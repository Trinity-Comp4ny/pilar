import type { MeioRecebimento } from "@/lib/margemLiquida";

/** Rascunho de um meio de recebimento no formulário de taxas (SPEC 168). */
export interface MeioRascunho {
  id: string;
  nome: string;
  taxa: string;
  faixas: { parcelas: string; taxa: string }[];
}

const paraNumero = (s: string) => parseFloat(s.replace(",", "."));
const paraTexto = (n: number) => (n ? String(n).replace(".", ",") : "");

export const meioParaRascunho = (m: MeioRecebimento): MeioRascunho => ({
  id: m.id,
  nome: m.nome,
  taxa: paraTexto(m.taxa_pct),
  faixas: Object.entries(m.faixas ?? {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([parcelas, taxa]) => ({ parcelas, taxa: paraTexto(taxa) })),
});

export const novoRascunho = (): MeioRascunho => ({
  id: `meio-${Math.random().toString(36).slice(2, 8)}`,
  nome: "",
  taxa: "",
  faixas: [],
});

const taxaValida = (s: string) => {
  const n = s.trim() === "" ? 0 : paraNumero(s);
  return Number.isFinite(n) && n >= 0 && n < 100 ? n : null;
};

/** Devolve a mensagem do primeiro problema, ou null quando está tudo certo. */
export function validarRascunhos(rascunhos: MeioRascunho[]): string | null {
  if (rascunhos.length === 0) return "Cadastre pelo menos um meio de recebimento.";
  for (const r of rascunhos) {
    if (!r.nome.trim()) return "Todo meio precisa de um nome.";
    if (taxaValida(r.taxa) === null) return `Taxa inválida em "${r.nome}": use um valor entre 0 e 99,9.`;
    const vistas = new Set<number>();
    for (const f of r.faixas) {
      const p = Number(f.parcelas);
      if (!Number.isInteger(p) || p < 1)
        return `Parcelas inválidas em "${r.nome}": use números inteiros a partir de 1.`;
      if (vistas.has(p)) return `"${r.nome}" repete a faixa de ${p} parcela(s).`;
      vistas.add(p);
      if (taxaValida(f.taxa) === null) return `Taxa inválida em "${r.nome}": use um valor entre 0 e 99,9.`;
    }
  }
  return null;
}

export function rascunhosParaMeios(rascunhos: MeioRascunho[]): MeioRecebimento[] {
  return rascunhos.map((r) => {
    const faixas = Object.fromEntries(r.faixas.map((f) => [String(Number(f.parcelas)), taxaValida(f.taxa) ?? 0]));
    return {
      id: r.id,
      nome: r.nome.trim(),
      taxa_pct: taxaValida(r.taxa) ?? 0,
      ...(r.faixas.length > 0 ? { faixas } : {}),
    };
  });
}
