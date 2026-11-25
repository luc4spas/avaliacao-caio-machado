import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { triagensQuery, type Triagem } from "@/lib/triagens";
import { toast } from "sonner";

export function useTriagens() { return useQuery(triagensQuery); }
export function useUpdateTriagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<Triagem, "crm_status" | "internal_notes">> }) => {
      const { error } = await supabase.from("triagens").update(patch).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: triagensQuery.queryKey });
      const prev = qc.getQueryData(triagensQuery.queryKey);
      qc.setQueryData(triagensQuery.queryKey, (old) => old?.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      return { prev };
    },
    onError: (_e, _v, ctx) => { qc.setQueryData(triagensQuery.queryKey, ctx?.prev); toast.error("Não foi possível salvar."); },
    onSuccess: (_d, v) => { if (v.patch.internal_notes !== undefined) toast.success("Anotações salvas"); },
  });
}
