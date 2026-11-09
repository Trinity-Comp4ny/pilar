import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ErroDeDocx } from "@/lib/erroDeDocx";

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
        throw new ErroDeDocx("Envie um arquivo Word (.docx).");
      }
      if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new ErroDeDocx("Envie um arquivo Word (.docx).");
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new ErroDeDocx("O arquivo passa de 10 MB. Reduza as imagens no Word e envie de novo.");
      }

      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");

      // 1. Lê as variáveis antes de subir: arquivo ruim não deixa lixo no storage.
      const arrayBuffer = await file.arrayBuffer();
      const { extractVariablesFromDocx, chavesSimplesNoDocx } = await import("@/lib/docxUtils");
      const variaveis = extractVariablesFromDocx(arrayBuffer);
      if (variaveis.length === 0) {
        const umaChave = chavesSimplesNoDocx(arrayBuffer);
        throw new ErroDeDocx(
          umaChave.length > 0
            ? `Este Word usa chave simples, como {${umaChave[0]}}. A variável precisa de duas chaves: {{${umaChave[0]}}}. Corrija no Word e envie de novo.`
            : "Este Word não tem nenhuma variável. Escreva marcações como {{CLIENTE_NOME}} onde o dado deve entrar (veja o guia de variáveis) e envie de novo."
        );
      }

      // 2. Upload file to storage
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${empresaId}/${Date.now()}_${sanitizedName}`;
      const { error: uploadError } = await supabase.storage.from("proposta-templates").upload(filePath, file);

      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

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

      if (error) {
        // O registro não entrou: não deixa o arquivo órfão no storage.
        await supabase.storage.from("proposta-templates").remove([filePath]);
        throw error;
      }
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
