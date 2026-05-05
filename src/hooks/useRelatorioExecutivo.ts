import { useCallback, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  generateExecutiveReport,
  type ExecutiveReportData,
  type ExecutiveConta,
  type ExecutiveLeadStatus,
} from "@/lib/relatorioExecutivo";

interface ContaRow {
  nome: string;
  saldo_inicial: number | null;
}

interface MovRow {
  conta_id: string | null;
  valor: number | null;
  status: string | null;
}

interface LeadValorRow {
  status: string | null;
  valor_estimado: number | null;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export function useRelatorioExecutivo() {
  const now = new Date();
  const periodoStart = startOfMonth(now);
  const periodoEnd = endOfMonth(now);

  const { profile } = useAuth();
  const empresa = profile?.empresas;
  const { data: dashboard, isLoading: dashboardLoading, refetch } = useDashboardData(periodoStart, periodoEnd);

  const [isGenerating, setIsGenerating] = useState(false);

  const gerar = useCallback(async () => {
    if (!empresa) {
      toast.error("Empresa não encontrada", { description: "Faça login novamente." });
      return;
    }

    setIsGenerating(true);
    try {
      // Garante dados frescos
      const dash = dashboard ?? (await refetch()).data;
      if (!dash) {
        toast.error("Não foi possível carregar os dados do dashboard.");
        return;
      }

      // Busca saldos por conta (saldo_inicial + recebimentos pagos - pagamentos pagos)
      const [contasRes, receitasPagasRes, despesasPagasRes, leadsValorRes] = await Promise.all([
        supabase.from("contas").select("id, nome, saldo_inicial").eq("empresa_id", empresa.id),
        supabase
          .from("receitas")
          .select("conta_id, valor, status")
          .eq("empresa_id", empresa.id)
          .eq("status", "Recebido"),
        supabase.from("despesas").select("conta_id, valor, status").eq("empresa_id", empresa.id).eq("status", "Pago"),
        supabase.from("leads").select("status, valor_estimado").eq("empresa_id", empresa.id),
      ]);

      const contasData = (contasRes.data ?? []) as Array<ContaRow & { id: string }>;
      const receitasPagas = (receitasPagasRes.data ?? []) as MovRow[];
      const despesasPagas = (despesasPagasRes.data ?? []) as MovRow[];
      const leadsValor = (leadsValorRes.data ?? []) as LeadValorRow[];

      const saldoPorConta = new Map<string, number>();
      contasData.forEach((c) => saldoPorConta.set(c.id, Number(c.saldo_inicial ?? 0)));
      receitasPagas.forEach((r) => {
        if (!r.conta_id) return;
        saldoPorConta.set(r.conta_id, (saldoPorConta.get(r.conta_id) ?? 0) + Number(r.valor ?? 0));
      });
      despesasPagas.forEach((d) => {
        if (!d.conta_id) return;
        saldoPorConta.set(d.conta_id, (saldoPorConta.get(d.conta_id) ?? 0) - Number(d.valor ?? 0));
      });

      const contas: ExecutiveConta[] = contasData.map((c) => ({
        nome: c.nome,
        saldo: saldoPorConta.get(c.id) ?? 0,
      }));

      // Pipeline com valor real
      const pipelineComValor: ExecutiveLeadStatus[] = dash.leadsPipeline.map((p) => {
        const valor = leadsValor
          .filter((l) => (l.status ?? "") === p.status)
          .reduce((acc, l) => acc + Number(l.valor_estimado ?? 0), 0);
        return { status: p.status, count: p.count, valor };
      });

      // Top 5 projetos por valor de contrato
      const topProjetos = [...dash.projetos]
        .sort((a, b) => (b.valorContrato ?? 0) - (a.valorContrato ?? 0))
        .slice(0, 5)
        .map((p) => ({
          nome: p.nome,
          cliente: p.cliente,
          valorContrato: p.valorContrato ?? 0,
          progresso: p.progressoPrazo ?? 0,
        }));

      const ultimosSeisMeses = dash.chartData.slice(-6).map((c) => ({
        mes: c.mes,
        receitas: c.receitas,
        despesas: c.despesas,
        saldo: c.saldo,
      }));

      const reportData: ExecutiveReportData = {
        empresaNome: empresa.nome,
        empresaLogoUrl: empresa.logo_url,
        periodoInicio: periodoStart,
        periodoFim: periodoEnd,
        kpis: {
          receitaTotal: dash.kpis.receitaMes,
          despesaTotal: dash.kpis.despesaMes,
          lucroLiquido: dash.kpis.saldoMes,
          aReceber: dash.kpis.aReceber,
          aPagar: dash.kpis.aPagar,
        },
        topProjetos,
        pipelineLeads: pipelineComValor,
        ultimosSeisMeses,
        contas,
      };

      const doc = generateExecutiveReport(reportData);
      const filename = `pilar-executivo-${slugify(empresa.nome)}-${format(now, "yyyy-MM")}.pdf`;
      doc.save(filename);

      toast.success("Relatório executivo gerado", { description: filename });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tente novamente.";
      toast.error("Erro ao gerar relatório", { description: message });
    } finally {
      setIsGenerating(false);
    }
  }, [dashboard, empresa, now, periodoEnd, periodoStart, refetch]);

  return {
    gerar,
    isGenerating,
    isLoading: dashboardLoading,
  };
}
