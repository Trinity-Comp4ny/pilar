import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FiltersData {
  categorias: { id: string; nome: string; tipo: string }[];
  projetos: { id: string; codigo: string }[];
  clientes: { id: string; nome: string }[];
  fornecedores: { id: string; nome: string }[];
  loading: boolean;
}

export const FORMAS_PAGAMENTO = [
  "PIX",
  "Transferência",
  "Boleto",
  "Dinheiro",
  "Cartão de Crédito",
  "Cartão de Débito",
] as const;

export function useLancamentosFiltersData(): FiltersData {
  const [categorias, setCategorias] = useState<FiltersData["categorias"]>([]);
  const [projetos, setProjetos] = useState<FiltersData["projetos"]>([]);
  const [clientes, setClientes] = useState<FiltersData["clientes"]>([]);
  const [fornecedores, setFornecedores] = useState<FiltersData["fornecedores"]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const [cats, projs, clis, forns] = await Promise.all([
          supabase.from("categorias_financeiras").select("id, nome, tipo").order("nome"),
          supabase.from("projetos").select("id, codigo_projeto").order("nome"),
          supabase.from("clientes").select("id, nome").order("nome"),
          // gen:types não inclui "fornecedores" ainda; cast defensivo até regeneração.
          supabase.from("fornecedores").select("id, nome").order("nome") as unknown as Promise<{
            data: { id: string; nome: string }[] | null;
          }>,
        ]);
        if (cancelled) return;
        setCategorias((cats.data ?? []).map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo })));
        setProjetos(
          (projs.data ?? []).map((p) => ({ id: p.id, codigo: p.codigo_projeto ?? "" })).filter((p) => p.codigo)
        );
        setClientes((clis.data ?? []).map((c) => ({ id: c.id, nome: c.nome })));
        setFornecedores((forns.data ?? []).map((f) => ({ id: f.id, nome: f.nome })));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { categorias, projetos, clientes, fornecedores, loading };
}
