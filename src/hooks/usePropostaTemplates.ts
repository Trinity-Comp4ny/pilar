import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { extractVariablesFromDocx } from "@/lib/docxUtils";

export interface PropostaTemplate {
  id: string;
  empresa_id: string;
  nome: string;
  descricao: string | null;
  arquivo_path: string;
  variaveis: string[];
  created_at: string;
}

export const usePropostaTemplates = () => {
  return useQuery({
    queryKey: ["proposta-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposta_templates")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as PropostaTemplate[];
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const useUploadTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, nome, descricao }: { file: File; nome: string; descricao?: string }) => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");

      // 1. Upload file to storage
      const filePath = `${empresaId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("proposta-templates").upload(filePath, file);

      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

      // 2. Parse variables from DOCX
      const arrayBuffer = await file.arrayBuffer();
      const variaveis = extractVariablesFromDocx(arrayBuffer);

      // 3. Insert template record
      const { data, error } = await supabase
        .from("proposta_templates")
        .insert({
          empresa_id: empresaId,
          nome,
          descricao: descricao || null,
          arquivo_path: filePath,
          variaveis,
        })
        .select()
        .single();

      if (error) throw error;
      return data as PropostaTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposta-templates"] });
    },
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("proposta_templates")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposta-templates"] });
    },
  });
};

/**
 * Download template file from storage as ArrayBuffer
 */
export async function downloadTemplateFile(arquivoPath: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from("proposta-templates").download(arquivoPath);

  if (error) throw new Error(`Erro ao baixar template: ${error.message}`);
  return data.arrayBuffer();
}
