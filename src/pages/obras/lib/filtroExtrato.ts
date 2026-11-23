// Filtros do extrato da conta da obra: tipo (aporte/despesa), fornecedor e busca na descrição.

export type FiltroTipo = "todos" | "aporte" | "despesa";

export interface FiltroExtrato {
  tipo: FiltroTipo;
  /** "" = qualquer fornecedor. */
  fornecedorId: string;
  busca: string;
}

export const FILTRO_VAZIO: FiltroExtrato = { tipo: "todos", fornecedorId: "", busca: "" };

const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filtrarExtrato<L extends { tipo: string; descricao: string; fornecedor_id?: string | null }>(
  lancamentos: ReadonlyArray<L>,
  f: FiltroExtrato
): L[] {
  const busca = normalizar(f.busca.trim());
  return lancamentos.filter(
    (l) =>
      (f.tipo === "todos" || l.tipo === f.tipo) &&
      (!f.fornecedorId || l.fornecedor_id === f.fornecedorId) &&
      (!busca || normalizar(l.descricao).includes(busca))
  );
}

export const filtroAtivo = (f: FiltroExtrato) => f.tipo !== "todos" || !!f.fornecedorId || !!f.busca.trim();
