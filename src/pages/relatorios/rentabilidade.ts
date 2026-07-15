// Cálculo de margem/rentabilidade para o relatório de Relatórios.
//
// Base de dados (decisão de produto, dinheiro real, audit-ready):
//   Receita = receitas lançadas do projeto (status Recebido + Pendente)
//   Custo   = despesas diretas do projeto (status Pago + Pendente)
//   Margem  = Receita menos Custo
// O valor de contrato entra só como referência de coluna, não no cálculo de
// margem, porque a margem realizada segue o que de fato foi lançado (receitas x
// despesas), não o valor fechado em proposta. Fonte server-side:
// RPC rpc_dashboard_rentabilidade (agrega por projeto com filtro de empresa).

export interface RentabilidadeProjeto {
  projeto_id: string;
  codigo_projeto: string;
  projeto_nome: string;
  cliente_id: string | null;
  cliente_nome: string;
  status: string;
  valor_contrato: number;
  receita: number;
  custo: number;
  margem: number;
  margem_pct: number;
}

export interface RentabilidadeCliente {
  cliente_id: string;
  cliente_nome: string;
  num_projetos: number;
  valor_contrato: number;
  receita: number;
  custo: number;
  margem: number;
  margem_pct: number;
}

/** Linha crua vinda do RPC rpc_dashboard_rentabilidade (campos como unknown). */
export interface RpcRentabilidadeRaw {
  projeto_id: unknown;
  projeto_nome: unknown;
  codigo_projeto: unknown;
  status: unknown;
  valor_contrato: unknown;
  receitas_total: unknown;
  despesas_diretas: unknown;
}

/**
 * Margem em R$ e %. A margem % é calculada sobre a receita (base de venda):
 * margem / receita. Sem receita, a margem % é 0 (evita divisão por zero e
 * porcentagens sem sentido).
 */
export function computeMargem(receita: number, custo: number): { margem: number; margem_pct: number } {
  const rec = Number.isFinite(receita) ? receita : 0;
  const cus = Number.isFinite(custo) ? custo : 0;
  const margem = rec - cus;
  const margem_pct = rec > 0 ? (margem / rec) * 100 : 0;
  return { margem, margem_pct };
}

/** Mapeia uma linha crua do RPC para RentabilidadeProjeto, resolvendo o cliente por fora. */
export function toRentabilidadeProjeto(
  raw: RpcRentabilidadeRaw,
  cliente: { id: string | null; nome: string }
): RentabilidadeProjeto {
  const receita = Number(raw.receitas_total) || 0;
  const custo = Number(raw.despesas_diretas) || 0;
  const { margem, margem_pct } = computeMargem(receita, custo);
  return {
    projeto_id: String(raw.projeto_id ?? ""),
    codigo_projeto: String(raw.codigo_projeto ?? "") || "-",
    projeto_nome: String(raw.projeto_nome ?? "") || "-",
    cliente_id: cliente.id,
    cliente_nome: cliente.nome,
    status: String(raw.status ?? "") || "-",
    valor_contrato: Number(raw.valor_contrato) || 0,
    receita,
    custo,
    margem,
    margem_pct,
  };
}

/** Agrega projetos por cliente, somando receita/custo e recomputando a margem. */
export function aggregatePorCliente(projetos: RentabilidadeProjeto[]): RentabilidadeCliente[] {
  const mapa = new Map<string, RentabilidadeCliente>();

  for (const p of projetos) {
    const id = p.cliente_id ?? "__sem_cliente__";
    const atual =
      mapa.get(id) ??
      ({
        cliente_id: id,
        cliente_nome: p.cliente_nome,
        num_projetos: 0,
        valor_contrato: 0,
        receita: 0,
        custo: 0,
        margem: 0,
        margem_pct: 0,
      } satisfies RentabilidadeCliente);

    atual.num_projetos += 1;
    atual.valor_contrato += p.valor_contrato;
    atual.receita += p.receita;
    atual.custo += p.custo;
    mapa.set(id, atual);
  }

  return Array.from(mapa.values())
    .map((c) => {
      const { margem, margem_pct } = computeMargem(c.receita, c.custo);
      return { ...c, margem, margem_pct };
    })
    .sort((a, b) => b.margem - a.margem);
}
