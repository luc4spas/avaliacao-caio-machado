import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Json } from "@/integrations/supabase/types";
import {
  answersOf,
  fmtDate,
  participantDetailsOf,
  participantNameLabelOf,
  patientWhatsLink,
  type Triagem,
} from "@/lib/triagens";
import { useUpdateTriagem } from "@/hooks/use-triagens";
import { RiskBadge, StatusSelect, WhatsIcon } from "./bits";
import { CONFIG } from "@/config";
import { formatAssessmentScore } from "@/lib/assessments";

export function PatientSheet({ t, onClose, canPrint = true }: { t: Triagem | null; onClose: () => void; canPrint?: boolean }) {
  const upd = useUpdateTriagem();
  const [notes, setNotes] = useState("");
  useEffect(() => setNotes(t?.internal_notes ?? ""), [t?.id]);
  if (!t) return null;
  const wa = patientWhatsLink(t);
  const ans = answersOf(t);
  const breakdown = scoreBreakdown(t.score_breakdown);
  const participantDetails = participantDetailsOf(t);

  const print = () => {
    const w = window.open("", "_blank"); if (!w) return;
    const e = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const rows = ans.map((a, i) => `<tr><td>${i + 1}. <b>${e(a.title)}</b><br/><small>${e(a.question)}</small></td><td style="white-space:nowrap">${e(a.answer)} (${a.value})</td></tr>`).join("");
    const breakdownRows = breakdown.map(([label, score]) => `<li>${e(label)}: ${formatAssessmentScore(score)}/100</li>`).join("");
    const participantRows = participantDetails.map(({ label, value }) => `<br/><b>${e(label)}:</b> ${e(value)}`).join("");
    w.document.write(`<html><head><title>${e(t.patient_name)}</title><style>body{font-family:sans-serif;padding:32px;color:#1e293b}td{border-bottom:1px solid #e2e8f0;padding:8px;vertical-align:top}table{border-collapse:collapse;width:100%}</style></head><body>
      <h2>${e(t.assessment_title)}</h2><p>${CONFIG.clinicName}</p>
      <p><b>${e(participantNameLabelOf(t))}:</b> ${e(t.patient_name) || "—"}${participantRows}<br/><b>E-mail:</b> ${e(t.patient_email) || "—"}<br/><b>WhatsApp:</b> ${e(t.patient_whatsapp) || "—"}<br/><b>Data:</b> ${fmtDate(t.created_at)}</p>
      <p><b>Pontuação:</b> ${formatAssessmentScore(t.score_0_100)}/100 — ${e(t.result_band)}<br/><b>Pontuação calculada:</b> ${t.score_raw}/${t.score_max}</p>
      <ul>${breakdownRows}</ul>
      <table>${rows}</table>${t.internal_notes ? `<h3>Anotações</h3><p>${e(t.internal_notes)}</p>` : ""}
      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="text-left">
          <SheetTitle className="text-xl">{t.patient_name || "Sem nome"}</SheetTitle>
          <SheetDescription>{fmtDate(t.created_at)} · {t.patient_email || "sem e-mail"} · {t.patient_whatsapp || "sem WhatsApp"}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-6">
          {participantDetails.length > 0 && (
            <section className="rounded-2xl border border-border p-4">
              <h3 className="mb-3 font-bold">Dados do participante</h3>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {participantDetails.map((detail) => (
                  <div key={detail.id}>
                    <dt className="text-muted-foreground">{detail.label}</dt>
                    <dd className="font-medium">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <RiskBadge risk={t.risk_level} score={t.total_score} />
            <StatusSelect value={t.crm_status} onChange={(v) => upd.mutate({ id: t.id, patch: { crm_status: v } })} />
          </div>
          {wa ? <a href={wa} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-bold text-primary-foreground hover:brightness-110"><WhatsIcon className="size-5" />Chamar no WhatsApp</a>
            : <p className="text-sm text-muted-foreground">Paciente não informou WhatsApp.</p>}
          <section className="rounded-2xl border border-border p-4">
            <p className="text-sm text-muted-foreground">{t.assessment_title}</p>
            <p className="text-4xl font-extrabold text-primary">{formatAssessmentScore(t.score_0_100)}<span className="text-base font-medium text-muted-foreground"> / 100</span></p>
            <p className="mt-1 text-sm text-muted-foreground">{t.result_band} · cálculo {t.score_raw}/{t.score_max}</p>
            {breakdown.map(([label, score]) => <Bar key={label} label={label} v={score} max={100} />)}
          </section>
          <section>
            <h3 className="mb-3 font-bold">Respostas</h3>
            <ol className="flex flex-col gap-2">{ans.map((a, i) => (
              <li key={i} className="rounded-xl border border-border p-3 text-sm">
                <p className="font-semibold">{i + 1}. {a.title}</p>
                <p className="mt-0.5 text-muted-foreground">{a.question}</p>
                <p className="mt-1 font-semibold">{a.answer} · valor {a.value}</p>
              </li>))}</ol>
          </section>
          <section className="flex flex-col gap-2">
            <label htmlFor="notes" className="font-bold">Anotações internas</label>
            <textarea id="notes" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Histórico de contato, preferência de horário, observações clínicas…"
              className="rounded-xl border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <button onClick={() => upd.mutate({ id: t.id, patch: { internal_notes: notes } })} disabled={upd.isPending}
              className="self-start rounded-full bg-secondary px-5 py-2.5 text-sm font-bold text-secondary-foreground hover:brightness-95">Salvar anotações</button>
          </section>
          {canPrint && <button onClick={print} className="flex items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-semibold hover:bg-muted"><Printer className="size-4" />Imprimir / Gerar PDF</button>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
function scoreBreakdown(value: Json): [string, number][] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  return Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === "number");
}
function Bar({ label, v, max }: { label: string; v: number; max: number }) {
  return (
    <div className="mt-4">
      <div className="flex justify-between text-sm"><span>{label}</span><span className="font-semibold">{formatAssessmentScore(v)}/{max}</span></div>
      <div className="mt-1.5 h-2.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} /></div>
    </div>
  );
}
