import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AuxData {
  categorias: { id: string; nome: string }[];
  projetos: { id: string; codigo: string }[];
  contas: { id: string; nome: string }[];
  cartoes: { id: string; nome: string; tipo: string }[];
  clientes: { id: string; nome: string; chaves_pix?: Array<{ chave: string; tipo: string }> }[];
  fornecedores: { id: string; nome: string }[];
  centrosCusto: { id: string; nome: string; codigo: string | null }[];
  loading: boolean;
}

async function fetchFinanceAuxData(tipo: "receita" | "despesa"): Promise<Omit<AuxData, "loading">> {
  const tipoCat = tipo === "receita" ? "Receita" : "Despesa";

  const baseQueries = Promise.all([
    supabase.from("categorias_financeiras").select("id, nome").eq("tipo", tipoCat).order("nome"),
    supabase.from("projetos").select("id, codigo_projeto").is("deleted_at", null).order("nome"),
    supabase.from("contas").select("id, nome").is("deleted_at", null).order("nome"),
    supabase.from("centros_custo").select("id, nome, codigo").eq("ativo", true).is("deleted_at", null).order("nome"),
  ]);

  if (tipo === "receita") {
    const [[catsRes, projsRes, cntsRes, ccsRes], clisRes] = await Promise.all([
      baseQueries,
      supabase.from("clientes").select("id, nome, chaves_pix").order("nome"),
    ]);
    return {
      categorias: (catsRes.data ?? []).map((c) => ({ id: c.id, nome: c.nome })),
      projetos: (projsRes.data ?? []).map((p) => ({ id: p.id, codigo: p.codigo_projeto ?? "" })),
      contas: (cntsRes.data ?? []).map((c) => ({ id: c.id, nome: c.nome })),
      centrosCusto: (ccsRes.data ?? []).map((c) => ({ id: c.id, nome: c.nome, codigo: c.codigo })),
      clientes: (clisRes.data ?? []).map((c) => ({
        id: c.id,
        nome: c.nome,
        chaves_pix: Array.isArray(c.chaves_pix) ? (c.chaves_pix as Array<{ chave: string; tipo: string }>) : [],
      })),
      fornecedores: [],
      cartoes: [],
    };
  }

  const [[catsRes, projsRes, cntsRes, ccsRes], fornsRes, crtsRes] = await Promise.all([
    baseQueries,
    supabase.from("fornecedores").select("id, nome").order("nome"),
    supabase.from("cartoes").select("id, nome, tipo").is("deleted_at", null).order("nome"),
  ]);

  return {
    categorias: (catsRes.data ?? []).map((c) => ({ id: c.id, nome: c.nome })),
    projetos: (projsRes.data ?? []).map((p) => ({ id: p.id, codigo: p.codigo_projeto ?? "" })),
    contas: (cntsRes.data ?? []).map((c) => ({ id: c.id, nome: c.nome })),
    centrosCusto: (ccsRes.data ?? []).map((c) => ({ id: c.id, nome: c.nome, codigo: c.codigo })),
    clientes: [],
    fornecedores: (fornsRes.data ?? []).map((f) => ({ id: f.id, nome: f.nome })),
    cartoes: (crtsRes.data ?? []).map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo })),
  };
}

const EMPTY: Omit<AuxData, "loading"> = {
  categorias: [],
  projetos: [],
  contas: [],
  cartoes: [],
  clientes: [],
  fornecedores: [],
  centrosCusto: [],
};

export function useFinanceAuxData(tipo: "receita" | "despesa"): AuxData {
  const { data, isLoading } = useQuery({
    queryKey: ["finance-aux-data", tipo],
    queryFn: () => fetchFinanceAuxData(tipo),
    staleTime: 10 * 60 * 1000,
  });

  return { ...(data ?? EMPTY), loading: isLoading };
}
