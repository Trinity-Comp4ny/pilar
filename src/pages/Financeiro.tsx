import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useSidebar } from "@/components/ui/sidebar";
import { useSearchParams } from "react-router-dom";
import { startOfMonth, endOfMonth, parseISO, format, isValid } from "date-fns";
import { LayoutDashboard, TrendingUp, Receipt, Users2, CreditCard, Landmark } from "lucide-react";
import { FinanceiroHeader } from "./financeiro/components/FinanceiroHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import { SecondSidebar, type SecondSidebarTab } from "@/components/SecondSidebar";
import { FinanceFilterProvider, type Visualizacao } from "./financeiro/contexts/FinanceFilterContext";

const VisaoGeral = lazy(() => import("./financeiro/tabs/VisaoGeral"));
const FluxoCaixa = lazy(() => import("./financeiro/tabs/FluxoCaixa"));
const Contas = lazy(() => import("./financeiro/tabs/Contas"));
const Lancamentos = lazy(() => import("./financeiro/tabs/Lancamentos"));
const FolhaPagamento = lazy(() => import("./financeiro/tabs/FolhaPagamento"));
const Faturas = lazy(() => import("./financeiro/tabs/Faturas"));

const FINANCEIRO_TABS_ALL: SecondSidebarTab[] = [
  { id: "visao-geral", label: "Visão Geral", icon: LayoutDashboard },
  { id: "fluxo-caixa", label: "Fluxo de Caixa", icon: TrendingUp },
  { id: "lancamentos", label: "Lançamentos", icon: Receipt },
  { id: "folha-pagamento", label: "Folha de Pagamento", icon: Users2 },
  { id: "faturas", label: "Faturas", icon: CreditCard },
  { id: "contas", label: "Contas", icon: Landmark },
];

function parseDateParam(v: string | null): Date | undefined {
  if (!v) return undefined;
  const d = parseISO(v);
  return isValid(d) ? d : undefined;
}

export default function Financeiro() {
  usePageTitle("Financeiro");
  const { state, isMobile } = useSidebar();
  const [searchParams, setSearchParams] = useSearchParams();

  const initial = useMemo(() => {
    const now = new Date();
    return {
      tab: searchParams.get("tab") || "visao-geral",
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

  // Sync state → URL
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", activeTab);
    if (dateFrom) params.set("from", format(dateFrom, "yyyy-MM-dd"));
    if (dateTo) params.set("to", format(dateTo, "yyyy-MM-dd"));
    if (visualizacao !== "mes") params.set("viz", visualizacao);
    setSearchParams(params, { replace: true });
  }, [activeTab, dateFrom, dateTo, visualizacao, setSearchParams]);

  const handleTabChange = (v: string) => setActiveTab(v);

  const filterValue = useMemo(
    () => ({ dateFrom, setDateFrom, dateTo, setDateTo, visualizacao, setVisualizacao }),
    [dateFrom, dateTo, visualizacao]
  );

  return (
    <div
      className="fixed top-0 right-0 bottom-0 bg-white z-40 overflow-hidden flex flex-col transition-[left] duration-300 ease-in-out"
      style={{ left: isMobile ? "0px" : state === "collapsed" ? "64px" : "240px" }}
    >
      <FinanceFilterProvider value={filterValue}>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col flex-1 overflow-hidden">
          <div className="sticky top-0 z-20 w-full bg-white border-b">
            <FinanceiroHeader />
          </div>

          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            <SecondSidebar tabs={FINANCEIRO_TABS_ALL} value={activeTab} onValueChange={handleTabChange} />
            <div className="flex-1 overflow-y-auto w-full bg-gray-50/50 p-6 md:p-8">
              <div className="w-full mx-auto space-y-6">
                <TabsContent value="visao-geral" className="mt-0 w-full focus-visible:ring-0">
                  {activeTab === "visao-geral" && (
                    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                      <VisaoGeral />
                    </Suspense>
                  )}
                </TabsContent>

                <TabsContent value="fluxo-caixa" className="mt-0 w-full focus-visible:ring-0">
                  {activeTab === "fluxo-caixa" && (
                    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                      <FluxoCaixa dateFrom={dateFrom} dateTo={dateTo} />
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

                <TabsContent value="faturas" className="mt-0 w-full focus-visible:ring-0">
                  {activeTab === "faturas" && (
                    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                      <Faturas />
                    </Suspense>
                  )}
                </TabsContent>

                <TabsContent value="contas" className="mt-0 w-full focus-visible:ring-0">
                  {activeTab === "contas" && (
                    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                      <Contas />
                    </Suspense>
                  )}
                </TabsContent>
              </div>
            </div>
          </div>
        </Tabs>
      </FinanceFilterProvider>
    </div>
  );
}
