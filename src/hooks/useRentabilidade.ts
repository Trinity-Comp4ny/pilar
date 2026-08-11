// Cache policy: rentabilidade depende de receitas/despesas reais. Tratado como
// dado financeiro crítico: staleTime 2min, refetchInterval 5min em background
// e refetchOnWindowFocus para o usuário ver números atualizados ao retornar.
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
  custo_mao_de_obra: number;
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
  custo_mao_de_obra: unknown;
  horas_orcadas: unknown;
  horas_consumidas: unknown;
}

function calcularMargens(raw: RpcRentabilidadeRow, custoIndiretoPct = 15): ProjetoRentabilidade {
  const receitas = Number(raw.receitas_total) || 0;
  const despesas = Number(raw.despesas_diretas) || 0;
  const maoDeObra = Number(raw.custo_mao_de_obra) || 0;
  // Mão de obra é custo direto: entra na margem bruta junto das despesas.
  const custoDireto = despesas + maoDeObra;
  const margemBruta = receitas - custoDireto;
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
    custo_mao_de_obra: maoDeObra,
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
      const projetos = rows.map((p) => calcularMargens(p as unknown as RpcRentabilidadeRow));

      // Métricas agregadas
      const comReceita = projetos.filter((p) => p.receitas_total > 0);
      const totalReceitas = projetos.reduce((s, p) => s + p.receitas_total, 0);
      const totalDespesas = projetos.reduce((s, p) => s + p.despesas_diretas, 0);
      const totalMaoDeObra = projetos.reduce((s, p) => s + p.custo_mao_de_obra, 0);
      const margemMediaPct =
        comReceita.length > 0 ? comReceita.reduce((s, p) => s + p.margem_bruta_pct, 0) / comReceita.length : 0;

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
          totalMaoDeObra,
          margemBrutaTotal: totalReceitas - totalDespesas - totalMaoDeObra,
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
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
};

export interface ClienteRentabilidade {
  cliente_id: string;
  cliente_nome: string;
  total_receitas: number;
  total_despesas: number;
  margem_bruta: number;
  margem_bruta_pct: number;
  num_projetos: number;
  concentracao_pct: number;
}

export const useRentabilidadePorCliente = () => {
  return useQuery({
    queryKey: ["rentabilidade-por-cliente"],
    queryFn: async () => {
      // Buscar todos os projetos com rentabilidade
      const { data, error } = await supabase.rpc("rpc_dashboard_rentabilidade");
      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      const projetos = rows.map((p) => calcularMargens(p as unknown as RpcRentabilidadeRow));

      // Buscar clientes dos projetos
      const projetoIds = projetos.map((p) => p.projeto_id).filter(Boolean);
      if (projetoIds.length === 0) return { clientes: [], totalReceitas: 0 };

      const { data: projetosData } = await supabase
        .from("projetos")
        .select("id, cliente_id, clientes(nome)")
        .in("id", projetoIds)
        .is("deleted_at", null);

      const clienteMap = new Map<string, { nome: string; projetos: typeof projetos }>();

      for (const pd of projetosData || []) {
        const clienteId = pd.cliente_id;
        if (!clienteId) continue;
        const clienteNome = pd.clientes?.nome || "Sem cliente";
        const projeto = projetos.find((p) => p.projeto_id === pd.id);
        if (!projeto) continue;

        if (!clienteMap.has(clienteId)) {
          clienteMap.set(clienteId, { nome: clienteNome, projetos: [] });
        }
        clienteMap.get(clienteId)!.projetos.push(projeto);
      }

      const totalReceitas = projetos.reduce((s, p) => s + p.receitas_total, 0);

      const clientes: ClienteRentabilidade[] = Array.from(clienteMap.entries()).map(
        ([clienteId, { nome, projetos: clienteProjetos }]) => {
          const rec = clienteProjetos.reduce((s, p) => s + p.receitas_total, 0);
          // Custo do cliente = despesas diretas + mão de obra dos projetos.
          const desp = clienteProjetos.reduce((s, p) => s + p.despesas_diretas + p.custo_mao_de_obra, 0);
          const margem = rec - desp;

          return {
            cliente_id: clienteId,
            cliente_nome: nome,
            total_receitas: rec,
            total_despesas: desp,
            margem_bruta: margem,
            margem_bruta_pct: rec > 0 ? (margem / rec) * 100 : 0,
            num_projetos: clienteProjetos.length,
            concentracao_pct: totalReceitas > 0 ? (rec / totalReceitas) * 100 : 0,
          };
        }
      );

      clientes.sort((a, b) => b.margem_bruta - a.margem_bruta);

      return { clientes, totalReceitas };
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
};

export const useProjetosDrenandoCaixa = () => {
  return useQuery({
    queryKey: ["projetos-drenando-caixa"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_dashboard_rentabilidade");
      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      const projetos = rows.map((p) => calcularMargens(p as unknown as RpcRentabilidadeRow));

      return projetos.filter((p) => p.margem_bruta < 0).sort((a, b) => a.margem_bruta - b.margem_bruta);
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
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
      return calcularMargens(data as unknown as RpcRentabilidadeRow);
    },
    enabled: !!projetoId,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
};
