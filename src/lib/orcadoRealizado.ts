// Orçado x realizado da obra por nível do cronograma (fase > etapa > serviço).
// O dinheiro (previsto e despesa) pendura em qualquer nó de `obra_frente`; aqui a árvore soma de baixo
// para cima para a tela mostrar o total de cada fase, etapa e serviço sem contar nada duas vezes.

export interface NoFinanceiro {
  id: string;
  parent_id: string | null;
  nivel: string;
  nome: string;
  ordem: number;
  created_at: string;
}

export interface LinhaOrcado {
  no: NoFinanceiro;
  nivel: "fase" | "etapa" | "servico";
  profundidade: number;
  /** "Fase › Etapa › Serviço": como o lançamento e a tela citam o nó. */
  caminho: string;
  /** Valor digitado neste nó (0 quando não há). */
  previstoProprio: number;
  /** Próprio, quando existe; senão a soma dos filhos. */
  previsto: number;
  /** Despesas deste nó mais as de todos os filhos. */
  realizado: number;
  filhos: LinhaOrcado[];
}

export interface OrcadoRealizado {
  raizes: LinhaOrcado[];
  /** Despesa lançada sem fase, etapa ou serviço. */
  semEtapa: number;
  totalPrevisto: number;
  totalRealizado: number;
}

const NIVEIS = ["fase", "etapa", "servico"] as const;
const porOrdem = (a: NoFinanceiro, b: NoFinanceiro) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at);

export function montarOrcadoRealizado(
  nos: ReadonlyArray<NoFinanceiro>,
  previstoPorNo: ReadonlyMap<string, number>,
  realizadoPorNo: Readonly<Record<string, number>>,
  semEtapa = 0
): OrcadoRealizado {
  const ids = new Set(nos.map((n) => n.id));
  const filhosDe = new Map<string | null, NoFinanceiro[]>();
  for (const n of nos) {
    const pai = n.parent_id && ids.has(n.parent_id) ? n.parent_id : null;
    filhosDe.set(pai, [...(filhosDe.get(pai) ?? []), n]);
  }

  const montar = (no: NoFinanceiro, profundidade: number, trilha: string[]): LinhaOrcado => {
    const caminho = [...trilha, no.nome];
    const filhos = (filhosDe.get(no.id) ?? []).sort(porOrdem).map((f) => montar(f, profundidade + 1, caminho));
    const previstoProprio = previstoPorNo.get(no.id) ?? 0;
    const somaFilhos = filhos.reduce((a, f) => a + f.previsto, 0);
    return {
      no,
      nivel: (NIVEIS as readonly string[]).includes(no.nivel) ? (no.nivel as LinhaOrcado["nivel"]) : "servico",
      profundidade,
      caminho: caminho.join(" › "),
      previstoProprio,
      previsto: previstoProprio > 0 ? previstoProprio : somaFilhos,
      realizado: (realizadoPorNo[no.id] ?? 0) + filhos.reduce((a, f) => a + f.realizado, 0),
      filhos,
    };
  };

  const raizes = (filhosDe.get(null) ?? []).sort(porOrdem).map((n) => montar(n, 0, []));
  return {
    raizes,
    semEtapa,
    totalPrevisto: raizes.reduce((a, r) => a + r.previsto, 0),
    totalRealizado: raizes.reduce((a, r) => a + r.realizado, 0) + semEtapa,
  };
}

/** A árvore em ordem de leitura, para listas e seletores. `aberto` filtra os filhos de nós recolhidos. */
export function achatarOrcado(raizes: ReadonlyArray<LinhaOrcado>, recolhidos?: ReadonlySet<string>): LinhaOrcado[] {
  const saida: LinhaOrcado[] = [];
  const visitar = (l: LinhaOrcado) => {
    saida.push(l);
    if (recolhidos?.has(l.no.id)) return;
    l.filhos.forEach(visitar);
  };
  raizes.forEach(visitar);
  return saida;
}
