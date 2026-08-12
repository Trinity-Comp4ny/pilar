import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import { startOfMonth, endOfMonth, parseISO, format, isValid } from "date-fns";
import { LayoutDashboard, Receipt, Users2, Wallet, FileBarChart } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PeriodoPopover } from "./financeiro/components/PeriodoPopover";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useRegistrarPagina } from "@/hooks/useRecentes";
import { SecondSidebar, type SecondSidebarTab } from "@/components/SecondSidebar";
import { FinanceFilterProvider, type Visualizacao } from "./financeiro/contexts/FinanceFilterContext";

const VisaoGeral = lazy(() => import("./financeiro/tabs/VisaoGeral"));
const Carteira = lazy(() => import("./financeiro/tabs/Carteira"));
const Lancamentos = lazy(() => import("./financeiro/tabs/Lancamentos"));
const FolhaPagamento = lazy(() => import("./financeiro/tabs/FolhaPagamento"));
const Relatorios = lazy(() => import("./Relatorios"));

const FINANCEIRO_TABS_ALL: SecondSidebarTab[] = [
  { id: "visao-geral", label: "Visão Geral", icon: LayoutDashboard },
  { id: "lancamentos", label: "Lançamentos", icon: Receipt },
  { id: "folha-pagamento", label: "Folha de Pagamento", icon: Users2 },
  { id: "carteira", label: "Carteira", icon: Wallet },
  { id: "relatorios", label: "Relatórios", icon: FileBarChart },
];

function parseDateParam(v: string | null): Date | undefined {
  if (!v) return undefined;
  const d = parseISO(v);
  return isValid(d) ? d : undefined;
}

export default function Financeiro() {
  useRegistrarPagina("pagina", "/financeiro", "Financeiro");
  const [searchParams, setSearchParams] = useSearchParams();

  const initial = useMemo(() => {
    const now = new Date();
    const tabParam = searchParams.get("tab") || "visao-geral";
    // Links antigos: "importar" virou modal em Lançamentos; "fluxo-caixa" foi fundida na Visão Geral;
    // "faturas" e "contas" foram unificadas na Carteira.
    const legacyTab: Record<string, string> = {
      importar: "lancamentos",
      "fluxo-caixa": "visao-geral",
      faturas: "carteira",
      contas: "carteira",
    };
    return {
      tab: legacyTab[tabParam] ?? tabParam,
      from: parseDateParam(searchParams.get("from")) ?? startOfMonth(now),
      to: parseDateParam(searchParams.get("to")) ?? endOfMonth(now),
      viz: ((searchParams.get("viz") as Visualizacao) || "mes") as Visualizacao,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeTab, setActiveTab] = useState<string>(initial.tab);
  const [visualizacao, setVisualizacao] = useState<Visualizacao>(initial.viz);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(initial.from);
  const [dateTo, setDateTo] = useState<Date | undefined>(initial.to);

  // Sync state → URL. Preserva os demais params (ex.: filtros de Lançamentos)
  // em vez de reescrever a query inteira.
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set("tab", activeTab);
        if (dateFrom) params.set("from", format(dateFrom, "yyyy-MM-dd"));
        else params.delete("from");
        if (dateTo) params.set("to", format(dateTo, "yyyy-MM-dd"));
        else params.delete("to");
        if (visualizacao !== "mes") params.set("viz", visualizacao);
        else params.delete("viz");
        return params;
      },
      { replace: true }
    );
  }, [activeTab, dateFrom, dateTo, visualizacao, setSearchParams]);

  const handleTabChange = (v: string) => setActiveTab(v);

  const filterValue = useMemo(
    () => ({ dateFrom, setDateFrom, dateTo, setDateTo, visualizacao, setVisualizacao }),
    [dateFrom, dateTo, visualizacao]
  );

  const isRoot = activeTab === "visao-geral";
  const activeLabel = FINANCEIRO_TABS_ALL.find((t) => t.id === activeTab)?.label ?? "Financeiro";
  usePageTitle(isRoot ? "Financeiro" : `Financeiro · ${activeLabel}`);

  return (
    <FinanceFilterProvider value={filterValue}>
      <PageLayout
        header={
          <PageHeader
            title={isRoot ? "Financeiro" : activeLabel}
            breadcrumbs={isRoot ? undefined : [{ label: "Financeiro", onClick: () => handleTabChange("visao-geral") }]}
          >
            <PeriodoPopover activeTab={activeTab} />
          </PageHeader>
        }
        sidebar={<SecondSidebar tabs={FINANCEIRO_TABS_ALL} value={activeTab} onValueChange={handleTabChange} />}
      >
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsContent value="visao-geral" className="mt-0 w-full focus-visible:ring-0">
            {activeTab === "visao-geral" && (
              <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                <VisaoGeral onNavigateTab={handleTabChange} />
              </Suspense>
            )}
          </TabsContent>

          <TabsContent value="lancamentos" className="mt-0 w-full focus-visible:ring-0">
            {activeTab === "lancamentos" && (
              <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                <Lancamentos />
              </Suspense>
            )}
          </TabsContent>

          <TabsContent value="folha-pagamento" className="mt-0 w-full focus-visible:ring-0">
            {activeTab === "folha-pagamento" && (
              <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                <FolhaPagamento />
              </Suspense>
            )}
          </TabsContent>

          <TabsContent value="carteira" className="mt-0 w-full focus-visible:ring-0">
            {activeTab === "carteira" && (
              <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                <Carteira />
              </Suspense>
            )}
          </TabsContent>

          <TabsContent value="relatorios" className="mt-0 w-full focus-visible:ring-0">
            {activeTab === "relatorios" && (
              <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                <Relatorios />
              </Suspense>
            )}
          </TabsContent>
        </Tabs>
      </PageLayout>
    </FinanceFilterProvider>
  );
}
