// Coleta automática dos preços de referência da estimativa de obra (CUB e SINAPI).
//
// Regras puras, sem rede e sem relógio: quais meses buscar, onde está o arquivo do SINAPI na página da Caixa,
// qual planilha usar dentro do zip e se o preço está atrasado. O script `coletar-sinapi.ts` faz a rede e o banco;
// a leitura da planilha é a mesma da importação manual (`interpretarSinapi`), então o que entra pelo robô passa
// pelas mesmas validações do que entra pela tela.

/** Mês-base no formato do banco: `AAAA-MM-01`. */
export type MesBase = string;

const RE_MES = /^(\d{4})-(0[1-9]|1[0-2])-01$/;

export function mesValido(mes: string): boolean {
  return RE_MES.test(mes);
}

function somarMeses(mes: MesBase, n: number): MesBase {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(ano, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** O mês de referência mais novo que pode existir em `hoje`: o mês anterior (o SINAPI e o CUB saem no mês seguinte). */
export function mesMaisNovoPossivel(hoje: Date): MesBase {
  const atual = `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return somarMeses(atual, -1);
}

/**
 * Meses a buscar, do mais antigo ao mais novo: os que vêm depois do último já gravado, até o mês anterior a
 * `hoje`. Sem nada gravado, ou com o banco muito para trás, busca só os `janela` meses mais recentes: a Caixa
 * não mantém o histórico inteiro no mesmo endereço, e mês velho não muda estimativa nova.
 */
export function mesesPendentes(ultimoGravado: MesBase | null, hoje: Date, janela = 3): MesBase[] {
  const fim = mesMaisNovoPossivel(hoje);
  const piso = somarMeses(fim, -(janela - 1));
  let inicio = ultimoGravado && mesValido(ultimoGravado) ? somarMeses(ultimoGravado, 1) : piso;
  if (inicio < piso) inicio = piso;
  const meses: MesBase[] = [];
  for (let m = inicio; m <= fim; m = somarMeses(m, 1)) meses.push(m);
  return meses;
}

/** Nome do zip que a Caixa publica para o mês: `SINAPI-2026-09-formato-xlsx.zip`. */
export function nomeDoZipSinapi(mes: MesBase): string {
  return `SINAPI-${mes.slice(0, 7)}-formato-xlsx.zip`;
}

export interface ArquivoSinapi {
  mes: MesBase;
  url: string;
  /** Nome do arquivo, como aparece no link. */
  nome: string;
  /** 0 para a publicação original, N para `_RetificacaoNN`. */
  retificacao: number;
}

const RE_ZIP = /SINAPI-(\d{4})-(0[1-9]|1[0-2])-formato-xlsx(?:_Retificacao(\d{1,2}))?\.zip/i;

/**
 * Acha na página da Caixa os links dos zips mensais e fica, por mês, com a retificação mais recente.
 * Lê só `href`: o resto da página muda sem aviso.
 */
export function acharZipsSinapi(html: string, paginaUrl: string): Map<MesBase, ArquivoSinapi> {
  const achados = new Map<MesBase, ArquivoSinapi>();
  const hrefs = html.matchAll(/href\s*=\s*["']([^"']+)["']/gi);
  for (const [, bruto] of hrefs) {
    const href = bruto.replace(/&amp;/g, "&");
    let decodificado = href;
    try {
      decodificado = decodeURIComponent(href);
    } catch {
      // `%` solto no link: lê como veio.
    }
    const m = RE_ZIP.exec(decodificado);
    if (!m) continue;
    let url: string;
    try {
      url = new URL(href, paginaUrl).toString();
    } catch {
      continue;
    }
    if (!url.startsWith("https://")) continue;
    const mes = `${m[1]}-${m[2]}-01`;
    const retificacao = m[3] ? Number(m[3]) : 0;
    const anterior = achados.get(mes);
    if (anterior && anterior.retificacao >= retificacao) continue;
    achados.set(mes, { mes, url, nome: m[0], retificacao });
  }
  return achados;
}

/**
 * Onde buscar o zip do mês: o link achado na página, se houver; senão o endereço direto pelo nome padrão
 * (a página da Caixa já mudou de layout mais de uma vez, o nome do arquivo não).
 */
export function arquivoDoMes(mes: MesBase, achados: Map<MesBase, ArquivoSinapi>, baseDownload: string): ArquivoSinapi {
  const achado = achados.get(mes);
  if (achado) return achado;
  const nome = nomeDoZipSinapi(mes);
  return { mes, url: `${baseDownload.replace(/\/+$/, "")}/${nome}`, nome, retificacao: 0 };
}

/**
 * A planilha de preços dentro do zip: `SINAPI_Referência_AAAA_MM.xlsx` (o acento pode vir estragado,
 * conforme quem compactou). Devolve null se não houver exatamente uma do mês pedido.
 */
export function planilhaDoZip(nomes: string[], mes: MesBase): string | null {
  const [ano, m] = mes.split("-");
  const re = new RegExp(`(^|/)SINAPI_Refer[^/]*_${ano}_${m}\\.xlsx$`, "i");
  const candidatas = nomes.filter((n) => re.test(n) && !n.split("/").pop()!.startsWith("~$"));
  return candidatas.length === 1 ? candidatas[0] : null;
}

/** Texto de `fonte` gravado em cada linha: diz que veio do robô e de qual arquivo, para auditar e para achar retificação. */
export function fonteDaColeta(arquivo: ArquivoSinapi): string {
  return `SINAPI ${arquivo.mes.slice(5, 7)}/${arquivo.mes.slice(0, 4)} (coleta automática: ${arquivo.nome})`.slice(
    0,
    200
  );
}

/**
 * Um mês já gravado deve ser lido de novo quando a Caixa publicou uma retificação mais nova que a gravada.
 * `fonteGravada` é o texto de `fonte` de uma linha do mês (da importação manual ou do robô).
 */
export function precisaReimportar(fonteGravada: string, achado: ArquivoSinapi): boolean {
  if (achado.retificacao === 0) return false;
  const m = /_Retificacao(\d{1,2})\.zip/i.exec(fonteGravada);
  const gravada = m ? Number(m[1]) : 0;
  return achado.retificacao > gravada;
}

export type Base = "cub" | "sinapi";

/** Dia do mês a partir do qual a falta do mês anterior é atraso (CUB sai até o dia 5, SINAPI perto do dia 9). */
export const PRAZO_DIA: Record<Base, number> = { cub: 10, sinapi: 15 };

export interface Atraso {
  base: Base;
  esperado: MesBase;
  ultimo: MesBase | null;
}

/**
 * O preço está atrasado quando, passado o prazo do mês, o banco não tem o mês anterior. Antes do prazo,
 * basta ter o mês retrasado. Devolve null quando está em dia.
 */
export function atraso(base: Base, ultimoGravado: MesBase | null, hoje: Date): Atraso | null {
  const maisNovo = mesMaisNovoPossivel(hoje);
  const esperado = hoje.getUTCDate() >= PRAZO_DIA[base] ? maisNovo : somarMeses(maisNovo, -1);
  if (ultimoGravado && ultimoGravado >= esperado) return null;
  return { base, esperado, ultimo: ultimoGravado };
}
