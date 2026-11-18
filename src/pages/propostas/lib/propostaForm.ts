import type { PropostaInsert } from "@/hooks/usePropostas";

export const emptyForm: PropostaInsert = {
  titulo: "",
  codigo: "",
  tipo: "projeto",
  area_m2: undefined,
  localizacao: "",
  valor_proposto: undefined,
  prazo_estimado_dias: undefined,
  observacao: "",
};

// Sugere o próximo código sequencial no padrão PROP-001 a partir dos existentes.
// O usuário pode editar livremente.
export const suggestNextCodigo = (list: { codigo: string | null }[]) => {
  let max = 0;
  for (const p of list) {
    const m = /^PROP-(\d+)$/i.exec((p.codigo || "").trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `PROP-${String(max + 1).padStart(3, "0")}`;
};
