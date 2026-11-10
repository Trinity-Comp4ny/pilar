/**
 * Markdown do blog, num subconjunto pequeno e previsível: `##`/`###`, parágrafo,
 * lista `-` e `1.`, `> destaque`, tabela com pipes, `**negrito**` e `[link](/rota)`.
 * Sem biblioteca: o bundle da landing não paga por um parser completo, e o que
 * não está aqui não deveria aparecer num artigo (HTML solto, imagem sem alt).
 *
 * Aqui fica a leitura (texto → blocos); o desenho está em `Markdown.tsx`.
 */

export type Bloco =
  | { tipo: "h2" | "h3"; texto: string; id: string }
  | { tipo: "p" | "destaque"; texto: string }
  | { tipo: "ul" | "ol"; itens: string[] }
  | { tipo: "tabela"; cabecalho: string[]; linhas: string[][] };

/** "Como fazer RDO?" → "como-fazer-rdo": âncora estável para o sumário. */
export function ancora(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const celulas = (linha: string) =>
  linha
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

export function analisarMarkdown(fonte: string): Bloco[] {
  const blocos: Bloco[] = [];
  const linhas = fonte.replace(/\r\n/g, "\n").split("\n");
  let i = 0;

  while (i < linhas.length) {
    const linha = linhas[i];
    const limpa = linha.trim();

    if (!limpa) {
      i++;
      continue;
    }

    const titulo = limpa.match(/^(#{2,3})\s+(.+)$/);
    if (titulo) {
      const texto = titulo[2].trim();
      blocos.push({ tipo: titulo[1].length === 2 ? "h2" : "h3", texto, id: ancora(texto) });
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(limpa) || /^\d+\.\s+/.test(limpa)) {
      const ordenada = /^\d+\.\s+/.test(limpa);
      const padrao = ordenada ? /^\d+\.\s+/ : /^[-*]\s+/;
      const itens: string[] = [];
      while (i < linhas.length && padrao.test(linhas[i].trim())) {
        itens.push(linhas[i].trim().replace(padrao, ""));
        i++;
      }
      blocos.push({ tipo: ordenada ? "ol" : "ul", itens });
      continue;
    }

    if (limpa.startsWith(">")) {
      const partes: string[] = [];
      while (i < linhas.length && linhas[i].trim().startsWith(">")) {
        partes.push(linhas[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocos.push({ tipo: "destaque", texto: partes.join(" ").trim() });
      continue;
    }

    if (limpa.startsWith("|") && i + 1 < linhas.length && /^\|?\s*:?-{2,}/.test(linhas[i + 1].trim())) {
      const cabecalho = celulas(limpa);
      i += 2;
      const corpo: string[][] = [];
      while (i < linhas.length && linhas[i].trim().startsWith("|")) {
        corpo.push(celulas(linhas[i]));
        i++;
      }
      blocos.push({ tipo: "tabela", cabecalho, linhas: corpo });
      continue;
    }

    const paragrafo: string[] = [];
    while (i < linhas.length) {
      const atual = linhas[i].trim();
      if (!atual || /^(#{2,3}\s|[-*]\s|\d+\.\s|>|\|)/.test(atual)) break;
      paragrafo.push(atual);
      i++;
    }
    blocos.push({ tipo: "p", texto: paragrafo.join(" ") });
  }

  return blocos;
}

/** Texto sem marcação, para JSON-LD e meta. */
export const textoSemMarcacao = (texto: string) =>
  texto.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

/**
 * Perguntas da seção "Perguntas frequentes" (cada `###` seguido do parágrafo de
 * resposta). Vira o FAQPage do artigo.
 */
export function perguntasFrequentes(blocos: Bloco[]): { pergunta: string; resposta: string }[] {
  const inicio = blocos.findIndex((b) => b.tipo === "h2" && /perguntas frequentes/i.test(b.texto));
  if (inicio < 0) return [];
  const faq: { pergunta: string; resposta: string }[] = [];
  for (let i = inicio + 1; i < blocos.length; i++) {
    const b = blocos[i];
    if (b.tipo === "h2") break;
    if (b.tipo !== "h3") continue;
    const respostas: string[] = [];
    for (let j = i + 1; j < blocos.length && blocos[j].tipo === "p"; j++) {
      respostas.push(textoSemMarcacao((blocos[j] as { texto: string }).texto));
    }
    if (respostas.length) faq.push({ pergunta: b.texto, resposta: respostas.join(" ") });
  }
  return faq;
}
