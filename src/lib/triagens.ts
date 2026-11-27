import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import type { StoredAnswer } from "./quiz";
import { CONFIG } from "@/config";

export type Triagem = Tables<"triagens">;
export type ParticipantDetail = { id: string; label: string; value: string };
export const triagensQuery = queryOptions({
  queryKey: ["triagens"],
  queryFn: async () => {
    const { data, error } = await supabase.from("triagens").select("*").order("created_at", { ascending: false }).limit(1000);
    if (error) throw error;
    return data;
  },
});
export const answersOf = (t: Triagem) => (Array.isArray(t.answers) ? (t.answers as unknown as StoredAnswer[]) : []);
function jsonObject(value: Json | undefined): Record<string, Json | undefined> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}
export function participantNameLabelOf(t: Triagem): string {
  const snapshot = jsonObject(t.assessment_snapshot);
  const label = snapshot?.["participant_name_label"];
  return typeof label === "string" && label ? label : "Nome completo";
}
export function participantDetailsOf(t: Triagem): ParticipantDetail[] {
  const data = jsonObject(t.participant_data);
  if (!data) return [];
  const snapshot = jsonObject(t.assessment_snapshot);
  const rawFields = snapshot?.["participant_fields"];
  const labels = new Map<string, string>();
  if (Array.isArray(rawFields)) {
    for (const rawField of rawFields) {
      const field = jsonObject(rawField);
      const id = field?.["id"];
      const label = field?.["label"];
      if (typeof id === "string" && typeof label === "string") labels.set(id, label);
    }
  }
  return Object.entries(data).flatMap(([id, value]) =>
    typeof value === "string" || typeof value === "number"
      ? [{ id, label: labels.get(id) ?? id, value: String(value) }]
      : [],
  );
}
export const fmtDate = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
export function patientWhatsLink(t: Triagem) {
  let n = t.patient_whatsapp.replace(/\D/g, "");
  if (n.length === 10 || n.length === 11) n = "55" + n;
  const first = t.patient_name.split(" ")[0] || "";
  const msg = `Olá${first ? `, ${first}` : ""}! Aqui é da equipe do ${CONFIG.shortName}. Recebemos sua autoavaliação e gostaríamos de te ajudar a dar o próximo passo. Qual o melhor dia e horário para conversarmos sobre uma avaliação?`;
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(msg)}` : null;
}
export function toCsv(rows: Triagem[]) {
  const head = ["avaliacao", "data", "nome", "email", "whatsapp", "pontuacao_0_100", "resultado", "status", "anotacoes"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) => [r.assessment_title, fmtDate(r.created_at), r.patient_name, r.patient_email, r.patient_whatsapp, r.score_0_100, r.result_band, r.crm_status, r.internal_notes].map(esc).join(";"));
  return "\uFEFF" + [head.join(";"), ...lines].join("\n");
}
