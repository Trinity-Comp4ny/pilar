import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { blobParaBase64, lerErro, mimeBase } from "@/lib/registroUpload";
import { temOrganizacaoEmCurso, type ExtraidoRegistro, type StatusRegistro } from "@/lib/registrosObra";

/** Mesmos nomes de bucket da edge `campo-registro-criar` (SPEC 135 e ADR 0062). */
export const BUCKET_AUDIO_REGISTRO = "obra-registro-audio";
export const BUCKET_FOTO_REGISTRO = "obra-campo";

/** Validade das URLs assinadas: o suficiente para ouvir ou ver, sem link permanente. */
const URL_VALIDADE_S = 600;

export interface ObraRegistro {
  id: string;
  obra_id: string;
  rdo_id: string | null;
  autor_nome: string;
  data_registro: string;
  tipo: "audio" | "foto" | "texto" | "misto";
  texto_bruto: string | null;
  texto_organizado: string | null;
  extraido: ExtraidoRegistro | null;
  audio_path: string | null;
  audio_duracao_s: number | null;
  fotos: string[];
  status: StatusRegistro;
  erro: string | null;
  visivel_cliente: boolean;
  criado_em: string;
}

const COLUNAS =
  "id, obra_id, rdo_id, autor_nome, data_registro, tipo, texto_bruto, texto_organizado, extraido, audio_path, audio_duracao_s, fotos, status, erro, visivel_cliente, criado_em";

/**
 * Registros da obra (SPEC 135), do mais novo para o mais antigo. A RLS de `obra_registro` já
 * limita à empresa. Enquanto algum registro está sendo organizado pela IA, a lista se atualiza
 * sozinha a cada 4 s.
 */
export function useObraRegistros(obraId: string) {
  return useQuery({
    queryKey: ["obra_registros", obraId],
    queryFn: async (): Promise<ObraRegistro[]> => {
      const { data, error } = await supabase
        .from("obra_registro")
        .select(COLUNAS)
        .eq("obra_id", obraId)
        .order("data_registro", { ascending: false })
        .order("criado_em", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as ObraRegistro[];
    },
    staleTime: 15_000,
    refetchInterval: (q) => (temOrganizacaoEmCurso(q.state.data ?? []) ? 4000 : false),
  });
}

export function useAtualizarRegistro(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...campos
    }: {
      id: string;
      texto_organizado?: string | null;
      visivel_cliente?: boolean;
    }) => {
      const { error } = await supabase.from("obra_registro").update(campos).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obra_registros", obraId] }),
  });
}

export interface NovoRegistro {
  /** Idempotência: reenviar o mesmo id não duplica. */
  clientId: string;
  /** AAAA-MM-DD. */
  data: string;
  texto?: string;
  audio?: { blob: Blob; mimeType: string; duracaoS: number };
  fotos: Blob[];
}

/** Gravar um registro pelo escritório (SPEC 135): a edge guarda e responde na hora; a IA organiza depois. */
export function useCriarRegistro(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: NovoRegistro) => {
      const body: Record<string, unknown> = {
        obra_id: obraId,
        client_id: r.clientId,
        data: r.data,
        fotos: await Promise.all(
          r.fotos.map(async (f) => ({ content_type: "image/jpeg", image_base64: await blobParaBase64(f) }))
        ),
      };
      if (r.texto) body.texto = r.texto;
      if (r.audio) {
        body.audio = {
          mime_type: mimeBase(r.audio.mimeType),
          base64: await blobParaBase64(r.audio.blob),
          duracao_s: r.audio.duracaoS,
        };
      }
      const { data, error } = await supabase.functions.invoke("registro-criar", { body });
      if (!error && (data as { success?: boolean } | null)?.success) return;
      throw new Error((await lerErro(error)).mensagem);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obra_registros", obraId] }),
  });
}

/** Liga os registros do dia ao RDO que o gestor acabou de salvar (SPEC 135, fase B). */
export function useVincularRegistrosRdo(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rdoId, registroIds }: { rdoId: string; registroIds: string[] }) => {
      if (registroIds.length === 0) return;
      const { error } = await supabase.from("obra_registro").update({ rdo_id: rdoId }).in("id", registroIds);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obra_registros", obraId] }),
  });
}

/** Apaga o registro e, junto, o áudio e as fotos do Storage (ADR 0062: excluir o registro apaga o áudio). */
export function useExcluirRegistro(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: Pick<ObraRegistro, "id" | "audio_path" | "fotos">) => {
      if (r.audio_path) await supabase.storage.from(BUCKET_AUDIO_REGISTRO).remove([r.audio_path]);
      if (r.fotos.length > 0) await supabase.storage.from(BUCKET_FOTO_REGISTRO).remove(r.fotos);
      const { error } = await supabase.from("obra_registro").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obra_registros", obraId] }),
  });
}

/** "Tentar de novo": a edge reorganiza em segundo plano; pouco depois a lista já mostra o resultado. */
export function useReprocessarRegistro(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (registroId: string) => {
      const { error } = await supabase.functions.invoke("registro-reprocessar", { body: { registro_id: registroId } });
      if (error) throw error;
    },
    onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ["obra_registros", obraId] }), 1200),
  });
}

/** URLs assinadas curtas para ouvir o áudio ou ver as fotos de um registro. */
export async function assinarArquivos(bucket: string, paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, URL_VALIDADE_S);
  if (error || !data) throw error ?? new Error("Não deu para abrir o arquivo");
  return data.map((d) => d.signedUrl).filter((u): u is string => Boolean(u));
}
