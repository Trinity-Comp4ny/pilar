// Colunas do funil de leads por empresa (SPEC 120). Espelha useProjetoEtapas:
// cada coluna declara um `bucket` (status canônico do lead) e o leads.status
// deriva dele por trigger, então conversão, motivo de perda e KPIs seguem iguais.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Lead } from "@/hooks/useLeads";

export type LeadBucket = Lead["status"];

export type LeadEtapa = {
  id: string;
  nome: string;
  ordem: number;
  cor: string | null;
  /** "Conta como": qual dos 6 status canônicos esta coluna representa. */
  bucket: LeadBucket;
};

const KEY = ["lead-etapas"] as const;

export function useLeadEtapas() {
  return useQuery({
    queryKey: KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<LeadEtapa[]> => {
      const { data, error } = await supabase
        .from("lead_etapas")
        .select("id, nome, ordem, cor, bucket")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((e) => ({ ...e, bucket: e.bucket as LeadBucket }));
    },
  });
}

export function useLeadEtapaMutations() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const criar = useMutation({
    mutationFn: async ({
      nome,
      ordem,
      cor,
      bucket,
    }: {
      nome: string;
      ordem: number;
      cor?: string | null;
      bucket: LeadBucket;
    }) => {
      const empresaId = profile?.empresa_id;
      if (!empresaId) throw new Error("Sem empresa no perfil");
      const { error } = await supabase
        .from("lead_etapas")
        .insert({ empresa_id: empresaId, nome, ordem, cor: cor ?? null, bucket });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Editar coluna: nome + cor. O bucket não muda (o banco recusa).
  const editar = useMutation({
    mutationFn: async ({ id, nome, cor }: { id: string; nome: string; cor: string }) => {
      const { error } = await supabase.from("lead_etapas").update({ nome, cor }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Troca a ordem de duas colunas (mover para esquerda/direita).
  const reordenar = useMutation({
    mutationFn: async (pares: { id: string; ordem: number }[]) => {
      for (const p of pares) {
        const { error } = await supabase.from("lead_etapas").update({ ordem: p.ordem }).eq("id", p.id);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  // O banco recusa coluna com lead ativo e a última de Ganho/Perdido; o front
  // checa antes com mensagem amigável e mantém o erro como rede de proteção.
  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_etapas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { criar, editar, reordenar, excluir };
}
