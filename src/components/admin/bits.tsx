import { CRM_STATUSES, RISK_LABEL, type Risk } from "@/lib/quiz";
import { formatAssessmentScore } from "@/lib/assessments";

const riskCls: Record<Risk, string> = {
  baixo: "bg-risk-low text-risk-low-foreground",
  moderado: "bg-risk-mod text-risk-mod-foreground",
  alto: "bg-risk-high text-risk-high-foreground",
  sem_classificacao: "bg-muted text-muted-foreground",
};
export function RiskBadge({ risk, score }: { risk: string; score?: number }) {
  const isKnownRisk = Object.prototype.hasOwnProperty.call(riskCls, risk);
  const riskClass = isKnownRisk ? riskCls[risk as Risk] : "bg-muted text-muted-foreground";
  const riskLabel = isKnownRisk ? RISK_LABEL[risk as Risk] : `Categoria desconhecida: ${risk}`;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${riskClass}`}
    >
      {riskLabel}
      {score !== undefined && ` • ${formatAssessmentScore(score)}/100`}
    </span>
  );
}
export function StatusSelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <select id={id} aria-label="Status do CRM" value={value} onChange={(e) => onChange(e.target.value)} onClick={(e) => e.stopPropagation()}
      className="h-9 rounded-lg border border-input bg-background px-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring">
      {CRM_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </select>
  );
}
export function WhatsIcon({ className = "size-4" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5 2.5 1 3 .8 3.6.7.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg>;
}
