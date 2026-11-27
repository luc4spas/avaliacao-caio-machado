import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CalendarCheck, Gauge } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTriagens } from "@/hooks/use-triagens";
import { CRM_STATUSES } from "@/lib/quiz";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

const DAY = 86400000;
function Dashboard() {
  const { data = [], isLoading, error } = useTriagens();
  const [assessmentId, setAssessmentId] = useState("all");
  const assessmentOptions = useMemo(
    () =>
      Array.from(
        new Map(data.map((item) => [item.assessment_id, item.assessment_title])).entries(),
      ).map(([id, title]) => ({ id, title })),
    [data],
  );
  const scopedRows = useMemo(
    () => (assessmentId === "all" ? data : data.filter((item) => item.assessment_id === assessmentId)),
    [assessmentId, data],
  );
  const s = useMemo(() => {
    const now = Date.now();
    const last7 = scopedRows.filter((t) => now - +new Date(t.created_at) < 7 * DAY).length;
    const prev7 = scopedRows.filter((t) => { const d = now - +new Date(t.created_at); return d >= 7 * DAY && d < 14 * DAY; }).length;
    const high = scopedRows.filter((t) => t.risk_level === "alto").length;
    const booked = scopedRows.filter((t) => t.crm_status === "agendado" || t.crm_status === "avaliado").length;
    const avg = scopedRows.length ? scopedRows.reduce((a, t) => a + t.score_0_100, 0) / scopedRows.length : 0;
    const pct = (n: number) => (scopedRows.length ? Math.round((n / scopedRows.length) * 100) : 0);
    const dist = [
      { name: "Baixo", value: scopedRows.filter((t) => t.risk_level === "baixo").length, fill: "var(--chart-1)" },
      { name: "Moderado", value: scopedRows.filter((t) => t.risk_level === "moderado").length, fill: "var(--chart-2)" },
      { name: "Alto", value: high, fill: "var(--chart-3)" },
      {
        name: "Sem classificação",
        value: scopedRows.filter((t) => t.risk_level === "sem_classificacao").length,
        fill: "var(--muted-foreground)",
      },
    ];
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now - (29 - i) * DAY); const key = d.toDateString();
      return { dia: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), triagens: scopedRows.filter((t) => new Date(t.created_at).toDateString() === key).length };
    });
    const funnel = CRM_STATUSES.filter((c) => c.value !== "arquivado").map((c) => ({ ...c, n: scopedRows.filter((t) => t.crm_status === c.value).length }));
    return { last7, prev7, high, highPct: pct(high), bookedPct: pct(booked), avg, dist, days, funnel };
  }, [scopedRows]);

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (error) return <p className="text-destructive">Não foi possível carregar os dados.</p>;
  const maxF = Math.max(1, ...s.funnel.map((f) => f.n));
  const diff = s.last7 - s.prev7;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
        <label className="flex min-w-64 flex-col gap-1 text-sm font-medium">
          Avaliação
          <select
            value={assessmentId}
            onChange={(event) => setAssessmentId(event.target.value)}
            className="h-10 rounded-xl border border-input bg-card px-3"
          >
            <option value="all">Todas as avaliações</option>
            {assessmentOptions.map((assessment) => (
              <option key={assessment.id} value={assessment.id}>{assessment.title}</option>
            ))}
          </select>
        </label>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Activity} label="Avaliações realizadas" value={scopedRows.length} hint={`${s.last7} nos últimos 7 dias (${diff >= 0 ? "+" : ""}${diff} vs. semana anterior)`} />
        <Kpi icon={AlertTriangle} label="Faixa alta" value={assessmentId === "all" ? "—" : s.high} hint={assessmentId === "all" ? "Selecione uma avaliação" : `${s.highPct}% do total`} highlight />
        <Kpi icon={CalendarCheck} label="Taxa de agendamento" value={`${s.bookedPct}%`} hint="Agendados ou avaliados" />
        <Kpi icon={Gauge} label="Pontuação média" value={assessmentId === "all" ? "—" : s.avg.toFixed(1)} hint={assessmentId === "all" ? "Selecione uma avaliação" : "de 100 pontos"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Distribuição por faixa">
          {assessmentId === "all" ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Selecione uma avaliação para comparar faixas compatíveis.</p>
          ) : (
            <>
              <div className="h-56"><ResponsiveContainer><PieChart><Pie data={s.dist} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>{s.dist.map((d) => <Cell key={d.name} fill={d.fill} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
              <div className="flex justify-center gap-4 text-xs">{s.dist.map((d) => <span key={d.name} className="flex items-center gap-1.5"><i className="size-2.5 rounded-full" style={{ background: d.fill }} />{d.name} ({d.value})</span>)}</div>
            </>
          )}
        </Card>
        <Card title="Avaliações nos últimos 30 dias" className="lg:col-span-2">
          <div className="h-64"><ResponsiveContainer><AreaChart data={s.days}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="dia" fontSize={11} interval={4} stroke="var(--muted-foreground)" /><YAxis allowDecimals={false} fontSize={11} width={28} stroke="var(--muted-foreground)" /><Tooltip /><Area type="monotone" dataKey="triagens" stroke="var(--primary)" fill="var(--secondary)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div>
        </Card>
      </div>
      <Card title="Funil do CRM">
        <div className="flex flex-col gap-3">{s.funnel.map((f) => (
          <div key={f.value} className="grid grid-cols-[100px_1fr_40px] items-center gap-3 text-sm">
            <span className="font-medium">{f.label}</span>
            <div className="h-3 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(f.n / maxF) * 100}%` }} /></div>
            <span className="text-right font-semibold">{f.n}</span>
          </div>))}</div>
      </Card>
    </div>
  );
}
function Kpi({ icon: Icon, label, value, hint, highlight }: { icon: typeof Activity; label: string; value: string | number; hint: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-soft ${highlight ? "border-risk-high bg-risk-high" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between text-sm text-muted-foreground">{label}<Icon className={`size-4 ${highlight ? "text-risk-high-foreground" : "text-primary"}`} /></div>
      <p className={`mt-2 text-3xl font-extrabold ${highlight ? "text-risk-high-foreground" : ""}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-border bg-card p-5 shadow-soft ${className}`}><h2 className="mb-4 font-bold">{title}</h2>{children}</section>;
}
