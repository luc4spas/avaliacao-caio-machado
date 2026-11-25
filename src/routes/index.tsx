import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Clock, Download, Info, MessageCircle, RotateCcw, ShieldCheck } from "lucide-react";
import { CONFIG } from "@/config";
import { OPTIONS, QUESTIONS, getResult, scoreAnswers, buildAnswers } from "@/lib/quiz";
import { supabase } from "@/integrations/supabase/client";
import { downloadPdf } from "@/lib/pdf";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Autoavaliação de TDAH Adulto | Caio Machado" },
      { name: "description", content: "Questionário de triagem de indicativos de TDAH em adultos, em menos de 3 minutos." },
      { property: "og:title", content: "Autoavaliação de TDAH Adulto | Caio Machado" },
      { property: "og:description", content: "Triagem rápida de indicativos de TDAH em adultos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Stage = "welcome" | "quiz" | "result";
const fade = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -16 }, transition: { duration: 0.3 } };
const input = "w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function Index() {
  const [stage, setStage] = useState<Stage>("welcome");
  const [form, setForm] = useState({ name: "", email: "", phone: "", consent: false });
  const [answers, setAnswers] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const choose = (v: number) => {
    setPicked(v);
    setTimeout(() => {
      const next = [...answers]; next[step] = v; setAnswers(next); setPicked(null);
      if (step < QUESTIONS.length - 1) setStep(step + 1); else { setStage("result"); void save(next); }
    }, 300);
  };
  const save = async (final: number[]) => {
    const sc = scoreAnswers(final);
    const { error } = await supabase.from("triagens").insert({
      patient_name: form.name.trim(), patient_email: form.email.trim(), patient_whatsapp: form.phone.trim(),
      lgpd_consent: form.consent, answers: buildAnswers(final), total_score: sc.total,
      inattention_score: sc.inattention, hyperactivity_score: sc.hyperactivity, risk_level: sc.risk,
    });
    if (error) console.error("Falha ao salvar triagem", error);
  };
  const restart = () => { setAnswers([]); setStep(0); setStage("welcome"); };
  const score = answers.reduce((a, b) => a + b, 0);
  const res = getResult(score);
  const whats = () => {
    const msg = `Olá! Meu nome é ${form.name || "(não informado)"}. Fiz a triagem de TDAH adulto e obtive ${score}/40 pontos (${res.level}). Gostaria de agendar uma avaliação.`;
    window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-6">
      <header className="mb-8 flex justify-center"><div className="rounded-2xl bg-brand-navy px-4 py-2 shadow-soft"><img src={CONFIG.logoUrl} alt={CONFIG.clinicName} className="h-12 w-auto" /></div></header>
      <AnimatePresence mode="wait">
        {stage === "welcome" && (
          <motion.section key="w" {...fade} className="flex flex-col gap-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground"><Clock className="size-3.5" />Menos de 3 minutos</span>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Autoavaliação de Indicativos de <span className="text-primary">TDAH em Adultos</span></h1>
              <p className="mx-auto mt-3 max-w-md text-muted-foreground">Responda pensando na frequência dos comportamentos nos <strong className="text-foreground">últimos 6 meses</strong>. Uma pergunta por vez, no seu ritmo.</p>
            </div>
            <form className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6" onSubmit={(e) => { e.preventDefault(); setStage("quiz"); }}>
              <p className="text-sm font-semibold">Seus dados</p>
              <label className="sr-only" htmlFor="n">Nome completo</label>
              <input id="n" className={input} placeholder="Nome completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sr-only" htmlFor="e">E-mail</label>
                <input id="e" type="email" className={input} placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <label className="sr-only" htmlFor="p">WhatsApp</label>
                <input id="p" type="tel" className={input} placeholder="WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <label className="flex cursor-pointer gap-3 py-2 text-sm text-muted-foreground">
                <input type="checkbox" required className="mt-0.5 size-5 shrink-0 accent-primary" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
                <span>Concordo em compartilhar minhas respostas com a equipe clínica para fins de triagem.</span>
              </label>
              <button type="submit" className="rounded-full bg-primary py-4 text-lg font-bold text-primary-foreground transition hover:brightness-110">Iniciar Questionário</button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" />Seus dados são tratados com sigilo</p>
            </form>
            <div className="flex gap-3 rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground"><Info className="size-5 shrink-0" />Este questionário é uma ferramenta de triagem inicial e não substitui um diagnóstico médico ou psicológico.</div>
          </motion.section>
        )}

        {stage === "quiz" && (
          <motion.section key={`q${step}`} {...fade} className="flex flex-col gap-5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <button onClick={() => (step ? setStep(step - 1) : setStage("welcome"))} className="flex min-h-11 items-center gap-1 hover:text-foreground"><ArrowLeft className="size-4" />Voltar</button>
              <span>Pergunta {step + 1} de {QUESTIONS.length}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} /></div>
            <p className="mt-4 text-xs font-bold tracking-[0.2em] text-primary uppercase">{QUESTIONS[step]!.title}</p>
            <h2 className="text-xl font-bold leading-snug sm:text-2xl">{QUESTIONS[step]!.text}</h2>
            <div className="flex flex-col gap-3">
              {OPTIONS.map((o, v) => {
                const on = picked === v || (picked === null && answers[step] === v);
                return (
                  <button key={o} onClick={() => choose(v)} disabled={picked !== null}
                    className={`flex items-center gap-4 rounded-2xl border p-5 text-left shadow-soft text-base font-semibold transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary"}`}>
                    <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm ${on ? "bg-primary-foreground text-primary" : "bg-muted text-muted-foreground"}`}>{v}</span>{o}
                  </button>
                );
              })}
            </div>
          </motion.section>
        )}

        {stage === "result" && (
          <motion.section key="r" {...fade} className="flex flex-col gap-6">
            <p className="text-xs font-bold tracking-[0.25em] text-primary">SEU RESULTADO</p>
            <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-end gap-2"><span className="text-6xl font-extrabold text-primary">{score}</span><span className="pb-2 text-muted-foreground">/ 40 pontos</span></div>
              <div className="relative mt-5 h-3 rounded-full" style={{ background: "linear-gradient(90deg, var(--chart-1) 0 37%, var(--chart-2) 37% 67%, var(--chart-3) 67%)" }}>
                <div className="absolute -top-1.5 size-6 -translate-x-1/2 rounded-full border-4 border-card bg-foreground" style={{ left: `${(score / 40) * 100}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>Baixo</span><span>Moderado</span><span>Alto</span></div>
              <h2 className="mt-6 text-2xl font-bold">{res.level}</h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">{res.text}</p>
            </div>
            <p className="flex gap-3 text-sm text-muted-foreground"><Info className="size-5 shrink-0 text-primary" />Sintomas semelhantes podem estar ligados a ansiedade, depressão, qualidade do sono ou questões hormonais. Somente a avaliação de um psiquiatra, neurologista ou neuropsicólogo pode confirmar um diagnóstico.</p>
            <button onClick={whats} className="flex items-center justify-center gap-2 rounded-full bg-primary py-4 text-base font-bold text-primary-foreground hover:brightness-110"><MessageCircle className="size-5" />Enviar resultado e agendar avaliação</button>
            <button onClick={() => downloadPdf(form.name, answers)} className="flex items-center justify-center gap-2 rounded-full bg-secondary py-4 text-base font-bold text-secondary-foreground hover:brightness-95"><Download className="size-5" />Baixar resumo em PDF</button>
            <button onClick={restart} className="mx-auto flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><RotateCcw className="size-4" />Refazer teste</button>
          </motion.section>
        )}
      </AnimatePresence>
      <footer className="mt-auto pt-10 text-center text-xs text-muted-foreground">{CONFIG.clinicName}</footer>
    </main>
  );
}
