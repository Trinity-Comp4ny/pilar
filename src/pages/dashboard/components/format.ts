// Formatadores de moeda compartilhados pelos widgets do Dashboard.
// Extraídos para módulo próprio para evitar import circular entre Dashboard e seus componentes.
export const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const fmtCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
