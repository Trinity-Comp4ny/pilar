import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { validarPropostaPdf } from "@/lib/propostaPdfArquivo";
import { toast } from "sonner";

const BUCKET = "proposta-pdfs";
export function usePropostaVersoes(leadId: string, propostaIds: string[], enabled: boolean) {
  const qc = useQueryClient();
  const key = ["proposta-versoes", leadId, propostaIds];
  const invalidar = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["proposta-versoes", leadId] }),
      qc.invalidateQueries({ queryKey: ["propostas"] }),
    ]);
  };
  const query = useQuery({
    queryKey: key,
    enabled: enabled && propostaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposta_versoes")
        .select("*")
        .in("proposta_id", propostaIds)
        .order("created_at", { ascending: false })
        .order("numero", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const adicionar = useMutation({
    mutationFn: async (input: {
      propostaId: string;
      arquivo: File;
      valor: number;
      validade: string | null;
      condicoes: string;
      motivo: string;
    }) => {
      const erroArquivo = await validarPropostaPdf(input.arquivo);
      if (erroArquivo) throw new Error(erroArquivo);
      const { data: empresaId, error: empresaError } = await supabase.rpc("get_user_empresa_id");
      if (empresaError) throw empresaError;
      if (!empresaId) throw new Error("Empresa não encontrada");
      const id = crypto.randomUUID();
      const path = `${empresaId}/${input.propostaId}/${id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, input.arquivo, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("proposta_versoes").insert({
        id,
        empresa_id: empresaId,
        proposta_id: input.propostaId,
        arquivo_path: path,
        nome_arquivo: input.arquivo.name,
        tamanho: input.arquivo.size,
        valor_proposto: input.valor,
        validade: input.validade,
        condicoes_pagamento: input.condicoes,
        motivo_revisao: input.motivo,
      });
      if (error) {
        // Só uploads órfãos podem ser removidos pela policy do bucket.
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }
    },
    onSuccess: invalidar,
  });
  const registrarEnvio = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("proposta_versoes")
        .update({ enviado_em: new Date().toISOString() })
        .eq("id", id)
        .is("enviado_em", null)
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: () => toast.error("Não foi possível registrar o envio."),
  });
  const baixar = async (path: string, nome: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error) {
      toast.error("Não foi possível baixar o PDF.");
      return;
    }
    const { saveAs } = await import("file-saver");
    saveAs(data, nome);
  };
  return { ...query, adicionar, registrarEnvio, baixar };
}
