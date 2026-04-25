/**
 * Helpers para cálculo de dias úteis e feriados nacionais brasileiros.
 * Cobre feriados fixos + móveis (Páscoa, Carnaval, Sexta Santa, Corpus Christi).
 * Não cobre feriados municipais/estaduais.
 */

function calcularPascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const feriadosCache = new Map<number, Date[]>();

export function getFeriadosBR(ano: number): Date[] {
  const cached = feriadosCache.get(ano);
  if (cached) return cached;

  const pascoa = calcularPascoa(ano);
  const lista = [
    new Date(ano, 0, 1), // Ano Novo
    addDays(pascoa, -48), // Carnaval segunda
    addDays(pascoa, -47), // Carnaval terça
    addDays(pascoa, -2), // Sexta-feira Santa
    new Date(ano, 3, 21), // Tiradentes
    new Date(ano, 4, 1), // Dia do Trabalho
    addDays(pascoa, 60), // Corpus Christi
    new Date(ano, 8, 7), // Independência
    new Date(ano, 9, 12), // N. Sra. Aparecida
    new Date(ano, 10, 2), // Finados
    new Date(ano, 10, 15), // Proclamação da República
    new Date(ano, 11, 25), // Natal
  ];

  feriadosCache.set(ano, lista);
  return lista;
}

export function isFeriado(date: Date): boolean {
  return getFeriadosBR(date.getFullYear()).some((f) => sameDay(f, date));
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isFeriado(date);
}

export function addBusinessDays(start: Date, days: number): Date {
  let current = new Date(start);
  let remaining = days;
  while (remaining > 0) {
    current = addDays(current, 1);
    if (isBusinessDay(current)) remaining--;
  }
  return current;
}

export function nextBusinessDay(date: Date): Date {
  let current = new Date(date);
  while (!isBusinessDay(current)) {
    current = addDays(current, 1);
  }
  return current;
}

export function parseDateLocal(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Retorna N datas de vencimento para parcelas, no dia fixo do mês.
 * Se dia cai em fim de semana ou feriado, pula pra próximo dia útil.
 * Primeira parcela: próximo mês se hoje >= diaFixo, senão mês atual.
 */
export function gerarDatasParcelasDiaFixo(numParcelas: number, diaFixo: number, hoje: Date = new Date()): Date[] {
  if (diaFixo < 1 || diaFixo > 31) throw new Error("dia fixo deve estar entre 1 e 31");

  const datas: Date[] = [];
  const startMonth = hoje.getDate() >= diaFixo ? hoje.getMonth() + 1 : hoje.getMonth();
  const startYear = hoje.getFullYear();

  for (let i = 0; i < numParcelas; i++) {
    const year = startYear + Math.floor((startMonth + i) / 12);
    const month = (startMonth + i) % 12;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const dia = Math.min(diaFixo, lastDay);
    const data = new Date(year, month, dia);
    datas.push(nextBusinessDay(data));
  }

  return datas;
}
