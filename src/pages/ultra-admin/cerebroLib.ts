// SPEC 169: agregação do cérebro de reuniões. Números saem daqui, nunca do modelo.
// Nesta fase nenhum item é "recomendação": só frequência (reuniões e escritórios distintos).

export const CATEGORIAS: Record<string, string> = {
  dor: "Dor",
  ideia: "Ideia",
  objecao: "Objeção",
  decisao: "Decisão",
  pedido_feature: "Pedido de feature",
  elogio: "Elogio",
  risco: "Risco",
  pratica_negocio: "Prática de negócio",
  concorrencia: "Concorrência",
};

export const TIPOS_REUNIAO: Record<string, string> = {
  discovery: "Descoberta",
  demo: "Demonstração",
  venda: "Venda",
  onboarding: "Onboarding",
  suporte: "Suporte",
  alinhamento_interno: "Alinhamento interno",
  parceiro: "Parceiro",
  outro: "Outro",
};

export const ORIGENS_CONTATO: Record<string, string> = {
  parente: "Parente ou amigo",
  indicacao: "Indicação",
  frio: "Contato frio",
  inbound: "Veio sozinho",
};

export interface LinhaInsight {
  id: string;
  reuniao_id: string;
  categoria: string;
  texto: string;
  citacao: string;
  modulo_pilar: string | null;
  removido: boolean;
  reuniao: { origem_nome: string | null; origem_contato: string | null } | null;
}

export interface FiltrosCerebro {
  categoria: string | null;
  modulo: string | null;
  escritorio: string | null;
}

export interface Tema {
  chave: string;
  categoria: string;
  modulo: string | null;
  reunioes: number;
  escritorios: number;
  exemplos: LinhaInsight[];
}

function chaveEscritorio(l: LinhaInsight): string {
  return (l.reuniao?.origem_nome ?? "").trim().toLowerCase() || `reuniao:${l.reuniao_id}`;
}

export function filtrar(linhas: LinhaInsight[], f: FiltrosCerebro): LinhaInsight[] {
  return linhas.filter(
    (l) =>
      !l.removido &&
      (!f.categoria || l.categoria === f.categoria) &&
      (!f.modulo || l.modulo_pilar === f.modulo) &&
      (!f.escritorio || (l.reuniao?.origem_nome ?? "") === f.escritorio)
  );
}

/** Um tema é categoria + módulo. Conta reuniões e escritórios distintos, ordenado por escritórios. */
export function agruparTemas(linhas: LinhaInsight[]): Tema[] {
  const grupos = new Map<string, LinhaInsight[]>();
  for (const l of linhas) {
    if (l.removido) continue;
    const chave = `${l.categoria}|${l.modulo_pilar ?? ""}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), l]);
  }
  return [...grupos.entries()]
    .map(([chave, itens]) => ({
      chave,
      categoria: itens[0].categoria,
      modulo: itens[0].modulo_pilar,
      reunioes: new Set(itens.map((i) => i.reuniao_id)).size,
      escritorios: new Set(itens.map(chaveEscritorio)).size,
      exemplos: itens.slice(0, 3),
    }))
    .sort((a, b) => b.escritorios - a.escritorios || b.reunioes - a.reunioes);
}

/** Proporção de reuniões por origem do contato, para o aviso de viés da rede pessoal. */
export function proporcaoPorOrigem(
  reunioes: Array<{ origem_contato: string | null }>
): Array<{ origem: string; reunioes: number; percentual: number }> {
  const total = reunioes.length;
  if (total === 0) return [];
  const contagem = new Map<string, number>();
  for (const r of reunioes) {
    const o = r.origem_contato ?? "sem_origem";
    contagem.set(o, (contagem.get(o) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([origem, n]) => ({ origem, reunioes: n, percentual: Math.round((n / total) * 100) }))
    .sort((a, b) => b.reunioes - a.reunioes);
}

export function percentualRedeProxima(reunioes: Array<{ origem_contato: string | null }>): number {
  if (reunioes.length === 0) return 0;
  const proximas = reunioes.filter((r) => r.origem_contato === "parente" || r.origem_contato === "indicacao").length;
  return Math.round((proximas / reunioes.length) * 100);
}
