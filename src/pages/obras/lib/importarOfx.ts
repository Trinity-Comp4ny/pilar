/**
 * Extrato bancário (OFX) -> lançamentos da conta da obra.
 * Crédito vira aporte, débito vira despesa. Lê OFX 1.x (SGML, sem tag de fechamento)
 * e 2.x (XML). Só o que a conta precisa: data, valor, descrição e o id do banco.
 */

export type TransacaoOfx = {
  /** Id único da transação no banco (FITID). */
  fitid: string;
  /** yyyy-MM-dd */
  data: string;
  /** Positivo = crédito, negativo = débito. */
  valor: number;
  descricao: string;
};

type LinhaOfx = TransacaoOfx & {
  tipo: "aporte" | "despesa";
  /** Valor absoluto, o que a conta grava. */
  valorAbs: number;
  /** Já existe na conta (mesma data, tipo e valor): vem desmarcada. */
  duplicada: boolean;
};

export type PlanoOfx = {
  linhas: LinhaOfx[];
  erro?: string;
};

function tag(bloco: string, nome: string): string {
  // OFX 1.x não fecha a tag: o valor vai até a próxima "<" ou quebra de linha.
  const m = new RegExp(`<${nome}>([^<\\r\\n]*)`, "i").exec(bloco);
  return m ? m[1].trim() : "";
}

function dataOfx(bruto: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(bruto);
  if (!m) return null;
  const [, a, mes, d] = m;
  if (Number(mes) < 1 || Number(mes) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${a}-${mes}-${d}`;
}

/** "1.234,56" ou "-1234.56" -> número. O OFX usa ponto, mas há bancos que mandam vírgula. */
function valorOfx(bruto: string): number | null {
  let s = bruto.trim().replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Uma passada só: decodificar em etapas faria "&amp;lt;" virar "<" (dupla decodificação). */
function decodificarEntidades(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos);/g, (_, nome: string) => ENTIDADES[nome]);
}

export function lerOfx(texto: string): TransacaoOfx[] {
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  const saida: TransacaoOfx[] = [];
  blocos.forEach((corpo, i) => {
    const bloco = corpo.split(/<\/STMTTRN>/i)[0];
    const data = dataOfx(tag(bloco, "DTPOSTED"));
    const valor = valorOfx(tag(bloco, "TRNAMT"));
    if (!data || valor === null || valor === 0) return;
    const memo = decodificarEntidades(tag(bloco, "MEMO"));
    const nome = decodificarEntidades(tag(bloco, "NAME"));
    const descricao = [nome, memo].filter((p, idx, arr) => p && arr.indexOf(p) === idx).join(" - ") || "Lançamento do extrato";
    saida.push({ fitid: tag(bloco, "FITID") || `sem-id-${i}`, data, valor, descricao });
  });
  return saida;
}

type Existente = { tipo: string; data: string; valor: number | string };

/**
 * Monta o plano de importação. Marca como duplicada a transação que já está na conta
 * com mesma data, tipo e valor (reimportar o mesmo extrato não dobra os lançamentos).
 */
export function planejarOfx(texto: string, existentes: Existente[]): PlanoOfx {
  if (!/<OFX>/i.test(texto) && !/<STMTTRN>/i.test(texto)) {
    return { linhas: [], erro: "Isso não parece um extrato OFX. Peça ao banco o arquivo .ofx." };
  }
  const transacoes = lerOfx(texto);
  if (transacoes.length === 0) {
    return { linhas: [], erro: "Não encontrei nenhuma movimentação nesse extrato." };
  }
  const chave = (tipo: string, data: string, valor: number) => `${tipo}|${data}|${valor.toFixed(2)}`;
  const jaTem = new Map<string, number>();
  for (const e of existentes) {
    const k = chave(e.tipo, e.data, Number(e.valor));
    jaTem.set(k, (jaTem.get(k) ?? 0) + 1);
  }
  const linhas = transacoes.map((t): LinhaOfx => {
    const tipo = t.valor > 0 ? "aporte" : "despesa";
    const valorAbs = Math.abs(t.valor);
    const k = chave(tipo, t.data, valorAbs);
    const restante = jaTem.get(k) ?? 0;
    // Consome uma ocorrência por transação: dois PIX iguais no mesmo dia só marcam
    // duplicados se a conta já tiver os dois.
    if (restante > 0) jaTem.set(k, restante - 1);
    return { ...t, tipo, valorAbs, duplicada: restante > 0 };
  });
  return { linhas: linhas.sort((a, b) => a.data.localeCompare(b.data)) };
}
