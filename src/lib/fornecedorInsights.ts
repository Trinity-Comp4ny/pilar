/**
 * Núcleo da inteligência do fornecedor (spec 026): funções puras que derivam o
 * histórico do fornecedor a partir das linhas cruas de cotação e conta da obra.
 * Sem I/O aqui — o hook busca os dados e passa; assim os critérios de aceite viram
 * teste sem tocar no Supabase.
 */

/** Status derivado de uma proposta dentro da sua cotação. */
export type StatusProposta = "venceu" | "perdeu" | "aberta";

export function statusProposta(
  cotacaoStatus: string,
  propostaId: string,
  propostaVencedoraId: string | null
): StatusProposta {
  if (propostaVencedoraId && propostaVencedoraId === propostaId) return "venceu";
  if (cotacaoStatus === "aberta") return "aberta";
  return "perdeu";
}

/** Uma proposta do fornecedor, já enriquecida com a obra e o status derivado. */
export type PropostaInsight = {
  propostaId: string;
  cotacaoId: string;
  obraId: string;
  obraNome: string;
  descricao: string;
  valor: number;
  status: StatusProposta;
};

/** Uma compra real (lançamento de despesa da conta da obra) com o fornecedor. */
export type CompraInsight = {
  lancamentoId: string;
  obraId: string;
  obraNome: string;
  data: string;
  descricao: string;
  valor: number;
};

export type ResumoFornecedor = {
  obras: number;
  totalComprado: number;
  totalCotado: number;
  cotacoesParticipadas: number;
  vitorias: number;
  /** Fração 0–1 (vitórias / propostas enviadas). 0 quando não participou de nenhuma. */
  taxaVitoria: number;
  /** Média por compra. 0 quando não há compra. */
  ticketMedio: number;
  /** Data ISO da compra mais recente, ou null. */
  ultimaCompra: string | null;
};

export function calcularResumo(propostas: PropostaInsight[], compras: CompraInsight[]): ResumoFornecedor {
  const obras = new Set<string>();
  for (const p of propostas) obras.add(p.obraId);
  for (const c of compras) obras.add(c.obraId);

  const totalComprado = compras.reduce((acc, c) => acc + c.valor, 0);
  const totalCotado = propostas.reduce((acc, p) => acc + p.valor, 0);
  const vitorias = propostas.filter((p) => p.status === "venceu").length;
  const ultimaCompra = compras.reduce<string | null>((max, c) => (max === null || c.data > max ? c.data : max), null);

  return {
    obras: obras.size,
    totalComprado,
    totalCotado,
    cotacoesParticipadas: propostas.length,
    vitorias,
    taxaVitoria: propostas.length === 0 ? 0 : vitorias / propostas.length,
    ticketMedio: compras.length === 0 ? 0 : totalComprado / compras.length,
    ultimaCompra,
  };
}

export type ObraRollup = {
  obraId: string;
  obraNome: string;
  totalCotado: number;
  totalComprado: number;
  cotacoes: number;
  vitorias: number;
};

/** Uma linha por obra em que o fornecedor aparece (via cotação ou compra). */
export function agruparPorObra(propostas: PropostaInsight[], compras: CompraInsight[]): ObraRollup[] {
  const mapa = new Map<string, ObraRollup>();

  const garantir = (obraId: string, obraNome: string): ObraRollup => {
    let atual = mapa.get(obraId);
    if (!atual) {
      atual = { obraId, obraNome, totalCotado: 0, totalComprado: 0, cotacoes: 0, vitorias: 0 };
      mapa.set(obraId, atual);
    }
    return atual;
  };

  for (const p of propostas) {
    const linha = garantir(p.obraId, p.obraNome);
    linha.totalCotado += p.valor;
    linha.cotacoes += 1;
    if (p.status === "venceu") linha.vitorias += 1;
  }
  for (const c of compras) {
    const linha = garantir(c.obraId, c.obraNome);
    linha.totalComprado += c.valor;
  }

  return [...mapa.values()].sort((a, b) => b.totalComprado - a.totalComprado);
}

/**
 * Normaliza um nome de fornecedor para casar texto livre com cadastro:
 * minúsculas, sem acento, sem pontuação e sem sufixos de razão social
 * (ltda, me, epp, sa, eireli). "Concreteira X Ltda." ≈ "concreteira x".
 */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira diacríticos (combining marks)
    .toLowerCase()
    .replace(/[.,/\-()]/g, " ")
    .replace(/\b(ltda|me|epp|sa|s\/a|eireli|cia)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pontua a semelhança entre um nome solto e um cadastro (0–1) para sugerir a
 * reconciliação. Exato = 1; um contém o outro = 0.85; mesma primeira palavra = 0.6.
 */
export function scoreSemelhanca(nomeLivre: string, nomeCadastro: string): number {
  const a = normalizarNome(nomeLivre);
  const b = normalizarNome(nomeCadastro);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const [pa] = a.split(" ");
  const [pb] = b.split(" ");
  if (pa && pa === pb) return 0.6;
  return 0;
}

export type SugestaoFornecedor = { id: string; nome: string } | null;

/** Melhor cadastro para um nome solto, acima do limiar. Null se nada convence. */
export function sugerirFornecedor(
  nomeLivre: string,
  cadastro: Array<{ id: string; nome: string }>,
  limiar = 0.6
): SugestaoFornecedor {
  let melhor: SugestaoFornecedor = null;
  let melhorScore = 0;
  for (const f of cadastro) {
    const s = scoreSemelhanca(nomeLivre, f.nome);
    if (s > melhorScore) {
      melhorScore = s;
      melhor = { id: f.id, nome: f.nome };
    }
  }
  return melhorScore >= limiar ? melhor : null;
}
