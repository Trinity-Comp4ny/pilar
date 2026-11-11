/**
 * Biblioteca ÚNICA de formatação (ADR 0008, spec 003 onda 1).
 *
 * Toda formatação de moeda, data, percentual e número importa daqui.
 * Os módulos antigos (`lib/utils.formatCurrency`, `lib/currencyUtils.formatCurrency`,
 * `lib/currency.formatBRL`) delegam para cá e estão deprecados; não adicionar
 * novos usos deles nem instanciar `Intl.NumberFormat` em página.
 */

export { formatDate, formatDateShort } from "./dateUtils";

const BRL_2 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const BRL_0 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const BRL_COMPACT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

export type CurrencyOptions = {
  /** Casas decimais: 2 (padrão, dinheiro real) ou 0 (rótulo/estimativa). */
  decimals?: 0 | 2;
  /** "R$ 1,2 mi" para tiles/eixos; nunca em tabela de lançamentos. */
  compact?: boolean;
};

export function formatCurrency(value: number, opts: CurrencyOptions = {}): string {
  const finito = Number.isFinite(value) ? value : 0;
  // Resíduo de float que arredonda para zero (0,3 − 0,1 − 0,2 = −2,7e−17) saía
  // "-R$ 0,00" num saldo zerado. Abaixo de meio centavo é zero, sem sinal.
  const v = Math.abs(finito) < 0.005 ? 0 : finito;
  if (opts.compact) return BRL_COMPACT.format(v);
  return (opts.decimals === 0 ? BRL_0 : BRL_2).format(v);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(Number.isFinite(value) ? value : 0);
}

/** "1,2 mil" / "3,4 mi" para eixos de gráfico. */
export function formatNumberCompact(value: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(
    Number.isFinite(value) ? value : 0
  );
}

/** Número decimal SEM símbolo de moeda (ex.: valor para docx/planilha). */
export function formatDecimal(value: number, decimals = 2): string {
  const v = Number.isFinite(value) ? value : 0;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Decimal de horas (1.5) → "1h 30min", estilo ClickUp. Null/zero vira null. */
export function formatHoras(dec: number | null): string | null {
  if (dec == null || !Number.isFinite(dec)) return null;
  const totalMin = Math.round(dec * 60);
  if (totalMin <= 0) return null;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const partes: string[] = [];
  if (h > 0) partes.push(`${h}h`);
  if (m > 0) partes.push(`${m}min`);
  return partes.join(" ");
}

export function formatPercent(value: number, decimals = 1): string {
  const v = Number.isFinite(value) ? value : 0;
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}

/** Timestamp ISO completo → "dd/mm/aaaa hh:mm". Datas puras usam formatDate. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Tamanho de arquivo em pt-BR: "850 KB", "12,4 MB", "1,2 GB". Vazio vira "-". */
export function formatBytes(bytes: number | string | null | undefined): string {
  const n = Number(bytes);
  if (bytes == null || bytes === "" || !Number.isFinite(n) || n < 0) return "-";
  if (n < 1024) return `${n} B`;
  const unidades = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < unidades.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: v < 10 ? 1 : 0 })} ${unidades[i]}`;
}
