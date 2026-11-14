import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Impacto } from "@/lib/novidades";

/**
 * Releases do produto no Ultra admin (SPEC 152). O rascunho nasce da edge release-rascunho no
 * deploy em produção (ou à mão aqui); o ultra admin revisa o texto e publica. A publicação é só
 * pela RPC `publicar_release`, que também avisa quem pediu cada item.
 */
export interface ReleaseItemAdmin {
  id: string;
  texto: string;
  impacto: Impacto;
  modulo: string | null;
  feedbackIds: string[];
  commitSha: string | null;
  ordem: number;
}

export interface ReleaseAdmin {
  id: string;
  sha: string | null;
  titulo: string;
  versao: string | null;
  criadaEm: string;
  publicadaEm: string | null;
  itens: ReleaseItemAdmin[];
}

export const RELEASES_KEY = ["ultra-admin-releases"] as const;

export function useReleasesAdmin() {
  return useQuery({
    queryKey: RELEASES_KEY,
    queryFn: async (): Promise<ReleaseAdmin[]> => {
      const { data, error } = await supabase
        .from("product_releases")
        .select("id, sha, titulo, versao, criada_em, publicada_em, product_release_itens(*)")
        .order("criada_em", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        sha: r.sha,
        titulo: r.titulo,
        versao: r.versao,
        criadaEm: r.criada_em,
        publicadaEm: r.publicada_em,
        itens: (r.product_release_itens ?? [])
          .map((i) => ({
            id: i.id,
            texto: i.texto,
            impacto: i.impacto as Impacto,
            modulo: i.modulo,
            feedbackIds: i.feedback_ids ?? [],
            commitSha: i.commit_sha,
            ordem: i.ordem,
          }))
          .sort((a, b) => a.ordem - b.ordem),
      }));
    },
  });
}

export interface ReleaseForm {
  titulo: string;
  versao: string;
}

export interface ItemForm {
  texto: string;
  impacto: Impacto;
  modulo: string | null;
}

function useInvalidar() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: RELEASES_KEY });
}

export function useSalvarRelease() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({ id, form }: { id: string | null; form: ReleaseForm }) => {
      const linha = { titulo: form.titulo.trim(), versao: form.versao.trim() || null };
      const { error } = id
        ? await supabase.from("product_releases").update(linha).eq("id", id)
        : await supabase.from("product_releases").insert(linha);
      if (error) throw error;
    },
    onSettled: invalidar,
  });
}

export function useExcluirRelease() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_releases").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: invalidar,
  });
}

export function useSalvarItem() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({
      releaseId,
      itemId,
      ordem,
      form,
    }: {
      releaseId: string;
      itemId: string | null;
      ordem: number;
      form: ItemForm;
    }) => {
      const linha = { texto: form.texto.trim(), impacto: form.impacto, modulo: form.modulo };
      const { error } = itemId
        ? await supabase.from("product_release_itens").update(linha).eq("id", itemId)
        : await supabase.from("product_release_itens").insert({ ...linha, release_id: releaseId, ordem });
      if (error) throw error;
    },
    onSettled: invalidar,
  });
}

export function useExcluirItem() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_release_itens").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: invalidar,
  });
}

export function usePublicarRelease() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (id: string): Promise<number> => {
      const { data, error } = await supabase.rpc("publicar_release", { p_release_id: id });
      if (error) throw error;
      return data ?? 0;
    },
    onSettled: invalidar,
  });
}

/** Rascunho primeiro (é o que pede ação), depois as publicadas da mais nova para a mais velha. */
export function ordenarReleases(releases: ReleaseAdmin[]): ReleaseAdmin[] {
  return [...releases].sort((a, b) => {
    if (!a.publicadaEm !== !b.publicadaEm) return a.publicadaEm ? 1 : -1;
    const da = a.publicadaEm ?? a.criadaEm;
    const db = b.publicadaEm ?? b.criadaEm;
    return db.localeCompare(da);
  });
}
