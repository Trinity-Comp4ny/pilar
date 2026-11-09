// SPEC 137 (BEZ-69): leitura do relatório mensal de preços de insumos do SINAPI (planilha da Caixa).
//
// Funções puras: recebem as células já lidas das abas ISD (encargos sem desoneração) e ICD (com desoneração) e
// devolvem só os preços dos códigos que o catálogo usa, mais os erros por linha, para a tela mostrar a prévia
// antes de gravar. Formato diferente do esperado recusa o arquivo inteiro: preço de referência errado é pior
// que nenhum (validar na fronteira, falhar cedo e claro).
//
// Layout conferido no arquivo de set/2026 (SINAPI_Referência_AAAA_MM.xlsx): título na linha 2, mês em
// "Mês de Referência" (linha 3, coluna B, MM/AAAA), cabeçalho com "Código do Insumo" e as UFs a partir da
// coluna F, e uma linha por insumo: classificação, código, descrição, unidade, origem (C ou CR) e o preço por
// UF. Preço em branco quer dizer que não houve coleta mínima naquela UF no mês.
import { UFS, type Regime, type Uf } from "@/schemas/estimativaObra";

export type CelulaBruta = unknown;

export interface AbaSinapi {
  /** Nome da aba no arquivo: "ISD" ou "ICD". */
  nome: string;
  celulas: CelulaBruta[][];
}

export interface ItemDoCatalogo {
  id: string;
  rotulo: string;
}

export interface LinhaSinapiLida {
  codigo: number;
  uf: Uf;
  regime: Regime;
  mes_base: string;
  valor: number;
  origem: "C" | "CR";
  descricao: string;
  unidade: string;
}

interface ErroSinapi {
  aba: string;
  /** Linha na planilha (1 = primeira), para apontar o erro. */
  linha: number;
  mensagem: string;
}

interface CodigoSemPreco {
  codigo: number;
  rotulo: string;
}

export interface CoberturaDoCodigo {
  codigo: number;
  rotulo: string;
  regime: Regime;
  ufs: number;
}

export interface ResultadoSinapi {
  mesBase: string | null;
  linhas: LinhaSinapiLida[];
  erros: ErroSinapi[];
  /** Regimes cuja aba foi lida (a aba ausente não é erro, mas o regime fica sem preço novo). */
  regimes: Regime[];
  /** Quantas UFs com preço cada código do catálogo tem em cada regime lido. */
  cobertura: CoberturaDoCodigo[];
  /** Códigos do catálogo que não aparecem na planilha, ou aparecem sem preço em nenhuma UF. */
  semPreco: CodigoSemPreco[];
  /** Problema que impede a leitura inteira. */
  erroGeral: string | null;
}

const ABAS: Record<string, Regime> = { ISD: "onerado", ICD: "desonerado" };
const TEXTO_DO_REGIME: Record<Regime, string> = { onerado: "SEM DESONERACAO", desonerado: "COM DESONERACAO" };
const PRIMEIRA_COLUNA_DE_UF = 5;
const LINHAS_PARA_ACHAR_CABECALHO = 20;
const PRECO_MAXIMO = 100_000_000;

/** Tira acento, caixa e espaços repetidos: "Código do\nInsumo" vira "CODIGO DO INSUMO". */
function normalizar(c: CelulaBruta): string {
  return String(c ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const vazia = (c: CelulaBruta) => c === "" || c === null || c === undefined;

function lerMes(celulas: CelulaBruta[][]): string | null {
  for (const linha of celulas.slice(0, 8)) {
    if (!normalizar(linha[0]).startsWith("MES DE REFERENCIA")) continue;
    const m = /^(\d{2})\/(\d{4})$/.exec(String(linha[1] ?? "").trim());
    if (!m) return null;
    const mes = Number(m[1]);
    const ano = Number(m[2]);
    return mes >= 1 && mes <= 12 && ano >= 2000 && ano <= 2100 ? `${ano}-${m[1]}-01` : null;
  }
  return null;
}

function achaCabecalho(celulas: CelulaBruta[][]): number {
  const fim = Math.min(celulas.length, LINHAS_PARA_ACHAR_CABECALHO);
  for (let i = 0; i < fim; i++) {
    if (normalizar(celulas[i][0]) === "CLASSIFICACAO" && normalizar(celulas[i][1]) === "CODIGO DO INSUMO") return i;
  }
  return -1;
}

interface LeituraDaAba {
  linhas: LinhaSinapiLida[];
  erros: ErroSinapi[];
  mesBase: string | null;
  achados: Map<number, number>;
  erroGeral: string | null;
}

function lerAba(aba: AbaSinapi, catalogo: Map<number, ItemDoCatalogo>): LeituraDaAba {
  const regime = ABAS[aba.nome];
  const vazio = (erroGeral: string): LeituraDaAba => ({
    linhas: [],
    erros: [],
    mesBase: null,
    achados: new Map(),
    erroGeral,
  });

  const titulo = normalizar(aba.celulas[1]?.[0]);
  if (!titulo.includes("RELATORIO DE PRECOS DE INSUMOS") || !titulo.includes(TEXTO_DO_REGIME[regime])) {
    return vazio(
      `A aba ${aba.nome} não é o relatório de preços de insumos ${regime === "onerado" ? "sem" : "com"} desoneração. Envie o arquivo SINAPI_Referência do mês, como saiu do zip da Caixa.`
    );
  }
  const mesBase = lerMes(aba.celulas);
  if (!mesBase) return vazio(`Não achei o mês de referência (MM/AAAA) na aba ${aba.nome}.`);

  const cab = achaCabecalho(aba.celulas);
  if (cab < 0) return vazio(`Não achei o cabeçalho "Código do Insumo" na aba ${aba.nome}.`);

  const colunasUf: { indice: number; uf: Uf }[] = [];
  const vistas = new Set<string>();
  const cabecalho = aba.celulas[cab];
  for (let i = PRIMEIRA_COLUNA_DE_UF; i < cabecalho.length; i++) {
    const sigla = normalizar(cabecalho[i]);
    if (!sigla) continue;
    if (!(UFS as readonly string[]).includes(sigla) || vistas.has(sigla)) {
      return vazio(
        `A coluna ${i + 1} da aba ${aba.nome} (${String(cabecalho[i])}) não é uma UF válida ou está repetida.`
      );
    }
    vistas.add(sigla);
    colunasUf.push({ indice: i, uf: sigla as Uf });
  }
  if (colunasUf.length === 0) return vazio(`A aba ${aba.nome} não tem colunas de UF.`);

  const linhas: LinhaSinapiLida[] = [];
  const erros: ErroSinapi[] = [];
  const achados = new Map<number, number>();
  const jaLidos = new Set<number>();
  for (let i = cab + 1; i < aba.celulas.length; i++) {
    const celulas = aba.celulas[i];
    const codigo = Number(celulas[1]);
    if (!Number.isInteger(codigo) || codigo <= 0 || !catalogo.has(codigo)) continue;
    const numero = i + 1;
    const erro = (mensagem: string) => erros.push({ aba: aba.nome, linha: numero, mensagem });
    if (jaLidos.has(codigo)) {
      erro(`O código ${codigo} aparece mais de uma vez.`);
      continue;
    }
    jaLidos.add(codigo);

    const origem = normalizar(celulas[4]);
    const descricao = String(celulas[2] ?? "").trim();
    const unidade = String(celulas[3] ?? "").trim();
    if (origem !== "C" && origem !== "CR") {
      erro(`Origem do preço do código ${codigo} deve ser C ou CR (veio "${String(celulas[4] ?? "")}").`);
      continue;
    }
    if (!descricao || !unidade) {
      erro(`O código ${codigo} está sem descrição ou unidade.`);
      continue;
    }

    let comPreco = 0;
    for (const { indice, uf } of colunasUf) {
      const bruto = celulas[indice];
      if (vazia(bruto)) continue;
      const valor = typeof bruto === "number" ? bruto : Number(String(bruto).replace(",", "."));
      if (!Number.isFinite(valor) || valor <= 0 || valor >= PRECO_MAXIMO) {
        erro(`Preço inválido do código ${codigo} em ${uf}: "${String(bruto)}".`);
        continue;
      }
      comPreco++;
      linhas.push({
        codigo,
        uf,
        regime,
        mes_base: mesBase,
        valor: Math.round(valor * 100) / 100,
        origem,
        descricao: descricao.slice(0, 300),
        unidade: unidade.slice(0, 20),
      });
    }
    achados.set(codigo, comPreco);
  }
  return { linhas, erros, mesBase, achados, erroGeral: null };
}

/**
 * Interpreta as abas do relatório. `catalogo` diz quais códigos guardar (os do catálogo da estimativa): o
 * resto do SINAPI, que passa de 4 mil insumos, não entra no banco.
 */
export function interpretarSinapi(abas: AbaSinapi[], catalogo: Map<number, ItemDoCatalogo>): ResultadoSinapi {
  const vazio = (erroGeral: string): ResultadoSinapi => ({
    mesBase: null,
    linhas: [],
    erros: [],
    regimes: [],
    cobertura: [],
    semPreco: [],
    erroGeral,
  });
  const lidas = abas.filter((a) => a.nome in ABAS);
  if (lidas.length === 0) {
    return vazio("O arquivo não tem as abas ISD e ICD. Envie o SINAPI_Referência do mês, como saiu do zip da Caixa.");
  }
  if (catalogo.size === 0) return vazio("O catálogo da estimativa não tem nenhum item com código do SINAPI.");

  const resultados = lidas.map((a) => ({ aba: a, ...lerAba(a, catalogo) }));
  const falha = resultados.find((r) => r.erroGeral);
  if (falha) return vazio(falha.erroGeral as string);

  const meses = new Set(resultados.map((r) => r.mesBase));
  if (meses.size > 1) return vazio("As abas ISD e ICD são de meses diferentes. Envie o arquivo de um mês só.");

  const linhas = resultados.flatMap((r) => r.linhas);
  const cobertura: CoberturaDoCodigo[] = resultados.flatMap((r) =>
    [...catalogo].map(([codigo, item]) => ({
      codigo,
      rotulo: item.rotulo,
      regime: ABAS[r.aba.nome],
      ufs: r.achados.get(codigo) ?? 0,
    }))
  );
  const comPreco = new Set(linhas.map((l) => l.codigo));
  return {
    mesBase: resultados[0].mesBase,
    linhas,
    erros: resultados.flatMap((r) => r.erros),
    regimes: resultados.map((r) => ABAS[r.aba.nome]),
    cobertura,
    semPreco: [...catalogo]
      .filter(([codigo]) => !comPreco.has(codigo))
      .map(([codigo, item]) => ({ codigo, rotulo: item.rotulo })),
    erroGeral: null,
  };
}

/** Códigos do SINAPI que o catálogo usa, a partir dos parâmetros do motor. */
export function codigosDoCatalogo(
  adicionais: Record<string, { rotulo: string; sinapi?: { codigo: number } } | undefined>
): Map<number, ItemDoCatalogo> {
  const mapa = new Map<number, ItemDoCatalogo>();
  for (const [id, a] of Object.entries(adicionais)) {
    if (a?.sinapi) mapa.set(a.sinapi.codigo, { id, rotulo: a.rotulo });
  }
  return mapa;
}

export interface LinhaSinapiGravada {
  codigo: number;
  uf: Uf;
  regime: Regime;
  mes_base: string;
  created_at: string;
}

export interface ResumoSinapi {
  mesBase: string;
  regime: Regime;
  codigos: number;
  ufs: number;
  linhas: number;
  ultimaImportacao: string;
}

/** Uma linha por mês e regime já importados, do mais novo para o mais antigo. */
export function resumirSinapi(gravadas: LinhaSinapiGravada[]): ResumoSinapi[] {
  const grupos = new Map<string, { m: ResumoSinapi; codigos: Set<number>; ufs: Set<string> }>();
  for (const l of gravadas) {
    const k = `${l.mes_base}|${l.regime}`;
    let g = grupos.get(k);
    if (!g) {
      g = {
        m: { mesBase: l.mes_base, regime: l.regime, codigos: 0, ufs: 0, linhas: 0, ultimaImportacao: l.created_at },
        codigos: new Set(),
        ufs: new Set(),
      };
      grupos.set(k, g);
    }
    g.codigos.add(l.codigo);
    g.ufs.add(l.uf);
    g.m.linhas++;
    if (l.created_at > g.m.ultimaImportacao) g.m.ultimaImportacao = l.created_at;
  }
  return [...grupos.values()]
    .map(({ m, codigos, ufs }) => ({ ...m, codigos: codigos.size, ufs: ufs.size }))
    .sort((a, b) => b.mesBase.localeCompare(a.mesBase) || a.regime.localeCompare(b.regime));
}
