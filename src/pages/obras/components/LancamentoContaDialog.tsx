import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useObraFrentes } from "@/hooks/useObraFrentes";
import { useSaveAporte, useSaveDespesa, type ObraLancamentoRow } from "@/hooks/useObraConta";
import { PAGO_POR_OPCOES, type PagoPor } from "@/lib/obras";

const SEM_FRENTE = "__none__";
const SEM_FORNECEDOR = "__none__";
const hoje = () => new Date().toISOString().slice(0, 10);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  tipo: "aporte" | "despesa";
  lancamento?: ObraLancamentoRow | null;
}

/** Registra um aporte do cliente ou uma despesa. Despesa passa pelo RPC (gera a taxa). */
export function LancamentoContaDialog({ open, onOpenChange, obraId, tipo, lancamento }: Props) {
  const isEdit = !!lancamento;
  const { data: frentes = [] } = useObraFrentes(obraId);
  const { data: fornecedores = [] } = useFornecedoresLite();
  const saveAporte = useSaveAporte(obraId);
  const saveDespesa = useSaveDespesa(obraId);

  // O pai remonta o dialog a cada abertura, então o estado inicial já reflete o
  // lançamento em edição (sem effect de sincronização props→state).
  const [data, setData] = useState(lancamento?.data ?? hoje());
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? "");
  const [valor, setValor] = useState(lancamento ? String(lancamento.valor) : "");
  const [frenteId, setFrenteId] = useState(lancamento?.obra_frente_id ?? SEM_FRENTE);
  const [fornecedorId, setFornecedorId] = useState(lancamento?.fornecedor_id ?? SEM_FORNECEDOR);
  const [pagoPor, setPagoPor] = useState<PagoPor>((lancamento?.pago_por as PagoPor) ?? "cliente");
  const [comprovanteUrl, setComprovanteUrl] = useState(lancamento?.comprovante_url ?? "");
  // "Segurar" = não deixar aparecer no portal ainda (confirmada_portal = false).
  const [seguraPortal, setSeguraPortal] = useState(lancamento ? lancamento.confirmada_portal === false : false);

  const saving = saveAporte.isPending || saveDespesa.isPending;

  const submit = async () => {
    const v = Number(valor);
    if (!descricao.trim() || !Number.isFinite(v) || v < 0) {
      toast.error("Preencha descrição e um valor válido");
      return;
    }
    try {
      if (tipo === "aporte") {
        await saveAporte.mutateAsync({ data, descricao: descricao.trim(), valor: v });
      } else {
        await saveDespesa.mutateAsync({
          id: lancamento?.id,
          data,
          descricao: descricao.trim(),
          valor: v,
          obra_frente_id: frenteId === SEM_FRENTE ? null : frenteId,
          fornecedor_id: fornecedorId === SEM_FORNECEDOR ? null : fornecedorId,
          pago_por: pagoPor,
          comprovante_url: comprovanteUrl.trim() || null,
          confirmada_portal: !seguraPortal,
        });
      }
      toast.success(tipo === "aporte" ? "Aporte registrado" : "Despesa registrada");
      onOpenChange(false);
    } catch (e) {
      toast.error("Não foi possível salvar", { description: e instanceof Error ? e.message : "Tente novamente" });
    }
  };

  const titulo = tipo === "aporte" ? "Aporte do cliente" : isEdit ? "Editar despesa" : "Nova despesa";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={titulo}
      size="md"
      onSubmit={submit}
      isPending={saving}
      submitLabel={isEdit ? "Salvar" : "Registrar"}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="lanc-data">Data</Label>
            <DatePicker id="lanc-data" value={data} onChange={setData} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lanc-valor">Valor (R$)</Label>
            <Input
              id="lanc-valor"
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lanc-desc">Descrição</Label>
          <Input
            id="lanc-desc"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={tipo === "aporte" ? "Ex.: Aporte inicial do cliente" : "Ex.: Concreto usinado 10 m³"}
          />
        </div>

        {tipo === "despesa" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Etapa</Label>
                <Select value={frenteId} onValueChange={setFrenteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_FRENTE}>Sem etapa</SelectItem>
                    {frentes.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fornecedor</Label>
                <Select value={fornecedorId} onValueChange={setFornecedorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_FORNECEDOR}>Sem fornecedor</SelectItem>
                    {fornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Pago com</Label>
              <Select value={pagoPor} onValueChange={(v) => setPagoPor(v as PagoPor)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGO_POR_OPCOES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lanc-comprovante">Comprovante (link da nota)</Label>
              <Input
                id="lanc-comprovante"
                type="url"
                inputMode="url"
                value={comprovanteUrl}
                onChange={(e) => setComprovanteUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
              />
              <p className="text-xs text-muted-foreground">
                Link do Drive. Aparece como "Ver nota" na prestação de contas do cliente.
              </p>
            </div>

            <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="lanc-segura">Segurar do portal</Label>
                <p className="text-xs text-muted-foreground">
                  Em conferência: não aparece para o cliente até você liberar.
                </p>
              </div>
              <Switch id="lanc-segura" checked={seguraPortal} onCheckedChange={setSeguraPortal} />
            </div>
          </>
        )}
      </div>
    </FormDialog>
  );
}

function useFornecedoresLite() {
  return useQuery({
    queryKey: ["fornecedores-lite"],
    queryFn: async (): Promise<{ id: string; nome: string }[]> => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
}
