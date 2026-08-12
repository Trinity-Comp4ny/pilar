// Fórmula da folha num só lugar: variável = área × valor/m²; total = fixo +
// variável. Antes esse cálculo estava duplicado (preview, edição, comprovante),
// o que deixou a edição salvar total inconsistente. Centralizado e testável.
import type { ProjetoDetalhe } from "./types";

export function calcularVariavel(area: number, valorM2: number): number {
  return (area || 0) * (valorM2 || 0);
}

export function calcularTotal(salarioFixo: number, variavel: number): number {
  return (salarioFixo || 0) + (variavel || 0);
}

// Subtotal do variável de um projeto no comprovante (m² do projeto × valor/m² da pessoa).
export function subtotalProjeto(projeto: ProjetoDetalhe, valorM2: number): number {
  return (projeto.area_m2 || 0) * (valorM2 || 0);
}

// chaves_pix é Json (array, objeto ou string). Extrai a primeira chave utilizável.
export function firstPix(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw || null;
  if (Array.isArray(raw)) {
    const first = raw.find((v) => typeof v === "string" && v) as string | undefined;
    return first ?? null;
  }
  if (typeof raw === "object") {
    const first = Object.values(raw as Record<string, unknown>).find((v) => typeof v === "string" && v);
    return (first as string) ?? null;
  }
  return null;
}

export function parseDetalhe(raw: unknown): ProjetoDetalhe[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({ nome: String(p.nome ?? "-"), area_m2: Number(p.area_m2 ?? 0) }));
}
