import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContaEmpresa {
  id: string;
  nome: string;
  email: string;
}

export interface ConvitePendente {
  id: string;
  email: string;
  expira_em: string;
}

const CONTAS_KEY = ["equipe", "contas-livres"] as const;

/**
 * Logins ativos da empresa que ainda não estão ligados a nenhuma pessoa da Equipe.
 * É a lista do "Ligar a uma conta existente" (pessoa com e-mail diferente do login).
 */
export function useContasSemPessoa(empresaId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...CONTAS_KEY, empresaId],
    enabled: enabled && !!empresaId,
    queryFn: async (): Promise<ContaEmpresa[]> => {
      const [contas, ligadas] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .eq("empresa_id", empresaId!)
          .is("desativado_em", null),
        supabase
          .from("pessoas")
          .select("profile_id")
          .eq("empresa_id", empresaId!)
          .is("deleted_at", null)
          .not("profile_id", "is", null),
      ]);
      if (contas.error) throw contas.error;
      if (ligadas.error) throw ligadas.error;
      const usadas = new Set((ligadas.data ?? []).map((p) => p.profile_id));
      return (contas.data ?? [])
        .filter((c) => !usadas.has(c.id))
        .map((c) => ({
          id: c.id,
          nome: [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.email || "",
          email: c.email ?? "",
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });
}

/** Login ligado à pessoa (nome e e-mail da conta, que pode diferir do e-mail da Equipe). */
export function useContaDaPessoa(profileId: string | null | undefined) {
  return useQuery({
    queryKey: ["equipe", "conta", profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<ContaEmpresa | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("id", profileId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        nome: [data.first_name, data.last_name].filter(Boolean).join(" ").trim(),
        email: data.email ?? "",
      };
    },
  });
}

/** Convite ainda válido enviado para esta pessoa (só admin enxerga convites, pela RLS). */
export function useConvitePendente(pessoaId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["equipe", "convite", pessoaId],
    enabled: enabled && !!pessoaId,
    queryFn: async (): Promise<ConvitePendente | null> => {
      const { data, error } = await supabase
        .from("convites")
        .select("id, email, expira_em")
        .eq("pessoa_id", pessoaId!)
        .is("usado_em", null)
        .gt("expira_em", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Convida a pessoa da Equipe para o Pilar. A conta criada pelo convite é ligada a
 * ela no banco, mesmo que o login use outro e-mail (migration 20261207000000).
 */
export async function convidarPessoa(pessoa: { id: string; nome: string; email: string }) {
  const { data, error } = await supabase.functions.invoke("invite-user", {
    body: { email: pessoa.email.trim(), nome: pessoa.nome, role: "user", pessoa_id: pessoa.id },
  });
  if (error) throw error;
  return { contaExistente: Boolean(data?.conta_existente) };
}

/**
 * Invalida o que depende do vínculo pessoa ↔ conta dentro da Equipe e o "sem conta" das
 * menções. A lista de pessoas de Meu trabalho é invalidada pela página (onAcessoAlterado).
 */
function useInvalidarAcesso() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["equipe"] });
    queryClient.invalidateQueries({ queryKey: ["pessoas-sem-conta"] });
  };
}

export function useVincularConta() {
  const invalidar = useInvalidarAcesso();
  return useMutation({
    mutationFn: async ({ pessoaId, profileId }: { pessoaId: string; profileId: string | null }) => {
      // p_profile_id null desliga; o tipo gerado não expressa o null do argumento.
      const { error } = await supabase.rpc("vincular_pessoa_conta", {
        p_pessoa_id: pessoaId,
        p_profile_id: profileId as string,
      });
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

export function useConvidarPessoa() {
  const invalidar = useInvalidarAcesso();
  return useMutation({ mutationFn: convidarPessoa, onSuccess: invalidar });
}
