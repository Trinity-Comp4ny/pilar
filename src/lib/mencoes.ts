const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `@all` e `@todos` avisam todos da empresa (SPEC 131). */
const TODOS = "[Aa][Ll][Ll]|[Tt][Oo][Dd][Oo][Ss]";

export interface SegmentoMencao {
  texto: string;
  /** Id da pessoa quando o trecho é "@Nome" de alguém conhecido. */
  pessoaId: string | null;
  /** Trecho é "@all" ou "@todos". */
  todos?: boolean;
}

type Pessoa = { id: string; nome: string };

/**
 * Regex que casa "@Nome" para qualquer pessoa da lista (nomes mais longos primeiro) e
 * "@all"/"@todos". O token de todos exige fim de palavra: "@allan" não é "@all".
 */
export function regexMencoes(pessoas: Pessoa[]): RegExp {
  const nomes = [...pessoas.map((p) => p.nome).filter(Boolean)].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const alternativas = [...nomes, `(?:${TODOS})(?![\\p{L}\\p{N}_])`];
  return new RegExp(`@(?:${alternativas.join("|")})`, "gu");
}

/** Segmenta o texto em trechos comuns, "@Nome" de pessoas da lista e "@all". */
export function segmentarMencoes(texto: string, pessoas: Pessoa[]): SegmentoMencao[] {
  const porNome = new Map(pessoas.map((p) => [p.nome, p.id]));
  const segmentos: SegmentoMencao[] = [];
  let ultimo = 0;
  for (const match of texto.matchAll(regexMencoes(pessoas))) {
    const inicio = match.index ?? 0;
    const nome = match[0].slice(1);
    const pessoaId = porNome.get(nome) ?? null;
    // "@all" colado em outra palavra (joao@all.com) é texto, não marcação.
    if (!pessoaId && inicio > 0 && !/\s/.test(texto[inicio - 1])) continue;
    if (inicio > ultimo) segmentos.push({ texto: texto.slice(ultimo, inicio), pessoaId: null });
    segmentos.push(pessoaId ? { texto: match[0], pessoaId } : { texto: match[0], pessoaId: null, todos: true });
    ultimo = inicio + match[0].length;
  }
  if (ultimo < texto.length) segmentos.push({ texto: texto.slice(ultimo), pessoaId: null });
  return segmentos;
}

/** Ids das pessoas marcadas no texto, sem repetir, na ordem em que aparecem. */
export function idsMencionados(texto: string, pessoas: Pessoa[]): string[] {
  const ids = segmentarMencoes(texto, pessoas).flatMap((s) => (s.pessoaId ? [s.pessoaId] : []));
  return [...new Set(ids)];
}

/** O texto marca todos (`@all` ou `@todos`)? */
export function mencionaTodos(texto: string): boolean {
  return segmentarMencoes(texto, []).some((s) => s.todos);
}
