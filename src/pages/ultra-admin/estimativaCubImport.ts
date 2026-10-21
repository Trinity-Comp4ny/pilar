// SPEC 136 (BEZ-13): leitura da planilha mensal do CUB que o ultra admin importa.
//
// Funções puras: recebem as células já lidas (CSV ou Excel) e devolvem as linhas prontas e os erros
// por linha, para a tela mostrar a prévia antes de gravar. Nada é gravado enquanto houver erro: preço
// de referência errado é pior que nenhum (validar na fronteira, falhar cedo e claro).
import { UFS, type Regime, type Uf } from "@/schemas/estimativaObra";
import { rotuloMesBase } from "@/lib/estimativaObra";

type PadraoCub = "baixo" | "normal" | "alto" | "unico";

export interface LinhaCubLida {
  /** Número da linha na planilha (1 = primeira), para apontar o erro. */
  linha: number;
  uf: Uf;
  subtipo: string;
  padrao: PadraoCub;
  valor_m2: number;
  mes_base: string;
  regime: Regime;
}

interface ErroLinha {
  linha: number;
  mensagem: string;
}

export interface ResultadoImportacao {
  linhas: LinhaCubLida[];
  erros: ErroLinha[];
  /** Linhas com conteúdo que o leitor tentou interpretar (válidas ou não). */
  totalLidas: number;
  /** Problema que impede a leitura inteira (sem cabeçalho, arquivo vazio, mês inválido). */
  erroGeral: string | null;
}

export const LIMITE_LINHAS = 5000;
const VALOR_MINIMO = 100;
const VALOR_MAXIMO = 100_000;

/** Tira acento, caixa e tudo que não é letra, número, `$` ou `/`: "R$/m²" vira "r$/m2". */
function chave(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/²/g, "2")
    .toLowerCase()
    .replace(/[^a-z0-9$/]/g, "");
}

type Coluna = "uf" | "codigo" | "subtipo" | "padrao" | "valor";
type MapaColunas = Partial<Record<Coluna, number>>;

/** Que coluna este cabeçalho é, pelo nome já normalizado por `chave`. Aceita "Valor (R$/m²)", "Estado" etc. */
function classificar(k: string): Coluna | null {
  if (k === "uf" || k === "estado" || k === "sigla") return "uf";
  if (
    k.startsWith("valor") ||
    k.includes("r$/m2") ||
    k.includes("r$m2") ||
    k.includes("rs/m2") ||
    k.startsWith("preco")
  ) {
    return "valor";
  }
  if (k.startsWith("subtipo")) return "subtipo";
  if (k.startsWith("padrao") || k === "acabamento") return "padrao";
  if (k === "codigo" || k.startsWith("codigocub") || k === "cub" || k.startsWith("projeto") || k === "tipo")
    return "codigo";
  return null;
}

function mapearCabecalho(celulas: string[]): MapaColunas {
  const mapa: MapaColunas = {};
  celulas.forEach((celula, i) => {
    const coluna = classificar(chave(celula));
    if (coluna && mapa[coluna] === undefined) mapa[coluna] = i;
  });
  return mapa;
}

function cabecalhoServe(m: MapaColunas): boolean {
  return (
    m.uf !== undefined &&
    m.valor !== undefined &&
    (m.codigo !== undefined || (m.subtipo !== undefined && m.padrao !== undefined))
  );
}

const SUFIXO_PADRAO: Record<string, PadraoCub> = { B: "baixo", N: "normal", A: "alto" };

/** `R1-A` → { subtipo: "R1", padrao: "alto" }; `GI` → { subtipo: "GI", padrao: undefined }. */
function lerCodigo(bruto: string): { subtipo: string; padrao?: PadraoCub } | null {
  const limpo = bruto.replace(/\s+/g, "").toUpperCase();
  const m = /^([A-Z]{1,3}[0-9]{0,2}(?:-[0-9]{1,2})?)(?:-([BNA]))?$/.exec(limpo);
  if (!m) return null;
  return { subtipo: m[1], padrao: m[2] ? SUFIXO_PADRAO[m[2]] : undefined };
}

function lerPadrao(bruto: string): PadraoCub | "ausente" | null {
  const k = chave(bruto);
  if (k === "" || k === "-" || k === "unico" || k === "unica") return k === "" || k === "-" ? "ausente" : "unico";
  if (k === "baixo" || k === "b") return "baixo";
  if (k === "normal" || k === "n") return "normal";
  if (k === "alto" || k === "a") return "alto";
  return null;
}

/**
 * Aceita "3.350,00", "R$ 3.350,00", "3350,5", "3350.50", "2.700" e "3,350.00". Devolve null se não
 * for um número escrito de um jeito que dê para ter certeza do que significa.
 */
export function lerValor(bruto: string): number | null {
  const t = bruto.replace(/R\$/gi, "").replace(/\s+/g, "");
  if (/^\d+$/.test(t)) return Number(t);
  // Brasileiro: milhar com ponto, decimal com vírgula.
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(t) || /^\d+,\d{1,2}$/.test(t))
    return Number(t.replace(/\./g, "").replace(",", "."));
  // Internacional: milhar com vírgula, decimal com ponto.
  if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(t) || /^\d+\.\d{1,2}$/.test(t)) return Number(t.replace(/,/g, ""));
  // Só milhar com ponto: "2.700" é dois mil e setecentos.
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  return null;
}

/**
 * Lê as células de uma planilha do CUB para um mês-base e um regime (com ou sem desoneração; a planilha
 * é de um regime só). Reconhece o cabeçalho nas primeiras 20 linhas: UF, valor e o código do CUB
 * (`R1-A`) ou subtipo e padrão em colunas separadas.
 */
export function interpretarPlanilhaCub(
  celulas: string[][],
  mesBase: string,
  regime: Regime = "onerado"
): ResultadoImportacao {
  const vazio = (erroGeral: string): ResultadoImportacao => ({ linhas: [], erros: [], totalLidas: 0, erroGeral });

  if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(mesBase)) return vazio("Escolha o mês-base da tabela.");

  let idxCabecalho = -1;
  let mapa: MapaColunas = {};
  for (let i = 0; i < Math.min(celulas.length, 20); i++) {
    const candidato = mapearCabecalho(celulas[i]);
    if (cabecalhoServe(candidato)) {
      idxCabecalho = i;
      mapa = candidato;
      break;
    }
  }
  if (idxCabecalho < 0) {
    return vazio(
      "Não achamos as colunas UF, valor e o código do CUB (ou subtipo e padrão). Confira o cabeçalho da planilha."
    );
  }

  const celula = (linha: string[], coluna: Coluna): string => {
    const i = mapa[coluna];
    return i === undefined ? "" : String(linha[i] ?? "").trim();
  };

  const linhas: LinhaCubLida[] = [];
  const erros: ErroLinha[] = [];
  const vistas = new Map<string, number>();
  let totalLidas = 0;

  for (let i = idxCabecalho + 1; i < celulas.length; i++) {
    const linha = celulas[i];
    if (linha.every((c) => String(c ?? "").trim() === "")) continue;
    totalLidas++;
    const numero = i + 1;
    if (totalLidas > LIMITE_LINHAS) {
      return vazio(`A planilha passa de ${LIMITE_LINHAS} linhas. Envie só a tabela do mês.`);
    }
    const falha = (mensagem: string) => erros.push({ linha: numero, mensagem });

    const uf = celula(linha, "uf").toUpperCase();
    if (!(UFS as readonly string[]).includes(uf)) {
      falha(uf ? `UF "${uf}" desconhecida` : "UF ausente");
      continue;
    }

    let subtipo: string | undefined;
    let padrao: PadraoCub | undefined;
    const codigoBruto = celula(linha, "codigo");
    if (codigoBruto) {
      const lido = lerCodigo(codigoBruto);
      if (!lido) {
        falha(`Código "${codigoBruto}" não é um código de CUB`);
        continue;
      }
      subtipo = lido.subtipo;
      padrao = lido.padrao;
    } else {
      const subBruto = celula(linha, "subtipo");
      const lido = subBruto ? lerCodigo(subBruto) : null;
      if (!lido || lido.padrao) {
        falha(subBruto ? `Subtipo "${subBruto}" não é um código de CUB` : "Subtipo ausente");
        continue;
      }
      subtipo = lido.subtipo;
    }

    if (!padrao) {
      const lido = lerPadrao(celula(linha, "padrao"));
      if (lido === null) {
        falha(`Padrão "${celula(linha, "padrao")}" desconhecido (use baixo, normal ou alto)`);
        continue;
      }
      if (lido === "ausente") {
        if (subtipo !== "GI") {
          falha("Padrão ausente");
          continue;
        }
        padrao = "unico";
      } else {
        padrao = lido;
      }
    }

    const valorBruto = celula(linha, "valor");
    const valor = lerValor(valorBruto);
    if (valor === null) {
      falha(valorBruto ? `Valor "${valorBruto}" não é um número` : "Valor ausente");
      continue;
    }
    if (valor <= 0) {
      falha("O valor deve ser maior que zero");
      continue;
    }
    if (valor < VALOR_MINIMO) {
      falha(`O valor está abaixo de R$ ${VALOR_MINIMO} por m², confira a unidade`);
      continue;
    }
    if (valor >= VALOR_MAXIMO) {
      falha(`O valor passa de R$ ${VALOR_MAXIMO.toLocaleString("pt-BR")} por m², confira a unidade`);
      continue;
    }

    const id = `${uf}|${subtipo}|${padrao}`;
    const anterior = vistas.get(id);
    if (anterior !== undefined) {
      falha(`Repetida: já está na linha ${anterior}`);
      continue;
    }
    vistas.set(id, numero);
    linhas.push({
      linha: numero,
      uf: uf as Uf,
      subtipo,
      padrao,
      valor_m2: Math.round(valor * 100) / 100,
      mes_base: mesBase,
      regime,
    });
  }

  if (totalLidas === 0) return vazio("A planilha não tem linhas depois do cabeçalho.");
  return { linhas, erros, totalLidas, erroGeral: null };
}

/** Lê um CSV (`;`, vírgula ou tab, com ou sem aspas, com ou sem BOM) em linhas de células. */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^\uFEFF/, "");
  const primeira = t.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  const delimitador = [";", "\t", ","].map((d) => ({ d, n: primeira.split(d).length })).sort((a, b) => b.n - a.n)[0].d;

  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c !== '"') campo += c;
      else if (t[i + 1] === '"') {
        campo += '"';
        i++;
      } else aspas = false;
    } else if (c === '"') {
      aspas = true;
    } else if (c === delimitador) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

/** Os últimos `quantos` meses, do mais novo ao mais antigo, como `AAAA-MM-01`. */
export function opcoesMesBase(hoje: Date, quantos = 7): { valor: string; rotulo: string }[] {
  return Array.from({ length: quantos }, (_, i) => {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1));
    const valor = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
    return { valor, rotulo: rotuloMesBase(valor) };
  });
}

export interface LinhaGravada {
  uf: string;
  subtipo: string;
  padrao: string;
  mes_base: string;
  regime: Regime;
  created_at: string;
}

export interface ResumoMes {
  mesBase: string;
  regime: Regime;
  linhas: number;
  ufs: number;
  ultimaImportacao: string;
}

/** Um resumo por mês e regime importados, do mês mais novo ao mais antigo (sem desoneração antes). */
export function resumirMeses(gravadas: LinhaGravada[]): ResumoMes[] {
  const porMes = new Map<string, ResumoMes & { ufSet: Set<string> }>();
  for (const l of gravadas) {
    const chaveMes = `${l.mes_base}|${l.regime}`;
    const atual = porMes.get(chaveMes) ?? {
      mesBase: l.mes_base,
      regime: l.regime,
      linhas: 0,
      ufs: 0,
      ultimaImportacao: l.created_at,
      ufSet: new Set<string>(),
    };
    atual.linhas++;
    atual.ufSet.add(l.uf);
    if (l.created_at > atual.ultimaImportacao) atual.ultimaImportacao = l.created_at;
    porMes.set(chaveMes, atual);
  }
  return [...porMes.values()]
    .map(({ ufSet, ...resumo }) => ({ ...resumo, ufs: ufSet.size }))
    .sort((a, b) =>
      a.mesBase !== b.mesBase
        ? a.mesBase < b.mesBase
          ? 1
          : -1
        : a.regime === b.regime
          ? 0
          : a.regime === "onerado"
            ? -1
            : 1
    );
}

/** UFs com e sem tabela no mês e no regime indicados. */
export function coberturaDoMes(
  gravadas: LinhaGravada[],
  mesBase: string,
  regime: Regime = "onerado"
): { com: Uf[]; sem: Uf[] } {
  const com = new Set(gravadas.filter((l) => l.mes_base === mesBase && l.regime === regime).map((l) => l.uf));
  return {
    com: UFS.filter((u) => com.has(u)),
    sem: UFS.filter((u) => !com.has(u)),
  };
}

/**
 * O regime que o nome do arquivo sugere ("cub-sem-desoneracao.csv", "cub-desonerado.csv"), ou null se o
 * nome não diz. Serve só para avisar quando o regime escolhido na tela é o outro.
 */
export function regimeSugeridoPeloNome(nome: string): Regime | null {
  const k = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/sem[^a-z]?desoner|(^|[^a-z])onerad/.test(k)) return "onerado";
  if (/com[^a-z]?desoner|desonerad/.test(k)) return "desonerado";
  return null;
}
