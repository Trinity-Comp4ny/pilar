import { useState } from "react";
import { Upload } from "lucide-react";
import { PilarPage } from "@/components/PilarPage";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ImportarLeadsDialog } from "./ImportarLeadsDialog";
import { ProspeccaoHoje } from "./ProspeccaoHoje";
import { ProspeccaoLeads } from "./ProspeccaoLeads";

/** Prospecção no Ultra (SPEC 172, fase 0): fila do dia por WhatsApp e a base de leads. */
export default function Prospeccao() {
  usePageTitle("Prospecção · Ultra admin");
  const [importando, setImportando] = useState(false);

  return (
    <PilarPage
      title="Prospecção"
      actions={
        <Button variant="outline" size="sm" onClick={() => setImportando(true)}>
          <Upload className="mr-2 h-4 w-4" /> Importar leads
        </Button>
      }
    >
      <Tabs defaultValue="hoje" className="space-y-4">
        <TabsList>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
        </TabsList>
        <TabsContent value="hoje">
          <ProspeccaoHoje />
        </TabsContent>
        <TabsContent value="leads">
          <ProspeccaoLeads />
        </TabsContent>
      </Tabs>
      <ImportarLeadsDialog open={importando} onOpenChange={setImportando} />
    </PilarPage>
  );
}
