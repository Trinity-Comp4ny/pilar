import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { ItemTrabalho } from "./useItensTrabalho";

export const TODOS = "todos";
export const NENHUM = "nenhum";

export function obraIdDoItem(i: ItemTrabalho): string | null {
  return i.tarefa?.obra?.id ?? null;
}

/** `todos` não filtra, `nenhum` pega quem não tem o vínculo, e um id pega só aquele projeto ou obra. */
export function bate(valorDoItem: string | null, filtro: string): boolean {
  if (filtro === TODOS) return true;
  if (filtro === NENHUM) return !valorDoItem;
  return valorDoItem === filtro;
}

/** Id e nome de todas as obras da empresa, para o filtro listar até as que ainda não têm tarefa. */
function useObrasDoFiltro(enabled: boolean) {
  return useQuery({
    queryKey: ["tarefas-filtro-obras"],
    enabled,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<{ id: string; nome: string }[]> => {
      const { data, error } = await supabase.from("obras").select("id, nome").is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Projeto e Obra: dois filtros simples, cada um com "Sem ..." para as tarefas gerais do escritório.
 * Ficam na URL (`?projeto=` e `?obra=`); dentro da obra eles não existem.
 */
export function useFiltroProjetoObra(
  naObra: boolean,
  itens: ItemTrabalho[],
  projetos: { id: string; nome: string }[] | undefined
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filtroProjeto = naObra ? TODOS : (searchParams.get("projeto") ?? TODOS);
  const filtroObra = naObra ? TODOS : (searchParams.get("obra") ?? TODOS);
  const setFiltroUrl = (chave: "projeto" | "obra", v: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v === TODOS) next.delete(chave);
        else next.set(chave, v);
        return next;
      },
      { replace: true }
    );
  const { data: obrasDaEmpresa } = useObrasDoFiltro(!naObra);
  const { opcoesProjeto, opcoesObra } = useMemo(() => {
    const obras = new Map<string, string>((obrasDaEmpresa ?? []).map((o) => [o.id, o.nome]));
    const projs = new Map<string, string>((projetos ?? []).map((p) => [p.id, p.nome]));
    for (const i of itens) {
      const oid = obraIdDoItem(i);
      if (oid && i.tarefa?.obra) obras.set(oid, i.tarefa.obra.nome);
      if (i.projetoId && i.projetoNome) projs.set(i.projetoId, i.projetoNome);
    }
    const porNome = (a: [string, string], b: [string, string]) => a[1].localeCompare(b[1], "pt-BR");
    const lista = (m: Map<string, string>) => [...m].sort(porNome).map(([value, label]) => ({ value, label }));
    return {
      opcoesProjeto: [{ value: TODOS, label: "Todos" }, { value: NENHUM, label: "Sem projeto" }, ...lista(projs)],
      opcoesObra: [{ value: TODOS, label: "Todas" }, { value: NENHUM, label: "Sem obra" }, ...lista(obras)],
    };
  }, [itens, obrasDaEmpresa, projetos]);
  return { filtroProjeto, filtroObra, setFiltroUrl, opcoesProjeto, opcoesObra };
}
