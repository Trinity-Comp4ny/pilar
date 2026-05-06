import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Conta {
  id: string;
  nome: string;
}

interface TransferenciaFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transferencia?: {
    id: string;
    conta_id: string | null;
    contraparte_id: string | null;
    valor: number;
    data_vencimento: string;
    descricao: string;
    status: string;
    observacao?: string | null;
  } | null;
  onSaved: () => void;
}

const formatDateInput = (iso: string) => iso.slice(0, 10);

export function TransferenciaFormDialog({ open, onOpenChange, transferencia, onSaved }: TransferenciaFormProps) {
  const isEdit = Boolean(transferencia);
  const [contas, setContas] = useState<Conta[]>([]);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    conta_origem_id: "",
    conta_destino_id: "",
    valor: "",
    data: today,
    descricao: "",
    status: "Concluída",
    observacao: "",
  });

  useEffect(() => {
    if (!open) return;
    supabase
      .from("contas")
      .select("id, nome")
      .is("deleted_at", null)
      .order("nome")
      .then(({ data }) => setContas((data ?? []) as Conta[]));
  }, [open]);

  useEffect(() => {
    if (transferencia) {
      setForm({
        conta_origem_id: transferencia.conta_id ?? "",
        conta_destino_id: transferencia.contraparte_id ?? "",
        valor: String(transferencia.valor),
        data: formatDateInput(transferencia.data_vencimento),
        descricao: transferencia.descricao ?? "",
        status: transferencia.status ?? "Concluída",
        observacao: transferencia.observacao ?? "",
      });
    } else {
      setForm({
        conta_origem_id: "",
        conta_destino_id: "",
        valor: "",
        data: today,
        descricao: "",
        status: "Concluída",
        observacao: "",
      });
    }
  }, [transferencia, open]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.conta_origem_id || !form.conta_destino_id) {
      toast.error("Selecione conta de origem e destino");
      return;
    }
    if (form.conta_origem_id === form.conta_destino_id) {
      toast.error("Origem e destino devem ser diferentes");
      return;
    }
    const valor = parseFloat(form.valor.replace(",", "."));
    if (!valor || valor <= 0) {
      toast.error("Valor inválido");
      return;
    }
    if (!form.data) {
      toast.error("Data obrigatória");
      return;
    }

    setSaving(true);
    try {
      if (isEdit && transferencia) {
        const { error } = await supabase.rpc("rpc_editar_transferencia", {
          p_id: transferencia.id,
          p_conta_origem_id: form.conta_origem_id,
          p_conta_destino_id: form.conta_destino_id,
          p_valor: valor,
          p_data: form.data,
          p_descricao: form.descricao.trim() || null,
          p_status: form.status,
          p_observacao: form.observacao.trim() || null,
        } as never);
        if (error) throw error;
        toast.success("Transferência atualizada");
      } else {
        const { error } = await supabase.rpc("rpc_criar_transferencia", {
          p_conta_origem_id: form.conta_origem_id,
          p_conta_destino_id: form.conta_destino_id,
          p_valor: valor,
          p_data: form.data,
          p_descricao: form.descricao.trim() || null,
          p_status: form.status,
          p_observacao: form.observacao.trim() || null,
        } as never);
        if (error) throw error;
        toast.success("Transferência criada");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar transferência" : "Nova transferência"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Conta de origem *</Label>
              <Select value={form.conta_origem_id} onValueChange={(v) => set("conta_origem_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={c.id === form.conta_destino_id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conta de destino *</Label>
              <Select value={form.conta_destino_id} onValueChange={(v) => set("conta_destino_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={c.id === form.conta_origem_id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor *</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={form.valor}
                onChange={(e) => set("valor", e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Data *</Label>
              <DatePicker value={form.data} onChange={(v) => set("data", v)} />
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Input value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Opcional" />
          </div>

          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Concluída">Concluída</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Observação</Label>
            <Textarea
              value={form.observacao}
              onChange={(e) => set("observacao", e.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : isEdit ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
