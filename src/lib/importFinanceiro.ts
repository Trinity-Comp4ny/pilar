/**
 * Spec 017: núcleo determinístico da importação de extrato/fatura/planilha.
 *
 * Tudo aqui é função pura e testável — parsing de CSV, normalização de valor e
 * data no padrão BR, inferência de tipo pelo sinal, hash de linha e detecção de
 * duplicata. O caminho de PDF/texto livre passa pela IA (edge function); este
 * módulo cobre o caminho determinístico (CSV/planilha) e as regras compartilhadas.
 */

export type ImportTipoDoc = "extrato" | "fatura" | "planilha";

/** Linha crua extraída de um extrato: valor mantém o sinal (negativo = saída). */
export interface LinhaExtrato {
  data: string; // ISO yyyy-mm-dd
  descricao: string;
  valorComSinal: number;
}

/** Candidato a lançamento, já com valor positivo, tipo e hash de deduplicação. */
export interface Candidato {
  data: string;
  descricao: string;
  valor: number; // sempre positivo
  tipo: "despesa" | "receita";
  lineHash: string;
}

/** Conta já cadastrada e pendente, usada na conciliação leve. */
export interface ContaPendente {
  id: string;
  valor: number;
  data: string; // ISO
  tipo: "despesa" | "receita";
}

/**
 * Converte um valor no padrão BR (ou US) para número, preservando o sinal.
 * Aceita "1.234,56", "R$ 1.234,56", "-1234.56", "(100,00)" (contábil negativo),
 * "100,00 D" / "100,00 C" (débito/crédito) e o formato US "1,234.56".
 */
export function normalizeValorBR(raw: unknown): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  let sinal = 1;
  if (/^\(.*\)$/.test(s)) {
    sinal = -1;
    s = s.slice(1, -1).trim();
  }
  const mDC = s.match(/\b([DC])\b\s*$/i);
  if (mDC && mDC.index !== undefined) {
    if (mDC[1].toUpperCase() === "D") sinal = -1;
    s = s.slice(0, mDC.index).trim();
  }
  if (s.startsWith("-")) {
    sinal = -1;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }

  s = s.replace(/R\$/gi, "").replace(/\s/g, "");
  const temVirgula = s.includes(",");
  const temPonto = s.includes(".");
  if (temVirgula && temPonto) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (temVirgula) {
    s = s.replace(",", ".");
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return sinal * n;
}

/** Converte data BR/ISO para ISO yyyy-mm-dd. Retorna null se não reconhecer. */
export function parseDataBR(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const ano = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${ano}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const mo = parseInt(m[2], 10);
    const d = parseInt(m[3], 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${m[1]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

/** Detecta o delimitador mais provável do CSV a partir da primeira linha. */
export function detectarDelimitador(text: string): string {
  const primeira = text.split(/\r?\n/)[0] ?? "";
  const conta = (ch: string) => (primeira.match(new RegExp(`\\${ch}`, "g")) ?? []).length;
  const tab = (primeira.match(/\t/g) ?? []).length;
  const ptv = conta(";");
  const virg = conta(",");
  if (tab > 0 && tab >= ptv && tab >= virg) return "\t";
  if (ptv > 0 && ptv >= virg) return ";";
  return ",";
}

/** Parser de CSV que respeita aspas e campos com o delimitador dentro. */
export function parseCsv(text: string, delim?: string): string[][] {
  const d = delim ?? detectarDelimitador(text);
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let emAspas = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (emAspas) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          emAspas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      emAspas = true;
    } else if (c === d) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n") {
      linha.push(campo);
      rows.push(linha);
      linha = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (campo.length > 0 || linha.length > 0) {
    linha.push(campo);
    rows.push(linha);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const HEADER_DATA = /^(data|dt\b|date)/i;
const HEADER_DESC = /(hist[oó]rico|descri|lan[cç]amento|memo|detalhe|estabelecimento)/i;
const HEADER_VALOR = /(valor|montante|amount|value)/i;
const HEADER_DEBITO = /(d[eé]bito|debit|sa[ií]da)/i;
const HEADER_CREDITO = /(cr[eé]dito|credit|entrada)/i;

/** Extrai a data e o valor de uma linha sem header, por heurística de conteúdo. */
function linhaHeuristica(cells: string[]): LinhaExtrato | null {
  let data: string | null = null;
  let dataIdx = -1;
  for (let i = 0; i < cells.length; i++) {
    const d = parseDataBR(cells[i]);
    if (d) {
      data = d;
      dataIdx = i;
      break;
    }
  }
  if (!data) return null;

  let valor: number | null = null;
  let valorIdx = -1;
  for (let i = cells.length - 1; i >= 0; i--) {
    if (i === dataIdx) continue;
    if (cells[i].trim() === "") continue;
    const v = normalizeValorBR(cells[i]);
    if (v != null) {
      valor = v;
      valorIdx = i;
      break;
    }
  }
  if (valor == null) return null;

  const descricao = cells
    .filter((c, i) => i !== dataIdx && i !== valorIdx && c.trim() !== "" && normalizeValorBR(c) == null)
    .map((c) => c.trim())
    .join(" ")
    .trim();
  return { data, descricao: descricao || "Sem descrição", valorComSinal: valor };
}

/**
 * Converte o texto de um CSV/planilha em linhas de extrato. Usa o header quando
 * reconhece as colunas (inclui débito/crédito separados); senão cai na heurística
 * por linha. Linhas sem data+valor viram avisos, não entram no resultado.
 */
export function csvParaLinhas(text: string): { linhas: LinhaExtrato[]; avisos: string[] } {
  const rows = parseCsv(text);
  const avisos: string[] = [];
  if (rows.length === 0) return { linhas: [], avisos: ["Arquivo vazio ou ilegível."] };

  const header = rows[0].map((h) => h.trim());
  const idx = { data: -1, desc: -1, valor: -1, debito: -1, credito: -1 };
  header.forEach((h, i) => {
    if (idx.data < 0 && HEADER_DATA.test(h)) idx.data = i;
    if (idx.debito < 0 && HEADER_DEBITO.test(h)) idx.debito = i;
    else if (idx.credito < 0 && HEADER_CREDITO.test(h)) idx.credito = i;
    else if (idx.valor < 0 && HEADER_VALOR.test(h)) idx.valor = i;
    if (idx.desc < 0 && HEADER_DESC.test(h)) idx.desc = i;
  });

  const temHeaderValor = idx.valor >= 0 || idx.debito >= 0 || idx.credito >= 0;
  const usaHeader = idx.data >= 0 && temHeaderValor;
  const dataRows = usaHeader ? rows.slice(1) : rows;
  const linhas: LinhaExtrato[] = [];

  for (const cells of dataRows) {
    let linha: LinhaExtrato | null = null;
    if (usaHeader) {
      const data = parseDataBR(cells[idx.data]);
      if (data) {
        let valor: number | null = null;
        if (idx.valor >= 0) {
          valor = normalizeValorBR(cells[idx.valor]);
        } else {
          const deb = idx.debito >= 0 ? normalizeValorBR(cells[idx.debito]) : null;
          const cred = idx.credito >= 0 ? normalizeValorBR(cells[idx.credito]) : null;
          if (deb != null || cred != null) valor = (cred ?? 0) - Math.abs(deb ?? 0);
        }
        if (valor != null && valor !== 0) {
          const descricao = idx.desc >= 0 ? (cells[idx.desc] ?? "").trim() : "";
          linha = { data, descricao: descricao || "Sem descrição", valorComSinal: valor };
        }
      }
    } else {
      linha = linhaHeuristica(cells);
    }
    if (linha) linhas.push(linha);
    else avisos.push(`Linha ignorada (sem data/valor reconhecível): ${cells.join(" | ").slice(0, 80)}`);
  }

  if (linhas.length === 0 && avisos.length > 0) {
    avisos.unshift("Nenhuma linha com data e valor foi reconhecida. Confira o formato do arquivo.");
  }
  return { linhas, avisos };
}

/** Hash estável de uma linha (data + valor + descrição normalizada) para dedupe. */
export function lineHash(input: { data: string; valor: number; descricao: string }): string {
  const base = `${input.data}|${input.valor.toFixed(2)}|${input.descricao.trim().toLowerCase().replace(/\s+/g, " ")}`;
  let h = 5381;
  for (let i = 0; i < base.length; i++) {
    h = ((h << 5) + h + base.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Transforma uma linha de extrato em candidato: valor positivo + tipo pelo sinal. */
export function linhaParaCandidato(l: LinhaExtrato): Candidato {
  const valor = Math.abs(l.valorComSinal);
  const tipo: "despesa" | "receita" = l.valorComSinal < 0 ? "despesa" : "receita";
  return {
    data: l.data,
    descricao: l.descricao,
    valor,
    tipo,
    lineHash: lineHash({ data: l.data, valor, descricao: l.descricao }),
  };
}

/**
 * Conciliação leve: acha uma conta pendente que casa com o candidato (mesmo tipo,
 * valor igual e vencimento dentro da janela de dias). Retorna o id ou null.
 */
export function encontrarDuplicata(c: Candidato, pendentes: ContaPendente[], janelaDias = 3): string | null {
  const alvo = new Date(`${c.data}T00:00:00`).getTime();
  const limite = janelaDias * 86_400_000;
  const match = pendentes.find(
    (p) =>
      p.tipo === c.tipo &&
      Math.abs(p.valor - c.valor) < 0.005 &&
      Math.abs(new Date(`${p.data}T00:00:00`).getTime() - alvo) <= limite
  );
  return match?.id ?? null;
}
