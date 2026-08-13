import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Download, Loader2, FileText, Check, Send, ArrowLeft, Eye, Mail } from "lucide-react";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import { usePropostaTemplates, downloadTemplateFile } from "@/hooks/usePropostaTemplates";
import { AUTO_VARIABLES, buildVariableData, generateDocx } from "@/lib/docxUtils";
import { sanitizeHtml } from "@/lib/sanitize";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import mammoth from "mammoth";

type Step = "config" | "preview" | "send";

const STEP_ORDER: Step[] = ["config", "preview", "send"];
const STEP_LABELS: Record<Step, string> = { config: "Configurar", preview: "Visualizar", send: "Enviar" };

// Converte um token de variável (ex.: "nome_cliente") num rótulo legível ("Nome cliente").
const humanizeVar = (v: string) => {
  const clean = v.replace(/[{}]/g, "").replace(/[_.]+/g, " ").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
};

// Variáveis cujo conteúdo costuma ser texto de vários parágrafos (escopo, apresentação,
// premissas). Recebem Textarea em vez de Input de uma linha. O generateDocx já usa
// linebreaks: true, então as quebras caem como parágrafos no .docx.
const LONG_TEXT_HINTS = [
  "ESCOPO",
  "APRESENTA",
  "OBSERV",
  "PREMISSA",
  "EXCLUS",
  "DESCRI",
  "DETALHE",
  "CONDICAO",
  "CONDICOES",
  "INTRODU",
  "JUSTIFICA",
  "TEXTO",
  "OBJETO",
  "SERVICO",
];
const isLongTextVar = (v: string) => {
  const upper = v.replace(/[{}]/g, "").toUpperCase();
  return LONG_TEXT_HINTS.some((hint) => upper.includes(hint));
};

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

interface GerarPropostaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "proposta" | "contrato";
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
  onSent?: () => void;
}

export function GerarPropostaDialog({
  open,
  onOpenChange,
  mode = "proposta",
  proposta,
  disciplinas = [],
  onSent,
}: GerarPropostaDialogProps) {
  const navigate = useNavigate();
  const { data: templates = [] } = usePropostaTemplates(mode);
  const label = mode === "contrato" ? "Contrato" : "Proposta";

  const [step, setStep] = useState<Step>("config");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [manualFields, setManualFields] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [autoData, setAutoData] = useState<Record<string, string>>({});
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);

  // Send form state
  const [sendEmail, setSendEmail] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendMensagem, setSendMensagem] = useState("");

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

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

  useEffect(() => {
    const data = buildVariableData({
      proposta,
      lead: lead ? { nome: lead.nome, email: lead.email ?? undefined, contato: lead.contato ?? undefined } : null,
      cliente: cliente
        ? { nome: cliente.nome, email: cliente.email ?? undefined, contato: cliente.contato ?? undefined }
        : null,
      empresaNome: empresa?.nome,
      disciplinas,
    });
    setAutoData(data);
  }, [proposta, lead, cliente, empresa, disciplinas]);

  useEffect(() => {
    if (proposta.campos_extras) setManualFields(proposta.campos_extras);
  }, [proposta.campos_extras]);

  // Pre-fill email send form when moving to send step
  useEffect(() => {
    if (step === "send") {
      const clienteEmail = cliente?.email || lead?.email || "";
      const clienteNome = cliente?.nome || lead?.nome || "";
      const baseTitle = proposta.titulo.replace(/^Proposta\s*[—-]\s*/i, "");
      const subject = mode === "contrato" ? `Contrato — ${baseTitle}` : proposta.titulo;
      const article = mode === "contrato" ? "o" : "a";
      setSendEmail(clienteEmail);
      setSendSubject(subject);
      setSendMensagem(
        clienteNome
          ? `Olá, ${clienteNome}!\n\nSegue em anexo ${article} ${label.toLowerCase()} conforme conversamos. Qualquer dúvida estou à disposição.`
          : ""
      );
    }
  }, [step, cliente, lead, label, proposta.titulo, mode]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("config");
      setGeneratedBlob(null);
      setPreviewHtml("");
      setSendEmail("");
      setSendSubject("");
      setSendMensagem("");
    }
  }, [open]);

  const manualVars = selectedTemplate?.variaveis.filter((v) => !(v in AUTO_VARIABLES)) || [];
  const emailInvalid = sendEmail.trim().length > 0 && !isValidEmail(sendEmail);

  const buildDocx = async (): Promise<{ blob: Blob; fileName: string }> => {
    const templateBuffer = await downloadTemplateFile(selectedTemplate!.arquivo_path);
    const allData = { ...autoData, ...manualFields };
    const blob = generateDocx(templateBuffer, allData);
    const fileName = `${label}_${proposta.codigo || proposta.titulo.replace(/\s+/g, "_")}.docx`;

    if (mode === "proposta") {
      await supabase
        .from("propostas")
        .update({ template_id: selectedTemplate!.id, campos_extras: manualFields })
        .eq("id", proposta.id);
    }

    return { blob, fileName };
  };

  const handleVisualize = async () => {
    if (!selectedTemplate) return;
    setIsGenerating(true);
    try {
      const { blob } = await buildDocx();
      setGeneratedBlob(blob);

      // Convert to HTML for preview
      setPreviewLoading(true);
      const arrayBuffer = await blob.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setPreviewHtml(result.value);
      setStep("preview");
    } catch (err: unknown) {
      toast.error(`Erro ao gerar preview`, {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsGenerating(false);
      setPreviewLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedBlob) return;
    const fileName = `${label}_${proposta.codigo || proposta.titulo.replace(/\s+/g, "_")}.docx`;
    saveAs(generatedBlob, fileName);
    toast.success("Documento baixado");
  };

  const handleSend = async () => {
    if (!sendEmail.trim()) {
      toast.error("Email do destinatário obrigatório");
      return;
    }
    if (!isValidEmail(sendEmail)) {
      toast.error("Email inválido", { description: "Verifique o endereço e tente novamente." });
      return;
    }
    if (!generatedBlob) return;

    setIsSending(true);
    try {
      // Convert blob to base64
      const arrayBuffer = await generatedBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const fileName = `${label}_${proposta.codigo || proposta.titulo.replace(/\s+/g, "_")}.docx`;
      const clienteNome = cliente?.nome || lead?.nome || "";

      const { error } = await supabase.functions.invoke("send-proposta-email", {
        body: {
          email: sendEmail.trim(),
          subject: sendSubject.trim() || `${label} — ${proposta.titulo}`,
          mensagem: sendMensagem.trim() || undefined,
          attachment_base64: base64,
          filename: fileName,
          proposta_id: proposta.id,
          nome_cliente: clienteNome || undefined,
          doc_mode: mode,
        },
      });

      if (error) throw new Error(error.message);

      toast.success(`${label} enviada!`, { description: `Email enviado para ${sendEmail}` });
      onSent?.();
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error("Erro ao enviar email", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsSending(false);
    }
  };

  const stepTitle: Record<Step, string> = {
    config: `Gerar ${label}`,
    preview: `Visualizar ${label}`,
    send: `Enviar ${label} por Email`,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-foreground" />
            {stepTitle[step]}
          </DialogTitle>
          {step === "config" && (
            <DialogDescription>
              Selecione um template e preencha os campos para visualizar o documento antes de enviar.
            </DialogDescription>
          )}
          {step === "preview" && (
            <DialogDescription>
              Revise o documento. Se precisar corrigir algo, volte e edite{" "}
              {mode === "contrato" ? "o contrato" : "a proposta"}.
            </DialogDescription>
          )}
          {step === "send" && (
            <DialogDescription>
              O documento será enviado como anexo ao email do cliente. O status mudará para <strong>Enviada</strong>{" "}
              automaticamente.
            </DialogDescription>
          )}
          {/* Indicador de passo do wizard */}
          <div
            className="flex items-center gap-1.5 pt-1"
            aria-label={`Passo ${STEP_ORDER.indexOf(step) + 1} de ${STEP_ORDER.length}`}
          >
            {STEP_ORDER.map((s, i) => {
              const current = STEP_ORDER.indexOf(step);
              const done = i < current;
              const active = i === current;
              return (
                <div key={s} className="flex items-center gap-1.5">
                  <span
                    className={
                      "text-[11px] font-medium px-2 py-0.5 rounded-full " +
                      (active
                        ? "bg-brand text-ink"
                        : done
                          ? "bg-positive/15 text-positive-strong"
                          : "bg-muted text-muted-foreground")
                    }
                  >
                    {i + 1}. {STEP_LABELS[s]}
                  </span>
                  {i < STEP_ORDER.length - 1 && <span className="text-muted-foreground/40 text-xs">›</span>}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        {/* STEP 1 — Config */}
        {step === "config" && (
          <div className="flex-1 overflow-y-auto space-y-5 mt-2 pr-1">
            <div className="space-y-2">
              <Label>Template *</Label>
              {templates.length === 0 ? (
                <div className="bg-warning-soft border border-warning-mid-border rounded-lg p-3 text-sm text-warning-mid space-y-2">
                  <p>
                    Nenhum template do tipo <strong>{label.toLowerCase()}</strong> cadastrado. Cadastre um template para
                    poder gerar o documento.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white border-warning-mid-border text-warning-strong hover:bg-warning-soft"
                    onClick={() => {
                      onOpenChange(false);
                      navigate("/templates");
                    }}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    Gerenciar Templates
                  </Button>
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
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Preenchido automaticamente
                  </Label>
                  <div className="bg-positive/5 rounded-lg p-3 space-y-1.5">
                    {selectedTemplate.variaveis
                      .filter((v) => v in AUTO_VARIABLES)
                      .map((v) => (
                        <div key={v} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <Check className="h-3 w-3 text-positive-strong" />
                            <span className="font-mono text-xs text-positive-strong">{v}</span>
                          </span>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {autoData[v] || "(vazio)"}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {manualVars.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Preencher manualmente
                    </Label>
                    {manualVars.map((v) => (
                      <div key={v} className="space-y-1.5">
                        <Label className="text-sm flex items-center gap-2">
                          {humanizeVar(v)}
                          <Badge variant="secondary" className="text-[10px] bg-warning-soft text-warning-mid font-mono">
                            {`{{${v.replace(/[{}]/g, "")}}}`}
                          </Badge>
                        </Label>
                        {isLongTextVar(v) ? (
                          <Textarea
                            value={manualFields[v] || ""}
                            onChange={(e) => setManualFields((prev) => ({ ...prev, [v]: e.target.value }))}
                            placeholder={`Valor para ${humanizeVar(v)}`}
                            rows={4}
                            className="resize-y min-h-[84px]"
                          />
                        ) : (
                          <Input
                            value={manualFields[v] || ""}
                            onChange={(e) => setManualFields((prev) => ({ ...prev, [v]: e.target.value }))}
                            placeholder={`Valor para ${humanizeVar(v)}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* STEP 2 — Preview */}
        {step === "preview" && (
          <div className="flex-1 overflow-y-auto min-h-0">
            {previewLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Gerando preview...</span>
              </div>
            ) : (
              <div className="bg-white border rounded-lg shadow-sm mx-1 my-1">
                <div
                  className="p-8 prose prose-sm max-w-none
                    [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-4
                    [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4
                    [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-3
                    [&_p]:mb-2 [&_p]:leading-relaxed [&_p]:text-sm
                    [&_table]:w-full [&_table]:border-collapse [&_table]:mb-4
                    [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1 [&_td]:text-sm
                    [&_th]:border [&_th]:border-gray-300 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-gray-50 [&_th]:text-sm
                    [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2
                    [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2
                    [&_li]:text-sm [&_li]:mb-1"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml) }}
                />
              </div>
            )}
          </div>
        )}

        {/* STEP 3 — Send */}
        {step === "send" && (
          <div className="flex-1 overflow-y-auto space-y-4 mt-2 pr-1">
            <div className="space-y-2">
              <Label>Email do destinatário *</Label>
              <Input
                type="email"
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
                placeholder="cliente@email.com"
                aria-invalid={emailInvalid}
              />
              {emailInvalid ? (
                <p className="text-xs text-negative-strong">Digite um email válido, ex.: nome@empresa.com.</p>
              ) : (
                !sendEmail &&
                cliente?.email == null &&
                lead?.email == null && (
                  <p className="text-xs text-warning-mid">
                    Nenhum email cadastrado para este cliente/lead. Preencha manualmente.
                  </p>
                )
              )}
            </div>
            <div className="space-y-2">
              <Label>Assunto</Label>
              <Input value={sendSubject} onChange={(e) => setSendSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Mensagem (opcional)</Label>
              <Textarea
                value={sendMensagem}
                onChange={(e) => setSendMensagem(e.target.value)}
                rows={5}
                placeholder="Mensagem personalizada para o cliente..."
              />
            </div>
            <div className="flex items-start gap-2 bg-info-soft border border-info-mid-border rounded-lg p-3">
              <Mail className="h-4 w-4 text-info-mid flex-shrink-0 mt-0.5" />
              <p className="text-xs text-info-strong">
                O documento DOCX será enviado como anexo. Após o envio, a proposta mudará automaticamente para{" "}
                <strong>Enviada</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="flex-shrink-0 mt-4 flex-wrap gap-2">
          {step === "config" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleVisualize} disabled={!selectedTemplateId || isGenerating} variant="brand">
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" /> Visualizar Documento
                  </>
                )}
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("config")}>
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
              </Button>
              <Button variant="outline" className="gap-1.5" onClick={handleDownload}>
                <Download className="h-4 w-4" /> Baixar documento
              </Button>
              <Button variant="brand" className="gap-1.5" onClick={() => setStep("send")}>
                <Send className="h-4 w-4" /> Enviar por Email
              </Button>
            </>
          )}

          {step === "send" && (
            <>
              <Button variant="outline" onClick={() => setStep("preview")}>
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar ao Preview
              </Button>
              <Button
                variant="brand"
                className="gap-1.5"
                disabled={!sendEmail.trim() || emailInvalid || isSending}
                onClick={handleSend}
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Confirmar Envio
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
