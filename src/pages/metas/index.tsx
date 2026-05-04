import { useState, useEffect } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useSidebar } from "@/components/ui/sidebar";
import { useSearchParams } from "react-router-dom";
import { LayoutDashboard, DollarSign, User, FolderKanban } from "lucide-react";
import { MetasHeader } from "./components/MetasHeader";
import MetasDashboard from "./tabs/MetasDashboard";
import MetasFinanceiras from "./tabs/MetasFinanceiras";
import MetasPessoais from "./tabs/MetasPessoais";
import MetasProjetos from "./tabs/MetasProjetos";
import { usePageTitle } from "@/hooks/usePageTitle";
import { SecondSidebar, type SecondSidebarTab } from "@/components/SecondSidebar";

const METAS_TABS: SecondSidebarTab[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "financeiras", label: "Financeiras", icon: DollarSign },
  { id: "pessoais", label: "Pessoais", icon: User },
  { id: "projetos", label: "Projetos", icon: FolderKanban },
];

export default function MetasPage() {
  usePageTitle("Metas");
  const { state, isMobile } = useSidebar();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("dashboard");

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
          <MetasHeader />
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          <SecondSidebar tabs={METAS_TABS} value={activeTab} onValueChange={handleTabChange} />
          <div className="flex-1 overflow-y-auto w-full bg-gray-50/50 p-6 md:p-8">
            <div className="w-full mx-auto space-y-6">
              <TabsContent value="dashboard" className="mt-0 w-full focus-visible:ring-0">
                <MetasDashboard />
              </TabsContent>
              <TabsContent value="financeiras" className="mt-0 w-full focus-visible:ring-0">
                <MetasFinanceiras />
              </TabsContent>
              <TabsContent value="pessoais" className="mt-0 w-full focus-visible:ring-0">
                <MetasPessoais />
              </TabsContent>
              <TabsContent value="projetos" className="mt-0 w-full focus-visible:ring-0">
                <MetasProjetos />
              </TabsContent>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
