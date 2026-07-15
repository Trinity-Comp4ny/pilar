import { describe, it, expect } from "vitest";
import {
  buildKPIs,
  buildProjetos,
  buildLeadsPipeline,
  buildVencimentos,
  buildAlertas,
  processChartData,
} from "./dashboard/processors";
import type { DashboardData, ProjetoWithCliente, ReceitaChartRow, DespesaChartRow } from "./dashboard/types";

/**
 * Estes testes validam o CONTRATO do retorno do useDashboardData
 * sem mockar a Supabase chain. A lógica está em ./dashboard/processors
 * (funções puras), então compomos o mesmo shape de DashboardData a
 * partir delas para garantir que o hook retorne defaults estáveis e
 * que arrays/agregações correspondam ao esperado pelos componentes.
 */

const buildDashboardDataFromInputs = (overrides: {
  receitasMes?: Parameters<typeof buildKPIs>[0];
  receitasMesAnt?: Parameters<typeof buildKPIs>[1];
  despesasMes?: Parameters<typeof buildKPIs>[2];
  despesasMesAnt?: Parameters<typeof buildKPIs>[3];
  receitasPendentes?: Parameters<typeof buildKPIs>[4];
  despesasPendentes?: Parameters<typeof buildKPIs>[5];
  projetosAtivos?: number;
  projetosData?: unknown[];
  leadsData?: unknown[];
  proxReceitas?: unknown[];
  proxDespesas?: unknown[];
  alertasData?: unknown[];
  alertasNaoLidos?: number;
  now?: Date;
}): DashboardData => {
  const now = overrides.now ?? new Date("2026-05-15");
  const mesStart = "2026-05-01";
  const mesEnd = "2026-05-31";
  const antStart = "2026-04-01";
  const antEnd = "2026-04-30";

  const kpis = buildKPIs(
    overrides.receitasMes ?? null,
    overrides.receitasMesAnt ?? null,
    overrides.despesasMes ?? null,
    overrides.despesasMesAnt ?? null,
    overrides.receitasPendentes ?? null,
    overrides.despesasPendentes ?? null,
    overrides.projetosAtivos ?? 0,
    mesStart,
    mesEnd,
    antStart,
    antEnd
  );

  const projetos = buildProjetos(overrides.projetosData ?? [], now);
  const { pipeline: leadsPipeline, total: leadsTotal } = buildLeadsPipeline(overrides.leadsData ?? []);
  const proximosVencimentos = buildVencimentos(overrides.proxReceitas ?? [], overrides.proxDespesas ?? [], now);
  const alertas = buildAlertas(overrides.alertasData ?? []);

  return {
    kpis,
    projetos,
    proximosVencimentos,
    leadsPipeline,
    leadsTotal,
    alertas,
    alertasNaoLidos: overrides.alertasNaoLidos ?? 0,
  };
};

describe("useDashboardData (contract)", () => {
  it("returns default KPI structure when data is empty", () => {
    const data = buildDashboardDataFromInputs({});

    expect(data.kpis).toEqual({
      receitaMes: 0,
      despesaMes: 0,
      saldoMes: 0,
      receitaVariacao: 0,
      despesaVariacao: 0,
      aReceber: 0,
      aPagar: 0,
      projetosAtivos: 0,
    });

    // Defaults dos demais campos do contrato
    expect(data.projetos).toEqual([]);
    expect(data.proximosVencimentos).toEqual([]);
    expect(data.leadsPipeline).toEqual([]);
    expect(data.leadsTotal).toBe(0);
    expect(data.alertas).toEqual([]);
    expect(data.alertasNaoLidos).toBe(0);
  });

  it("returns projetos array and aggregates chart data", () => {
    const projeto: ProjetoWithCliente = {
      id: "p1",
      codigo_projeto: "PRJ-100",
      nome: "Proj 1",
      status: "Em andamento",
      prioridade: "Alta",
      status_data: null,
      valor_contrato: 25000,
      data_inicio: "2026-01-01",
      data_previsao: "2026-12-31",
      data_final: null,
      cliente_id: "c1",
      clientes: { nome: "Cliente Alpha" },
    };

    const receitaChart: ReceitaChartRow[] = [
      { valor: 1000, data_recebimento: "2026-05-10", data_vencimento: "2026-05-10", status: "Recebido" },
    ];
    const despesaChart: DespesaChartRow[] = [
      { valor: 400, data_pagamento: "2026-05-12", data_vencimento: "2026-05-12", status: "Pago" },
    ];

    const data = buildDashboardDataFromInputs({
      projetosData: [projeto],
      projetosAtivos: 1,
    });

    // projetos: array com shape correto
    expect(Array.isArray(data.projetos)).toBe(true);
    expect(data.projetos).toHaveLength(1);
    expect(data.projetos[0]).toMatchObject({
      id: "p1",
      nome: "PRJ-100",
      cliente: "Cliente Alpha",
      valorContrato: 25000,
    });
    expect(typeof data.projetos[0].progressoPrazo).toBe("number");

    // KPI projetosAtivos é repassado
    expect(data.kpis.projetosAtivos).toBe(1);

    // O gráfico agora vem de hooks dedicados (RPC + fallback); a agregação
    // continua sendo responsabilidade de processChartData.
    const chartData = processChartData(receitaChart, despesaChart);
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({ receitas: 1000, despesas: 400, saldo: 600 });
    expect(chartData[0].mes).toMatch(/\/\d{2}$/);
  });
});
