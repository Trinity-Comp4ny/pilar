import { format, isValid, parse } from "date-fns";

/** Máscara dd/mm/aaaa enquanto digita: só dígitos, barras entram sozinhas. */
export function mascararData(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/**
 * Data digitada (dd/mm/aaaa, ou dd/mm/aa = 20aa) para Date. Data impossível
 * (31/02, 13º mês) volta undefined em vez de rolar para o mês seguinte.
 */
export function parseDataDigitada(texto: string): Date | undefined {
  const d = texto.replace(/\D/g, "");
  if (d.length !== 6 && d.length !== 8) return undefined;
  const dia = d.slice(0, 2);
  const mes = d.slice(2, 4);
  const ano = d.length === 6 ? `20${d.slice(4)}` : d.slice(4);
  const data = parse(`${dia}/${mes}/${ano}`, "dd/MM/yyyy", new Date());
  if (!isValid(data) || format(data, "dd/MM/yyyy") !== `${dia}/${mes}/${ano}`) return undefined;
  return data;
}
