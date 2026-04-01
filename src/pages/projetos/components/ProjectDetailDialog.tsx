import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Calendar, User, DollarSign, Ruler, Trash2, Edit, MessageSquare } from "lucide-react";
import { PROJECT_STATUS_CONFIG } from "@/constants";
import { type Projeto, formatCurrency, formatDate, formatDateShort, getDeadlineStatus, getProjectProgress } from "@/pages/projetos/types";

interface ProjectDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projeto: Projeto | null;
  canEdit: boolean;
  onEdit: (projeto: Projeto) => void;
  onDelete: (id: string) => void;
}

const statusConfig = PROJECT_STATUS_CONFIG;

export function ProjectDetailDialog({ open, onOpenChange, projeto, canEdit, onEdit, onDelete }: ProjectDetailDialogProps) {
  if (!projeto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-xl">{projeto.codigo_projeto}</DialogTitle>
            <Badge className={statusConfig[projeto.status]?.color}>
              {statusConfig[projeto.status]?.label}
            </Badge>
          </div>
          <DialogDescription>
            {projeto.nome}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <div className="font-medium flex items-center gap-2">
                <User size={14} /> {projeto.cliente_nome}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Valor Contrato</Label>
              <div className="font-medium flex items-center gap-2">
                <DollarSign size={14} /> {formatCurrency(projeto.valor_contrato)}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Área (m²)</Label>
              <div className="font-medium flex items-center gap-2">
                <Ruler size={14} /> {projeto.area_m2 || 0} m²
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Início</Label>
              <div className="font-medium flex items-center gap-2">
                <Calendar size={14} /> {formatDate(projeto.data_inicio)}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Previsão Entrega</Label>
              <div className="font-medium flex items-center gap-2">
                <Calendar size={14} /> {formatDate(projeto.data_previsao)}
                {(() => {
                  const deadlineStatus = getDeadlineStatus(projeto);
                  return deadlineStatus ? (
                    <Badge className={`text-xs ml-2 ${deadlineStatus.color}`}>
                      {deadlineStatus.label} {deadlineStatus.days > 0 && `(${deadlineStatus.days}d)`}
                    </Badge>
                  ) : null;
                })()}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Data Final</Label>
              <div className="font-medium flex items-center gap-2">
                <Calendar size={14} /> {formatDate(projeto.data_final)}
              </div>
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Progresso</Label>
              <div className="flex items-center gap-2">
                <Progress value={getProjectProgress(projeto.disciplinas)} className="h-2 flex-1" />
                <span className="text-sm font-medium">{getProjectProgress(projeto.disciplinas)}%</span>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Localização</Label>
              <div className="font-medium flex items-center gap-2">
                {projeto.localizacao || '-'}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Parcelas</Label>
              <div className="font-medium flex items-center gap-2">
                {projeto.parcelas || '-'}
              </div>
            </div>
          </div>

          {projeto.disciplinas && projeto.disciplinas.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground mb-3 block">Disciplinas, Prazos e Status</Label>
              <div className="space-y-3">
                {projeto.disciplinas.map((disc, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-medium text-sm block">{disc.disciplina}</span>
                        <span className="text-xs text-muted-foreground">{disc.responsavel_nome}</span>
                      </div>
                      <Badge variant="outline" className={`${
                        disc.status === 'Concluído' ? 'bg-green-50 text-green-700 border-green-200' :
                        disc.status === 'Em Andamento' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-gray-100 text-gray-700 border-gray-200'
                      }`}>
                        {disc.status || 'Não Iniciado'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mb-2">
                      <div>
                        <span className="block text-[10px] uppercase text-gray-400">Início</span>
                        {formatDateShort(disc.data_inicio) || '-'}
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase text-gray-400">Previsão</span>
                        {formatDateShort(disc.data_previsao) || '-'}
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase text-gray-400">Final</span>
                        {formatDateShort(disc.data_final) || '-'}
                      </div>
                    </div>

                    {disc.observacoes && disc.observacoes.length > 0 && (
                      <div className="border-t border-gray-100 pt-2 mt-2">
                        <p className="text-[10px] text-gray-400 mb-1 flex items-center gap-1">
                          <MessageSquare size={10} /> Última observação
                        </p>
                        <p className="text-xs text-gray-700 line-clamp-2 italic">
                          "{disc.observacoes[disc.observacoes.length - 1].texto}"
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {projeto.observacao && (
            <div>
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <p className="text-sm bg-gray-50 p-3 rounded mt-1 text-gray-700">
                {projeto.observacao}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Fechar
            </Button>
            {canEdit && (
              <>
                <Button
                  variant="default"
                  onClick={() => onEdit(projeto)}
                  className="flex-1 bg-accent-orange hover:bg-accent-orange/90 text-white"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button variant="destructive" onClick={() => onDelete(projeto.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
