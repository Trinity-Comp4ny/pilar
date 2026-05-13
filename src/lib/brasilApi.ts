import { onlyDigits } from "./maskUtils";

const BASE = "https://brasilapi.com.br/api";

export type CepLookup = {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

export type CnpjLookup = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  email: string | null;
  telefone: string | null;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
};

export function isValidCEP(value: string): boolean {
  return onlyDigits(value).length === 8;
}

export function isValidCNPJ(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const calc = (slice: string, weights: number[]) => {
    const sum = slice.split("").reduce((acc, c, i) => acc + Number(c) * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, ...w1];
  return calc(d.slice(0, 12), w1) === Number(d[12]) && calc(d.slice(0, 13), w2) === Number(d[13]);
}

export async function lookupCEP(cep: string): Promise<CepLookup | null> {
  const d = onlyDigits(cep);
  if (d.length !== 8) return null;
  try {
    const res = await fetch(`${BASE}/cep/v2/${d}`);
    if (!res.ok) return null;
    const json = (await res.json()) as Partial<CepLookup>;
    if (!json.city || !json.state) return null;
    return {
      cep: json.cep ?? d,
      street: json.street ?? "",
      neighborhood: json.neighborhood ?? "",
      city: json.city,
      state: json.state,
    };
  } catch {
    return null;
  }
}

type RawCnpj = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  email?: string | null;
  ddd_telefone_1?: string | null;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
};

export async function lookupCNPJ(cnpj: string): Promise<CnpjLookup | null> {
  const d = onlyDigits(cnpj);
  if (d.length !== 14) return null;
  try {
    const res = await fetch(`${BASE}/cnpj/v1/${d}`);
    if (!res.ok) return null;
    const json = (await res.json()) as RawCnpj;
    if (!json.razao_social) return null;
    return {
      cnpj: json.cnpj ?? d,
      razao_social: json.razao_social,
      nome_fantasia: json.nome_fantasia ?? "",
      email: json.email ?? null,
      telefone: json.ddd_telefone_1 ?? null,
      logradouro: json.logradouro ?? "",
      numero: json.numero ?? "",
      bairro: json.bairro ?? "",
      municipio: json.municipio ?? "",
      uf: json.uf ?? "",
      cep: json.cep ?? "",
    };
  } catch {
    return null;
  }
}
