import { describe, expect, it } from "vitest";
import {
  calculateAssessmentScore,
  buildParticipantData,
  formatAssessmentScore,
  validateAssessment,
  type AssessmentParticipantField,
  type AssessmentQuestion,
  type ResultBand,
} from "./assessments";

const questions: AssessmentQuestion[] = [
  {
    id: "q1",
    title: "Pergunta 1",
    text: "Enunciado 1",
    weight: 1,
    options: [
      { label: "Não", value: 0 },
      { label: "Sim", value: 4 },
    ],
  },
  {
    id: "q2",
    title: "Pergunta 2",
    text: "Enunciado 2",
    weight: 3,
    options: [
      { label: "Não", value: 0 },
      { label: "Sim", value: 2 },
    ],
  },
];
const result_bands: ResultBand[] = [
  { min: 0, max: 49, label: "Baixo", description: "", risk: "baixo" },
  { min: 50, max: 79, label: "Médio", description: "", risk: "moderado" },
  { min: 80, max: 100, label: "Alto", description: "", risk: "alto" },
];

describe("calculateAssessmentScore", () => {
  it("normalizes the weighted sum to 0–100 using each question's maximum", () => {
    const result = calculateAssessmentScore(
      { questions, result_bands, scoring: { method: "weighted_sum" } },
      [1, 1],
    );
    expect(result.raw).toBe(10);
    expect(result.max).toBe(10);
    expect(result.score).toBe(100);
    expect(result.band.label).toBe("Alto");
  });

  it("calculates an unweighted sum independently of question weights", () => {
    const result = calculateAssessmentScore(
      { questions, result_bands, scoring: { method: "sum" } },
      [1, 0],
    );
    expect(result.score).toBe(67);
  });

  it("rejects incomplete or invalid answers", () => {
    expect(() =>
      calculateAssessmentScore({ questions, result_bands, scoring: { method: "average" } }, [1]),
    ).toThrow("Responda todas as perguntas");
    expect(() =>
      calculateAssessmentScore({ questions, result_bands, scoring: { method: "average" } }, [2, 0]),
    ).toThrow("A resposta da pergunta 1 é inválida");
  });
});

describe("validateAssessment", () => {
  it("requires result bands to cover the full scale without gaps", () => {
    const error = validateAssessment({
      slug: "teste",
      title: "Teste",
      questions,
      participant_name_label: "Nome",
      participant_fields: [],
      scoring: { method: "average" },
      result_bands: [
        { min: 0, max: 49, label: "Baixo", description: "", risk: "baixo" },
        { min: 51, max: 100, label: "Alto", description: "", risk: "alto" },
      ],
    });
    expect(error).toBe("As faixas devem ser contínuas, sem lacunas ou sobreposições.");
  });

  it("supports a full-range result without automatic risk classification", () => {
    const error = validateAssessment({
      slug: "rastreio-tea-infantil",
      title: "Rastreio de indicativos de TEA infantil",
      questions,
      participant_name_label: "Nome da criança",
      participant_fields: [],
      scoring: { method: "sum" },
      result_bands: [
        {
          min: 0,
          max: 100,
          label: "Rastreio orientativo sem classificação automática",
          description: "",
          risk: "sem_classificacao",
        },
      ],
    });
    expect(error).toBeNull();
  });

  it("calculates a two-decimal 0–100 mean and selects the matching band", () => {
    const twelveQuestions: AssessmentQuestion[] = Array.from({ length: 12 }, (_, index) => ({
      id: `q${index + 1}`,
      title: `Pergunta ${index + 1}`,
      text: `Enunciado ${index + 1}`,
      weight: 1,
      category: "Comunicação social",
      options: [
        { label: "Nunca", value: 0 },
        { label: "Raramente", value: 25 },
        { label: "Às vezes", value: 50 },
        { label: "Frequentemente", value: 75 },
        { label: "Muito frequentemente", value: 100 },
      ],
    }));
    const bands: ResultBand[] = [
      { min: 0, max: 19, label: "Baixos indicativos", description: "", risk: "sem_classificacao" },
      { min: 20, max: 39, label: "Indicativos leves", description: "", risk: "sem_classificacao" },
      {
        min: 40,
        max: 59,
        label: "Indicativos moderados",
        description: "",
        risk: "sem_classificacao",
      },
      {
        min: 60,
        max: 79,
        label: "Indicativos elevados",
        description: "",
        risk: "sem_classificacao",
      },
      {
        min: 80,
        max: 100,
        label: "Indicativos muito elevados",
        description: "",
        risk: "sem_classificacao",
      },
    ];
    const result = calculateAssessmentScore(
      {
        questions: twelveQuestions,
        result_bands: bands,
        scoring: { method: "sum", decimalPlaces: 2 },
      },
      [4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0],
    );

    expect(result.raw).toBe(700);
    expect(result.max).toBe(1200);
    expect(result.score).toBe(58.33);
    expect(result.band.label).toBe("Indicativos moderados");
    expect(result.breakdown["Comunicação social"]).toBe(58.33);
    expect(formatAssessmentScore(result.score)).toBe("58,33");

    const nearUpperBoundary = calculateAssessmentScore(
      {
        questions: twelveQuestions,
        result_bands: bands,
        scoring: { method: "sum", decimalPlaces: 2 },
      },
      [4, 4, 4, 4, 1, 1, 1, 0, 0, 0, 0, 0],
    );
    expect(nearUpperBoundary.score).toBe(39.58);
    expect(nearUpperBoundary.band.label).toBe("Indicativos leves");
  });

  it("normalizes configured participant values and enforces numeric limits", () => {
    const fields: AssessmentParticipantField[] = [
      {
        id: "age",
        label: "Idade (anos)",
        type: "number",
        required: true,
        min: 0,
        max: 18,
      },
    ];
    expect(buildParticipantData(fields, { age: "7" })).toEqual({ age: 7 });
    expect(() => buildParticipantData(fields, { age: "19" })).toThrow(
      'O campo "Idade (anos)" está fora dos limites permitidos.',
    );
    expect(() => buildParticipantData(fields, {})).toThrow('Preencha o campo "Idade (anos)".');
  });

  it("validates configured selections and omits blank optional fields", () => {
    const fields: AssessmentParticipantField[] = [
      {
        id: "relationship",
        label: "Parentesco",
        type: "select",
        required: true,
        options: ["Mãe", "Pai", "Outro"],
      },
      { id: "school", label: "Escola", type: "text", required: false },
    ];
    expect(buildParticipantData(fields, { relationship: "Mãe", school: "" })).toEqual({
      relationship: "Mãe",
    });
    expect(() => buildParticipantData(fields, { relationship: "Responsável" })).toThrow(
      'Selecione uma opção válida para "Parentesco".',
    );
  });
});
