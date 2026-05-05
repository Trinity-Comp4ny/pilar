// Cache policy: índice de saúde combina dados financeiros + projetos. Como agrega
// receitas/despesas/inadimplência (dinheiro real), tratamos como dado crítico:
// staleTime 2min, refetchInterval 5min e refetchOnWindowFocus ligados.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ReceitaHealth {
  valor: number;
  status: string;
  cliente_id: string | null;
  data_vencimento: string;
  data_recebimento: string | null;
  projeto_id: string | null;
}

interface DespesaHealth {
  valor: number;
  status: string;
  projeto_id: string | null;
}

interface ProjetoAtivo {
  id: string;
  status: string;
  data_previsao: string | null;
  data_final: string | null;
}

interface ProjetoConcluido {
  id: string;
  data_previsao: string | null;
  data_final: string | null;
}

export interface HealthBreakdown {
  margem: number; // 0-100
  previsibilidade: number; // 0-100
  ociosidade: number; // 0-100 (100 = sem ociosos)
  atrasos: number; // 0-100 (100 = sem atrasos)
  inadimplencia: number; // 0-100 (100 = sem inadimplência)
  concentracao: number; // 0-100 (100 = diversificado)
}

export interface HealthIndex {
  score: number; // 0-100
  breakdown: HealthBreakdown;
  label: string;
  color: string;
}

const PESOS = {
  margem: 0.25,
  previsibilidade: 0.2,
  ociosidade: 0.15,
  atrasos: 0.15,
  inadimplencia: 0.15,
  concentracao: 0.1,
};

function getLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Excelente", color: "hsl(var(--chart-success))" };
  if (score >= 60) return { label: "Bom", color: "hsl(var(--c-lime-500))" };
  if (score >= 40) return { label: "Atenção", color: "hsl(var(--chart-warning))" };
  if (score >= 20) return { label: "Crítico", color: "hsl(var(--c-orange-500))" };
  return { label: "Emergência", color: "hsl(var(--chart-danger))" };
}

/**
 * Calcula o Índice Pilar de Saúde Operacional (0-100)
 * Composto por 6 métricas ponderadas
 */
export const useHealthIndex = () => {
  return useQuery({
    queryKey: ["health-index"],
    queryFn: async () => {
      // Busca dados em paralelo
      const [receitasRes, despesasRes, projetosRes, projetosConcRes] = await Promise.all([
        supabase
          .from("receitas")
          .select("valor, status, cliente_id, data_vencimento, data_recebimento, projeto_id")
          .is("deleted_at", null),
        supabase.from("despesas").select("valor, status, projeto_id").is("deleted_at", null),
        supabase
          .from("projetos")
          .select("id, status, data_previsao, data_final")
          .is("deleted_at", null)
          .in("status", ["Planejamento", "Em andamento"]),
        supabase
          .from("projetos")
          .select("id, data_previsao, data_final")
          .is("deleted_at", null)
          .eq("status", "Concluído"),
      ]);

      const receitas = (receitasRes.data || []) as ReceitaHealth[];
      const despesas = (despesasRes.data || []) as DespesaHealth[];
      const projetosAtivos = (projetosRes.data || []) as ProjetoAtivo[];
      const projetosConcluidos = (projetosConcRes.data || []) as ProjetoConcluido[];

      // 1. MARGEM (25%) - Margem média dos projetos com receita
      const receitasPorProjeto: Record<string, number> = {};
      const despesasPorProjeto: Record<string, number> = {};
      receitas.forEach((r) => {
        if (r.projeto_id) receitasPorProjeto[r.projeto_id] = (receitasPorProjeto[r.projeto_id] || 0) + Number(r.valor);
      });
      despesas.forEach((d) => {
        if (d.projeto_id) despesasPorProjeto[d.projeto_id] = (despesasPorProjeto[d.projeto_id] || 0) + Number(d.valor);
      });

      const projetosComReceita = Object.keys(receitasPorProjeto);
      let margemMedia = 0;
      if (projetosComReceita.length > 0) {
        const margens = projetosComReceita.map((pid) => {
          const rec = receitasPorProjeto[pid] || 0;
          const desp = despesasPorProjeto[pid] || 0;
          return rec > 0 ? ((rec - desp) / rec) * 100 : 0;
        });
        margemMedia = margens.reduce((a, b) => a + b, 0) / margens.length;
      }
      // Score: margem de 30%+ = 100, 0% = 0, negativa = 0
      const scoreMargem = Math.max(0, Math.min(100, (margemMedia / 30) * 100));

      // 2. PREVISIBILIDADE (20%) - % projetos entregues no prazo (últimos 12 meses)
      const umAnoAtras = new Date();
      umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
      const recentes = projetosConcluidos.filter((p) => p.data_final && new Date(p.data_final) >= umAnoAtras);
      const noPrazo = recentes.filter(
        (p) => p.data_previsao && p.data_final && new Date(p.data_final) <= new Date(p.data_previsao)
      );
      const scorePrevisibilidade = recentes.length > 0 ? (noPrazo.length / recentes.length) * 100 : 50;

      // 3. OCIOSIDADE (15%) - Invertido: mais ociosos = menor score
      // Sem dados de alocação detalhados, usamos projetos ativos por pessoa como proxy
      // Score fixo em 70 como baseline (será melhorado com dados de alocações)
      const scoreOciosidade = 70;

      // 4. ATRASOS (15%) - % projetos ativos SEM atraso
      const atrasados = projetosAtivos.filter(
        (p) => p.data_previsao && !p.data_final && new Date(p.data_previsao) < new Date()
      ).length;
      const scoreAtrasos =
        projetosAtivos.length > 0 ? ((projetosAtivos.length - atrasados) / projetosAtivos.length) * 100 : 100;

      // 5. INADIMPLÊNCIA (15%) - % receitas NÃO atrasadas
      const receitasPendentes = receitas.filter((r) => r.status === "Pendente");
      const receitasAtrasadas = receitasPendentes.filter(
        (r) => r.data_vencimento && new Date(r.data_vencimento) < new Date()
      );
      const valorAtrasado = receitasAtrasadas.reduce((s, r) => s + Number(r.valor), 0);
      const valorPendente = receitasPendentes.reduce((s, r) => s + Number(r.valor), 0);
      const scoreInadimplencia = valorPendente > 0 ? ((valorPendente - valorAtrasado) / valorPendente) * 100 : 100;

      // 6. CONCENTRAÇÃO DE CLIENTES (10%) - HHI invertido
      const receitaPorCliente: Record<string, number> = {};
      const totalReceita = receitas.reduce((s, r) => s + Number(r.valor), 0);
      receitas.forEach((r) => {
        const cid = r.cliente_id || "sem_cliente";
        receitaPorCliente[cid] = (receitaPorCliente[cid] || 0) + Number(r.valor);
      });

      let hhi = 0;
      if (totalReceita > 0) {
        Object.values(receitaPorCliente).forEach((val) => {
          const share = val / totalReceita;
          hhi += share * share;
        });
      }
      // HHI: 1/N (perfeito) a 1.0 (um só cliente). Score = (1 - HHI) * 100
      const scoreConcentracao = Math.max(0, (1 - hhi) * 100);

      const breakdown: HealthBreakdown = {
        margem: Math.round(scoreMargem),
        previsibilidade: Math.round(scorePrevisibilidade),
        ociosidade: Math.round(scoreOciosidade),
        atrasos: Math.round(scoreAtrasos),
        inadimplencia: Math.round(scoreInadimplencia),
        concentracao: Math.round(scoreConcentracao),
      };

      const score = Math.round(
        breakdown.margem * PESOS.margem +
          breakdown.previsibilidade * PESOS.previsibilidade +
          breakdown.ociosidade * PESOS.ociosidade +
          breakdown.atrasos * PESOS.atrasos +
          breakdown.inadimplencia * PESOS.inadimplencia +
          breakdown.concentracao * PESOS.concentracao
      );

      const { label, color } = getLabel(score);

      return { score, breakdown, label, color } as HealthIndex;
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
};
