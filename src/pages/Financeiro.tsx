import { useState, useEffect } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useSidebar } from "@/components/ui/sidebar";
import { useSearchParams } from "react-router-dom";
import {
  LayoutDashboard,
  TrendingUp,
  Receipt,
  Users2,
  CreditCard,
  Landmark,
  LineChart,
  Clock,
  FileBarChart2,
  Briefcase,
  PieChart,
} from "lucide-react";
import { FinanceiroHeader } from "./financeiro/components/FinanceiroHeader";
import VisaoGeral from "./financeiro/tabs/VisaoGeral";
import FluxoCaixa from "./financeiro/tabs/FluxoCaixa";
import Contas from "./financeiro/tabs/Contas";
import Lancamentos from "./financeiro/tabs/Lancamentos";
import FolhaPagamento from "./financeiro/tabs/FolhaPagamento";
import Faturas from "./financeiro/tabs/Faturas";
import ProjecaoFluxoCaixa from "./financeiro/tabs/ProjecaoFluxoCaixa";
import AgingRecebiveis from "./financeiro/tabs/AgingRecebiveis";
import DRE from "./financeiro/tabs/DRE";
import WIP from "./financeiro/tabs/WIP";
import Rentabilidade from "./financeiro/tabs/Rentabilidade";
import { usePageTitle } from "@/hooks/usePageTitle";
import { SecondSidebar, type SecondSidebarTab } from "@/components/SecondSidebar";

const FINANCEIRO_TABS: SecondSidebarTab[] = [
  { id: "visao-geral", label: "Visão Geral", icon: LayoutDashboard },
  { id: "fluxo-caixa", label: "Fluxo de Caixa", icon: TrendingUp },
  { id: "lancamentos", label: "Lançamentos", icon: Receipt },
  { id: "folha-pagamento", label: "Folha de Pagamento", icon: Users2 },
  { id: "faturas", label: "Faturas", icon: CreditCard, disabled: true },
  { id: "contas", label: "Contas", icon: Landmark },
  { id: "projecao", label: "Projeção", icon: LineChart, disabled: true },
  { id: "aging", label: "Aging", icon: Clock, disabled: true },
  { id: "dre", label: "DRE", icon: FileBarChart2, disabled: true },
  { id: "wip", label: "WIP", icon: Briefcase, disabled: true },
  { id: "rentabilidade", label: "Rentabilidade", icon: PieChart },
];

export default function Financeiro() {
  usePageTitle("Financeiro");
  const { state, isMobile } = useSidebar();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>("visao-geral");
  const [visualizacao, setVisualizacao] = useState<"dia" | "mes" | "ano">("mes");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (v: string) => {
    setActiveTab(v);
    setSearchParams({ tab: v }, { replace: true });
  };

  return (
    <div
      className="fixed top-0 right-0 bottom-0 bg-white z-40 overflow-hidden flex flex-col transition-[left] duration-300 ease-in-out"
      style={{ left: isMobile ? "0px" : state === "collapsed" ? "64px" : "240px" }}
    >
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col flex-1 overflow-hidden">
        <div className="sticky top-0 z-20 w-full bg-white border-b">
          <FinanceiroHeader
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            visualizacao={visualizacao}
            setVisualizacao={setVisualizacao}
          />
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          <SecondSidebar tabs={FINANCEIRO_TABS} value={activeTab} onValueChange={handleTabChange} />
          <div className="flex-1 overflow-y-auto w-full bg-gray-50/50 p-6 md:p-8">
            <div className="w-full mx-auto space-y-6">
              <TabsContent value="visao-geral" className="mt-0 w-full focus-visible:ring-0">
                {activeTab === "visao-geral" && (
                  <VisaoGeral visualizacao={visualizacao} dateFrom={dateFrom} dateTo={dateTo} />
                )}
              </TabsContent>

              <TabsContent value="fluxo-caixa" className="mt-0 w-full focus-visible:ring-0">
                {activeTab === "fluxo-caixa" && <FluxoCaixa dateFrom={dateFrom} dateTo={dateTo} />}
              </TabsContent>

              <TabsContent value="lancamentos" className="mt-0 w-full focus-visible:ring-0">
                {activeTab === "lancamentos" && <Lancamentos />}
              </TabsContent>

              <TabsContent value="folha-pagamento" className="mt-0 w-full focus-visible:ring-0">
                {activeTab === "folha-pagamento" && <FolhaPagamento />}
              </TabsContent>

              <TabsContent value="faturas" className="mt-0 w-full focus-visible:ring-0">
                {activeTab === "faturas" && <Faturas />}
              </TabsContent>

              <TabsContent value="contas" className="mt-0 w-full focus-visible:ring-0">
                {activeTab === "contas" && <Contas />}
              </TabsContent>

              <TabsContent value="projecao" className="mt-0 w-full focus-visible:ring-0">
                {activeTab === "projecao" && <ProjecaoFluxoCaixa />}
              </TabsContent>

              <TabsContent value="aging" className="mt-0 w-full focus-visible:ring-0">
                {activeTab === "aging" && <AgingRecebiveis />}
              </TabsContent>

              <TabsContent value="dre" className="mt-0 w-full focus-visible:ring-0">
                {activeTab === "dre" && <DRE />}
              </TabsContent>

              <TabsContent value="wip" className="mt-0 w-full focus-visible:ring-0">
                {activeTab === "wip" && <WIP />}
              </TabsContent>

              <TabsContent value="rentabilidade" className="mt-0 w-full focus-visible:ring-0">
                {activeTab === "rentabilidade" && <Rentabilidade />}
              </TabsContent>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
