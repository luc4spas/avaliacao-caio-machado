import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { StoredAnswer } from "./quiz";
import { CONFIG } from "@/config";

export type Triagem = Tables<"triagens">;
export const triagensQuery = queryOptions({
  queryKey: ["triagens"],
  queryFn: async () => {
    const { data, error } = await supabase.from("triagens").select("*").order("created_at", { ascending: false }).limit(1000);
    if (error) throw error;
    return data;
  },
});
export const answersOf = (t: Triagem) => (Array.isArray(t.answers) ? (t.answers as unknown as StoredAnswer[]) : []);
export const fmtDate = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
export function patientWhatsLink(t: Triagem) {
  let n = t.patient_whatsapp.replace(/\D/g, "");
  if (n.length === 10 || n.length === 11) n = "55" + n;
  const first = t.patient_name.split(" ")[0] || "";
  const msg = `Olá${first ? `, ${first}` : ""}! Aqui é da equipe do ${CONFIG.shortName}. Recebemos sua autoavaliação e gostaríamos de te ajudar a dar o próximo passo. Qual o melhor dia e horário para conversarmos sobre uma avaliação?`;
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(msg)}` : null;
}
export function toCsv(rows: Triagem[]) {
  const head = ["data", "nome", "email", "whatsapp", "pontuacao", "desatencao", "hiperatividade", "nivel", "status", "anotacoes"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) => [fmtDate(r.created_at), r.patient_name, r.patient_email, r.patient_whatsapp, r.total_score, r.inattention_score, r.hyperactivity_score, r.risk_level, r.crm_status, r.internal_notes].map(esc).join(";"));
  return "\uFEFF" + [head.join(";"), ...lines].join("\n");
}
