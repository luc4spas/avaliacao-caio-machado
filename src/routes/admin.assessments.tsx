import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import {
  listAssessments,
  saveAssessment,
  type AssessmentDraft,
} from "@/integrations/supabase/assessments.functions";
import {
  validateAssessment,
  type Assessment,
  type AssessmentParticipantField,
  type ParticipantFieldType,
  type AssessmentQuestion,
  type ResultBand,
} from "@/lib/assessments";

export const Route = createFileRoute("/admin/assessments")({ component: AssessmentManager });

const control =
  "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const textArea =
  "min-h-24 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível salvar a avaliação.";
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function createId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function createQuestion(): AssessmentQuestion {
  const id = createId();
  return {
    id,
    title: "",
    text: "",
    weight: 1,
    options: [
      { label: "Nunca", value: 0 },
      { label: "Raramente", value: 25 },
      { label: "Às vezes", value: 50 },
      { label: "Frequentemente", value: 75 },
      { label: "Muito frequentemente", value: 100 },
    ],
  };
}

function createParticipantField(): AssessmentParticipantField {
  return {
    id: createId(),
    label: "",
    type: "text",
    required: false,
  };
}

function changeParticipantFieldType(
  field: AssessmentParticipantField,
  type: ParticipantFieldType,
): AssessmentParticipantField {
  const updated = { ...field, type };
  if (type === "select") {
    updated.options = field.options?.length ? field.options : ["Sim", "Não"];
    delete updated.min;
    delete updated.max;
  } else {
    delete updated.options;
    if (type === "text") {
      delete updated.min;
      delete updated.max;
    }
  }
  return updated;
}

function changeParticipantFieldBound(
  field: AssessmentParticipantField,
  bound: "min" | "max",
  rawValue: string,
): AssessmentParticipantField {
  const updated = { ...field };
  if (rawValue === "") delete updated[bound];
  else updated[bound] = Number(rawValue);
  return updated;
}

function createDraft(): AssessmentDraft {
  return {
    slug: "",
    title: "",
    description: "",
    instructions: "",
    status: "draft",
    participant_name_label: "Nome completo",
    participant_name_required: false,
    participant_fields: [],
    questions: [createQuestion()],
    scoring: { method: "weighted_sum" },
    result_bands: [
      { min: 0, max: 33, label: "Faixa inicial", description: "", risk: "baixo" },
      { min: 34, max: 66, label: "Faixa intermediária", description: "", risk: "moderado" },
      { min: 67, max: 100, label: "Faixa superior", description: "", risk: "alto" },
    ],
  };
}

function AssessmentManager() {
  const { role } = useRouteContext({ from: "/admin" });
  const queryClient = useQueryClient();
  const assessmentsQuery = useQuery({
    queryKey: ["assessments"],
    queryFn: listAssessments,
    enabled: role === "admin" && typeof window !== "undefined",
  });
  const [selected, setSelected] = useState<Assessment | null>(null);
  const [draft, setDraft] = useState<AssessmentDraft | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error("Nenhuma avaliação selecionada.");
      const error = validateAssessment(draft);
      if (error) throw new Error(error);
      await saveAssessment(draft, selected ?? undefined);
    },
    onSuccess: async () => {
      setFeedback("Avaliação salva.");
      setDraft(null);
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ["assessments"] });
    },
    onError: (error) => setFeedback(getErrorMessage(error)),
  });

  const startNew = () => {
    setSelected(null);
    setDraft(createDraft());
    setFeedback(null);
    setSlugEdited(false);
  };

  const edit = (assessment: Assessment) => {
    setSelected(assessment);
    setDraft({
      slug: assessment.slug,
      title: assessment.title,
      description: assessment.description,
      instructions: assessment.instructions,
      status: assessment.status as AssessmentDraft["status"],
      participant_name_label: assessment.participant_name_label,
      participant_name_required: assessment.participant_name_required,
      participant_fields: assessment.participant_fields.map((field) => ({
        ...field,
        ...(field.options ? { options: [...field.options] } : {}),
      })),
      questions: assessment.questions.map((question) => ({
        ...question,
        options: question.options.map((option) => ({ ...option })),
      })),
      scoring: { ...assessment.scoring },
      result_bands: assessment.result_bands.map((band) => ({ ...band })),
    });
    setFeedback(null);
    setSlugEdited(true);
  };

  const updateDraft = <K extends keyof AssessmentDraft>(key: K, value: AssessmentDraft[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateQuestion = (
    questionIndex: number,
    update: (question: AssessmentQuestion) => AssessmentQuestion,
  ) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            questions: current.questions.map((question, index) =>
              index === questionIndex ? update(question) : question,
            ),
          }
        : current,
    );
  };

  const moveQuestion = (index: number, offset: -1 | 1) => {
    setDraft((current) => {
      if (!current) return current;
      const target = index + offset;
      if (target < 0 || target >= current.questions.length) return current;
      const questions = [...current.questions];
      [questions[index], questions[target]] = [questions[target]!, questions[index]!];
      return { ...current, questions };
    });
  };

  const updateParticipantField = (
    fieldIndex: number,
    update: (field: AssessmentParticipantField) => AssessmentParticipantField,
  ) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            participant_fields: current.participant_fields.map((field, index) =>
              index === fieldIndex ? update(field) : field,
            ),
          }
        : current,
    );
  };

  const moveParticipantField = (index: number, offset: -1 | 1) => {
    setDraft((current) => {
      if (!current) return current;
      const target = index + offset;
      if (target < 0 || target >= current.participant_fields.length) return current;
      const participantFields = [...current.participant_fields];
      [participantFields[index], participantFields[target]] = [
        participantFields[target]!,
        participantFields[index]!,
      ];
      return { ...current, participant_fields: participantFields };
    });
  };

  const updateBand = (index: number, field: keyof ResultBand, value: string | number) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            result_bands: current.result_bands.map((band, bandIndex) =>
              bandIndex === index ? { ...band, [field]: value } : band,
            ),
          }
        : current,
    );
  };

  if (role !== "admin") {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-lg font-bold">Acesso restrito</h1>
        <p className="mt-1 text-muted-foreground">
          Somente administradores podem gerenciar avaliações.
        </p>
      </div>
    );
  }

  if (draft) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setSelected(null);
                setFeedback(null);
              }}
              className="mb-2 flex min-h-9 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> Voltar às avaliações
            </button>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {selected ? "Editar avaliação" : "Nova avaliação"}
            </h1>
          </div>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => {
              setFeedback(null);
              save.mutate();
            }}
            className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            <Save className="size-4" />
            {save.isPending ? "Salvando…" : "Salvar avaliação"}
          </button>
        </header>

        {feedback && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {feedback}
          </p>
        )}

        <section className="grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Título
            <input
              className={control}
              maxLength={120}
              value={draft.title}
              onChange={(event) => {
                const title = event.target.value;
                updateDraft("title", title);
                if (!slugEdited) updateDraft("slug", slugify(title));
              }}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Endereço (slug)
            <input
              className={control}
              value={draft.slug}
              onChange={(event) => {
                setSlugEdited(true);
                updateDraft("slug", slugify(event.target.value));
              }}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium md:col-span-2">
            Resumo
            <textarea
              className={textArea}
              value={draft.description}
              onChange={(event) => updateDraft("description", event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium md:col-span-2">
            Instruções
            <textarea
              className={textArea}
              value={draft.instructions}
              onChange={(event) => updateDraft("instructions", event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Publicação
            <select
              className={control}
              value={draft.status}
              onChange={(event) =>
                updateDraft("status", event.target.value as AssessmentDraft["status"])
              }
            >
              <option value="draft">Rascunho</option>
              <option value="published">Publicado</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Fórmula de pontuação
            <select
              className={control}
              value={draft.scoring.method}
              onChange={(event) =>
                updateDraft("scoring", {
                  ...draft.scoring,
                  method: event.target.value as AssessmentDraft["scoring"]["method"],
                })
              }
            >
              <option value="sum">Soma normalizada</option>
              <option value="weighted_sum">Soma ponderada normalizada</option>
              <option value="average">Média normalizada</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Rótulo do índice
            <input
              className={control}
              maxLength={120}
              value={draft.scoring.resultLabel ?? ""}
              onChange={(event) =>
                updateDraft("scoring", { ...draft.scoring, resultLabel: event.target.value })
              }
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Casas decimais
            <select
              className={control}
              value={draft.scoring.decimalPlaces ?? 0}
              onChange={(event) => {
                const decimalPlaces = Number(event.target.value);
                if (decimalPlaces === 0 || decimalPlaces === 2) {
                  updateDraft("scoring", {
                    ...draft.scoring,
                    decimalPlaces,
                  });
                }
              }}
            >
              <option value={0}>0</option>
              <option value={2}>2</option>
            </select>
          </label>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <div>
            <h2 className="text-lg font-bold">Dados do participante</h2>
            <p className="text-sm text-muted-foreground">
              Configure o nome e os dados adicionais solicitados antes do questionário.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Rótulo do nome
              <input
                className={control}
                maxLength={120}
                value={draft.participant_name_label}
                onChange={(event) => updateDraft("participant_name_label", event.target.value)}
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={draft.participant_name_required}
                onChange={(event) => updateDraft("participant_name_required", event.target.checked)}
                className="size-4 accent-primary"
              />
              Solicitar o nome obrigatoriamente
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold">Campos adicionais</h3>
              <p className="text-sm text-muted-foreground">
                Exemplo: idade da criança, série escolar ou parentesco do responsável.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                updateDraft("participant_fields", [
                  ...draft.participant_fields,
                  createParticipantField(),
                ])
              }
              className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted"
            >
              <Plus className="size-4" /> Adicionar campo
            </button>
          </div>

          {draft.participant_fields.map((field, index) => (
            <article
              key={field.id}
              className="flex flex-col gap-3 rounded-xl border border-border p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold">Campo {index + 1}</h4>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`Mover campo ${index + 1} para cima`}
                    disabled={index === 0}
                    onClick={() => moveParticipantField(index, -1)}
                    className="grid size-9 place-items-center rounded-lg hover:bg-muted disabled:opacity-40"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Mover campo ${index + 1} para baixo`}
                    disabled={index === draft.participant_fields.length - 1}
                    onClick={() => moveParticipantField(index, 1)}
                    className="grid size-9 place-items-center rounded-lg hover:bg-muted disabled:opacity-40"
                  >
                    <ArrowDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover campo ${index + 1}`}
                    onClick={() =>
                      updateDraft(
                        "participant_fields",
                        draft.participant_fields.filter((item) => item.id !== field.id),
                      )
                    }
                    className="grid size-9 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex flex-col gap-1.5 text-sm font-medium md:col-span-2">
                  Rótulo
                  <input
                    className={control}
                    value={field.label}
                    onChange={(event) =>
                      updateParticipantField(index, (current) => ({
                        ...current,
                        label: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Tipo
                  <select
                    className={control}
                    value={field.type}
                    onChange={(event) => {
                      const type = event.target.value as ParticipantFieldType;
                      updateParticipantField(index, (current) =>
                        changeParticipantFieldType(current, type),
                      );
                    }}
                  >
                    <option value="text">Texto</option>
                    <option value="number">Número</option>
                    <option value="select">Seleção</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium md:col-span-2">
                  Texto de ajuda (opcional)
                  <input
                    className={control}
                    value={field.placeholder ?? ""}
                    onChange={(event) =>
                      updateParticipantField(index, (current) => ({
                        ...current,
                        placeholder: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) =>
                      updateParticipantField(index, (current) => ({
                        ...current,
                        required: event.target.checked,
                      }))
                    }
                    className="size-4 accent-primary"
                  />
                  Obrigatório
                </label>
                {field.type === "number" && (
                  <>
                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                      Mínimo (opcional)
                      <input
                        className={control}
                        type="number"
                        value={field.min ?? ""}
                        onChange={(event) =>
                          updateParticipantField(index, (current) =>
                            changeParticipantFieldBound(current, "min", event.target.value),
                          )
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                      Máximo (opcional)
                      <input
                        className={control}
                        type="number"
                        value={field.max ?? ""}
                        onChange={(event) =>
                          updateParticipantField(index, (current) =>
                            changeParticipantFieldBound(current, "max", event.target.value),
                          )
                        }
                      />
                    </label>
                  </>
                )}
                {field.type === "select" && (
                  <label className="flex flex-col gap-1.5 text-sm font-medium md:col-span-3">
                    Opções (uma por linha)
                    <textarea
                      className={textArea}
                      value={field.options?.join("\n") ?? ""}
                      onChange={(event) =>
                        updateParticipantField(index, (current) => ({
                          ...current,
                          options: event.target.value
                            .split("\n")
                            .map((option) => option.trim())
                            .filter(Boolean),
                        }))
                      }
                    />
                  </label>
                )}
              </div>
            </article>
          ))}
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">Perguntas e respostas</h2>
              <p className="text-sm text-muted-foreground">
                Os valores das opções devem ficar entre 0 e 100. O resultado final é normalizado.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateDraft("questions", [...draft.questions, createQuestion()])}
              className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted"
            >
              <Plus className="size-4" /> Adicionar pergunta
            </button>
          </div>

          {draft.questions.map((question, index) => (
            <article
              key={question.id}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold">Pergunta {index + 1}</h3>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`Mover pergunta ${index + 1} para cima`}
                    disabled={index === 0}
                    onClick={() => moveQuestion(index, -1)}
                    className="grid size-9 place-items-center rounded-lg hover:bg-muted disabled:opacity-40"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Mover pergunta ${index + 1} para baixo`}
                    disabled={index === draft.questions.length - 1}
                    onClick={() => moveQuestion(index, 1)}
                    className="grid size-9 place-items-center rounded-lg hover:bg-muted disabled:opacity-40"
                  >
                    <ArrowDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover pergunta ${index + 1}`}
                    disabled={draft.questions.length === 1}
                    onClick={() =>
                      updateDraft(
                        "questions",
                        draft.questions.filter((item) => item.id !== question.id),
                      )
                    }
                    className="grid size-9 place-items-center rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-40"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px]">
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Título curto
                  <input
                    className={control}
                    value={question.title}
                    onChange={(event) =>
                      updateQuestion(index, (item) => ({ ...item, title: event.target.value }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Categoria (opcional)
                  <input
                    className={control}
                    value={question.category ?? ""}
                    onChange={(event) =>
                      updateQuestion(index, (item) => ({
                        ...item,
                        category: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Peso
                  <input
                    className={control}
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={question.weight}
                    onChange={(event) =>
                      updateQuestion(index, (item) => ({
                        ...item,
                        weight: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Enunciado
                <textarea
                  className={textArea}
                  value={question.text}
                  onChange={(event) =>
                    updateQuestion(index, (item) => ({ ...item, text: event.target.value }))
                  }
                />
              </label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Opções e valores</h4>
                  <button
                    type="button"
                    onClick={() =>
                      updateQuestion(index, (item) => ({
                        ...item,
                        options: [...item.options, { label: "", value: 0 }],
                      }))
                    }
                    className="text-sm font-semibold text-primary"
                  >
                    Adicionar opção
                  </button>
                </div>
                {question.options.map((option, optionIndex) => (
                  <div
                    key={`${question.id}-${optionIndex}`}
                    className="grid grid-cols-[minmax(0,1fr)_100px_40px] gap-2"
                  >
                    <input
                      aria-label={`Opção ${optionIndex + 1} da pergunta ${index + 1}`}
                      className={control}
                      value={option.label}
                      onChange={(event) =>
                        updateQuestion(index, (item) => ({
                          ...item,
                          options: item.options.map((current, currentIndex) =>
                            currentIndex === optionIndex
                              ? { ...current, label: event.target.value }
                              : current,
                          ),
                        }))
                      }
                    />
                    <input
                      aria-label={`Pontuação da opção ${optionIndex + 1} da pergunta ${index + 1}`}
                      className={control}
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={option.value}
                      onChange={(event) =>
                        updateQuestion(index, (item) => ({
                          ...item,
                          options: item.options.map((current, currentIndex) =>
                            currentIndex === optionIndex
                              ? { ...current, value: Number(event.target.value) }
                              : current,
                          ),
                        }))
                      }
                    />
                    <button
                      type="button"
                      aria-label={`Remover opção ${optionIndex + 1} da pergunta ${index + 1}`}
                      disabled={question.options.length <= 2}
                      onClick={() =>
                        updateQuestion(index, (item) => ({
                          ...item,
                          options: item.options.filter(
                            (_, currentIndex) => currentIndex !== optionIndex,
                          ),
                        }))
                      }
                      className="grid size-10 place-items-center rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-40"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">Faixas de resultado</h2>
              <p className="text-sm text-muted-foreground">
                Configure intervalos contínuos que cubram de 0 a 100.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                updateDraft("result_bands", [
                  ...draft.result_bands,
                  { min: 0, max: 100, label: "", description: "", risk: "baixo" },
                ])
              }
              className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted"
            >
              <Plus className="size-4" /> Adicionar faixa
            </button>
          </div>
          {draft.result_bands.map((band, index) => (
            <div
              key={`band-${index}`}
              className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-[100px_100px_minmax(0,1fr)_150px_40px]"
            >
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Mínimo
                <input
                  className={control}
                  type="number"
                  min="0"
                  max="100"
                  value={band.min}
                  onChange={(event) => updateBand(index, "min", Number(event.target.value))}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Máximo
                <input
                  className={control}
                  type="number"
                  min="0"
                  max="100"
                  value={band.max}
                  onChange={(event) => updateBand(index, "max", Number(event.target.value))}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Nome da faixa
                <input
                  className={control}
                  value={band.label}
                  onChange={(event) => updateBand(index, "label", event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Categoria
                <select
                  className={control}
                  value={band.risk}
                  onChange={(event) => updateBand(index, "risk", event.target.value)}
                >
                  <option value="baixo">Baixo</option>
                  <option value="moderado">Moderado</option>
                  <option value="alto">Alto</option>
                  <option value="sem_classificacao">Sem classificação automática</option>
                </select>
              </label>
              <button
                type="button"
                aria-label={`Remover faixa ${index + 1}`}
                disabled={draft.result_bands.length <= 1}
                onClick={() =>
                  updateDraft(
                    "result_bands",
                    draft.result_bands.filter((_, bandIndex) => bandIndex !== index),
                  )
                }
                className="mt-4 grid size-10 place-items-center rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-40"
              >
                <Trash2 className="size-4" />
              </button>
              <label className="flex flex-col gap-1 text-xs font-semibold md:col-span-5">
                Texto do resultado
                <textarea
                  className={textArea}
                  value={band.description}
                  onChange={(event) => updateBand(index, "description", event.target.value)}
                />
              </label>
            </div>
          ))}
        </section>

        <details className="rounded-2xl border border-border bg-card p-5">
          <summary className="cursor-pointer font-semibold">Pré-visualizar perguntas</summary>
          <div className="mt-4 flex flex-col gap-4">
            {draft.questions.map((question, index) => (
              <div key={question.id}>
                <p className="text-xs font-bold uppercase text-primary">
                  Pergunta {index + 1} · {question.title || "Sem título"}
                </p>
                <p className="mt-1 font-medium">{question.text || "Enunciado da pergunta"}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {question.options.map((option) => option.label || "Opção").join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </details>

        <p className="text-sm text-muted-foreground">
          Confirme com a equipe clínica as opções, pontuações e faixas antes de publicar uma
          avaliação. A pontuação é uma ferramenta de triagem, não um diagnóstico.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Avaliações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie questionários, opções de resposta e resultados.
          </p>
        </div>
        <button
          type="button"
          onClick={startNew}
          className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          <Plus className="size-4" /> Nova avaliação
        </button>
      </header>

      {feedback && (
        <p role="status" className="rounded-xl border border-border bg-card p-3 text-sm">
          {feedback}
        </p>
      )}
      {assessmentsQuery.isLoading ? (
        <p className="text-muted-foreground">Carregando avaliações…</p>
      ) : assessmentsQuery.error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {getErrorMessage(assessmentsQuery.error)}
        </p>
      ) : assessmentsQuery.data?.length ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {assessmentsQuery.data.map((assessment) => (
            <article
              key={assessment.id}
              className="flex flex-col gap-3 border-b border-border p-5 last:border-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold">{assessment.title}</h2>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                    {assessment.status === "published"
                      ? "Publicado"
                      : assessment.status === "inactive"
                        ? "Inativo"
                        : "Rascunho"}
                  </span>
                  <span className="text-xs text-muted-foreground">v{assessment.version}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {assessment.description || "Sem resumo"} · {assessment.questions.length} perguntas
                  · /avaliacoes/{assessment.slug}
                </p>
              </div>
              <button
                type="button"
                onClick={() => edit(assessment)}
                className="h-10 shrink-0 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted"
              >
                Editar
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Nenhuma avaliação cadastrada.
        </p>
      )}
    </div>
  );
}
