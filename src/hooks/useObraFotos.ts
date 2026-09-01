import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FotoAssinada {
  id: string;
  url: string;
  path: string;
}

export const MIME_FOTO_RDO = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FOTO_RDO_BYTES = 8 * 1024 * 1024;

/**
 * Fotos do diário de uma obra, agrupadas por rdo_id e já com URL assinada
 * (bucket privado `obra-campo`). O escritório (autenticado) passa no RLS do
 * Storage porque o 1º segmento do path é o empresa_id.
 */
export function useObraFotos(obraId: string | undefined) {
  return useQuery({
    queryKey: ["obra_fotos", obraId],
    enabled: !!obraId,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<Record<string, FotoAssinada[]>> => {
      const { data, error } = await supabase.from("obra_rdo_foto").select("id, rdo_id, path").eq("obra_id", obraId!);
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return {};

      const { data: signed } = await supabase.storage.from("obra-campo").createSignedUrls(
        rows.map((r) => r.path),
        3600
      );
      const urlByPath = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));

      const byRdo: Record<string, FotoAssinada[]> = {};
      for (const r of rows) {
        const url = urlByPath.get(r.path);
        if (!url) continue;
        (byRdo[r.rdo_id] ??= []).push({ id: r.id, url, path: r.path });
      }
      return byRdo;
    },
  });
}

/** Redimensiona pro mesmo padrão do Pilar Campo (max 1600px, JPEG 0.8) antes de subir. */
async function comprimirParaJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.8));
  if (!blob) throw new Error("Não foi possível processar a imagem");
  return blob;
}

export interface UploadRdoFotoInput {
  empresaId: string;
  obraId: string;
  rdoId: string;
  file: File;
}

/**
 * Sobe uma foto do RDO direto do escritório (spec 080). Reusa o bucket
 * `obra-campo` e a tabela `obra_rdo_foto` da spec 042: a policy de INSERT já
 * autoriza `authenticated` por `empresa_id`, sem migration nova.
 */
export function useUploadRdoFoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ empresaId, obraId, rdoId, file }: UploadRdoFotoInput) => {
      const blob = await comprimirParaJpeg(file);
      const path = `${empresaId}/${obraId}/${rdoId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("obra-campo")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error("Falha ao subir a foto");

      const { error: insErr } = await supabase
        .from("obra_rdo_foto")
        .insert({ empresa_id: empresaId, obra_id: obraId, rdo_id: rdoId, path });
      if (insErr) {
        await supabase.storage.from("obra-campo").remove([path]);
        throw new Error("Falha ao registrar a foto");
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["obra_fotos", vars.obraId] });
    },
  });
}

/** Remove uma foto do RDO (Storage + metadado). */
export function useDeleteRdoFoto(obraId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, path }: { id: string; path: string }) => {
      await supabase.storage.from("obra-campo").remove([path]);
      const { error } = await supabase.from("obra_rdo_foto").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (obraId) qc.invalidateQueries({ queryKey: ["obra_fotos", obraId] });
    },
  });
}
