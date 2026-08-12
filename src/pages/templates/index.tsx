import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, FileText, Clock, Layers, Trash2, Pencil, Loader2 } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  type TemplateProjeto,
  type TemplateInsert,
} from "@/hooks/useTemplates";
import { TemplateForm } from "./components/TemplateForm";
import { usePageTitle } from "@/hooks/usePageTitle";
import { EmptyState } from "@/components/EmptyState";

export default function Templates() {
  usePageTitle("Templates");
  const { data: userRole } = useUserRole();
  const { data: templates = [], isLoading } = useTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const canEdit = userRole === "admin" || userRole === "ultra_admin";

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateProjeto | undefined>();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleCreate = (data: TemplateInsert) => {
    createTemplate.mutate(data, {
      onSuccess: () => {
        toast.success("Template criado com sucesso");
        setIsFormOpen(false);
      },
      onError: () => {
        toast.error("Erro");
      },
    });
  };

  const handleUpdate = (data: TemplateInsert) => {
    if (!editingTemplate) return;
    updateTemplate.mutate(
      { id: editingTemplate.id, ...data },
      {
        onSuccess: () => {
          toast.success("Template atualizado");
          setEditingTemplate(undefined);
          setIsFormOpen(false);
        },
        onError: () => {
          toast.error("Erro");
        },
      }
    );
  };

  const handleDelete = () => {
    if (!confirmDeleteId) return;
    deleteTemplate.mutate(confirmDeleteId, {
      onSuccess: () => {
        toast.success("Template removido");
        setConfirmDeleteId(null);
      },
      onError: () => {
        toast.error("Erro");
      },
    });
  };

  const openEdit = (template: TemplateProjeto) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
  };

  const openCreate = () => {
    setEditingTemplate(undefined);
    setIsFormOpen(true);
  };

  // Agrupa templates por tipo_servico
  const agrupado = templates.reduce<Record<string, TemplateProjeto[]>>((acc, t) => {
    if (!acc[t.tipo_servico]) acc[t.tipo_servico] = [];
    acc[t.tipo_servico].push(t);
    return acc;
  }, {});

  const totalHorasFases = (template: TemplateProjeto) =>
    template.fases.reduce((sum, f) => sum + f.disciplinas.reduce((s, d) => s + (d.horas_estimadas || 0), 0), 0);

  const totalDias = (template: TemplateProjeto) => template.fases.reduce((sum, f) => sum + (f.duracao_dias || 0), 0);

  if (isLoading) {
    return (
      <PageLayout>
        <PageHeader title="Templates de Projeto" />
        <div className="flex items-center justify-center py-12" aria-busy="true" aria-label="Carregando templates">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader title="Templates de Projeto">
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Novo Template
          </Button>
        )}
      </PageHeader>

      {templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum template criado ainda"
          description="Templates permitem criar projetos rapidamente com fases e disciplinas pré-definidas."
          action={canEdit ? { label: "Criar Primeiro Template", variant: "outline", onClick: openCreate } : undefined}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(agrupado).map(([tipo, items]) => (
            <div key={tipo}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">{tipo}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((template) => (
                  <Card key={template.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-sm font-medium">{template.nome}</CardTitle>
                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(template)}
                              aria-label="Editar template"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500"
                              onClick={() => setConfirmDeleteId(template.id)}
                              aria-label="Excluir template"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {template.descricao && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{template.descricao}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5" />
                          {template.fases.length} fase{template.fases.length !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {totalHorasFases(template)}h estimadas
                        </span>
                        <span>{totalDias(template)} dias</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.fases
                          .flatMap((f) => f.disciplinas.map((d) => d.disciplina))
                          .filter((v, i, a) => a.indexOf(v) === i)
                          .slice(0, 4)
                          .map((disc) => (
                            <Badge key={disc} variant="secondary" className="text-[10px]">
                              {disc}
                            </Badge>
                          ))}
                        {template.fases.flatMap((f) => f.disciplinas).length > 4 && (
                          <Badge variant="secondary" className="text-[10px]">
                            +{template.fases.flatMap((f) => f.disciplinas).length - 4}
                          </Badge>
                        )}
                      </div>
                      {template.checklist.length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-2">
                          {template.checklist.length} itens no checklist
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog de criação/edição */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsFormOpen(false);
            setEditingTemplate(undefined);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          <TemplateForm
            template={editingTemplate}
            onSubmit={editingTemplate ? handleUpdate : handleCreate}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingTemplate(undefined);
            }}
            isLoading={createTemplate.isPending || updateTemplate.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
        title="Excluir Template"
        description="Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita."
        onConfirm={handleDelete}
      />
    </PageLayout>
  );
}
