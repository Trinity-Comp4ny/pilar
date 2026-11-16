import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PlanoImportacao } from "@/pages/obras/lib/importarCronograma";

const LOTE = 200;

async function inserirEmLotes<T>(
  linhas: T[],
  inserir: (lote: T[]) => PromiseLike<{ error: { message: string } | null }>
) {
  for (let i = 0; i < linhas.length; i += LOTE) {
    const { error } = await inserir(linhas.slice(i, i + LOTE));
    if (error) throw new Error(error.message);
  }
}

/**
 * Grava o plano lido da planilha (ou montado de um fluxo): fases, depois etapas, serviços e tarefas, cada nível
 * num lote só. Os ids nascem no cliente, então o filho já aponta para o pai sem esperar resposta. As fases novas
 * entram depois das que a obra já tem; nada existente é alterado.
 */
export async function gravarPlanoDoCronograma(
  obraId: string,
  projetoId: string | null,
  fasesExistentes: number,
  plano: PlanoImportacao
): Promise<{ nos: number; tarefas: number }> {
  const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
  if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");

  const ids = new Map(plano.itens.map((i) => [i.chave, crypto.randomUUID()]));
  const ordemNoPai = new Map<string, number>();
  const linhasNo = plano.itens.map((i) => {
    const pai = i.paiChave ?? "";
    const ordem = (ordemNoPai.get(pai) ?? (i.paiChave === null ? fasesExistentes : 0)) as number;
    ordemNoPai.set(pai, ordem + 1);
    return {
      id: ids.get(i.chave)!,
      empresa_id: empresaId,
      obra_id: obraId,
      nome: i.nome,
      nivel: i.nivel,
      parent_id: i.paiChave ? (ids.get(i.paiChave) ?? null) : null,
      ordem,
      data_inicio: i.inicio,
      data_fim: i.fim,
      fornecedor_id: i.fornecedorId ?? null,
    };
  });

  for (const nivel of ["fase", "etapa", "servico"] as const) {
    await inserirEmLotes(
      linhasNo.filter((l) => l.nivel === nivel),
      (lote) => supabase.from("obra_frente").insert(lote)
    );
  }

  await inserirEmLotes(
    plano.tarefas.map((t) => ({
      empresa_id: empresaId,
      obra_id: obraId,
      projeto_id: projetoId,
      obra_frente_id: ids.get(t.servicoChave) ?? null,
      titulo: t.titulo,
      data_inicio: t.inicio,
      prazo: t.prazo,
    })),
    (lote) => supabase.from("tarefas").insert(lote)
  );

  return { nos: plano.itens.length, tarefas: plano.tarefas.length };
}

export function useImportarCronograma(obraId: string, projetoId: string | null, fasesExistentes: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plano: PlanoImportacao) => gravarPlanoDoCronograma(obraId, projetoId, fasesExistentes, plano),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra_frente", obraId] });
      qc.invalidateQueries({ queryKey: ["obra_tarefas", obraId] });
      qc.invalidateQueries({ queryKey: ["tarefas"] });
    },
  });
}
