import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, Loader2, FileText, Check } from "lucide-react";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import { usePropostaTemplates, downloadTemplateFile } from "@/hooks/usePropostaTemplates";
import { AUTO_VARIABLES, buildVariableData, generateDocx } from "@/lib/docxUtils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface GerarPropostaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposta: {
    id: string;
    codigo?: string | null;
    titulo: string;
    area_m2?: number | null;
    localizacao?: string | null;
    valor_proposto?: number | null;
    prazo_estimado_dias?: number | null;
    validade?: string | null;
    observacao?: string | null;
    lead_id?: string | null;
    cliente_id?: string | null;
    campos_extras?: Record<string, string> | null;
  };
  disciplinas?: { disciplina: string; horas_estimadas: number; custo_hora: number; valor_venda?: number }[];
}

export function GerarPropostaDialog({ open, onOpenChange, proposta, disciplinas = [] }: GerarPropostaDialogProps) {
  const { data: templates = [] } = usePropostaTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [manualFields, setManualFields] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoData, setAutoData] = useState<Record<string, string>>({});

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Buscar dados do lead/cliente pra preencher variáveis
  const { data: lead } = useQuery({
    queryKey: ["lead-detail", proposta.lead_id],
    queryFn: async () => {
      if (!proposta.lead_id) return null;
      const { data } = await supabase.from("leads").select("nome, email, contato").eq("id", proposta.lead_id).single();
      return data;
    },
    enabled: !!proposta.lead_id,
  });

  const { data: cliente } = useQuery({
    queryKey: ["cliente-detail", proposta.cliente_id],
    queryFn: async () => {
      if (!proposta.cliente_id) return null;
      const { data } = await supabase
        .from("clientes")
        .select("nome, email, contato")
        .eq("id", proposta.cliente_id)
        .single();
      return data;
    },
    enabled: !!proposta.cliente_id,
  });

  const { data: empresa } = useQuery({
    queryKey: ["empresa-nome"],
    queryFn: async () => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) return null;
      const { data } = await supabase.from("empresas").select("nome").eq("id", empresaId).single();
      return data;
    },
  });

  // Recalcular dados automáticos quando dependências mudam
  useEffect(() => {
    const data = buildVariableData({
      proposta,
      lead,
      cliente,
      empresaNome: empresa?.nome,
      disciplinas,
    });
    setAutoData(data);
  }, [proposta, lead, cliente, empresa, disciplinas]);

  // Inicializar campos manuais salvos
  useEffect(() => {
    if (proposta.campos_extras) {
      setManualFields(proposta.campos_extras);
    }
  }, [proposta.campos_extras]);

  // Variáveis que precisam preenchimento manual
  const manualVars = selectedTemplate?.variaveis.filter((v) => !(v in AUTO_VARIABLES)) || [];

  const handleGenerate = async () => {
    if (!selectedTemplate) return;

    setIsGenerating(true);
    try {
      // 1. Download template from storage
      const templateBuffer = await downloadTemplateFile(selectedTemplate.arquivo_path);

      // 2. Merge auto + manual data
      const allData = { ...autoData, ...manualFields };

      // 3. Generate DOCX
      const blob = generateDocx(templateBuffer, allData);

      // 4. Save campos_extras na proposta
      await supabase
        .from("propostas")
        .update({
          template_id: selectedTemplate.id,
          campos_extras: manualFields,
        })
        .eq("id", proposta.id);

      // 5. Download
      const fileName = `Proposta_${proposta.codigo || proposta.titulo.replace(/\s+/g, "_")}.docx`;
      saveAs(blob, fileName);

      toast.success("DOCX gerado", { description: `Arquivo ${fileName} baixado com sucesso` });
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao gerar DOCX");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent-orange" />
            Gerar Documento da Proposta
          </DialogTitle>
          <DialogDescription>Selecione um template e preencha os campos extras para gerar o DOCX</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Template Selector */}
          <div className="space-y-2">
            <Label>Template *</Label>
            {templates.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                Nenhum template cadastrado. Vá em Propostas → Templates para fazer upload de um modelo DOCX.
              </div>
            ) : (
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome} ({t.variaveis.length} variáveis)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedTemplate && (
            <>
              {/* Auto-filled variables preview */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Preenchido automaticamente
                </Label>
                <div className="bg-green-50/50 rounded-lg p-3 space-y-1.5">
                  {selectedTemplate.variaveis
                    .filter((v) => v in AUTO_VARIABLES)
                    .map((v) => (
                      <div key={v} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Check className="h-3 w-3 text-green-600" />
                          <span className="font-mono text-xs text-green-700">{v}</span>
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {autoData[v] || "(vazio)"}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Manual fields */}
              {manualVars.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Preencher manualmente
                  </Label>
                  {manualVars.map((v) => (
                    <div key={v} className="space-y-1.5">
                      <Label className="text-sm flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700 font-mono">
                          {v}
                        </Badge>
                      </Label>
                      <Input
                        value={manualFields[v] || ""}
                        onChange={(e) => setManualFields((prev) => ({ ...prev, [v]: e.target.value }))}
                        placeholder={`Valor para {{${v}}}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!selectedTemplateId || isGenerating}
            className="bg-accent-orange hover:bg-accent-orange/90 text-white"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" /> Gerar DOCX
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
