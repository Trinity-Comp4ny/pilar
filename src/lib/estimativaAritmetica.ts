// Aritmética em centavos e formatação de número, compartilhadas pelo motor (SPEC 136) e pelos itens (SPEC 137).

export const centavos = (reais: number) => Math.round(reais * 100);
export const reais = (cents: number) => cents / 100;
export const somar = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function formatarNumero(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}
