/**
 * Leitura das linhas de novidade nos commits de um release (SPEC 152).
 *
 * Quem faz a mudança decide no commit se ela vai para o usuário:
 *
 *   Novidade: A fatura agora sai de dentro do projeto
 *   Impacto: fluxo            (fluxo | melhoria | correcao)
 *   Modulo: financeiro        (opcional: só quem usa o módulo recebe o destaque)
 *   Feedback: <uuid>          (opcional, SPEC 145: liga o item a quem pediu)
 *
 * Commit sem `Novidade:` é interno e não aparece. Linha fora do padrão não derruba o release:
 * vira aviso para o ultra admin revisar.
 */
export type Impacto = "fluxo" | "melhoria" | "correcao";

export interface Commit {
  sha: string;
  mensagem: string;
}

export interface ItemNota {
  texto: string;
  impacto: Impacto;
  modulo: string | null;
  feedback_ids: string[];
  commit_sha: string | null;
}

export interface Notas {
  itens: ItemNota[];
  avisos: string[];
}

export const MAX_COMMITS = 500;
export const MAX_TEXTO = 300;

const SHA = /^[0-9a-f]{7,40}$/;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const MODULO = /^[a-z][a-z0-9_-]{0,39}$/;

const IMPACTOS: Record<string, Impacto> = {
  fluxo: "fluxo",
  melhoria: "melhoria",
  correcao: "correcao",
  correção: "correcao",
};

function linhas(mensagem: string, chave: RegExp): string[] {
  return mensagem
    .split("\n")
    .map((l) => l.match(chave)?.[1]?.trim() ?? null)
    .filter((v): v is string => !!v);
}

function curto(sha: string | null): string {
  return sha ? sha.slice(0, 7) : "sem sha";
}

export function lerNotas(commits: Commit[]): Notas {
  const itens: ItemNota[] = [];
  const avisos: string[] = [];
  const vistos = new Set<string>();

  for (const commit of commits) {
    const textos = linhas(commit.mensagem, /^Novidade:\s*(.+)$/i);
    if (textos.length === 0) continue;

    const sha = SHA.test(commit.sha) ? commit.sha : null;
    const impactoBruto = linhas(commit.mensagem, /^Impacto:\s*(.+)$/i)[0];
    let impacto: Impacto = "melhoria";
    if (impactoBruto === undefined) {
      avisos.push(`${curto(sha)}: sem linha Impacto:, entrou como melhoria`);
    } else {
      const lido = IMPACTOS[impactoBruto.toLowerCase()];
      if (!lido) {
        avisos.push(`${curto(sha)}: Impacto "${impactoBruto}" fora de fluxo, melhoria ou correcao; item ignorado`);
        continue;
      }
      impacto = lido;
    }

    const moduloBruto = linhas(commit.mensagem, /^M[oó]dulo:\s*(.+)$/i)[0]?.toLowerCase();
    let modulo: string | null = null;
    if (moduloBruto !== undefined) {
      if (MODULO.test(moduloBruto)) modulo = moduloBruto;
      else avisos.push(`${curto(sha)}: Modulo "${moduloBruto}" inválido; item vale para todos`);
    }

    const feedbackIds = [
      ...new Set(
        linhas(commit.mensagem, /^Feedback:\s*(.+)$/i)
          .map((v) => v.match(UUID)?.[0]?.toLowerCase())
          .filter((v): v is string => !!v && v.length === 36)
      ),
    ];

    for (const bruto of textos) {
      const texto = bruto.length > MAX_TEXTO ? `${bruto.slice(0, MAX_TEXTO - 1)}…` : bruto;
      if (bruto.length > MAX_TEXTO) avisos.push(`${curto(sha)}: texto da novidade cortado em ${MAX_TEXTO} caracteres`);
      const chave = texto.toLowerCase();
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      itens.push({ texto, impacto, modulo, feedback_ids: feedbackIds, commit_sha: sha });
    }
  }

  // Mudança de fluxo primeiro: é o que abre o modal e o que o usuário precisa ler.
  const peso: Record<Impacto, number> = { fluxo: 0, melhoria: 1, correcao: 2 };
  itens.sort((a, b) => peso[a.impacto] - peso[b.impacto]);
  return { itens, avisos };
}

export type Entrada = { ok: true; sha: string; commits: Commit[] } | { ok: false; erro: string };

/** Corpo aceito: { sha: string, commits: { sha, mensagem }[] }. */
export function lerEntrada(corpo: unknown): Entrada {
  if (typeof corpo !== "object" || corpo === null) return { ok: false, erro: "corpo inválido" };
  const { sha, commits } = corpo as { sha?: unknown; commits?: unknown };
  if (typeof sha !== "string" || !SHA.test(sha)) return { ok: false, erro: "sha inválido" };
  if (!Array.isArray(commits)) return { ok: false, erro: "commits deve ser uma lista" };
  if (commits.length > MAX_COMMITS) return { ok: false, erro: `no máximo ${MAX_COMMITS} commits por release` };
  const lidos: Commit[] = [];
  for (const c of commits) {
    if (typeof c !== "object" || c === null) return { ok: false, erro: "commit inválido" };
    const { sha: s, mensagem } = c as { sha?: unknown; mensagem?: unknown };
    if (typeof s !== "string" || typeof mensagem !== "string") return { ok: false, erro: "commit inválido" };
    lidos.push({ sha: s.trim().toLowerCase(), mensagem: mensagem.slice(0, 20_000) });
  }
  return { ok: true, sha: sha.toLowerCase(), commits: lidos };
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Título padrão do rascunho, na data de Brasília: "Atualização de 10 de novembro de 2026". */
export function tituloPadrao(agora: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(agora);
  const pega = (t: string) => Number(partes.find((p) => p.type === t)?.value);
  return `Atualização de ${pega("day")} de ${MESES[pega("month") - 1]} de ${pega("year")}`;
}
