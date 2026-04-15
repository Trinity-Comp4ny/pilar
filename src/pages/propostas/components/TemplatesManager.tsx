import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, FileText, Trash2, Loader2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { usePropostaTemplates, useUploadTemplate, useDeleteTemplate } from "@/hooks/usePropostaTemplates";
import { AUTO_VARIABLES } from "@/lib/docxUtils";
import { VariaveisGuideButton } from "./VariaveisGuideDialog";

export function TemplatesManager() {
  const { toast } = useToast();
  const { data: templates = [], isLoading } = usePropostaTemplates();
  const uploadTemplate = useUploadTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewVarsId, setViewVarsId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const viewTemplate = templates.find((t) => t.id === viewVarsId);

  const handleUpload = () => {
    if (!nome.trim()) {
      toast({ variant: "destructive", title: "Nome é obrigatório" });
      return;
    }
    if (!selectedFile) {
      toast({ variant: "destructive", title: "Selecione um arquivo DOCX" });
      return;
    }

    uploadTemplate.mutate(
      { file: selectedFile, nome: nome.trim(), descricao: descricao.trim() || undefined },
      {
        onSuccess: (data) => {
          toast({
            title: "Template salvo",
            description: `${data.variaveis.length} variáveis detectadas`,
          });
          resetForm();
        },
        onError: (err: Error) => {
          toast({ variant: "destructive", title: "Erro", description: err.message });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteTemplate.mutate(deleteId, {
      onSuccess: () => {
        toast({ title: "Template removido" });
        setDeleteId(null);
      },
    });
  };

  const resetForm = () => {
    setNome("");
    setDescricao("");
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Templates de Proposta</h3>
          <p className="text-sm text-muted-foreground">
            Faça upload de arquivos DOCX com variáveis {"{{VARIAVEL}}"} para gerar propostas automaticamente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <VariaveisGuideButton />
          <Button
            onClick={() => setIsUploadOpen(true)}
            className="bg-accent-orange hover:bg-accent-orange/90 text-white"
          >
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-accent-orange flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{t.nome}</p>
                      {t.descricao && <p className="text-xs text-muted-foreground">{t.descricao}</p>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500"
                    onClick={() => setDeleteId(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1">
                  {t.variaveis.slice(0, 5).map((v) => (
                    <Badge
                      key={v}
                      variant="secondary"
                      className={`text-[10px] ${v in AUTO_VARIABLES ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}
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

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {t.variaveis.length} variáveis · {new Date(t.created_at).toLocaleDateString("pt-BR")}
                  </span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setViewVarsId(t.id)}>
                    <Eye className="h-3 w-3 mr-1" />
                    Ver variáveis
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
            <Button
              onClick={handleUpload}
              disabled={uploadTemplate.isPending}
              className="bg-accent-orange hover:bg-accent-orange/90 text-white"
            >
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

      {/* View Variables Dialog */}
      <Dialog
        open={!!viewVarsId}
        onOpenChange={(open) => {
          if (!open) setViewVarsId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Variáveis — {viewTemplate?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {viewTemplate?.variaveis.map((v) => {
              const isAuto = v in AUTO_VARIABLES;
              return (
                <div key={v} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={`text-xs font-mono ${isAuto ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}
                    >
                      {`{{${v}}}`}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {isAuto ? AUTO_VARIABLES[v] : "Preenchimento manual"}
                  </span>
                </div>
              );
            })}
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p>
                <Badge variant="secondary" className="text-[10px] bg-green-50 text-green-700 mr-1">
                  verde
                </Badge>{" "}
                = preenchido automaticamente
              </p>
              <p>
                <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700 mr-1">
                  amarelo
                </Badge>{" "}
                = você preenche manualmente
              </p>
            </div>
          </div>
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
