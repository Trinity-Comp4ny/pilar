// Onde o dinheiro da obra foi: despesas somadas por fornecedor ou por item (a descrição do lançamento).

export interface DespesaAgrupavel {
  tipo: string;
  descricao: string;
  valor: number | string;
  quantidade?: number | string | null;
  unidade?: string | null;
  fornecedor_id?: string | null;
}

export interface GrupoDespesa {
  chave: string;
  rotulo: string;
  total: number;
  lancamentos: number;
  /** Quantidade somada, só quando todos os lançamentos do grupo trazem a mesma unidade. */
  quantidade: number | null;
  unidade: string | null;
}

const SEM_FORNECEDOR = "__sem__";

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export function agruparDespesas(
  lancamentos: ReadonlyArray<DespesaAgrupavel>,
  por: "fornecedor" | "item",
  nomeFornecedor: ReadonlyMap<string, string>
): GrupoDespesa[] {
  const grupos = new Map<string, GrupoDespesa & { unidades: Set<string>; temQtd: boolean }>();
  for (const l of lancamentos) {
    if (l.tipo !== "despesa") continue;
    const chave =
      por === "fornecedor" ? (l.fornecedor_id ?? SEM_FORNECEDOR) : normalizar(l.descricao) || "(sem descrição)";
    const rotulo =
      por === "fornecedor"
        ? l.fornecedor_id
          ? (nomeFornecedor.get(l.fornecedor_id) ?? "Fornecedor")
          : "Sem fornecedor"
        : l.descricao.trim() || "(sem descrição)";
    const g = grupos.get(chave) ?? {
      chave,
      rotulo,
      total: 0,
      lancamentos: 0,
      quantidade: null,
      unidade: null,
      unidades: new Set<string>(),
      temQtd: false,
    };
    g.total += Number(l.valor);
    g.lancamentos += 1;
    if (l.quantidade != null) {
      g.temQtd = true;
      g.quantidade = (g.quantidade ?? 0) + Number(l.quantidade);
      g.unidades.add((l.unidade ?? "").trim().toLowerCase());
    }
    grupos.set(chave, g);
  }
  return [...grupos.values()]
    .map(({ unidades, temQtd, ...g }) => {
      const unica = temQtd && unidades.size === 1 ? [...unidades][0] : null;
      return { ...g, quantidade: unica !== null ? g.quantidade : null, unidade: unica || null };
    })
    .sort((a, b) => b.total - a.total);
}
