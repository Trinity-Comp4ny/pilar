import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface TemplateDisciplina {
  disciplina: string;
  horas_estimadas: number;
  riscos: string[];
}

export interface TemplateFase {
  nome: string;
  disciplinas: TemplateDisciplina[];
  duracao_dias: number;
}

export interface TemplateChecklistItem {
  item: string;
  obrigatorio: boolean;
}

export interface TemplateProjeto {
  id: string;
  empresa_id: string;
  nome: string;
  tipo_servico: string;
  descricao: string | null;
  fases: TemplateFase[];
  checklist: TemplateChecklistItem[];
  ativo: boolean;
  created_at: string;
}

export interface TemplateInsert {
  nome: string;
  tipo_servico: string;
  descricao?: string;
  fases: TemplateFase[];
  checklist?: TemplateChecklistItem[];
}

export const TIPOS_SERVICO = [
  "Projeto Arquitetônico Residencial",
  "Projeto Arquitetônico Comercial",
  "Projeto Estrutural",
  "Projeto Elétrico",
  "Projeto Hidrossanitário",
  "Compatibilização",
  "Regularização",
  "Aprovação em Prefeitura",
  "Acompanhamento de Obra",
  "Interiores",
  "Urbanismo",
  "Outro",
] as const;

export const useTemplates = () => {
  return useQuery({
    queryKey: ["templates-projeto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates_projeto")
        .select("*")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("tipo_servico")
        .order("nome");

      if (error) throw error;

      return (data || []).map((t) => ({
        ...t,
        fases: (Array.isArray(t.fases) ? t.fases : []) as unknown as TemplateFase[],
        checklist: (Array.isArray(t.checklist) ? t.checklist : []) as unknown as TemplateChecklistItem[],
      })) as TemplateProjeto[];
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const useCreateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: TemplateInsert) => {
      const { data, error } = await supabase
        .from("templates_projeto")
        .insert({
          nome: template.nome,
          tipo_servico: template.tipo_servico,
          descricao: template.descricao || null,
          fases: template.fases as unknown as Json,
          checklist: (template.checklist || []) as unknown as Json,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates-projeto"] });
    },
  });
};

export const useUpdateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...template }: TemplateInsert & { id: string }) => {
      const { data, error } = await supabase
        .from("templates_projeto")
        .update({
          nome: template.nome,
          tipo_servico: template.tipo_servico,
          descricao: template.descricao || null,
          fases: template.fases as unknown as Json,
          checklist: (template.checklist || []) as unknown as Json,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates-projeto"] });
    },
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("templates_projeto")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates-projeto"] });
    },
  });
};
