import { useState } from "react";
import { Upload } from "lucide-react";
import { PilarPage } from "@/components/PilarPage";
import { Button } from "@/components/ui/button";
import { SectionTabs } from "@/components/SectionTabs";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ImportarLeadsDialog } from "./ImportarLeadsDialog";
import { ProspeccaoHoje } from "./ProspeccaoHoje";
import { ProspeccaoLeads } from "./ProspeccaoLeads";

/** Prospecção no Ultra (SPEC 172, fase 0): fila do dia por WhatsApp e a base de leads. */
export default function Prospeccao() {
  usePageTitle("Prospecção · Ultra admin");
  const [importando, setImportando] = useState(false);
  const [aba, setAba] = useState("hoje");

  return (
    <PilarPage
      title="Prospecção"
      tabs={
        <SectionTabs
          tabs={[
            { id: "hoje", label: "Hoje" },
            { id: "leads", label: "Leads" },
          ]}
          value={aba}
          onValueChange={setAba}
        />
      }
      actions={
        <Button variant="outline" size="sm" onClick={() => setImportando(true)}>
          <Upload className="mr-2 h-4 w-4" /> Importar leads
        </Button>
      }
    >
      {aba === "hoje" ? <ProspeccaoHoje /> : <ProspeccaoLeads />}
      <ImportarLeadsDialog open={importando} onOpenChange={setImportando} />
    </PilarPage>
  );
}
