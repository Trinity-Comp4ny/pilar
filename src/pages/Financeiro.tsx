import { useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useSidebar } from "@/components/ui/sidebar";
import { FinanceiroHeader } from "./financeiro/components/FinanceiroHeader";
import VisaoGeral from "./financeiro/tabs/VisaoGeral";
import FluxoCaixa from "./financeiro/tabs/FluxoCaixa";
import ResumoMensal from "./financeiro/tabs/ResumoMensal";
import Configuracoes from "./financeiro/tabs/Configuracoes";
import Receitas from "./financeiro/tabs/Receitas";
import Despesas from "./financeiro/tabs/Despesas";
import Metas from "./financeiro/tabs/Metas";

export default function Financeiro() {
  const { state } = useSidebar();
  const [visualizacao, setVisualizacao] = useState<"dia" | "mes" | "ano">("mes");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();

  return (
    <div 
      className="fixed top-0 right-0 bottom-0 bg-white z-40 overflow-hidden flex flex-col transition-[left] duration-300 ease-in-out"
      style={{ left: state === "collapsed" ? "64px" : "240px" }}
    >
      <Tabs defaultValue="visao-geral" className="w-full h-full flex flex-col">
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
              <VisaoGeral visualizacao={visualizacao} />
            </TabsContent>

            <TabsContent value="fluxo-caixa" className="mt-0 w-full focus-visible:ring-0">
              <FluxoCaixa />
            </TabsContent>

            <TabsContent value="mensal" className="mt-0 w-full focus-visible:ring-0">
              <ResumoMensal />
            </TabsContent>

            <TabsContent value="metas" className="mt-0 w-full focus-visible:ring-0">
              <Metas />
            </TabsContent>
            
            <TabsContent value="receitas" className="mt-0 w-full focus-visible:ring-0">
              <Receitas />
            </TabsContent>
            
            <TabsContent value="despesas" className="mt-0 w-full focus-visible:ring-0">
              <Despesas />
            </TabsContent>

            <TabsContent value="configuracoes" className="mt-0 w-full focus-visible:ring-0">
              <Configuracoes />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
