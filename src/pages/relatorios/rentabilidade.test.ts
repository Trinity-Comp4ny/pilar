import { describe, it, expect } from "vitest";
import {
  computeMargem,
  toRentabilidadeProjeto,
  aggregatePorCliente,
  type RentabilidadeProjeto,
  type RpcRentabilidadeRaw,
} from "./rentabilidade";

describe("computeMargem", () => {
  it("calcula margem positiva e % sobre a receita", () => {
    const { margem, margem_pct } = computeMargem(10000, 6000);
    expect(margem).toBe(4000);
    expect(margem_pct).toBe(40);
  });

  it("calcula margem negativa quando o custo passa da receita", () => {
    const { margem, margem_pct } = computeMargem(5000, 8000);
    expect(margem).toBe(-3000);
    expect(margem_pct).toBe(-60);
  });

  it("retorna % zero quando não há receita (evita divisão por zero)", () => {
    const { margem, margem_pct } = computeMargem(0, 2000);
    expect(margem).toBe(-2000);
    expect(margem_pct).toBe(0);
  });

  it("trata valores não finitos como zero", () => {
    expect(computeMargem(Number.NaN, 100)).toEqual({ margem: -100, margem_pct: 0 });
    expect(computeMargem(1000, Number.POSITIVE_INFINITY)).toEqual({ margem: 1000, margem_pct: 100 });
  });
});

describe("toRentabilidadeProjeto", () => {
  const raw: RpcRentabilidadeRaw = {
    projeto_id: "p1",
    projeto_nome: "Ponte Norte",
    codigo_projeto: "PRJ-001",
    status: "Em andamento",
    valor_contrato: 120000,
    receitas_total: 100000,
    despesas_diretas: 70000,
  };

  it("mapeia a linha crua e computa a margem", () => {
    const p = toRentabilidadeProjeto(raw, { id: "c1", nome: "Prefeitura X" });
    expect(p.projeto_id).toBe("p1");
    expect(p.cliente_nome).toBe("Prefeitura X");
    expect(p.receita).toBe(100000);
    expect(p.custo).toBe(70000);
    expect(p.margem).toBe(30000);
    expect(p.margem_pct).toBe(30);
    expect(p.valor_contrato).toBe(120000);
  });

  it("aplica defaults quando campos vêm nulos", () => {
    const p = toRentabilidadeProjeto(
      { ...raw, codigo_projeto: null, receitas_total: null, despesas_diretas: null, valor_contrato: null },
      { id: null, nome: "Sem cliente" }
    );
    expect(p.codigo_projeto).toBe("-");
    expect(p.receita).toBe(0);
    expect(p.custo).toBe(0);
    expect(p.margem).toBe(0);
    expect(p.margem_pct).toBe(0);
  });
});

describe("aggregatePorCliente", () => {
  const mk = (over: Partial<RentabilidadeProjeto>): RentabilidadeProjeto => ({
    projeto_id: "p",
    codigo_projeto: "PRJ",
    projeto_nome: "Projeto",
    cliente_id: "c1",
    cliente_nome: "Cliente A",
    status: "Em andamento",
    valor_contrato: 0,
    receita: 0,
    custo: 0,
    margem: 0,
    margem_pct: 0,
    ...over,
  });

  it("soma receita/custo por cliente e recomputa a margem agregada", () => {
    const rows = [
      mk({ cliente_id: "c1", cliente_nome: "Cliente A", receita: 10000, custo: 4000, valor_contrato: 12000 }),
      mk({ cliente_id: "c1", cliente_nome: "Cliente A", receita: 30000, custo: 26000, valor_contrato: 35000 }),
      mk({ cliente_id: "c2", cliente_nome: "Cliente B", receita: 5000, custo: 8000 }),
    ];
    const agg = aggregatePorCliente(rows);
    expect(agg).toHaveLength(2);

    const a = agg.find((c) => c.cliente_id === "c1")!;
    expect(a.num_projetos).toBe(2);
    expect(a.receita).toBe(40000);
    expect(a.custo).toBe(30000);
    expect(a.margem).toBe(10000);
    expect(a.margem_pct).toBe(25);
    expect(a.valor_contrato).toBe(47000);
  });

  it("ordena por margem R$ decrescente", () => {
    const rows = [
      mk({ cliente_id: "c2", cliente_nome: "B", receita: 5000, custo: 8000 }),
      mk({ cliente_id: "c1", cliente_nome: "A", receita: 10000, custo: 4000 }),
    ];
    const agg = aggregatePorCliente(rows);
    expect(agg[0].cliente_id).toBe("c1");
    expect(agg[1].cliente_id).toBe("c2");
  });

  it("agrupa projetos sem cliente sob uma chave única", () => {
    const rows = [
      mk({ cliente_id: null, cliente_nome: "Sem cliente", receita: 1000, custo: 500 }),
      mk({ cliente_id: null, cliente_nome: "Sem cliente", receita: 2000, custo: 500 }),
    ];
    const agg = aggregatePorCliente(rows);
    expect(agg).toHaveLength(1);
    expect(agg[0].num_projetos).toBe(2);
    expect(agg[0].receita).toBe(3000);
  });
});
