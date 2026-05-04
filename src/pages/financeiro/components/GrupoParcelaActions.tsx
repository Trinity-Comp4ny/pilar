import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Pencil, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Lancamento } from "../hooks/useLancamentosUnified";

interface Props {
  lancamento: Lancamento;
  onChanged: () => void;
}

type ActionType = "editar" | "renegociar" | "quitar" | null;

export function GrupoParcelaActions({ lancamento: l, onChanged }: Props) {
  const [action, setAction] = useState<ActionType>(null);

  if (!l.grupo_parcela) return null;

  const grupoStatusColor =
    l.grupo_status === "quitado"
      ? "bg-positive/10 text-positive"
      : l.grupo_status === "parcial"
        ? "bg-amber-100 text-amber-700"
        : l.grupo_status === "cancelado"
          ? "bg-muted text-muted-foreground"
          : "bg-blue-100 text-blue-700";

  return (
    <>
      <div className="rounded-md border bg-muted/30 p-3 text-sm">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="font-medium">Grupo de parcelas</div>
          <Badge variant="secondary" className={grupoStatusColor}>
            {l.grupo_status ?? "—"}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          {l.grupo_total_original != null && (
            <div>
              Total original:{" "}
              <span className="font-mono">
                {l.grupo_total_original.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
            </div>
          )}
          {l.parcela_total && (
            <div>
              Parcela {l.parcela_numero}/{l.parcela_total}
            </div>
          )}
          {l.grupo_tipo && <div>Tipo: {l.grupo_tipo}</div>}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="mt-3 w-full gap-2">
              Operações de grupo <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => setAction("editar")}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar parcelas em aberto
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAction("renegociar")}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Renegociar grupo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAction("quitar")}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Quitar antecipado
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <EditarEmAbertoDialog
        open={action === "editar"}
        grupoId={l.grupo_parcela}
        onClose={() => setAction(null)}
        onDone={onChanged}
      />
      <RenegociarDialog
        open={action === "renegociar"}
        grupoId={l.grupo_parcela}
        onClose={() => setAction(null)}
        onDone={onChanged}
      />
      <QuitarAntecipadoDialog
        open={action === "quitar"}
        grupoId={l.grupo_parcela}
        onClose={() => setAction(null)}
        onDone={onChanged}
      />
    </>
  );
}

interface OpProps {
  open: boolean;
  grupoId: string;
  onClose: () => void;
  onDone: () => void;
}

function EditarEmAbertoDialog({ open, grupoId, onClose, onDone }: OpProps) {
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("rpc_grupo_parcela_editar_em_aberto", {
        p_grupo_id: grupoId,
        p_novo_valor_parcela: valor ? Number(valor) : undefined,
        p_nova_categoria_id: undefined,
        p_novo_centro_custo_id: undefined,
        p_nova_conta_id: undefined,
        p_nova_observacao: observacao || undefined,
      });
      if (error) throw error;
      toast.success(`${data ?? 0} parcela(s) atualizada(s)`);
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar parcelas em aberto</DialogTitle>
          <DialogDescription>Altera somente as parcelas pendentes/atrasadas. Pagas ficam intactas.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Novo valor por parcela (opcional)</Label>
            <Input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Deixe vazio para manter"
            />
          </div>
          <div>
            <Label>Observação (opcional)</Label>
            <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : "Aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenegociarDialog({ open, grupoId, onClose, onDone }: OpProps) {
  const [novoTotal, setNovoTotal] = useState("");
  const [numParcelas, setNumParcelas] = useState("");
  const [primeiraData, setPrimeiraData] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!novoTotal || !numParcelas || !primeiraData) {
      toast.error("Preencha total, parcelas e primeira data");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("rpc_grupo_parcela_renegociar", {
        p_grupo_id: grupoId,
        p_novo_total: Number(novoTotal),
        p_novo_num_parcelas: Number(numParcelas),
        p_nova_primeira_data: primeiraData,
        p_observacao: observacao || undefined,
      });
      if (error) throw error;
      toast.success("Grupo renegociado", { description: `Novo grupo: ${data}` });
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renegociar grupo</DialogTitle>
          <DialogDescription>
            Cancela parcelas em aberto e cria um novo grupo. Histórico preservado via link.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Novo total *</Label>
            <Input type="number" step="0.01" value={novoTotal} onChange={(e) => setNovoTotal(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nº parcelas *</Label>
              <Input
                type="number"
                min={1}
                max={360}
                value={numParcelas}
                onChange={(e) => setNumParcelas(e.target.value)}
              />
            </div>
            <div>
              <Label>1ª data *</Label>
              <Input type="date" value={primeiraData} onChange={(e) => setPrimeiraData(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Observação</Label>
            <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Renegociando..." : "Renegociar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuitarAntecipadoDialog({ open, grupoId, onClose, onDone }: OpProps) {
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [quantidade, setQuantidade] = useState("");
  const [desconto, setDesconto] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("rpc_grupo_parcela_quitar_antecipado", {
        p_grupo_id: grupoId,
        p_data_pagamento: dataPagamento,
        p_quantidade: quantidade ? Number(quantidade) : undefined,
        p_desconto_total: desconto ? Number(desconto) : 0,
      });
      if (error) throw error;
      toast.success(`${data ?? 0} parcela(s) quitada(s)`);
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quitar antecipado</DialogTitle>
          <DialogDescription>Baixa N parcelas em aberto na data informada.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Data do pagamento *</Label>
            <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
          </div>
          <div>
            <Label>Quantidade (vazio = todas em aberto)</Label>
            <Input type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </div>
          <div>
            <Label>Desconto total (R$)</Label>
            <Input type="number" step="0.01" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Quitando..." : "Quitar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
