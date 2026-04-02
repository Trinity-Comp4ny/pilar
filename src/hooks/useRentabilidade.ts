import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjetoRentabilidade {
  projeto_id: string;
  projeto_nome: string;
  codigo_projeto: string;
  status: string;
  valor_contrato: number;
  receitas_total: number;
  receitas_recebidas: number;
  despesas_diretas: number;
  horas_orcadas: number;
  horas_consumidas: number;
  // Calculados no frontend
  margem_bruta: number;
  margem_bruta_pct: number;
  margem_liquida: number;
  margem_liquida_pct: number;
}

/** Linha retornada pelos RPCs `rpc_dashboard_rentabilidade` / `rpc_projeto_rentabilidade` */
export interface RpcRentabilidadeRow {
  projeto_id: unknown;
  projeto_nome: unknown;
  codigo_projeto: unknown;
  status: unknown;
  valor_contrato: unknown;
  receitas_total: unknown;
  receitas_recebidas: unknown;
  despesas_diretas: unknown;
  horas_orcadas: unknown;
  horas_consumidas: unknown;
}

function calcularMargens(raw: RpcRentabilidadeRow, custoIndiretoPct = 15): ProjetoRentabilidade {
  const receitas = Number(raw.receitas_total) || 0;
  const despesas = Number(raw.despesas_diretas) || 0;
  const margemBruta = receitas - despesas;
  const margemBrutaPct = receitas > 0 ? (margemBruta / receitas) * 100 : 0;
  const custoIndireto = despesas * (custoIndiretoPct / 100);
  const margemLiquida = margemBruta - custoIndireto;
  const margemLiquidaPct = receitas > 0 ? (margemLiquida / receitas) * 100 : 0;

  return {
    projeto_id: String(raw.projeto_id ?? ""),
    projeto_nome: String(raw.projeto_nome ?? ""),
    codigo_projeto: String(raw.codigo_projeto ?? ""),
    status: String(raw.status ?? ""),
    valor_contrato: Number(raw.valor_contrato) || 0,
    receitas_total: receitas,
    receitas_recebidas: Number(raw.receitas_recebidas) || 0,
    despesas_diretas: despesas,
    horas_orcadas: Number(raw.horas_orcadas) || 0,
    horas_consumidas: Number(raw.horas_consumidas) || 0,
    margem_bruta: margemBruta,
    margem_bruta_pct: margemBrutaPct,
    margem_liquida: margemLiquida,
    margem_liquida_pct: margemLiquidaPct,
  };
}

export const useDashboardRentabilidade = () => {
  return useQuery({
    queryKey: ["dashboard-rentabilidade"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_dashboard_rentabilidade");
      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      const projetos = rows.map((p) => calcularMargens(p as RpcRentabilidadeRow));

      // Métricas agregadas
      const comReceita = projetos.filter((p) => p.receitas_total > 0);
      const totalReceitas = projetos.reduce((s, p) => s + p.receitas_total, 0);
      const totalDespesas = projetos.reduce((s, p) => s + p.despesas_diretas, 0);
      const margemMediaPct = comReceita.length > 0
        ? comReceita.reduce((s, p) => s + p.margem_bruta_pct, 0) / comReceita.length
        : 0;

      const totalHorasOrcadas = projetos.reduce((s, p) => s + p.horas_orcadas, 0);
      const totalHorasConsumidas = projetos.reduce((s, p) => s + p.horas_consumidas, 0);

      // Top 5 mais/menos rentáveis
      const ordenadosPorMargem = [...comReceita].sort((a, b) => b.margem_bruta_pct - a.margem_bruta_pct);
      const topRentaveis = ordenadosPorMargem.slice(0, 5);
      const menosRentaveis = ordenadosPorMargem.slice(-5).reverse();

      return {
        projetos,
        metricas: {
          totalReceitas,
          totalDespesas,
          margemBrutaTotal: totalReceitas - totalDespesas,
          margemMediaPct,
          totalHorasOrcadas,
          totalHorasConsumidas,
          utilizacaoHoras: totalHorasOrcadas > 0 ? (totalHorasConsumidas / totalHorasOrcadas) * 100 : 0,
          totalProjetos: projetos.length,
          projetosComReceita: comReceita.length,
        },
        topRentaveis,
        menosRentaveis,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const useProjetoRentabilidade = (projetoId: string | undefined) => {
  return useQuery({
    queryKey: ["projeto-rentabilidade", projetoId],
    queryFn: async () => {
      if (!projetoId) return null;
      const { data, error } = await supabase.rpc("rpc_projeto_rentabilidade", {
        p_projeto_id: projetoId,
      });
      if (error) throw error;
      if (!data) return null;
      return calcularMargens(data as RpcRentabilidadeRow);
    },
    enabled: !!projetoId,
    staleTime: 1000 * 60 * 3,
  });
};
