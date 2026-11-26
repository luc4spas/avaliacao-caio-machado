import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { answersOf, fmtDate, patientWhatsLink, type Triagem } from "@/lib/triagens";
import { useUpdateTriagem } from "@/hooks/use-triagens";
import { RiskBadge, StatusSelect, WhatsIcon } from "./bits";
import { CONFIG } from "@/config";

export function PatientSheet({ t, onClose, canPrint = true }: { t: Triagem | null; onClose: () => void; canPrint?: boolean }) {
  const upd = useUpdateTriagem();
  const [notes, setNotes] = useState("");
  useEffect(() => setNotes(t?.internal_notes ?? ""), [t?.id]);
  if (!t) return null;
  const wa = patientWhatsLink(t);
  const ans = answersOf(t);

  const print = () => {
    const w = window.open("", "_blank"); if (!w) return;
    const e = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const rows = ans.map((a, i) => `<tr><td>${i + 1}. <b>${e(a.title)}</b><br/><small>${e(a.question)}</small></td><td style="white-space:nowrap">${e(a.answer)} (${a.value})</td></tr>`).join("");
    w.document.write(`<html><head><title>${e(t.patient_name)}</title><style>body{font-family:sans-serif;padding:32px;color:#1e293b}td{border-bottom:1px solid #e2e8f0;padding:8px;vertical-align:top}table{border-collapse:collapse;width:100%}</style></head><body>
      <h2>Triagem de Indicativos de TDAH Adulto</h2><p>${CONFIG.clinicName}</p>
      <p><b>Paciente:</b> ${e(t.patient_name) || "—"}<br/><b>E-mail:</b> ${e(t.patient_email) || "—"}<br/><b>WhatsApp:</b> ${e(t.patient_whatsapp) || "—"}<br/><b>Data:</b> ${fmtDate(t.created_at)}</p>
      <p><b>Total:</b> ${t.total_score}/40 (${e(t.risk_level)}) — <b>Desatenção:</b> ${t.inattention_score}/24 — <b>Hiperatividade/Impulsividade:</b> ${t.hyperactivity_score}/16</p>
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
          <div className="flex flex-wrap items-center gap-3">
            <RiskBadge risk={t.risk_level} score={t.total_score} />
            <StatusSelect value={t.crm_status} onChange={(v) => upd.mutate({ id: t.id, patch: { crm_status: v } })} />
          </div>
          {wa ? <a href={wa} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-bold text-primary-foreground hover:brightness-110"><WhatsIcon className="size-5" />Chamar no WhatsApp</a>
            : <p className="text-sm text-muted-foreground">Paciente não informou WhatsApp.</p>}
          <section className="rounded-2xl border border-border p-4">
            <p className="text-sm text-muted-foreground">Pontuação total</p>
            <p className="text-4xl font-extrabold text-primary">{t.total_score}<span className="text-base font-medium text-muted-foreground"> / 40</span></p>
            <Bar label="Desatenção" v={t.inattention_score} max={24} />
            <Bar label="Hiperatividade/Impulsividade" v={t.hyperactivity_score} max={16} />
          </section>
          <section>
            <h3 className="mb-3 font-bold">Respostas</h3>
            <ol className="flex flex-col gap-2">{ans.map((a, i) => (
              <li key={i} className={`rounded-xl border p-3 text-sm ${a.value >= 3 ? "border-risk-mod-foreground/30 bg-risk-mod" : "border-border"}`}>
                <p className="font-semibold">{i + 1}. {a.title}</p>
                <p className="mt-0.5 text-muted-foreground">{a.question}</p>
                <p className={`mt-1 font-semibold ${a.value >= 3 ? "text-risk-mod-foreground" : ""}`}>{a.answer} · {a.value} pt</p>
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
function Bar({ label, v, max }: { label: string; v: number; max: number }) {
  return (
    <div className="mt-4">
      <div className="flex justify-between text-sm"><span>{label}</span><span className="font-semibold">{v}/{max}</span></div>
      <div className="mt-1.5 h-2.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} /></div>
    </div>
  );
}
