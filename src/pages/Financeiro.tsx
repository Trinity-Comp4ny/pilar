import { useState, useEffect } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useSidebar } from "@/components/ui/sidebar";
import { useSearchParams } from "react-router-dom";
import { FinanceiroHeader } from "./financeiro/components/FinanceiroHeader";
import VisaoGeral from "./financeiro/tabs/VisaoGeral";
import FluxoCaixa from "./financeiro/tabs/FluxoCaixa";
import ResumoMensal from "./financeiro/tabs/ResumoMensal";
import Contas from "./financeiro/tabs/Contas";
import Lancamentos from "./financeiro/tabs/Lancamentos";
import FolhaPagamento from "./financeiro/tabs/FolhaPagamento";
import Faturas from "./financeiro/tabs/Faturas";
import ProjecaoFluxoCaixa from "./financeiro/tabs/ProjecaoFluxoCaixa";
import AgingRecebiveis from "./financeiro/tabs/AgingRecebiveis";
import DRE from "./financeiro/tabs/DRE";
import WIP from "./financeiro/tabs/WIP";
import Rentabilidade from "./financeiro/tabs/Rentabilidade";

export default function Financeiro() {
  const { state, isMobile } = useSidebar();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>("visao-geral");
  const [visualizacao, setVisualizacao] = useState<"dia" | "mes" | "ano">("mes");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  return (
    <div
      className="fixed top-0 right-0 bottom-0 bg-white z-40 overflow-x-hidden flex flex-col transition-[left] duration-300 ease-in-out"
      style={{ left: isMobile ? "0px" : state === "collapsed" ? "64px" : "240px" }}
    >
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full flex flex-col h-full flex-1 overflow-hidden"
      >
        {/* Header with Navigation */}
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

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto w-full bg-gray-50/50 p-6 md:p-8">
          <div className="w-full mx-auto space-y-6">
            <TabsContent value="visao-geral" className="mt-0 w-full focus-visible:ring-0">
              <VisaoGeral visualizacao={visualizacao} dateFrom={dateFrom} dateTo={dateTo} />
            </TabsContent>

            <TabsContent value="fluxo-caixa" className="mt-0 w-full focus-visible:ring-0">
              <FluxoCaixa dateFrom={dateFrom} dateTo={dateTo} />
            </TabsContent>

            <TabsContent value="lancamentos" className="mt-0 w-full focus-visible:ring-0">
              <Lancamentos />
            </TabsContent>

            <TabsContent value="mensal" className="mt-0 w-full focus-visible:ring-0">
              <ResumoMensal dateFrom={dateFrom} dateTo={dateTo} />
            </TabsContent>

            <TabsContent value="folha-pagamento" className="mt-0 w-full focus-visible:ring-0">
              <FolhaPagamento />
            </TabsContent>

            <TabsContent value="faturas" className="mt-0 w-full focus-visible:ring-0">
              <Faturas />
            </TabsContent>

            <TabsContent value="contas" className="mt-0 w-full focus-visible:ring-0">
              <Contas />
            </TabsContent>

            <TabsContent value="projecao" className="mt-0 w-full focus-visible:ring-0">
              <ProjecaoFluxoCaixa />
            </TabsContent>

            <TabsContent value="aging" className="mt-0 w-full focus-visible:ring-0">
              <AgingRecebiveis />
            </TabsContent>

            <TabsContent value="dre" className="mt-0 w-full focus-visible:ring-0">
              <DRE />
            </TabsContent>

            <TabsContent value="wip" className="mt-0 w-full focus-visible:ring-0">
              <WIP />
            </TabsContent>

            <TabsContent value="rentabilidade" className="mt-0 w-full focus-visible:ring-0">
              <Rentabilidade />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
