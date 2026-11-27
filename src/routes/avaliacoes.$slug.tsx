import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  Download,
  Info,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { getPublishedAssessment } from "@/integrations/supabase/assessments.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  assessmentSnapshot,
  buildParticipantData,
  buildAssessmentAnswers,
  calculateAssessmentScore,
  formatAssessmentScore,
  type Assessment,
  type AssessmentScore,
} from "@/lib/assessments";
import { downloadPdf } from "@/lib/pdf";
import { CONFIG } from "@/config";

export const Route = createFileRoute("/avaliacoes/$slug")({
  ssr: false,
  component: AssessmentFlow,
});

type Stage = "welcome" | "quiz" | "result";
type ParticipantForm = {
  name: string;
  email: string;
  phone: string;
  consent: boolean;
  participantData: Record<string, string>;
};
const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
  transition: { duration: 0.3 },
};
const input =
  "w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function AssessmentFlow() {
  const { slug } = Route.useParams();
  const assessmentQuery = useQuery({
    queryKey: ["assessment", slug],
    queryFn: () => getPublishedAssessment(slug),
  });
  const assessment = assessmentQuery.data;
  const [stage, setStage] = useState<Stage>("welcome");
  const [form, setForm] = useState<ParticipantForm>({
    name: "",
    email: "",
    phone: "",
    consent: false,
    participantData: {},
  });
  const [answers, setAnswers] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<AssessmentScore | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async (
    currentAssessment: Assessment,
    finalAnswers: number[],
    score: AssessmentScore,
  ) => {
    setSaving(true);
    setSaveError(null);
    try {
      const { error } = await supabase.from("triagens").insert({
        assessment_id: currentAssessment.id,
        assessment_title: currentAssessment.title,
        assessment_version: currentAssessment.version,
        assessment_snapshot: assessmentSnapshot(currentAssessment),
        patient_name: form.name.trim(),
        patient_email: form.email.trim(),
        patient_whatsapp: form.phone.trim(),
        participant_data: buildParticipantData(
          currentAssessment.participant_fields,
          form.participantData,
        ),
        lgpd_consent: form.consent,
        answers: buildAssessmentAnswers(currentAssessment, finalAnswers),
        total_score: score.score,
        score_raw: score.raw,
        score_max: score.max,
        score_0_100: score.score,
        score_breakdown: score.breakdown,
        result_band: score.band.label,
        risk_level: score.band.risk,
        inattention_score: score.breakdown["Desatenção"] ?? null,
        hyperactivity_score: score.breakdown["Hiperatividade/Impulsividade"] ?? null,
      });
      if (error) throw error;
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar suas respostas. Tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  };

  const choose = (optionIndex: number) => {
    if (!assessment || picked !== null) return;
    setSaveError(null);
    setPicked(optionIndex);
    window.setTimeout(() => {
      const next = [...answers];
      next[step] = optionIndex;
      setAnswers(next);
      setPicked(null);
      if (step < assessment.questions.length - 1) {
        setStep(step + 1);
        return;
      }

      try {
        const score = calculateAssessmentScore(assessment, next);
        setResult(score);
        setStage("result");
        void save(assessment, next, score);
      } catch (error) {
        setSaveError(
          error instanceof Error ? error.message : "Não foi possível calcular o resultado.",
        );
        setStage("quiz");
      }
    }, 250);
  };

  const restart = () => {
    setAnswers([]);
    setStep(0);
    setPicked(null);
    setResult(null);
    setSaveError(null);
    setStage("welcome");
  };

  if (assessmentQuery.isLoading) {
    return (
      <main className="mx-auto max-w-xl p-8 text-center text-muted-foreground">
        Carregando avaliação…
      </main>
    );
  }
  if (assessmentQuery.error) {
    return (
      <main className="mx-auto max-w-xl p-8 text-center text-destructive">
        Não foi possível carregar esta avaliação.
      </main>
    );
  }
  if (!assessment) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Avaliação indisponível</h1>
        <p className="text-muted-foreground">
          Ela pode ter sido desativada ou o endereço está incorreto.
        </p>
        <Link to="/" className="text-primary underline">
          Ver avaliações disponíveis
        </Link>
      </main>
    );
  }

  const currentQuestion = assessment.questions[step];
  const whats = () => {
    if (!result) return;
    const message = `Olá! Meu nome é ${form.name || "(não informado)"}. Fiz a avaliação "${assessment.title}" e obtive ${formatAssessmentScore(result.score)}/100 (${result.band.label}). Gostaria de conversar com a equipe.`;
    window.open(
      `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-6">
      <header className="mb-8 flex justify-center">
        <div className="rounded-2xl bg-brand-navy px-4 py-2 shadow-soft">
          <img src={CONFIG.logoUrl} alt={CONFIG.clinicName} className="h-12 w-auto" />
        </div>
      </header>
      <AnimatePresence mode="wait">
        {stage === "welcome" && (
          <motion.section key="welcome" {...fade} className="flex flex-col gap-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                <Clock className="size-3.5" />
                {assessment.questions.length} perguntas
              </span>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                {assessment.title}
              </h1>
              {assessment.description && (
                <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                  {assessment.description}
                </p>
              )}
              {assessment.instructions && (
                <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                  {assessment.instructions}
                </p>
              )}
            </div>
            <form
              className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6"
              onSubmit={(event) => {
                event.preventDefault();
                setStage("quiz");
              }}
            >
              <p className="text-sm font-semibold">Seus dados</p>
              <label className="sr-only" htmlFor="patient-name">
                {assessment.participant_name_label}
              </label>
              <input
                id="patient-name"
                className={input}
                placeholder={assessment.participant_name_label}
                required={assessment.participant_name_required}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
              {assessment.participant_fields.map((field) => {
                const id = `participant-${field.id}`;
                const value = form.participantData[field.id] ?? "";
                const onChange = (nextValue: string) =>
                  setForm((current) => ({
                    ...current,
                    participantData: {
                      ...current.participantData,
                      [field.id]: nextValue,
                    },
                  }));
                return (
                  <label key={field.id} className="flex flex-col gap-1.5 text-sm font-medium">
                    {field.label}
                    {field.type === "select" ? (
                      <select
                        id={id}
                        className={input}
                        required={field.required}
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                      >
                        <option value="">Selecione…</option>
                        {field.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={id}
                        type={field.type}
                        className={input}
                        placeholder={field.placeholder}
                        required={field.required}
                        min={field.type === "number" ? field.min : undefined}
                        max={field.type === "number" ? field.max : undefined}
                        step={field.type === "number" ? "1" : undefined}
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                      />
                    )}
                  </label>
                );
              })}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sr-only" htmlFor="patient-email">
                  E-mail
                </label>
                <input
                  id="patient-email"
                  type="email"
                  className={input}
                  placeholder="E-mail"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
                <label className="sr-only" htmlFor="patient-phone">
                  WhatsApp
                </label>
                <input
                  id="patient-phone"
                  type="tel"
                  className={input}
                  placeholder="WhatsApp"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </div>
              <label className="flex cursor-pointer gap-3 py-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  required
                  className="mt-0.5 size-5 shrink-0 accent-primary"
                  checked={form.consent}
                  onChange={(event) => setForm({ ...form, consent: event.target.checked })}
                />
                <span>
                  Concordo em compartilhar as informações e respostas fornecidas com a equipe
                  clínica para fins de triagem.
                </span>
              </label>
              <button
                type="submit"
                className="rounded-full bg-primary py-4 text-lg font-bold text-primary-foreground transition hover:brightness-110"
              >
                Iniciar avaliação
              </button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 text-primary" /> Seus dados são tratados com sigilo
              </p>
            </form>
            <div className="flex gap-3 rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
              <Info className="size-5 shrink-0" />
              Esta avaliação é uma ferramenta de triagem e não substitui um diagnóstico
              profissional.
            </div>
            <Link
              to="/"
              className="mx-auto flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> Todas as avaliações
            </Link>
          </motion.section>
        )}

        {stage === "quiz" && currentQuestion && (
          <motion.section key={`question-${step}`} {...fade} className="flex flex-col gap-5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => (step ? setStep(step - 1) : setStage("welcome"))}
                className="flex min-h-11 items-center gap-1 hover:text-foreground"
              >
                <ArrowLeft className="size-4" /> Voltar
              </button>
              <span>
                Pergunta {step + 1} de {assessment.questions.length}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${((step + 1) / assessment.questions.length) * 100}%` }}
              />
            </div>
            <p className="mt-4 text-xs font-bold tracking-[0.2em] text-primary uppercase">
              {currentQuestion.title}
            </p>
            <h2 className="text-xl font-bold leading-snug sm:text-2xl">{currentQuestion.text}</h2>
            {saveError && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {saveError}
              </p>
            )}
            <div className="flex flex-col gap-3">
              {currentQuestion.options.map((option, optionIndex) => {
                const isSelected =
                  picked === optionIndex || (picked === null && answers[step] === optionIndex);
                return (
                  <button
                    key={`${option.label}-${optionIndex}`}
                    type="button"
                    onClick={() => choose(optionIndex)}
                    disabled={picked !== null}
                    className={`flex items-center gap-4 rounded-2xl border p-5 text-left text-base font-semibold shadow-soft transition ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary"
                    }`}
                  >
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-full text-sm ${
                        isSelected
                          ? "bg-primary-foreground text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {optionIndex + 1}
                    </span>
                    {option.label}
                  </button>
                );
              })}
            </div>
          </motion.section>
        )}

        {stage === "result" && result && (
          <motion.section key="result" {...fade} className="flex flex-col gap-6">
            <p className="text-xs font-bold tracking-[0.25em] text-primary">
              RESULTADO DO RASTREIO
            </p>
            <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-end gap-2">
                <span className="text-6xl font-extrabold text-primary">
                  {formatAssessmentScore(result.score)}
                </span>
                <span className="pb-2 text-muted-foreground">
                  / 100 · {assessment.scoring.resultLabel?.trim() || "pontuação geral"}
                </span>
              </div>
              <div className="relative mt-5 h-3 rounded-full bg-muted">
                <div
                  className="absolute -top-1.5 size-6 -translate-x-1/2 rounded-full border-4 border-card bg-foreground"
                  style={{ left: `${result.score}%` }}
                />
              </div>
              <h2 className="mt-6 text-2xl font-bold">{result.band.label}</h2>
              <p className="mt-2 leading-relaxed whitespace-pre-line text-muted-foreground">
                {result.band.description}
              </p>
            </div>
            {Object.entries(result.breakdown).length > 0 && (
              <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                <h2 className="text-lg font-bold">Escores por domínio</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Os escores por domínio ajudam a observar diferenças que a média geral pode não
                  evidenciar. São orientativos e não geram classificação automática.
                </p>
                <div className="mt-4 flex flex-col gap-4">
                  {Object.entries(result.breakdown).map(([category, score]) => (
                    <div key={category}>
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="font-medium">{category}</span>
                        <span className="font-semibold">{formatAssessmentScore(score)}/100</span>
                      </div>
                      <div className="mt-1.5 h-2.5 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {saving && <p className="text-sm text-muted-foreground">Salvando suas respostas…</p>}
            {saveError && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {saveError}
              </p>
            )}
            {!saving && !saveError && (
              <p className="text-sm text-muted-foreground">Respostas registradas.</p>
            )}
            <p className="flex gap-3 text-sm text-muted-foreground">
              <Info className="size-5 shrink-0 text-primary" />
              Este resultado é uma triagem inicial e não substitui uma avaliação profissional.
            </p>
            <button
              type="button"
              onClick={whats}
              className="flex items-center justify-center gap-2 rounded-full bg-primary py-4 text-base font-bold text-primary-foreground hover:brightness-110"
            >
              <MessageCircle className="size-5" /> Conversar com a equipe
            </button>
            <button
              type="button"
              onClick={() =>
                void downloadPdf(
                  form.name,
                  assessment,
                  buildAssessmentAnswers(assessment, answers),
                  result,
                  form.participantData,
                )
              }
              className="flex items-center justify-center gap-2 rounded-full bg-secondary py-4 text-base font-bold text-secondary-foreground hover:brightness-95"
            >
              <Download className="size-5" /> Baixar resumo em PDF
            </button>
            <button
              type="button"
              onClick={restart}
              className="mx-auto flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-4" /> Refazer avaliação
            </button>
          </motion.section>
        )}
      </AnimatePresence>
      <footer className="mt-auto pt-10 text-center text-xs text-muted-foreground">
        {CONFIG.clinicName}
      </footer>
    </main>
  );
}
