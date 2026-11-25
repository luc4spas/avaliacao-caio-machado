import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Eye, KanbanSquare, List, Search } from "lucide-react";
import { useTriagens, useUpdateTriagem } from "@/hooks/use-triagens";
import { CRM_STATUSES } from "@/lib/quiz";
import { fmtDate, patientWhatsLink, toCsv, type Triagem } from "@/lib/triagens";
import { RiskBadge, StatusSelect, WhatsIcon } from "@/components/admin/bits";
import { PatientSheet } from "@/components/admin/PatientSheet";

export const Route = createFileRoute("/admin/crm")({ component: Crm });

const ctl = "h-11 rounded-xl border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
function Crm() {
  const { data = [], isLoading } = useTriagens();
  const upd = useUpdateTriagem();
  const [view, setView] = useState<"list" | "kanban">("list");
  const [q, setQ] = useState(""); const [risk, setRisk] = useState("todos"); const [status, setStatus] = useState("todos");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const s = q.toLowerCase().trim(); const digits = s.replace(/\D/g, "");
    return data.filter((t) =>
      (risk === "todos" || t.risk_level === risk) && (status === "todos" || t.crm_status === status) &&
      (!s || t.patient_name.toLowerCase().includes(s) || t.patient_email.toLowerCase().includes(s) || (!!digits && t.patient_whatsapp.replace(/\D/g, "").includes(digits))));
  }, [data, q, risk, status]);
  const open = data.find((t) => t.id === openId) ?? null;
  const setSt = (t: Triagem, v: string) => upd.mutate({ id: t.id, patch: { crm_status: v } });
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `triagens-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const Actions = ({ t }: { t: Triagem }) => {
    const wa = patientWhatsLink(t);
    return (
      <div className="flex items-center gap-1">
        {wa && <a href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${t.patient_name}`} className="grid size-9 place-items-center rounded-lg text-primary hover:bg-secondary"><WhatsIcon /></a>}
        <button onClick={() => setOpenId(t.id)} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold hover:bg-muted"><Eye className="size-4" />Ver detalhes</button>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h1 className="truncate text-2xl font-extrabold tracking-tight">CRM de Pacientes</h1>
        <div className="flex rounded-xl border border-border bg-card p-1">
          <button aria-label="Lista" aria-pressed={view === "list"} onClick={() => setView("list")} className={`grid size-9 place-items-center rounded-lg ${view === "list" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}><List className="size-4" /></button>
          <button aria-label="Kanban" aria-pressed={view === "kanban"} onClick={() => setView("kanban")} className={`grid size-9 place-items-center rounded-lg ${view === "kanban" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}><KanbanSquare className="size-4" /></button>
        </div>
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" /><input aria-label="Buscar" placeholder="Buscar por nome, e-mail ou WhatsApp" value={q} onChange={(e) => setQ(e.target.value)} className={`${ctl} w-full pl-9`} /></div>
        <select aria-label="Nível" value={risk} onChange={(e) => setRisk(e.target.value)} className={ctl}><option value="todos">Todos os níveis</option><option value="alto">Alto</option><option value="moderado">Moderado</option><option value="baixo">Baixo</option></select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={ctl}><option value="todos">Todos os status</option>{CRM_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        <button onClick={exportCsv} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:brightness-110"><Download className="size-4" />Exportar CSV</button>
      </div>

      {isLoading ? <p className="text-muted-foreground">Carregando…</p> : rows.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">Nenhuma triagem encontrada.</p>
      : view === "list" ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {rows.map((t) => (
            <div key={t.id} className="flex flex-col gap-3 border-b border-border p-4 last:border-0 md:flex-row md:items-center">
              <button onClick={() => setOpenId(t.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-semibold">{t.patient_name || "Sem nome"}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(t.created_at)}</p>
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge risk={t.risk_level} score={t.total_score} />
                <StatusSelect value={t.crm_status} onChange={(v) => setSt(t, v)} />
                <Actions t={t} />
              </div>
            </div>))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {CRM_STATUSES.map((c) => {
            const col = rows.filter((t) => t.crm_status === c.value);
            return (
              <div key={c.value} className="flex w-72 shrink-0 flex-col gap-3 rounded-2xl bg-muted p-3">
                <p className="flex justify-between px-1 text-sm font-bold">{c.label}<span className="text-muted-foreground">{col.length}</span></p>
                {col.map((t) => (
                  <div key={t.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-soft">
                    <button onClick={() => setOpenId(t.id)} className="text-left"><p className="truncate font-semibold">{t.patient_name || "Sem nome"}</p><p className="text-xs text-muted-foreground">{fmtDate(t.created_at)}</p></button>
                    <RiskBadge risk={t.risk_level} score={t.total_score} />
                    <div className="flex items-center justify-between gap-2"><StatusSelect value={t.crm_status} onChange={(v) => setSt(t, v)} /><Actions t={t} /></div>
                  </div>))}
              </div>);
          })}
        </div>
      )}
      <PatientSheet t={open} onClose={() => setOpenId(null)} />
    </div>
  );
}
