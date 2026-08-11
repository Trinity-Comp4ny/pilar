import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Mail,
  Phone,
  User,
  CheckCircle2,
  Loader2,
  FileText,
  Pencil,
  Trash2,
  MoreVertical,
  Building2,
  DollarSign,
  Calendar,
  AlertTriangle,
  FolderPlus,
  Pencil as PencilIcon,
} from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";
import { type Lead } from "@/hooks/useLeads";
import { PROPOSTA_STATUS_CONFIG, type Proposta } from "@/hooks/usePropostas";
import { statusExibido } from "@/lib/comercial";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  Novo: { label: "Novo", color: "bg-info-soft text-info-strong" },
  "Em contato": { label: "Em Contato", color: "bg-highlight-soft text-highlight-strong" },
  Proposta: { label: "Proposta Enviada", color: "bg-warning-soft text-warning-strong" },
  Negociação: { label: "Em Negociação", color: "bg-brand text-ink" },
  Ganho: { label: "Ganho", color: "bg-positive/10 text-positive-strong" },
  Perdido: { label: "Perdido", color: "bg-danger-soft text-danger-strong" },
};

interface LeadMember {
  id: string;
  first_name: string;
  last_name: string;
}

interface LeadDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  canEdit: boolean;
  members: LeadMember[];
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
  onCreateProposta: () => void;
  onConvert: () => void;
  createPropostaPending?: boolean;
  proposta?: Proposta | null;
  onOpenProposta?: (id: string) => void;
  onConvertProjeto?: () => void;
  convertProjetoPending?: boolean;
}

export function LeadDetailDialog({
  open,
  onOpenChange,
  lead,
  canEdit,
  members,
  onEdit,
  onDelete,
  onCreateProposta,
  onConvert,
  createPropostaPending = false,
  proposta,
  onOpenProposta,
  onConvertProjeto,
  convertProjetoPending = false,
}: LeadDetailDialogProps) {
  if (!lead) return null;

  const statusConfig = STATUS_CONFIG[lead.status];
  const responsavel = members.find((m) => m.id === lead.responsavel_id);
  const nomeCompleto = [lead.nome, lead.sobrenome].filter(Boolean).join(" ");
  const propStatus = proposta ? statusExibido(proposta) : null;
  const propStatusConfig = propStatus ? PROPOSTA_STATUS_CONFIG[propStatus] : null;
  const podeConverterProjeto = !!proposta && proposta.projeto_id == null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-gray-50/50">
          <DialogHeader className="mb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-lg">{nomeCompleto}</DialogTitle>
                  <DialogDescription className="sr-only">Detalhes do lead {nomeCompleto}</DialogDescription>
                  <Badge className={statusConfig?.color}>{statusConfig?.label ?? lead.status}</Badge>
                  {lead.status === "Perdido" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-danger-soft text-danger-strong flex items-center gap-1">
                      <AlertTriangle size={10} /> Perdido
                    </span>
                  )}
                </div>
                {lead.empresa_lead && (
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {lead.empresa_lead}
                  </p>
                )}
              </div>

              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-1" aria-label="Mais opções">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(lead)}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Editar dados
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete(lead.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir lead
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </DialogHeader>

          {/* Metadados em linha */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-muted-foreground">
            {lead.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" /> {lead.email}
              </span>
            )}
            {lead.contato && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> {lead.contato}
              </span>
            )}
            {lead.valor_estimado != null && (
              <span className="flex items-center gap-1 text-positive-strong font-medium">
                <DollarSign className="h-3 w-3" /> {formatCurrency(lead.valor_estimado)}
              </span>
            )}
            {lead.previsao_fechamento && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Previsão {new Date(lead.previsao_fechamento + "T00:00:00").toLocaleDateString("pt-BR")}
              </span>
            )}
            {responsavel && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" /> {responsavel.first_name} {responsavel.last_name}
              </span>
            )}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="px-6 py-4 space-y-4">
          {proposta && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[10px] uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Proposta
                </Label>
                {propStatusConfig && <Badge className={propStatusConfig.color}>{propStatusConfig.label}</Badge>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {proposta.valor_proposto != null && (
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatCurrency(proposta.valor_proposto)}
                  </span>
                )}
                {proposta.margem_estimada_pct != null && (
                  <span className="text-muted-foreground">margem {Math.round(proposta.margem_estimada_pct)}%</span>
                )}
                {proposta.validade && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    validade {new Date(proposta.validade + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
              {onOpenProposta && (
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onOpenProposta(proposta.id)}>
                  <PencilIcon className="mr-1.5 h-3.5 w-3.5" /> Editar proposta
                </Button>
              )}
            </div>
          )}

          {lead.origem && (
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Origem</Label>
              <p className="text-sm text-foreground border-l-2 border-border pl-3 py-0.5">{lead.origem}</p>
            </div>
          )}

          {lead.status === "Perdido" && lead.motivo_perda && (
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase text-muted-foreground tracking-wider text-danger-strong">
                Motivo da Perda
              </Label>
              <p className="text-sm text-danger-mid bg-danger-soft p-3 rounded-lg border border-danger-soft-border">
                {lead.motivo_perda}
              </p>
            </div>
          )}

          {lead.status === "Ganho" && lead.convertido_em && (
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase text-muted-foreground tracking-wider text-positive-strong">
                Convertido em
              </Label>
              <p className="text-sm text-positive-strong bg-positive/10 p-3 rounded-lg border border-positive/10">
                {new Date(lead.convertido_em).toLocaleDateString("pt-BR")}
              </p>
            </div>
          )}

          {lead.notas && (
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Notas</Label>
              <p className="text-sm text-foreground border-l-2 border-border pl-3 py-0.5 whitespace-pre-wrap">
                {lead.notas}
              </p>
            </div>
          )}

          {!proposta && !lead.origem && !lead.motivo_perda && !lead.convertido_em && !lead.notas && (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhuma informação adicional.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-6 py-3 border-t bg-gray-50/30">
          {lead.status === "Ganho" && !lead.cliente_id && (
            <Button size="sm" className="bg-positive hover:bg-positive/90 text-white" onClick={onConvert}>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Transformar em Cliente
            </Button>
          )}

          {canEdit && podeConverterProjeto && onConvertProjeto && (
            <Button
              size="sm"
              className="bg-positive hover:bg-positive/90 text-white"
              onClick={onConvertProjeto}
              disabled={convertProjetoPending}
            >
              {convertProjetoPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
              )}
              Converter em projeto
            </Button>
          )}

          {!proposta && (
            <Button
              size="sm"
              variant="brand"
              onClick={onCreateProposta}
              disabled={createPropostaPending || lead.status === "Perdido" || lead.status === "Ganho"}
            >
              {createPropostaPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="mr-1.5 h-3.5 w-3.5" />
              )}
              Criar Proposta
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
