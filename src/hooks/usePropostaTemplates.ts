import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { extractVariablesFromDocx } from "@/lib/docxUtils";

export type TemplateTipo = "proposta" | "contrato";

export interface PropostaTemplate {
  id: string;
  empresa_id: string;
  nome: string;
  descricao: string | null;
  arquivo_path: string;
  variaveis: string[];
  tipo: TemplateTipo;
  created_at: string;
}

export const usePropostaTemplates = (tipo?: TemplateTipo) => {
  return useQuery({
    queryKey: ["proposta-templates", tipo ?? "all"],
    queryFn: async () => {
      let query = supabase.from("proposta_templates").select("*").is("deleted_at", null);
      if (tipo) query = query.eq("tipo", tipo);
      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return ((data || []) as unknown as PropostaTemplate[]).map((t) => ({
        ...t,
        tipo: (t.tipo as TemplateTipo) || "proposta",
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const useUploadTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      nome,
      descricao,
      tipo = "proposta",
    }: {
      file: File;
      nome: string;
      descricao?: string;
      tipo?: TemplateTipo;
    }) => {
      // Validação de segurança do arquivo
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      const ALLOWED_EXTENSIONS = [".docx"];
      const ALLOWED_MIME_TYPES = ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

      const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
        throw new Error("Apenas arquivos .docx são permitidos");
      }
      if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error("Tipo de arquivo inválido. Envie um .docx");
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new Error("Arquivo excede o limite de 10MB");
      }

      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");

      // 1. Upload file to storage
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${empresaId}/${Date.now()}_${sanitizedName}`;
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
          tipo,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as PropostaTemplate;
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
