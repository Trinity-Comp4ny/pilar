const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface SegmentoMencao {
  texto: string;
  /** Id da pessoa quando o trecho é "@Nome" de alguém conhecido. */
  pessoaId: string | null;
}

/** Regex que casa "@Nome" para qualquer pessoa da lista (nomes mais longos primeiro). */
export function regexMencoes(pessoas: { id: string; nome: string }[]): RegExp | null {
  const nomes = pessoas.map((p) => p.nome).filter(Boolean);
  if (nomes.length === 0) return null;
  const alternativas = [...nomes].sort((a, b) => b.length - a.length).map(escapeRegExp);
  return new RegExp(`@(?:${alternativas.join("|")})`, "g");
}

/** Segmenta o texto em trechos comuns e trechos "@Nome" que batem com pessoas da lista. */
export function segmentarMencoes(texto: string, pessoas: { id: string; nome: string }[]): SegmentoMencao[] {
  const regex = regexMencoes(pessoas);
  if (!regex) return [{ texto, pessoaId: null }];
  const porNome = new Map(pessoas.map((p) => [p.nome, p.id]));
  const segmentos: SegmentoMencao[] = [];
  let ultimo = 0;
  for (const match of texto.matchAll(regex)) {
    const inicio = match.index ?? 0;
    if (inicio > ultimo) segmentos.push({ texto: texto.slice(ultimo, inicio), pessoaId: null });
    segmentos.push({ texto: match[0], pessoaId: porNome.get(match[0].slice(1)) ?? null });
    ultimo = inicio + match[0].length;
  }
  if (ultimo < texto.length) segmentos.push({ texto: texto.slice(ultimo), pessoaId: null });
  return segmentos;
}
