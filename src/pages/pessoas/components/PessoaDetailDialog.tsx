import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Trash2, Landmark, Eye, EyeOff } from "lucide-react";
import {
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  CONTRACT_TYPE_COLORS,
  PESSOA_STATUS_LABELS,
  PESSOA_STATUS_COLORS,
  type ContractType,
  type PessoaStatus,
} from "@/constants";
import { cn } from "@/lib/utils";
import type { Pessoa } from "../types";

const formatDateBR = (iso?: string) => {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

interface PessoaDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pessoa: Pessoa | null;
  isAdmin: boolean;
  onEdit: (pessoa: Pessoa) => void;
  onDelete: (id: string) => void;
}

export function PessoaDetailDialog({ open, onOpenChange, pessoa, isAdmin, onEdit, onDelete }: PessoaDetailDialogProps) {
  // CPF é PII: mascarado por padrão, revelado só sob ação explícita.
  const [showCpf, setShowCpf] = useState(false);

  useEffect(() => {
    setShowCpf(false);
  }, [pessoa?.id, open]);

  if (!pessoa) return null;

  const maskedCpf = pessoa.cpf ? `***.***.***-${pessoa.cpf.replace(/\D/g, "").slice(-2)}` : "-";

  const tipo = pessoa.tipo_contrato as ContractType;
  const status = (pessoa.status || "ativo") as PessoaStatus;
  const isPJ = tipo === CONTRACT_TYPES.PJ;
  const isCLT = tipo === CONTRACT_TYPES.CLT;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {pessoa.nome}
            <Badge variant="outline" className={cn("border", CONTRACT_TYPE_COLORS[tipo])}>
              {CONTRACT_TYPE_LABELS[tipo] || tipo}
            </Badge>
            <Badge variant="outline" className={cn("border", PESSOA_STATUS_COLORS[status])}>
              {PESSOA_STATUS_LABELS[status]}
            </Badge>
          </DialogTitle>
          <DialogDescription>Detalhes do cadastro</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">CPF</Label>
              <div className="flex items-center gap-1.5">
                <p className="font-medium">{pessoa.cpf ? (showCpf ? pessoa.cpf : maskedCpf) : "-"}</p>
                {pessoa.cpf && (
                  <button
                    type="button"
                    onClick={() => setShowCpf((v) => !v)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={showCpf ? "Ocultar CPF" : "Mostrar CPF"}
                  >
                    {showCpf ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">RG</Label>
              <p className="font-medium">{pessoa.rg || "-"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Cargo</Label>
              <p className="font-medium">{pessoa.cargo}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Nascimento</Label>
              <p className="font-medium">{formatDateBR(pessoa.data_nascimento)}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Admissão</Label>
              <p className="font-medium">{formatDateBR(pessoa.data_admissao)}</p>
            </div>
            {pessoa.data_demissao && (
              <div>
                <Label className="text-xs text-muted-foreground">Demissão</Label>
                <p className="font-medium">{formatDateBR(pessoa.data_demissao)}</p>
              </div>
            )}
            {isAdmin && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Salário Fixo</Label>
                  <p className="font-medium">
                    {pessoa.salario_fixo
                      ? `R$ ${pessoa.salario_fixo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Valor m²</Label>
                  <p className="font-medium">
                    {pessoa.valor_m2
                      ? `R$ ${pessoa.valor_m2.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : "-"}
                  </p>
                </div>
              </>
            )}
          </div>

          {isPJ && (pessoa.cnpj || pessoa.razao_social) && (
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm text-muted-foreground mb-2">Dados PJ</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">CNPJ</Label>
                  <p className="font-medium">{pessoa.cnpj || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Razão Social</Label>
                  <p className="font-medium">{pessoa.razao_social || "-"}</p>
                </div>
              </div>
            </div>
          )}

          {isCLT && pessoa.pis_nit && (
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm text-muted-foreground mb-2">Dados CLT</h4>
              <div>
                <Label className="text-xs text-muted-foreground">PIS/NIT</Label>
                <p className="font-medium">{pessoa.pis_nit}</p>
              </div>
            </div>
          )}

          <div className="border-t pt-4 space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground mb-2">Contato & Endereço</h4>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm w-20">Email:</span>
                <span>{pessoa.email || "-"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm w-20">Telefone:</span>
                <span>{pessoa.telefone || "-"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm w-20">Endereço:</span>
                <span>{pessoa.endereco || "-"}</span>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="border-t pt-4 space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground mb-2">Contas Bancárias</h4>
              {pessoa.contas_bancarias && pessoa.contas_bancarias.length > 0 ? (
                <div className="space-y-2">
                  {pessoa.contas_bancarias.map((conta, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between gap-3 bg-gray-50 border rounded-lg px-3 py-2 text-sm ${
                        conta.is_primary ? "border-brand/50 bg-brand/5" : "border-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-1.5 rounded-full bg-white border border-gray-100 text-gray-500">
                          <Landmark size={14} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{conta.banco}</span>
                            {conta.is_primary && (
                              <span className="text-[10px] bg-brand/10 text-brand px-1.5 py-0.5 rounded font-medium">
                                Principal
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Ag: {conta.agencia}</span>
                            <span className="text-gray-300">|</span>
                            <span>Cc: {conta.conta}</span>
                            <span className="text-gray-300">|</span>
                            <span className="capitalize">{conta.tipo}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nenhuma conta bancária cadastrada.</p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            {isAdmin && (
              <>
                <Button variant="outline" onClick={() => onEdit(pessoa)} className="flex-1">
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button variant="destructive" onClick={() => onDelete(pessoa.id)} className="flex-1">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
