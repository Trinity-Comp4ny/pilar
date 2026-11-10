// Coleta automática do CUB/m² no portal da CBIC (cub.org.br), regras puras.
//
// O portal tem uma página por UF (`/cub-m2-estadual/{UF}/`) com um formulário Django: escolhe-se o Sinduscon, o
// mês, o ano e o regime (com ou sem desoneração), e a resposta é o PDF da tabela do mês. Aqui ficam a leitura do
// formulário e a leitura do texto do PDF; o script `coletar.ts` faz a rede e o banco.
//
// O layout do PDF não está sob nosso controle, então a leitura é desconfiada: um PDF só vira linhas quando traz
// os 19 códigos da NBR 12721 com a contagem certa, valores em faixa plausível, padrão alto acima do normal e
// normal acima do baixo, e o mês e o regime pedidos. Qualquer falha recusa a UF inteira: preço errado é pior
// que nenhum, e a UF fica para a importação manual.
import { lerValor } from "@/pages/ultra-admin/estimativaCubImport";
import type { Regime, Uf } from "@/schemas/estimativaObra";

export type PadraoCub = "baixo" | "normal" | "alto" | "unico";

export interface LinhaCub {
  uf: Uf;
  subtipo: string;
  padrao: PadraoCub;
  valor_m2: number;
  mes_base: string;
  regime: Regime;
}

export interface OpcaoSinduscon {
  valor: string;
  rotulo: string;
}

const tirarAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
const chave = (t: string) =>
  tirarAcento(t)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

/** Token CSRF do Django: o campo escondido do formulário ou, na falta dele, o cookie `csrftoken`. */
export function lerCsrf(html: string, setCookie: string | null): string | null {
  const campo =
    /name=["']csrfmiddlewaretoken["'][^>]*value=["']([^"']+)["']/i.exec(html) ??
    /value=["']([^"']+)["'][^>]*name=["']csrfmiddlewaretoken["']/i.exec(html);
  if (campo) return campo[1];
  const cookie = /(?:^|[;,\s])csrftoken=([^;,\s]+)/.exec(setCookie ?? "");
  return cookie ? cookie[1] : null;
}

/** Junta os `Set-Cookie` da resposta num header `Cookie` (só nome=valor). */
export function cookiesDaResposta(setCookies: string[]): string {
  return setCookies
    .map((c) => c.split(";")[0].trim())
    .filter((c) => /^[^=\s]+=/.test(c))
    .join("; ");
}

/**
 * Texto de um trecho de HTML de site de terceiro, para log e para a coluna `fonte`. Tira as tags e depois
 * qualquer `<` ou `>` que sobre (tag quebrada ou aninhada, como `<<b>script>`): o resultado nunca carrega
 * marcação. Corta em 200 caracteres.
 */
export function textoPuro(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/[<>]/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/** Opções do `<select name="sinduscon">` da página da UF, sem o "-1" de "selecione". */
export function lerOpcoesSinduscon(html: string): OpcaoSinduscon[] {
  const select = /<select[^>]*name=["']sinduscon["'][^>]*>([\s\S]*?)<\/select>/i.exec(html);
  if (!select) return [];
  const opcoes: OpcaoSinduscon[] = [];
  for (const m of select[1].matchAll(/<option[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi)) {
    const valor = m[1].trim();
    const rotulo = textoPuro(m[2]);
    if (!valor || valor === "-1" || !/^\d+$/.test(valor)) continue;
    opcoes.push({ valor, rotulo });
  }
  return opcoes;
}

/**
 * Qual Sinduscon representa a UF. Ordem: o fixado em `fixos` (ex. `{ MG: "12" }`), a opção chamada
 * "Sinduscon-UF", a única opção. Mais de uma sem nome da UF é ambíguo: devolve null e a UF fica manual.
 */
export function escolherSinduscon(
  uf: Uf,
  opcoes: OpcaoSinduscon[],
  fixos: Partial<Record<Uf, string>> = {}
): OpcaoSinduscon | null {
  const fixo = fixos[uf];
  if (fixo) return opcoes.find((o) => o.valor === fixo) ?? null;
  const daUf = opcoes.filter((o) => chave(o.rotulo) === `SINDUSCON${uf}`);
  if (daUf.length === 1) return daUf[0];
  return opcoes.length === 1 ? opcoes[0] : null;
}

/** `CUB_SINDUSCON="MG=12,PR=3"` vira `{ MG: "12", PR: "3" }`. Entrada fora do formato é ignorada. */
export function lerFixos(texto: string): Partial<Record<Uf, string>> {
  const fixos: Partial<Record<Uf, string>> = {};
  for (const par of texto.split(",")) {
    const m = /^\s*([A-Z]{2})\s*=\s*(\d+)\s*$/.exec(par);
    if (m) fixos[m[1] as Uf] = m[2];
  }
  return fixos;
}

/** Campos do POST que gera o PDF da tabela do mês. */
export function formularioCub(
  uf: Uf,
  sinduscon: string,
  mes: string,
  regime: Regime,
  csrf: string
): Record<string, string> {
  const ano = mes.slice(0, 4);
  return {
    csrfmiddlewaretoken: csrf,
    uf,
    sinduscon,
    relatorio: "tabela-cub-m2",
    ano,
    ano_i: ano,
    ano_f: ano,
    mes: String(Number(mes.slice(5, 7))),
    desoneracao: regime === "desonerado" ? "com-desoneracao" : "sem-desoneracao",
    variacao: "com-variacao",
    cimento: "1",
    projeto: "1",
  };
}

// ─── Texto do PDF ────────────────────────────────────────────────────────────

export interface ItemDeTexto {
  texto: string;
  x: number;
  /** Altura na página, crescendo para cima (como o PDF guarda). */
  y: number;
}

/**
 * Remonta as linhas de uma página: agrupa os pedaços de texto pela altura (tolerância de meio corpo de letra)
 * e ordena de cima para baixo e da esquerda para a direita. Tabelas lado a lado viram uma linha só, o que a
 * leitura por ocorrência abaixo aceita.
 */
export function linhasDaPagina(itens: ItemDeTexto[], tolerancia = 3): string[] {
  const ordenados = itens.filter((i) => i.texto.trim() !== "").sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas: { y: number; itens: ItemDeTexto[] }[] = [];
  for (const item of ordenados) {
    const linha = linhas.find((l) => Math.abs(l.y - item.y) <= tolerancia);
    if (linha) linha.itens.push(item);
    else linhas.push({ y: item.y, itens: [item] });
  }
  return linhas
    .sort((a, b) => b.y - a.y)
    .map((l) =>
      l.itens
        .sort((a, b) => a.x - b.x)
        .map((i) => i.texto.trim())
        .join(" ")
    );
}

/**
 * Leitura por coluna: para tabelas lado a lado. As colunas começam onde os códigos começam (todo código de uma
 * tabela fica no mesmo x); cada item vai para a coluna em que cai, e cada coluna é lida de cima para baixo.
 */
export function linhasPorColuna(itens: ItemDeTexto[], tolerancia = 3): string[] {
  const inicios: number[] = [];
  for (const x of itens
    .filter((i) => RE_CODIGO.test(juntarCodigos(i.texto.trim())))
    .map((i) => i.x)
    .sort((a, b) => a - b)) {
    if (inicios.length === 0 || x - inicios[inicios.length - 1] > 20) inicios.push(x);
  }
  if (inicios.length < 2) return linhasDaPagina(itens, tolerancia);
  const colunas: ItemDeTexto[][] = inicios.map(() => []);
  for (const item of itens) {
    let k = 0;
    while (k + 1 < inicios.length && item.x >= inicios[k + 1] - tolerancia) k++;
    colunas[k].push(item);
  }
  return colunas.flatMap((c) => linhasDaPagina(c, tolerancia));
}

/**
 * Os códigos da NBR 12721 na ordem das tabelas do relatório (residencial baixo, normal, alto; comercial normal,
 * alto; especiais). Cada código que se repete tem um padrão por ocorrência: o primeiro R-1 é o baixo, o segundo
 * o normal, o terceiro o alto.
 */
const PADROES_POR_OCORRENCIA: Record<string, { subtipo: string; padroes: PadraoCub[] }> = {
  R1: { subtipo: "R1", padroes: ["baixo", "normal", "alto"] },
  PP4: { subtipo: "PP-4", padroes: ["baixo", "normal"] },
  R8: { subtipo: "R8", padroes: ["baixo", "normal", "alto"] },
  PIS: { subtipo: "PIS", padroes: ["baixo"] },
  R16: { subtipo: "R16", padroes: ["normal", "alto"] },
  CAL8: { subtipo: "CAL-8", padroes: ["normal", "alto"] },
  CSL8: { subtipo: "CSL-8", padroes: ["normal", "alto"] },
  CSL16: { subtipo: "CSL-16", padroes: ["normal", "alto"] },
  RP1Q: { subtipo: "RP1Q", padroes: ["unico"] },
  GI: { subtipo: "GI", padroes: ["unico"] },
};

/** Quantas linhas um PDF completo dá: a soma das ocorrências acima (19). */
export const TOTAL_CODIGOS = Object.values(PADROES_POR_OCORRENCIA).reduce((s, c) => s + c.padroes.length, 0);

/** "CAL - 8", "CSL - 16", "R - 1", "PP - 4" (com espaço, como no PDF do Sinduscon-MS) viram "CAL-8" etc. */
export function juntarCodigos(texto: string): string {
  return texto.replace(/(^|[^A-Za-z0-9])(R|PP|CAL|CSL|RP)\s+-\s+(\d{1,2}Q?)(?![0-9])/g, "$1$2-$3");
}

// "R-1" (padrão pela tabela) ou "R1-N" (padrão no próprio código, como no destaque do CUB médio).
const RE_CODIGO = /^(R-?1|PP-?4|R-?8|R-?16|PIS|CAL-?8|CSL-?8|CSL-?16|RP-?1Q|GI)(?:-([BNA]))?$/i;
const SUFIXO: Record<string, PadraoCub> = { B: "baixo", N: "normal", A: "alto" };
const RE_VALOR = /^(?:R\$)?\d{1,3}(?:\.\d{3})*,\d{2}$/;
const VALOR_MINIMO = 500;
const VALOR_MAXIMO = 30_000;

const MESES = [
  "JANEIRO",
  "FEVEREIRO",
  "MARCO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

export interface OpcoesLeitura {
  /** O regime precisa estar escrito no PDF (portal estadual, onde o regime não vem do formulário). */
  exigirRegimeNoTexto?: boolean;
}

export interface LeituraCub {
  linhas: LinhaCub[];
  erro: string | null;
}

/** Meses citados no texto como "Outubro/2026" ou "OUTUBRO DE 2026", no formato `AAAA-MM-01`. */
function mesesCitados(texto: string): Set<string> {
  const meses = new Set<string>();
  // "Outubro/2026", "OUTUBRO DE 2026" e "MÊS: OUTUBRO ANO: 2026" (Sinduscon-MS).
  const re = new RegExp(`(${MESES.join("|")})\\s*(?:/|DE|ANO:?)\\s*(\\d{4})`, "g");
  for (const m of texto.matchAll(re)) {
    meses.add(`${m[2]}-${String(MESES.indexOf(m[1]) + 1).padStart(2, "0")}-01`);
  }
  return meses;
}

/**
 * Lê as linhas de texto do PDF de uma UF, mês e regime. Pareia cada código com o primeiro valor em reais que
 * vem depois dele (a variação, com %, é pulada) e dá o padrão pela ordem de ocorrência.
 */
export function interpretarTextoCub(
  linhas: string[],
  uf: Uf,
  mes: string,
  regime: Regime,
  { exigirRegimeNoTexto = false }: OpcoesLeitura = {}
): LeituraCub {
  const falha = (erro: string): LeituraCub => ({ linhas: [], erro });
  const texto = tirarAcento(linhas.join("\n")).toUpperCase();

  const citados = mesesCitados(texto);
  if (!citados.has(mes)) {
    const outros = [...citados].sort().join(", ");
    return falha(`O PDF não é de ${mes.slice(5, 7)}/${mes.slice(0, 4)}${outros ? ` (cita ${outros})` : ""}.`);
  }
  const com = /COM\s+DESONERA|(?<!NAO\s)DESONERADO/.test(texto);
  const sem = /SEM\s+DESONERA|NAO\s+DESONERADO/.test(texto);
  if ((regime === "desonerado" && sem && !com) || (regime === "onerado" && com && !sem)) {
    return falha(`O PDF é do outro regime (pedido ${regime === "desonerado" ? "com" : "sem"} desoneração).`);
  }
  // Fora do formulário da CBIC o regime não vem do pedido: o desonerado precisa estar escrito no PDF. O onerado
  // é a série clássica, sem marca.
  if (exigirRegimeNoTexto && regime === "desonerado" && !com) {
    return falha("O PDF não diz que é com desoneração.");
  }

  const tokens = linhas.flatMap((l) => juntarCodigos(l).split(/\s+/).filter(Boolean));
  const ocorrencias = new Map<string, number>();
  const lidas: LinhaCub[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const cod = RE_CODIGO.exec(tokens[i]);
    if (!cod) continue;
    const id = cod[1].toUpperCase().replace(/-/g, "");
    const regra = PADROES_POR_OCORRENCIA[id];
    // Valor: o próximo token em reais antes do próximo código. "R$" solto e a variação em % são pulados.
    let valor: number | null = null;
    for (let j = i + 1; j < tokens.length && !RE_CODIGO.test(tokens[j]); j++) {
      if (tokens[j].includes("%")) continue;
      if (RE_VALOR.test(tokens[j])) {
        valor = lerValor(tokens[j]);
        break;
      }
    }
    if (valor === null) continue; // código citado em texto corrido, sem valor ao lado
    if (valor < VALOR_MINIMO || valor > VALOR_MAXIMO) {
      return falha(`Valor fora da faixa para ${regra.subtipo}: R$ ${valor}.`);
    }

    let padrao: PadraoCub | undefined;
    if (cod[2]) {
      // Padrão explícito no código: não conta como ocorrência da tabela.
      padrao = SUFIXO[cod[2].toUpperCase()];
      if (!regra.padroes.includes(padrao)) return falha(`${tokens[i]} não é um código do CUB.`);
    } else {
      const n = ocorrencias.get(id) ?? 0;
      ocorrencias.set(id, n + 1);
      padrao = regra.padroes[n];
      if (!padrao) return falha(`O código ${regra.subtipo} aparece mais vezes que o esperado.`);
    }
    const igual = lidas.find((l) => l.subtipo === regra.subtipo && l.padrao === padrao);
    if (igual) {
      if (igual.valor_m2 === valor) continue;
      return falha(`${regra.subtipo} ${padrao} aparece com dois valores (R$ ${igual.valor_m2} e R$ ${valor}).`);
    }
    lidas.push({ uf, subtipo: regra.subtipo, padrao, valor_m2: valor, mes_base: mes, regime });
  }

  const faltando = Object.values(PADROES_POR_OCORRENCIA).flatMap((r) =>
    r.padroes
      .filter((p) => !lidas.some((l) => l.subtipo === r.subtipo && l.padrao === p))
      .map((p) => `${r.subtipo} ${p}`)
  );
  if (faltando.length > 0) return falha(`Faltam no PDF: ${faltando.join(", ")}.`);

  // Padrão mais alto custa mais. Se não, a leitura trocou colunas ou tabelas.
  const ordem: PadraoCub[] = ["baixo", "normal", "alto"];
  for (const r of Object.values(PADROES_POR_OCORRENCIA)) {
    const valores = ordem.flatMap((p) => lidas.filter((l) => l.subtipo === r.subtipo && l.padrao === p));
    for (let k = 1; k < valores.length; k++) {
      if (valores[k].valor_m2 <= valores[k - 1].valor_m2) {
        return falha(
          `${r.subtipo} ${valores[k].padrao} (R$ ${valores[k].valor_m2}) não está acima do ${valores[k - 1].padrao} (R$ ${valores[k - 1].valor_m2}): a leitura do PDF não é confiável.`
        );
      }
    }
  }
  return { linhas: lidas, erro: null };
}

/** Variação máxima aceita de um mês para o seguinte. Acima disso é mais provável erro de leitura que de preço. */
export const VARIACAO_MAXIMA = 0.15;

/**
 * Confere contra o mês anterior da mesma UF e regime, quando existe. Devolve a primeira linha que mudou demais,
 * ou null.
 */
export function saltoSuspeito(
  novas: LinhaCub[],
  anteriores: Pick<LinhaCub, "subtipo" | "padrao" | "valor_m2">[]
): string | null {
  for (const n of novas) {
    const a = anteriores.find((x) => x.subtipo === n.subtipo && x.padrao === n.padrao);
    if (!a) continue;
    const variacao = Math.abs(n.valor_m2 - a.valor_m2) / a.valor_m2;
    if (variacao > VARIACAO_MAXIMA) {
      return `${n.subtipo} ${n.padrao} foi de R$ ${a.valor_m2} para R$ ${n.valor_m2} (${Math.round(variacao * 100)}%).`;
    }
  }
  return null;
}

const assinatura = (l: LeituraCub) =>
  l.linhas
    .map((x) => `${x.subtipo}|${x.padrao}|${x.valor_m2}`)
    .sort()
    .join(";");

/** Lê um conjunto de páginas por linha e por coluna e fica com a leitura que passa (as duas têm de concordar). */
function lerPaginas(paginas: ItemDeTexto[][], uf: Uf, mes: string, regime: Regime, opcoes: OpcoesLeitura): LeituraCub {
  const porLinha = interpretarTextoCub(
    paginas.flatMap((p) => linhasDaPagina(p)),
    uf,
    mes,
    regime,
    opcoes
  );
  const porColuna = interpretarTextoCub(
    paginas.flatMap((p) => linhasPorColuna(p)),
    uf,
    mes,
    regime,
    opcoes
  );
  if (porLinha.erro && porColuna.erro) return porLinha;
  if (porLinha.erro) return porColuna;
  if (porColuna.erro) return porLinha;
  if (assinatura(porLinha) !== assinatura(porColuna)) {
    return { linhas: [], erro: "O PDF admite duas leituras diferentes: layout ambíguo, nada aceito." };
  }
  return porLinha;
}

/**
 * Lê o PDF (itens de texto por página) por linha e por coluna e fica com a leitura que passa nas conferências.
 * Se o documento inteiro não passa (ex.: os dois regimes, um por página), tenta página por página e aceita só
 * se exatamente uma página passar.
 */
export function lerPdfCub(
  paginas: ItemDeTexto[][],
  uf: Uf,
  mes: string,
  regime: Regime,
  opcoes: OpcoesLeitura = {}
): LeituraCub {
  const inteiro = lerPaginas(paginas, uf, mes, regime, opcoes);
  if (!inteiro.erro || paginas.length < 2) return inteiro;
  const porPagina = paginas.map((p) => lerPaginas([p], uf, mes, regime, opcoes)).filter((l) => !l.erro);
  const distintas = new Set(porPagina.map(assinatura));
  if (distintas.size === 1) return porPagina[0];
  if (distintas.size > 1) {
    return { linhas: [], erro: "Mais de uma página do PDF serve para o mesmo regime: layout ambíguo, nada aceito." };
  }
  return inteiro;
}

/** O mesmo valor em todos os códigos que o mês anterior: arquivo repetido, não mês novo. */
export function igualAoAnterior(
  novas: LinhaCub[],
  anteriores: Pick<LinhaCub, "subtipo" | "padrao" | "valor_m2">[]
): boolean {
  if (anteriores.length === 0) return false;
  return novas.every((n) =>
    anteriores.some((a) => a.subtipo === n.subtipo && a.padrao === n.padrao && a.valor_m2 === n.valor_m2)
  );
}

// O banco só aceita subtipo no formato `^[A-Z]{1,3}[0-9]{0,2}(-[0-9]{1,2})?$`, e o motor não usa o RP1Q: ele é
// lido (para conferir que o PDF está completo) mas não é gravado.
const SUBTIPO_DO_BANCO = /^[A-Z]{1,3}[0-9]{0,2}(-[0-9]{1,2})?$/;

export function paraGravar(linhas: LinhaCub[]): LinhaCub[] {
  return linhas.filter((l) => SUBTIPO_DO_BANCO.test(l.subtipo));
}
