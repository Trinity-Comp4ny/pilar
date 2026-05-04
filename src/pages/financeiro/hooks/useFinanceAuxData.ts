import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AuxData {
  categorias: { id: string; nome: string }[];
  projetos: { id: string; codigo: string }[];
  contas: { id: string; nome: string }[];
  cartoes: { id: string; nome: string }[];
  clientes: { id: string; nome: string; chaves_pix?: Array<{ chave: string; tipo: string }> }[];
  fornecedores: { id: string; nome: string }[];
  centrosCusto: { id: string; nome: string; codigo: string | null }[];
  loading: boolean;
}

export function useFinanceAuxData(tipo: "receita" | "despesa"): AuxData {
  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([]);
  const [projetos, setProjetos] = useState<{ id: string; codigo: string }[]>([]);
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);
  const [cartoes, setCartoes] = useState<{ id: string; nome: string }[]>([]);
  const [clientes, setClientes] = useState<
    { id: string; nome: string; chaves_pix?: Array<{ chave: string; tipo: string }> }[]
  >([]);
  const [fornecedores, setFornecedores] = useState<{ id: string; nome: string }[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<{ id: string; nome: string; codigo: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        const tipoCat = tipo === "receita" ? "Receita" : "Despesa";
        const [{ data: cats }, { data: projs }, { data: cnts }, { data: ccs }] = await Promise.all([
          supabase.from("categorias_financeiras").select("id, nome").eq("tipo", tipoCat).order("nome"),
          supabase.from("projetos").select("id, codigo_projeto").order("nome"),
          supabase.from("contas").select("id, nome").order("nome"),
          supabase
            .from("centros_custo")
            .select("id, nome, codigo")
            .eq("ativo", true)
            .is("deleted_at", null)
            .order("nome"),
        ]);

        if (cancelled) return;
        setCategorias((cats ?? []).map((c) => ({ id: c.id, nome: c.nome })));
        setProjetos((projs ?? []).map((p) => ({ id: p.id, codigo: p.codigo_projeto ?? "" })));
        setContas((cnts ?? []).map((c) => ({ id: c.id, nome: c.nome })));
        setCentrosCusto((ccs ?? []).map((c) => ({ id: c.id, nome: c.nome, codigo: c.codigo })));

        if (tipo === "receita") {
          type ClientePix = { id: string; nome: string; chaves_pix: Array<{ chave: string; tipo: string }> | null };
          const { data: clis } = await (
            supabase as unknown as {
              from: (t: string) => {
                select: (c: string) => { order: (col: string) => Promise<{ data: ClientePix[] | null }> };
              };
            }
          )
            .from("clientes")
            .select("id, nome, chaves_pix")
            .order("nome");
          if (!cancelled)
            setClientes(
              (clis ?? []).map((c) => ({
                id: c.id,
                nome: c.nome,
                chaves_pix: Array.isArray(c.chaves_pix) ? c.chaves_pix : [],
              }))
            );
        } else {
          type FornRow = { id: string; nome: string };
          type CartaoRow = { id: string; nome: string };
          const [{ data: forns }, { data: crts }] = await Promise.all([
            supabase.from("fornecedores").select("id, nome").order("nome") as unknown as Promise<{
              data: FornRow[] | null;
            }>,
            supabase.from("cartoes").select("id, nome").order("nome") as unknown as Promise<{
              data: CartaoRow[] | null;
            }>,
          ]);
          if (!cancelled) {
            setFornecedores((forns ?? []).map((f) => ({ id: f.id, nome: f.nome })));
            setCartoes((crts ?? []).map((c) => ({ id: c.id, nome: c.nome })));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => {
      cancelled = true;
    };
  }, [tipo]);

  return { categorias, projetos, contas, cartoes, clientes, fornecedores, centrosCusto, loading };
}
