import { describe, it, expect } from "vitest";
import {
  sumValues,
  buildKPIs,
  buildProjetos,
  buildLeadsPipeline,
  buildVencimentos,
  buildAlertas,
  processChartData,
} from "./processors";
import type {
  ProjetoWithCliente,
  LeadRow,
  AlertaRow,
  ProximaReceitaRow,
  ProximaDespesaRow,
  ReceitaChartRow,
  DespesaChartRow,
} from "./types";

describe("sumValues", () => {
  it("retorna 0 para null/undefined/vazio", () => {
    expect(sumValues(null)).toBe(0);
    expect(sumValues([])).toBe(0);
  });

  it("soma valores numéricos", () => {
    expect(sumValues([{ valor: 100 }, { valor: 250.5 }])).toBe(350.5);
  });

  it("converte strings para número", () => {
    expect(sumValues([{ valor: "100" as unknown as number }, { valor: "50" as unknown as number }])).toBe(150);
  });
});

describe("buildKPIs", () => {
  const mesStart = "2026-05-01";
  const mesEnd = "2026-05-31";
  const antStart = "2026-04-01";
  const antEnd = "2026-04-30";

  it("retorna estrutura zerada quando tudo vazio", () => {
    const kpis = buildKPIs(null, null, null, null, null, null, 0, mesStart, mesEnd, antStart, antEnd);
    expect(kpis).toEqual({
      receitaMes: 0,
      despesaMes: 0,
      saldoMes: 0,
      receitaVariacao: 0,
      despesaVariacao: 0,
      aReceber: 0,
      aPagar: 0,
      projetosAtivos: 0,
    });
  });

  it("calcula saldo, variação e pendentes", () => {
    const kpis = buildKPIs(
      [{ valor: 1000, status: "Recebido", data_recebimento: "2026-05-10", data_vencimento: "2026-05-15" }],
      [{ valor: 500, status: "Recebido", data_recebimento: "2026-04-10", data_vencimento: "2026-04-15" }],
      [{ valor: 300, status: "Pendente", data_pagamento: null, data_vencimento: "2026-05-20" }],
      [{ valor: 200, status: "Pendente", data_pagamento: null, data_vencimento: "2026-04-20" }],
      [{ valor: 1500 }],
      [{ valor: 700 }],
      4,
      mesStart,
      mesEnd,
      antStart,
      antEnd
    );

    expect(kpis.receitaMes).toBe(1000);
    expect(kpis.despesaMes).toBe(300);
    expect(kpis.saldoMes).toBe(700);
    expect(kpis.receitaVariacao).toBe(100); // 500 → 1000
    expect(kpis.despesaVariacao).toBe(50); // 200 → 300
    expect(kpis.aReceber).toBe(1500);
    expect(kpis.aPagar).toBe(700);
    expect(kpis.projetosAtivos).toBe(4);
  });

  it("ignora linhas fora da janela do mês", () => {
    const kpis = buildKPIs(
      [
        { valor: 100, status: "Recebido", data_recebimento: "2026-05-10", data_vencimento: "2026-05-10" },
        { valor: 999, status: "Recebido", data_recebimento: "2026-03-10", data_vencimento: "2026-03-10" },
      ],
      null,
      null,
      null,
      null,
      null,
      0,
      mesStart,
      mesEnd,
      antStart,
      antEnd
    );
    expect(kpis.receitaMes).toBe(100);
  });
});

describe("buildProjetos", () => {
  const projeto: ProjetoWithCliente = {
    id: "p1",
    codigo_projeto: "PRJ-001",
    nome: "Projeto X",
    status: "Em andamento",
    prioridade: "Alta",
    status_data: null,
    valor_contrato: 50000,
    data_inicio: "2026-01-01",
    data_previsao: "2026-12-31",
    data_final: null,
    cliente_id: "c1",
    clientes: { nome: "Cliente A" },
  };

  it("mapeia campos e calcula progresso de prazo", () => {
    const now = new Date("2026-07-01");
    const [r] = buildProjetos([projeto], now);
    expect(r.id).toBe("p1");
    expect(r.nome).toBe("PRJ-001");
    expect(r.cliente).toBe("Cliente A");
    expect(r.valorContrato).toBe(50000);
    expect(r.progressoPrazo).toBeGreaterThan(40);
    expect(r.progressoPrazo).toBeLessThan(60);
  });

  it("ordena por prioridade Alta → Media → Baixa", () => {
    const baixa = { ...projeto, id: "b", prioridade: "Baixa" };
    const media = { ...projeto, id: "m", prioridade: "Media" };
    const alta = { ...projeto, id: "a", prioridade: "Alta" };
    const r = buildProjetos([baixa, media, alta], new Date("2026-07-01"));
    expect(r.map((p) => p.id)).toEqual(["a", "m", "b"]);
  });

  it("usa fallback quando faltam dados", () => {
    const sem = { ...projeto, codigo_projeto: null, nome: "", clientes: null, valor_contrato: null };
    const [r] = buildProjetos([sem], new Date("2026-07-01"));
    expect(r.nome).toBe("Sem nome");
    expect(r.cliente).toBe("—");
    expect(r.valorContrato).toBe(0);
  });

  it("progresso 0 sem datas", () => {
    const semData = { ...projeto, data_inicio: null, data_previsao: null };
    const [r] = buildProjetos([semData], new Date("2026-07-01"));
    expect(r.progressoPrazo).toBe(0);
  });
});

describe("buildLeadsPipeline", () => {
  it("agrupa por status e filtra etapas vazias", () => {
    const leads: LeadRow[] = [
      { id: "1", status: "Novo", nome: "L1" },
      { id: "2", status: "Novo", nome: "L2" },
      { id: "3", status: "Em contato", nome: "L3" },
      { id: "4", status: "Ganho", nome: "L4" },
    ];
    const { pipeline, total } = buildLeadsPipeline(leads);
    expect(total).toBe(4);
    expect(pipeline).toEqual([
      { status: "Novo", count: 2, valor: 0 },
      { status: "Em contato", count: 1, valor: 0 },
      { status: "Ganho", count: 1, valor: 0 },
    ]);
  });

  it("retorna pipeline vazia sem leads", () => {
    expect(buildLeadsPipeline([])).toEqual({ pipeline: [], total: 0 });
  });
});

describe("buildVencimentos", () => {
  const now = new Date("2026-05-01");

  const receita: ProximaReceitaRow = {
    id: "r1",
    descricao: "Receita 1",
    valor: 1000,
    data_vencimento: "2026-05-10",
    status: "Pendente",
    projeto_id: null,
    projetos: { codigo_projeto: "PRJ-001" },
    cliente_id: null,
    clientes: { nome: "Cliente A" },
  };

  const despesa: ProximaDespesaRow = {
    id: "d1",
    descricao: "Despesa 1",
    valor: 500,
    data_vencimento: "2026-05-05",
    status: "Pendente",
    projeto_id: null,
    projetos: null,
    fornecedor_id: null,
    fornecedores: { nome: "Fornecedor B" },
  };

  it("mescla receita+despesa, ordena por dias e limita a 8", () => {
    const v = buildVencimentos([receita], [despesa], now);
    expect(v).toHaveLength(2);
    expect(v[0].id).toBe("d1"); // 4 dias
    expect(v[1].id).toBe("r1"); // 9 dias
    expect(v[0].diasRestantes).toBe(4);
    expect(v[0].entidade).toBe("Fornecedor B");
    expect(v[1].projeto).toBe("PRJ-001");
  });

  it("limita a 8 itens", () => {
    const muitas = Array.from({ length: 10 }, (_, i) => ({ ...receita, id: `r${i}` }));
    const v = buildVencimentos(muitas, [], now);
    expect(v).toHaveLength(8);
  });
});

describe("buildAlertas", () => {
  it("mapeia campos do alerta", () => {
    const a: AlertaRow = {
      id: "a1",
      tipo: "atraso",
      severidade: "alta",
      titulo: "T",
      mensagem: "M",
      created_at: "2026-05-01",
    };
    expect(buildAlertas([a])).toEqual([a]);
  });

  it("retorna [] quando vazio", () => {
    expect(buildAlertas([])).toEqual([]);
  });
});

describe("processChartData", () => {
  it("agrupa por mês e calcula saldo", () => {
    const receitas: ReceitaChartRow[] = [
      { valor: 1000, data_recebimento: "2026-05-10", data_vencimento: "2026-05-10", status: "Recebido" },
      { valor: 500, data_recebimento: "2026-05-20", data_vencimento: "2026-05-20", status: "Recebido" },
    ];
    const despesas: DespesaChartRow[] = [
      { valor: 300, data_pagamento: "2026-05-15", data_vencimento: "2026-05-15", status: "Pago" },
    ];
    const r = processChartData(receitas, despesas);
    expect(r).toHaveLength(1);
    expect(r[0].receitas).toBe(1500);
    expect(r[0].despesas).toBe(300);
    expect(r[0].saldo).toBe(1200);
  });

  it("ordena cronologicamente e limita a 12 meses", () => {
    const receitas: ReceitaChartRow[] = Array.from({ length: 14 }, (_, i) => ({
      valor: 100,
      data_recebimento: `2025-${String((i % 12) + 1).padStart(2, "0")}-15`,
      data_vencimento: `2025-${String((i % 12) + 1).padStart(2, "0")}-15`,
      status: "Recebido",
    }));
    const r = processChartData(receitas, []);
    expect(r.length).toBeLessThanOrEqual(12);
    for (let i = 1; i < r.length; i++) {
      expect(r[i].sortKey >= r[i - 1].sortKey).toBe(true);
    }
  });

  it("retorna [] sem dados", () => {
    expect(processChartData([], [])).toEqual([]);
  });
});
