import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { NumberInput } from "@/components/forms/NumberInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSalvarConfigComercial, type ConfigComercial } from "../hooks/useConfigComercial";
import {
  meioParaRascunho,
  novoRascunho,
  rascunhosParaMeios,
  validarRascunhos,
  type MeioRascunho,
} from "../lib/meiosRecebimentoForm";

interface MeiosRecebimentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ConfigComercial;
}

/** Cadastro das taxas de cada meio de recebimento (PIX, boleto, cartão) da empresa. SPEC 168. */
export function MeiosRecebimentoDialog({ open, onOpenChange, config }: MeiosRecebimentoDialogProps) {
  const salvar = useSalvarConfigComercial();
  const [rascunhos, setRascunhos] = useState<MeioRascunho[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRascunhos(config.meiosRecebimento.map(meioParaRascunho));
    setErro(null);
  }, [open, config.meiosRecebimento]);

  const mudaMeio = (i: number, patch: Partial<MeioRascunho>) =>
    setRascunhos((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const enviar = () => {
    const problema = validarRascunhos(rascunhos);
    setErro(problema);
    if (problema) return;
    salvar.mutate(
      { ...config, meiosRecebimento: rascunhosParaMeios(rascunhos) },
      {
        onSuccess: () => {
          toast.success("Taxas atualizadas");
          onOpenChange(false);
        },
        onError: () => toast.error("Não foi possível salvar as taxas"),
      }
    );
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Taxas de recebimento"
      description="Informe a taxa que cada meio cobra de você. A calculadora usa esse valor para descontar do preço. O Pilar não consulta a maquininha."
      size="lg"
      onSubmit={enviar}
      isPending={salvar.isPending}
    >
      <div className="space-y-4">
        {rascunhos.map((r, i) => (
          <div key={r.id} className="space-y-3 rounded-lg border border-black/5 p-3" data-testid="meio-recebimento">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-2xs">Nome do meio</Label>
                <Input className="h-8 text-xs" value={r.nome} onChange={(e) => mudaMeio(i, { nome: e.target.value })} />
              </div>
              {r.faixas.length === 0 && (
                <div className="w-[120px] space-y-1">
                  <Label className="text-2xs">Taxa (%)</Label>
                  <NumberInput
                    allowDecimal
                    min={0}
                    max={99.9}
                    suffix="%"
                    className="h-8 text-xs"
                    value={r.taxa}
                    onChange={(v) => mudaMeio(i, { taxa: v })}
                  />
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover ${r.nome || "meio"}`}
                onClick={() => setRascunhos((rs) => rs.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {r.faixas.map((f, j) => (
              <div key={j} className="flex items-end gap-3 pl-3">
                <div className="w-[140px] space-y-1">
                  <Label className="text-2xs">A partir de (parcelas)</Label>
                  <NumberInput
                    min={1}
                    max={24}
                    className="h-8 text-xs"
                    value={f.parcelas}
                    onChange={(v) =>
                      mudaMeio(i, { faixas: r.faixas.map((x, k) => (k === j ? { ...x, parcelas: v } : x)) })
                    }
                  />
                </div>
                <div className="w-[120px] space-y-1">
                  <Label className="text-2xs">Taxa (%)</Label>
                  <NumberInput
                    allowDecimal
                    min={0}
                    max={99.9}
                    suffix="%"
                    className="h-8 text-xs"
                    value={f.taxa}
                    onChange={(v) => mudaMeio(i, { faixas: r.faixas.map((x, k) => (k === j ? { ...x, taxa: v } : x)) })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remover faixa"
                  onClick={() => mudaMeio(i, { faixas: r.faixas.filter((_, k) => k !== j) })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() =>
                mudaMeio(i, {
                  faixas: [
                    ...r.faixas,
                    { parcelas: r.faixas.length === 0 ? "1" : "", taxa: r.faixas.length === 0 ? r.taxa : "" },
                  ],
                })
              }
            >
              Taxa por número de parcelas
            </Button>
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={() => setRascunhos((rs) => [...rs, novoRascunho()])}>
          <Plus className="mr-1 h-4 w-4" />
          Adicionar meio
        </Button>

        {erro && (
          <p role="alert" className="text-xs text-danger-strong">
            {erro}
          </p>
        )}
      </div>
    </FormDialog>
  );
}
