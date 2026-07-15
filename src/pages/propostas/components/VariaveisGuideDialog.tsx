import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BookOpen, Copy, Check } from "lucide-react";
import { AUTO_VARIABLES } from "@/lib/docxUtils";
import { toast } from "sonner";

const VARIABLE_EXAMPLES: Record<string, string> = {
  CLIENTE_NOME: "João da Silva",
  CLIENTE_EMAIL: "joao@email.com",
  CLIENTE_CONTATO: "(11) 99999-0000",
  EMPRESA_NOME: "Minha Empresa Ltda",
  AREA_M2: "250",
  VALOR_PROPOSTO: "R$ 85.000,00",
  PRAZO_DIAS: "120",
  LOCALIZACAO: "São Paulo - SP",
  CODIGO: "PROP-2026-042",
  TITULO: "Projeto Residencial Casa Verde",
  DATA_HOJE: new Date().toLocaleDateString("pt-BR"),
  VALIDADE: "15/05/2026",
  DISCIPLINAS: "Arquitetura, Estrutural, Elétrica",
  OBSERVACAO: "Inclui acompanhamento de obra",
};

interface VariaveisGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VariaveisGuideDialog({ open, onOpenChange }: VariaveisGuideDialogProps) {
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const handleCopy = async (varName: string) => {
    await navigator.clipboard.writeText(`{{${varName}}}`);
    setCopiedVar(varName);
    toast.success(`{{${varName}}} copiado`);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-brand" />
            Guia de Variáveis para Templates
          </DialogTitle>
          <DialogDescription>
            Use estas variáveis no seu arquivo Word (.docx). O sistema substitui automaticamente pelos dados da
            proposta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* How to use */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium text-blue-900">Como usar</p>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Abra seu documento Word (.docx)</li>
              <li>
                Digite a variável com chaves duplas, ex:{" "}
                <code className="bg-blue-100 px-1 rounded font-mono text-xs">{"{{CLIENTE_NOME}}"}</code>
              </li>
              <li>Faça upload do template aqui no sistema</li>
              <li>Ao gerar a proposta, o sistema substitui pelas informações reais</li>
            </ol>
          </div>

          {/* Variables table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-0 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-2 border-b">
              <span>Variável</span>
              <span>Exemplo de valor</span>
              <span className="w-8" />
            </div>
            {Object.entries(AUTO_VARIABLES).map(([varName, description]) => (
              <div
                key={varName}
                className="grid grid-cols-[1fr_1fr_auto] gap-0 items-center px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/30 transition-colors"
              >
                <div className="space-y-0.5">
                  <Badge variant="secondary" className="font-mono text-xs bg-positive/10 text-positive-strong">
                    {`{{${varName}}}`}
                  </Badge>
                  <p className="text-[11px] text-muted-foreground">{description}</p>
                </div>
                <span className="text-sm text-muted-foreground truncate">{VARIABLE_EXAMPLES[varName] || "—"}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0"
                  onClick={() => handleCopy(varName)}
                  aria-label="Copiar variável"
                >
                  {copiedVar === varName ? (
                    <Check className="h-3.5 w-3.5 text-positive-strong" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ))}
          </div>

          {/* Custom variables info */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
            <p className="text-sm font-medium text-amber-900">Variáveis personalizadas</p>
            <p className="text-sm text-amber-800">
              Você pode criar suas próprias variáveis! Basta escrever{" "}
              <code className="bg-amber-100 px-1 rounded font-mono text-xs">{"{{MINHA_VARIAVEL}}"}</code> no documento.
              O sistema vai detectá-la e pedir para você preencher manualmente ao gerar a proposta.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function VariaveisGuideButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <BookOpen className="h-4 w-4 mr-2" />
        Guia de Variáveis
      </Button>
      <VariaveisGuideDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
