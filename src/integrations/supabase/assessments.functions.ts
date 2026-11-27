import { supabase } from "./client";
import {
  parseAssessment,
  type Assessment,
  type AssessmentParticipantField,
  type AssessmentQuestion,
  type ResultBand,
  type ScoringConfig,
} from "@/lib/assessments";
import type { Json, Tables } from "./types";

export type AssessmentDraft = {
  slug: string;
  title: string;
  description: string;
  instructions: string;
  status: "draft" | "published" | "inactive";
  participant_name_label: string;
  participant_name_required: boolean;
  participant_fields: AssessmentParticipantField[];
  questions: AssessmentQuestion[];
  scoring: ScoringConfig;
  result_bands: ResultBand[];
};

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function toDraft(row: Tables<"assessments">): Assessment {
  return parseAssessment(row);
}

export async function listAssessments(): Promise<Assessment[]> {
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data.map(toDraft);
}

export async function listPublishedAssessments(): Promise<Assessment[]> {
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("status", "published")
    .order("title");
  if (error) throw error;
  return data.map(toDraft);
}

export async function getPublishedAssessment(slug: string): Promise<Assessment | null> {
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return data ? toDraft(data) : null;
}

export async function saveAssessment(
  draft: AssessmentDraft,
  existing?: Pick<Assessment, "id" | "version">,
): Promise<void> {
  const payload = {
    ...draft,
    questions: toJson(draft.questions),
    participant_fields: toJson(draft.participant_fields),
    scoring: toJson(draft.scoring),
    result_bands: toJson(draft.result_bands),
    version: existing ? existing.version + 1 : 1,
    updated_at: new Date().toISOString(),
  };
  const result = existing
    ? await supabase.from("assessments").update(payload).eq("id", existing.id)
    : await supabase.from("assessments").insert(payload);
  if (result.error) throw result.error;
}
