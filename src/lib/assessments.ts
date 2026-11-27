import type { Json, Tables } from "@/integrations/supabase/types";

export type AssessmentRisk = "baixo" | "moderado" | "alto" | "sem_classificacao";
export type ScoringMethod = "sum" | "weighted_sum" | "average";

export type AssessmentOption = { label: string; value: number };
export type ParticipantFieldType = "text" | "number" | "select";
export type AssessmentParticipantField = {
  id: string;
  label: string;
  type: ParticipantFieldType;
  required: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: string[];
};
export type ParticipantData = Record<string, string | number>;
export type AssessmentQuestion = {
  id: string;
  title: string;
  text: string;
  weight: number;
  category?: string;
  options: AssessmentOption[];
};
export type ResultBand = {
  min: number;
  max: number;
  label: string;
  description: string;
  risk: AssessmentRisk;
};
export type ScoringConfig = {
  method: ScoringMethod;
  decimalPlaces?: 0 | 2;
  resultLabel?: string;
};

export type Assessment = Omit<
  Tables<"assessments">,
  "questions" | "participant_fields" | "result_bands" | "scoring"
> & {
  questions: AssessmentQuestion[];
  participant_fields: AssessmentParticipantField[];
  result_bands: ResultBand[];
  scoring: ScoringConfig;
};

export type AssessmentAnswer = {
  questionId: string;
  title: string;
  question: string;
  answer: string;
  value: number;
  maxValue: number;
  weight: number;
  category?: string;
};

export type AssessmentScore = {
  raw: number;
  max: number;
  score: number;
  band: ResultBand;
  breakdown: Record<string, number>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isRisk(value: unknown): value is AssessmentRisk {
  return (
    value === "baixo" || value === "moderado" || value === "alto" || value === "sem_classificacao"
  );
}

function parseQuestion(value: unknown): AssessmentQuestion | null {
  if (!isRecord(value) || !Array.isArray(value["options"])) return null;
  const { id, title, text, weight, options } = value;
  const category = value["category"];
  if (
    typeof id !== "string" ||
    typeof title !== "string" ||
    typeof text !== "string" ||
    typeof weight !== "number" ||
    !Number.isFinite(weight) ||
    weight <= 0
  ) {
    return null;
  }
  const parsedOptions = options.map((option): AssessmentOption | null => {
    if (!isRecord(option)) return null;
    const label = option["label"];
    const score = option["value"];
    return typeof label === "string" &&
      typeof score === "number" &&
      Number.isFinite(score) &&
      score >= 0 &&
      score <= 100
      ? { label, value: score }
      : null;
  });
  if (parsedOptions.length < 2 || parsedOptions.some((option) => option === null)) return null;
  if (category !== undefined && typeof category !== "string") return null;
  return {
    id,
    title,
    text,
    weight,
    ...(typeof category === "string" && category.trim() ? { category } : {}),
    options: parsedOptions as AssessmentOption[],
  };
}

function parseParticipantField(value: unknown): AssessmentParticipantField | null {
  if (!isRecord(value)) return null;
  const { id, label, type, required, placeholder, min, max, options } = value;
  if (
    typeof id !== "string" ||
    !id.trim() ||
    typeof label !== "string" ||
    !label.trim() ||
    (type !== "text" && type !== "number" && type !== "select") ||
    typeof required !== "boolean" ||
    (placeholder !== undefined && typeof placeholder !== "string")
  ) {
    return null;
  }
  if (
    type === "number" &&
    ((min !== undefined && (typeof min !== "number" || !Number.isFinite(min))) ||
      (max !== undefined && (typeof max !== "number" || !Number.isFinite(max))) ||
      (typeof min === "number" && typeof max === "number" && min > max))
  ) {
    return null;
  }
  if (
    type === "select" &&
    (!Array.isArray(options) ||
      options.length < 2 ||
      options.some((option) => typeof option !== "string" || !option.trim()) ||
      new Set(options).size !== options.length)
  ) {
    return null;
  }
  return {
    id,
    label,
    type,
    required,
    ...(typeof placeholder === "string" ? { placeholder } : {}),
    ...(type === "number" && typeof min === "number" ? { min } : {}),
    ...(type === "number" && typeof max === "number" ? { max } : {}),
    ...(type === "select" ? { options: options as string[] } : {}),
  };
}

function parseBand(value: unknown): ResultBand | null {
  if (!isRecord(value)) return null;
  const { min, max, label, description, risk } = value;
  if (
    typeof min !== "number" ||
    typeof max !== "number" ||
    min < 0 ||
    max > 100 ||
    min > max ||
    typeof label !== "string" ||
    typeof description !== "string" ||
    !isRisk(risk)
  ) {
    return null;
  }
  return { min, max, label, description, risk };
}

function parseScoring(value: unknown): ScoringConfig | null {
  if (!isRecord(value)) return null;
  const method = value["method"];
  const decimalPlaces = value["decimalPlaces"];
  const resultLabel = value["resultLabel"];
  if (
    (method !== "sum" && method !== "weighted_sum" && method !== "average") ||
    (decimalPlaces !== undefined && decimalPlaces !== 0 && decimalPlaces !== 2) ||
    (resultLabel !== undefined && typeof resultLabel !== "string")
  ) {
    return null;
  }
  return {
    method,
    ...(decimalPlaces === 0 || decimalPlaces === 2 ? { decimalPlaces } : {}),
    ...(typeof resultLabel === "string" ? { resultLabel } : {}),
  };
}

export function parseAssessment(row: Tables<"assessments">): Assessment {
  const questions = Array.isArray(row.questions) ? row.questions.map(parseQuestion) : [];
  const participantFields = Array.isArray(row.participant_fields)
    ? row.participant_fields.map(parseParticipantField)
    : [];
  const resultBands = Array.isArray(row.result_bands) ? row.result_bands.map(parseBand) : [];
  const scoring = parseScoring(row.scoring);
  if (
    questions.length === 0 ||
    questions.some((question) => question === null) ||
    participantFields.some((field) => field === null) ||
    !row.participant_name_label.trim() ||
    resultBands.length === 0 ||
    resultBands.some((band) => band === null) ||
    !scoring
  ) {
    throw new Error(`A avaliação "${row.title}" tem uma configuração inválida.`);
  }
  return {
    ...row,
    questions: questions as AssessmentQuestion[],
    participant_fields: participantFields as AssessmentParticipantField[],
    result_bands: resultBands as ResultBand[],
    scoring,
  };
}

export function validateAssessment(
  assessment: Pick<
    Assessment,
    | "slug"
    | "title"
    | "questions"
    | "participant_fields"
    | "participant_name_label"
    | "result_bands"
    | "scoring"
  >,
): string | null {
  if (
    (assessment.scoring.decimalPlaces !== undefined &&
      assessment.scoring.decimalPlaces !== 0 &&
      assessment.scoring.decimalPlaces !== 2) ||
    (assessment.scoring.resultLabel !== undefined && assessment.scoring.resultLabel.length > 120)
  ) {
    return "Revise as configurações de exibição do resultado.";
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(assessment.slug)) {
    return "O endereço deve conter apenas letras minúsculas, números e hífens.";
  }
  if (!assessment.title.trim() || assessment.title.length > 120) {
    return "Informe um título com até 120 caracteres.";
  }
  if (!assessment.participant_name_label.trim() || assessment.participant_name_label.length > 120) {
    return "Informe o rótulo do nome do participante, com até 120 caracteres.";
  }
  if (assessment.questions.length === 0) return "Adicione pelo menos uma pergunta.";
  if (!parseScoring(assessment.scoring)) return "Selecione uma fórmula de pontuação válida.";

  for (const [index, question] of assessment.questions.entries()) {
    if (!question.title.trim() || !question.text.trim()) {
      return `Preencha o título e o enunciado da pergunta ${index + 1}.`;
    }
    if (
      question.weight <= 0 ||
      !Number.isFinite(question.weight) ||
      question.options.length < 2 ||
      question.options.some(
        (option) =>
          !option.label.trim() ||
          !Number.isFinite(option.value) ||
          option.value < 0 ||
          option.value > 100,
      )
    ) {
      return `Revise as opções e o peso da pergunta ${index + 1}.`;
    }
  }

  const fieldIds = new Set<string>();
  for (const [index, field] of assessment.participant_fields.entries()) {
    if (!field.id.trim() || fieldIds.has(field.id) || !field.label.trim()) {
      return `Revise o nome e o identificador do campo adicional ${index + 1}.`;
    }
    fieldIds.add(field.id);
    if (field.type === "number") {
      if (
        (field.min !== undefined && !Number.isFinite(field.min)) ||
        (field.max !== undefined && !Number.isFinite(field.max)) ||
        (field.min !== undefined && field.max !== undefined && field.min > field.max)
      ) {
        return `Revise os limites numéricos do campo "${field.label}".`;
      }
    }
    if (
      field.type === "select" &&
      (!field.options ||
        field.options.length < 2 ||
        field.options.some((option) => !option.trim()) ||
        new Set(field.options).size !== field.options.length)
    ) {
      return `Adicione pelo menos duas opções válidas ao campo "${field.label}".`;
    }
  }

  const bands = [...assessment.result_bands].sort((a, b) => a.min - b.min);
  if (bands.length === 0 || bands[0]?.min !== 0 || bands.at(-1)?.max !== 100) {
    return "As faixas precisam cobrir toda a pontuação de 0 a 100.";
  }
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index]!;
    if (
      band.min > band.max ||
      !band.label.trim() ||
      !isRisk(band.risk) ||
      (index > 0 && band.min !== bands[index - 1]!.max + 1)
    ) {
      return "As faixas devem ser contínuas, sem lacunas ou sobreposições.";
    }
  }
  return null;
}

export function buildParticipantData(
  fields: AssessmentParticipantField[],
  values: Record<string, string>,
): ParticipantData {
  const data: ParticipantData = {};
  for (const field of fields) {
    const rawValue = values[field.id]?.trim() ?? "";
    if (!rawValue) {
      if (field.required) throw new Error(`Preencha o campo "${field.label}".`);
      continue;
    }
    if (field.type === "number") {
      const value = Number(rawValue);
      if (
        !Number.isFinite(value) ||
        (field.min !== undefined && value < field.min) ||
        (field.max !== undefined && value > field.max)
      ) {
        throw new Error(`O campo "${field.label}" está fora dos limites permitidos.`);
      }
      data[field.id] = value;
    } else if (field.type === "select") {
      if (!field.options?.includes(rawValue)) {
        throw new Error(`Selecione uma opção válida para "${field.label}".`);
      }
      data[field.id] = rawValue;
    } else {
      data[field.id] = rawValue;
    }
  }
  return data;
}

export function calculateAssessmentScore(
  assessment: Pick<Assessment, "questions" | "scoring" | "result_bands">,
  selectedOptionIndexes: number[],
): AssessmentScore {
  if (selectedOptionIndexes.length !== assessment.questions.length) {
    throw new Error("Responda todas as perguntas antes de calcular o resultado.");
  }

  const selected = assessment.questions.map((question, index) => {
    const option = question.options[selectedOptionIndexes[index]!];
    if (!option) throw new Error(`A resposta da pergunta ${index + 1} é inválida.`);
    return { question, option };
  });

  let raw: number;
  let max: number;
  let score: number;
  const roundScore = (value: number) => {
    const decimalPlaces = assessment.scoring.decimalPlaces ?? 0;
    return decimalPlaces === 2 ? Number(value.toFixed(2)) : Math.round(value);
  };
  const breakdown: Record<string, number> = {};
  switch (assessment.scoring.method) {
    case "sum":
      raw = selected.reduce((sum, item) => sum + item.option.value, 0);
      max = selected.reduce(
        (sum, item) => sum + Math.max(...item.question.options.map((option) => option.value)),
        0,
      );
      score = max > 0 ? roundScore((raw / max) * 100) : 0;
      break;
    case "weighted_sum":
      raw = selected.reduce((sum, item) => sum + item.option.value * item.question.weight, 0);
      max = selected.reduce(
        (sum, item) =>
          sum +
          Math.max(...item.question.options.map((option) => option.value)) * item.question.weight,
        0,
      );
      score = max > 0 ? roundScore((raw / max) * 100) : 0;
      break;
    case "average":
      raw =
        selected.reduce((sum, item) => {
          const questionMax = Math.max(...item.question.options.map((option) => option.value));
          return sum + (questionMax > 0 ? (item.option.value / questionMax) * 100 : 0);
        }, 0) / selected.length;
      max = 100;
      score = roundScore(raw);
      break;
  }

  const categories = new Map<string, { raw: number; max: number }>();
  for (const { question, option } of selected) {
    if (!question.category) continue;
    const category = categories.get(question.category) ?? { raw: 0, max: 0 };
    const weight = assessment.scoring.method === "weighted_sum" ? question.weight : 1;
    category.raw += option.value * weight;
    category.max += Math.max(...question.options.map((candidate) => candidate.value)) * weight;
    categories.set(question.category, category);
  }
  for (const [category, values] of categories) {
    breakdown[category] = values.max > 0 ? roundScore((values.raw / values.max) * 100) : 0;
  }

  // Whole-number thresholds classify decimal scores by their lower integer value.
  const bandScore = Math.floor(score);
  const band = assessment.result_bands.find(
    (candidate) => bandScore >= candidate.min && bandScore <= candidate.max,
  );
  if (!band) throw new Error("A pontuação não corresponde a nenhuma faixa de resultado.");
  return { raw, max, score, band, breakdown };
}

export function formatAssessmentScore(score: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(score);
}

export function buildAssessmentAnswers(
  assessment: Pick<Assessment, "questions">,
  selectedOptionIndexes: number[],
): AssessmentAnswer[] {
  if (selectedOptionIndexes.length !== assessment.questions.length) {
    throw new Error("O número de respostas não corresponde às perguntas.");
  }
  return assessment.questions.map((question, index) => {
    const option = question.options[selectedOptionIndexes[index]!];
    if (!option) throw new Error(`A resposta da pergunta ${index + 1} é inválida.`);
    return {
      questionId: question.id,
      title: question.title,
      question: question.text,
      answer: option.label,
      value: option.value,
      maxValue: Math.max(...question.options.map((candidate) => candidate.value)),
      weight: question.weight,
      ...(question.category ? { category: question.category } : {}),
    };
  });
}

export function assessmentSnapshot(assessment: Assessment): Json {
  return {
    id: assessment.id,
    slug: assessment.slug,
    title: assessment.title,
    version: assessment.version,
    participant_name_label: assessment.participant_name_label,
    participant_name_required: assessment.participant_name_required,
    participant_fields: assessment.participant_fields.map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      required: field.required,
      placeholder: field.placeholder ?? "",
      min: field.min ?? null,
      max: field.max ?? null,
      options: field.options ?? [],
    })),
    questions: assessment.questions.map((question) => ({
      id: question.id,
      title: question.title,
      text: question.text,
      weight: question.weight,
      category: question.category ?? "",
      options: question.options.map((option) => ({
        label: option.label,
        value: option.value,
      })),
    })),
    scoring: { method: assessment.scoring.method },
    result_bands: assessment.result_bands.map((band) => ({
      min: band.min,
      max: band.max,
      label: band.label,
      description: band.description,
      risk: band.risk,
    })),
  };
}
