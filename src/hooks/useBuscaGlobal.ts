import { useQuery } from "@tanstack/react-query";
import { Building2, FileText, HardHat, UserPlus, Users, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type BuscaTipo = "cliente" | "projeto" | "fornecedor" | "lead" | "proposta" | "pessoa";

export type BuscaResultado = {
  tipo: BuscaTipo;
  id: string;
  label: string;
  rota: string;
  icon: typeof Building2;
};

export type BuscaGrupo = {
  tipo: BuscaTipo;
  label: string;
  itens: BuscaResultado[];
};

const LIMITE_POR_TIPO = 5;

/**
 * Cada entidade é buscada de forma independente. Uma falha isolada (RLS,
 * coluna, rede) vira lista vazia e não derruba as outras.
 */
async function buscarEntidade(fn: () => Promise<BuscaResultado[]>): Promise<BuscaResultado[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

async function buscar(termo: string): Promise<BuscaGrupo[]> {
  const like = `%${termo}%`;

  const [clientes, projetos, fornecedores, leads, propostas, pessoas] = await Promise.all([
    buscarEntidade(async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id,nome")
        .is("deleted_at", null)
        .ilike("nome", like)
        .limit(LIMITE_POR_TIPO);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        tipo: "cliente" as const,
        id: r.id,
        label: r.nome,
        rota: `/gestao/clientes/${r.id}`,
        icon: Building2,
      }));
    }),
    buscarEntidade(async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id,nome,codigo_projeto")
        .is("deleted_at", null)
        .ilike("nome", like)
        .limit(LIMITE_POR_TIPO);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        tipo: "projeto" as const,
        id: r.id,
        label: r.codigo_projeto ? `${r.codigo_projeto} ${r.nome}` : r.nome,
        rota: `/projetos/${r.id}`,
        icon: Calendar,
      }));
    }),
    buscarEntidade(async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id,nome")
        .is("deleted_at", null)
        .ilike("nome", like)
        .limit(LIMITE_POR_TIPO);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        tipo: "fornecedor" as const,
        id: r.id,
        label: r.nome,
        rota: `/obras/fornecedores/${r.id}`,
        icon: HardHat,
      }));
    }),
    buscarEntidade(async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id,nome")
        .is("deleted_at", null)
        .ilike("nome", like)
        .limit(LIMITE_POR_TIPO);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        tipo: "lead" as const,
        id: r.id,
        label: r.nome,
        rota: "/gestao/leads",
        icon: UserPlus,
      }));
    }),
    buscarEntidade(async () => {
      const { data, error } = await supabase
        .from("propostas")
        .select("id,titulo")
        .is("deleted_at", null)
        .ilike("titulo", like)
        .limit(LIMITE_POR_TIPO);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        tipo: "proposta" as const,
        id: r.id,
        label: r.titulo,
        rota: "/gestao/propostas",
        icon: FileText,
      }));
    }),
    buscarEntidade(async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id,nome")
        .is("deleted_at", null)
        .ilike("nome", like)
        .limit(LIMITE_POR_TIPO);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        tipo: "pessoa" as const,
        id: r.id,
        label: r.nome,
        rota: "/gestao/equipe",
        icon: Users,
      }));
    }),
  ]);

  const grupos: BuscaGrupo[] = [
    { tipo: "cliente", label: "Clientes", itens: clientes },
    { tipo: "projeto", label: "Projetos", itens: projetos },
    { tipo: "fornecedor", label: "Fornecedores", itens: fornecedores },
    { tipo: "lead", label: "Leads", itens: leads },
    { tipo: "proposta", label: "Propostas", itens: propostas },
    { tipo: "pessoa", label: "Pessoas", itens: pessoas },
  ];

  return grupos.filter((g) => g.itens.length > 0);
}

/**
 * Busca global client-side sobre as tabelas do tenant. A RLS por empresa já
 * filtra os registros, então não há filtro de empresa no client nem RPC.
 */
export function useBuscaGlobal(termo: string) {
  const termoLimpo = termo.trim();
  const enabled = termoLimpo.length >= 2;

  const query = useQuery({
    queryKey: ["busca-global", termoLimpo],
    queryFn: () => buscar(termoLimpo),
    enabled,
    staleTime: 30_000,
  });

  return {
    grupos: query.data ?? [],
    isFetching: query.isFetching,
    enabled,
  };
}
