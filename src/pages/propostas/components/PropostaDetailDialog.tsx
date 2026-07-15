import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  CheckCircle2,
  FileOutput,
  FileSignature,
  FolderPlus,
  Loader2,
  MapPin,
  Pencil,
  Send,
  Trash2,
  Undo2,
  XCircle,
  Building2,
  DollarSign,
  Calendar,
  Ruler,
  Clock,
  AlertCircle,
  Clock3,
  ThumbsUp,
  ThumbsDown,
  PenLine,
} from "lucide-react";
import { PROPOSTA_STATUS_CONFIG } from "@/hooks/usePropostas";

interface Proposta {
  id: string;
  titulo: string;
  codigo: string | null;
  status: string;
  valor_proposto: number | null;
  area_m2: number | null;
  prazo_estimado_dias: number | null;
  localizacao: string | null;
  observacao: string | null;
  validade: string | null;
  cliente_nome?: string | null;
  lead_nome?: string | null;
  projeto_id?: string | null;
  contrato_enviado?: boolean;
  contrato_assinado?: boolean;
  contrato_recusado?: boolean;
}

interface PropostaDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposta: Proposta | null;
  canEdit: boolean;
  hoje: string;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (id: string, status: string) => void;
  onGerarDocx: () => void;
  onGerarContrato: () => void;
  onConverter: () => void;
  onMarcarContratoAssinado?: () => void;
  onRecusarContrato?: () => void;
  isUpdating?: boolean;
}

const formatCurrency = (v: number | null) =>
  v ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

const formatDate = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

function InfoRow({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium ${valueClass || ""}`}>{value}</p>
      </div>
    </div>
  );
}

type StageConfig = {
  bg: string;
  border: string;
  icon: React.ElementType;
  iconColor: string;
  message: string;
};

const STAGE_CONFIG: Record<string, StageConfig> = {
  rascunho: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    icon: Pencil,
    iconColor: "text-gray-500",
    message:
      "Em elaboração. Edite os detalhes, gere o documento para revisar e envie ao cliente quando estiver pronto.",
  },
  enviada: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: Clock3,
    iconColor: "text-blue-500",
    message: "Enviada ao cliente — aguardando resposta. Registre o resultado quando o cliente retornar.",
  },
  aceita: {
    bg: "bg-positive/10",
    border: "border-positive/20",
    icon: ThumbsUp,
    iconColor: "text-positive",
    message: "Proposta aceita! Formalize o contrato ou converta em projeto para iniciar o trabalho.",
  },
  recusada: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: ThumbsDown,
    iconColor: "text-red-500",
    message: "Proposta recusada pelo cliente. Você pode reabrir como rascunho para revisar e reenviar.",
  },
  expirada: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: AlertCircle,
    iconColor: "text-amber-500",
    message: "Prazo de validade expirado. Edite a proposta, atualize a validade e reenvie.",
  },
};

export function PropostaDetailDialog({
  open,
  onOpenChange,
  proposta,
  canEdit,
  hoje,
  onEdit,
  onDelete,
  onStatusChange,
  onGerarDocx,
  onGerarContrato,
  onConverter,
  onMarcarContratoAssinado,
  onRecusarContrato,
  isUpdating,
}: PropostaDetailDialogProps) {
  const [confirmRecusar, setConfirmRecusar] = useState(false);

  if (!proposta) return null;

  const getDisplayStatus = () => {
    if (
      proposta.validade &&
      proposta.validade < hoje &&
      (proposta.status === "rascunho" || proposta.status === "enviada")
    ) {
      return "expirada";
    }
    return proposta.status;
  };

  const displayStatus = getDisplayStatus();
  const stage = STAGE_CONFIG[displayStatus] ?? STAGE_CONFIG.rascunho;
  const StageIcon = stage.icon;
  const isExpiredValidity = proposta.validade && proposta.validade < hoje;
  const stageMessage =
    displayStatus === "aceita" && proposta.projeto_id
      ? "Proposta aceita e já convertida em projeto. Formalize o contrato para concluir a negociação."
      : stage.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0">
              <DialogTitle className="text-base leading-snug">{proposta.titulo}</DialogTitle>
              {proposta.codigo && <p className="text-xs text-muted-foreground font-mono mt-0.5">{proposta.codigo}</p>}
              <DialogDescription className="sr-only">
                Detalhes e ações da proposta {proposta.titulo}
              </DialogDescription>
            </div>
            <Badge className={`text-[11px] flex-shrink-0 mt-0.5 ${PROPOSTA_STATUS_CONFIG[displayStatus]?.color || ""}`}>
              {PROPOSTA_STATUS_CONFIG[displayStatus]?.label || displayStatus}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Banner de contexto do estágio */}
          <div className={`flex items-start gap-2.5 rounded-lg border p-3 ${stage.bg} ${stage.border}`}>
            <StageIcon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${stage.iconColor}`} />
            <p className="text-xs text-foreground/80">{stageMessage}</p>
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-3">
            {(proposta.cliente_nome || proposta.lead_nome) && (
              <InfoRow
                icon={Building2}
                label="Cliente / Lead"
                value={proposta.cliente_nome || proposta.lead_nome || "—"}
              />
            )}
            {proposta.valor_proposto && (
              <InfoRow icon={DollarSign} label="Valor" value={formatCurrency(proposta.valor_proposto)} />
            )}
            {proposta.area_m2 && <InfoRow icon={Ruler} label="Área" value={`${proposta.area_m2} m²`} />}
            {proposta.prazo_estimado_dias && (
              <InfoRow icon={Clock} label="Prazo" value={`${proposta.prazo_estimado_dias} dias`} />
            )}
            {proposta.validade && (
              <InfoRow
                icon={Calendar}
                label="Validade"
                value={formatDate(proposta.validade)}
                valueClass={isExpiredValidity ? "text-red-500" : ""}
              />
            )}
            {proposta.localizacao && <InfoRow icon={MapPin} label="Localização" value={proposta.localizacao} />}
          </div>

          {proposta.observacao && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground mb-1">Observações</p>
              <p className="text-sm">{proposta.observacao}</p>
            </div>
          )}

          <Separator />

          {/* Ações por estágio */}
          {displayStatus === "rascunho" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={onGerarDocx}>
                  <FileOutput className="h-3.5 w-3.5" />
                  Baixar DOCX
                </Button>
                {canEdit && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                  disabled={isUpdating}
                  onClick={() => onStatusChange(proposta.id, "enviada")}
                >
                  {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Enviei manualmente
                </Button>
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={onDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </Button>
              )}
            </div>
          )}

          {displayStatus === "enviada" && (
            <div className="space-y-3">
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-3">
                <p className="text-xs text-muted-foreground mb-2 font-medium">A proposta foi:</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="gap-1.5 border-positive/30 text-positive hover:bg-positive hover:text-white hover:border-positive transition-colors"
                    disabled={isUpdating}
                    onClick={() => onStatusChange(proposta.id, "aceita")}
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Aceita
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-1.5 border-red-300 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
                    disabled={isUpdating}
                    onClick={() => setConfirmRecusar(true)}
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Recusada
                  </Button>
                </div>
              </div>
              <ConfirmDialog
                open={confirmRecusar}
                onOpenChange={setConfirmRecusar}
                onConfirm={() => {
                  onStatusChange(proposta.id, "recusada");
                  setConfirmRecusar(false);
                }}
                title="Marcar proposta como recusada?"
                description="A proposta sairá do fluxo de negociação. Você pode reverter o status depois, se precisar."
                itemName={proposta.titulo}
                confirmText="Marcar recusada"
              />
              <div className="flex flex-wrap gap-2">
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={onConverter}
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    Aceitar e Criar Projeto
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-1.5" onClick={onGerarDocx}>
                  <FileOutput className="h-3.5 w-3.5" />
                  Baixar DOCX
                </Button>
                {canEdit && (
                  <>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-gray-500"
                      disabled={isUpdating}
                      onClick={() => onStatusChange(proposta.id, "rascunho")}
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      Voltar a Rascunho
                    </Button>
                  </>
                )}
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={onDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </Button>
              )}
            </div>
          )}

          {displayStatus === "aceita" && (
            <div className="space-y-3">
              {/* Status do contrato */}
              {proposta.contrato_assinado ? (
                <div className="flex items-center gap-2 rounded-lg border border-positive/20 bg-positive/10 px-3 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-positive flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-positive">Contrato assinado</p>
                    <p className="text-[11px] text-positive">O cliente assinou o contrato.</p>
                  </div>
                </div>
              ) : proposta.contrato_recusado ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-red-800">Contrato recusado</p>
                      <p className="text-[11px] text-red-700">
                        O cliente recusou o contrato. Gere um novo para reenviar.
                      </p>
                    </div>
                  </div>
                </div>
              ) : proposta.contrato_enviado ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-3">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">O contrato foi:</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="gap-1.5 border-positive/30 text-positive hover:bg-positive hover:text-white hover:border-positive transition-colors"
                      disabled={isUpdating}
                      onClick={onMarcarContratoAssinado}
                    >
                      {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                      Assinado
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-1.5 border-red-300 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
                      disabled={isUpdating}
                      onClick={onRecusarContrato}
                    >
                      {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Recusado
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-200 bg-amber-50/50 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-700">Nenhum contrato enviado. Gere e envie o contrato ao cliente.</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {canEdit && !proposta.projeto_id && (
                  <Button className="gap-1.5" onClick={onConverter}>
                    <FolderPlus className="h-4 w-4" />
                    Criar Projeto
                  </Button>
                )}
                {!proposta.contrato_assinado && (
                  <Button
                    variant={proposta.projeto_id ? "default" : "outline"}
                    className="gap-1.5"
                    onClick={onGerarContrato}
                  >
                    <FileSignature className="h-4 w-4" />
                    {proposta.contrato_recusado ? "Gerar Novo Contrato" : "Gerar Contrato"}
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={onGerarDocx}>
                  <FileOutput className="h-3.5 w-3.5" />
                  Baixar DOCX
                </Button>
                {canEdit && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                )}
              </div>
            </div>
          )}

          {displayStatus === "recusada" && (
            <div className="space-y-3">
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="gap-1.5"
                    disabled={isUpdating}
                    onClick={() => onStatusChange(proposta.id, "rascunho")}
                  >
                    <Undo2 className="h-4 w-4" />
                    Reabrir como Rascunho
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={onGerarDocx}>
                  <FileOutput className="h-3.5 w-3.5" />
                  Baixar DOCX
                </Button>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </Button>
                )}
              </div>
            </div>
          )}

          {displayStatus === "expirada" && (
            <div className="space-y-3">
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <Button className="gap-1.5" onClick={onEdit}>
                    <Pencil className="h-4 w-4" />
                    Editar e Atualizar Validade
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={onGerarDocx}>
                  <FileOutput className="h-3.5 w-3.5" />
                  Baixar DOCX
                </Button>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
