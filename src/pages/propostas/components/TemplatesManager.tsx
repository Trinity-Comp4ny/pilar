import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Trash2, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  usePropostaTemplates,
  useUploadTemplate,
  useDeleteTemplate,
  downloadTemplateFile,
  type TemplateTipo,
  type PropostaTemplate,
} from "@/hooks/usePropostaTemplates";
import { AUTO_VARIABLES } from "@/lib/docxUtils";
import { sanitizeHtml } from "@/lib/sanitize";
import { VariaveisGuideButton } from "./VariaveisGuideDialog";
import mammoth from "mammoth";

export function TemplatesManager() {
  const { data: templates = [], isLoading } = usePropostaTemplates();
  const uploadTemplate = useUploadTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<TemplateTipo>("proposta");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<PropostaTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = () => {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!selectedFile) {
      toast.error("Selecione um arquivo DOCX");
      return;
    }

    uploadTemplate.mutate(
      { file: selectedFile, nome: nome.trim(), descricao: descricao.trim() || undefined, tipo },
      {
        onSuccess: (data) => {
          toast.success("Template salvo", { description: `${data.variaveis.length} variáveis detectadas` });
          resetForm();
        },
        onError: (err: Error) => toast.error("Erro", { description: err.message }),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteTemplate.mutate(deleteId, {
      onSuccess: () => {
        toast.success("Template removido");
        setDeleteId(null);
      },
      onError: (err: Error) => toast.error("Não foi possível remover o template", { description: err.message }),
    });
  };

  const handlePreview = async (t: PropostaTemplate) => {
    setPreviewTemplate(t);
    setPreviewHtml("");
    setPreviewLoading(true);
    try {
      const arrayBuffer = await downloadTemplateFile(t.arquivo_path);
      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          styleMap: [
            "p[style-name='Heading 1'] => h1.docx-h1:fresh",
            "p[style-name='Heading 2'] => h2.docx-h2:fresh",
            "p[style-name='Heading 3'] => h3.docx-h3:fresh",
          ],
        }
      );
      setPreviewHtml(result.value);
    } catch {
      toast.error("Não foi possível gerar o preview");
      setPreviewTemplate(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const resetForm = () => {
    setNome("");
    setDescricao("");
    setTipo("proposta");
    setSelectedFile(null);
    setIsUploadOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const templatesProposta = templates.filter((t) => t.tipo === "proposta");
  const templatesContrato = templates.filter((t) => t.tipo === "contrato");

  const TemplateCard = ({ t }: { t: PropostaTemplate }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <FileText
              className={`h-8 w-8 flex-shrink-0 ${t.tipo === "contrato" ? "text-purple-500" : "text-blue-500"}`}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{t.nome}</p>
              {t.descricao && <p className="text-xs text-muted-foreground truncate">{t.descricao}</p>}
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {new Date(t.created_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500 flex-shrink-0"
            onClick={() => setDeleteId(t.id)}
            aria-label="Excluir template"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-1">
          {t.variaveis.slice(0, 5).map((v) => (
            <Badge
              key={v}
              variant="secondary"
              className={`text-[10px] ${v in AUTO_VARIABLES ? "bg-positive/10 text-positive-strong" : "bg-amber-50 text-amber-700"}`}
            >
              {v}
            </Badge>
          ))}
          {t.variaveis.length > 5 && (
            <Badge variant="secondary" className="text-[10px]">
              +{t.variaveis.length - 5}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-[10px] text-muted-foreground">{t.variaveis.length} variáveis</span>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handlePreview(t)}>
            <Eye className="h-3 w-3" />
            Preview
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Faça upload de arquivos <span className="font-medium text-foreground">.docx</span> com variáveis{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">{"{{VARIAVEL}}"}</code> para gerar documentos
          automaticamente.
        </p>
        <div className="flex items-center gap-2">
          <VariaveisGuideButton />
          <Button onClick={() => setIsUploadOpen(true)} variant="brand">
            <Upload className="h-4 w-4 mr-2" />
            Upload Template
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">Nenhum template cadastrado.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Crie um documento Word (.docx) com variáveis como {"{{CLIENTE_NOME}}"} e faça upload aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {templatesProposta.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-blue-500" />
                <h4 className="text-sm font-medium">Propostas</h4>
                <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">
                  {templatesProposta.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {templatesProposta.map((t) => (
                  <TemplateCard key={t.id} t={t} />
                ))}
              </div>
            </div>
          )}
          {templatesContrato.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-purple-500" />
                <h4 className="text-sm font-medium">Contratos</h4>
                <Badge variant="secondary" className="text-[10px] bg-purple-50 text-purple-700">
                  {templatesContrato.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {templatesContrato.map((t) => (
                  <TemplateCard key={t.id} t={t} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog
        open={!!previewTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewTemplate(null);
            setPreviewHtml("");
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText
                className={`h-4 w-4 ${previewTemplate?.tipo === "contrato" ? "text-purple-500" : "text-blue-500"}`}
              />
              {previewTemplate?.nome}
              <Badge
                variant="secondary"
                className={`text-[10px] ml-1 ${previewTemplate?.tipo === "contrato" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}
              >
                {previewTemplate?.tipo === "contrato" ? "Contrato" : "Proposta"}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0">
            {previewLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando preview...</span>
              </div>
            ) : previewHtml ? (
              <div className="bg-white border rounded-lg shadow-sm mx-1 my-2">
                {/* Folha de papel simulada */}
                <div
                  className="p-8 min-h-[400px] prose prose-sm max-w-none
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
            ) : null}
          </div>

          {previewTemplate && previewHtml && (
            <div className="flex-shrink-0 pt-2 border-t">
              <div className="flex flex-wrap gap-1">
                {previewTemplate.variaveis.map((v) => (
                  <Badge
                    key={v}
                    variant="secondary"
                    className={`text-[10px] ${v in AUTO_VARIABLES ? "bg-positive/10 text-positive-strong" : "bg-amber-50 text-amber-700"}`}
                  >
                    {`{{${v}}}`}
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                <span className="inline-block w-2 h-2 rounded-sm bg-positive/10 border border-positive/30 mr-1" />
                preenchimento automático
                <span className="inline-block w-2 h-2 rounded-sm bg-amber-100 border border-amber-300 mx-1 ml-3" />
                preenchimento manual
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog
        open={isUploadOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setIsUploadOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload de Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TemplateTipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proposta">Proposta</SelectItem>
                  <SelectItem value="contrato">Contrato</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Templates de contrato aparecem só ao clicar em "Gerar contrato" em uma proposta aceita.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Nome do Template *</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Proposta Residencial Padrão"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Breve descrição do template"
              />
            </div>
            <div className="space-y-2">
              <Label>Arquivo DOCX *</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <p className="text-[10px] text-muted-foreground">
                Use {"{{VARIAVEL}}"} no documento. Variáveis reconhecidas: {Object.keys(AUTO_VARIABLES).join(", ")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploadTemplate.isPending} variant="brand">
              {uploadTemplate.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Excluir Template"
        description="Tem certeza que deseja excluir este template?"
        onConfirm={handleDelete}
      />
    </div>
  );
}
