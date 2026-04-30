export type TipoChavePix = "cpf_cnpj" | "email" | "telefone" | "aleatoria";

export const TIPO_CHAVE_PIX_LABEL: Record<TipoChavePix, string> = {
  cpf_cnpj: "CPF/CNPJ",
  email: "E-mail",
  telefone: "Celular",
  aleatoria: "Aleatória",
};

const CELULAR_COM_DDD = /^\d{2}9\d{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidCPF(d: string): boolean {
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += +d[i] * (10 - i);
  let r = (sum * 10) % 11;
  if (r >= 10) r = 0;
  if (r !== +d[9]) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += +d[i] * (11 - i);
  r = (sum * 10) % 11;
  if (r >= 10) r = 0;
  return r === +d[10];
}

function isValidCNPJ(d: string): boolean {
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (s: string, w: number[]) => {
    const rem = w.reduce((acc, w, i) => acc + +s[i] * w, 0) % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  return (
    calc(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === +d[12] &&
    calc(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === +d[13]
  );
}

export function normalizarChavePix(chave: string, tipo: TipoChavePix): string {
  if (tipo !== "telefone") return chave;
  const digits = chave.replace(/\D/g, "");
  if (chave.startsWith("+")) return chave;
  // Remove 55 redundante se usuário digitou com código do país sem o +
  if (digits.startsWith("55") && digits.length === 13) return `+${digits}`;
  return `+55${digits}`;
}

export function detectTipoChavePix(chave: string): TipoChavePix | null {
  const v = chave.trim();
  if (!v) return null;

  if (v.startsWith("+")) return "telefone";

  // E-mail: exige formato mínimo válido
  if (v.includes("@")) return EMAIL_REGEX.test(v) ? "email" : null;

  // UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return "aleatoria";

  const digits = v.replace(/\D/g, "");

  // 10 dígitos raw são ambíguos (pode ser CPF sendo digitado) → não inferir
  if (digits.length === 11) {
    if (isValidCPF(digits)) return "cpf_cnpj";
    if (CELULAR_COM_DDD.test(digits)) return "telefone";
    return "cpf_cnpj";
  }
  if (digits.length === 14) return isValidCNPJ(digits) ? "cpf_cnpj" : null;

  return null;
}
