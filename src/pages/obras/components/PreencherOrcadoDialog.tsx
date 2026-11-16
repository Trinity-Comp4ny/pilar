import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { useEstimativas } from "@/pages/obras/estimativa/hooks";
import { planejarOrcadoDaEstimativa } from "@/pages/obras/estimativa/orcadoDaEstimativa";
import { useObraFrentes } from "@/pages/obras/hooks/useObraFrentes";
import { useObraOrcamento, useSalvarOrcamentoEmLote } from "@/pages/obras/hooks/useObraOrcamento";

/** Preenche o orçado da obra com o previsto de uma estimativa, casando fases e etapas pelo nome. */
export function PreencherOrcadoDialog({
  open,
  onOpenChange,
  obraId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
}) {
  const formatCurrency = useMoneyMask();
  const { data: estimativas = [] } = useEstimativas();
  const { data: nos = [] } = useObraFrentes(obraId);
  const { data: orcamentos = [] } = useObraOrcamento(obraId);
  const salvar = useSalvarOrcamentoEmLote(obraId);
  const [estimativaId, setEstimativaId] = useState("");
  const [substituir, setSubstituir] = useState(false);

  const comResultado = estimativas.filter((e) => e.resultado);
  const estimativa = comResultado.find((e) => e.id === estimativaId) ?? null;

  // Conta pequena (dezenas de linhas): sem useMemo, o compilador do React cuida.
  const resultado = estimativa?.resultado ?? null;
  const plano = resultado
    ? planejarOrcadoDaEstimativa(
        resultado,
        nos,
        new Map(orcamentos.map((o) => [o.obra_frente_id, Number(o.valor_previsto)])),
        substituir
      )
    : null;

  const aGravar = plano?.linhas.filter((l) => !l.mantido) ?? [];

  const confirmar = async () => {
    if (aGravar.length === 0) return;
    try {
      await salvar.mutateAsync(aGravar.map((l) => ({ obraFrenteId: l.id, valorPrevisto: l.novo })));
      toast.success("Orçado preenchido", {
        description: `${aGravar.length} ${aGravar.length === 1 ? "linha" : "linhas"} da estimativa.`,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error("Não foi possível preencher", { description: e instanceof Error ? e.message : "Tente de novo." });
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Orçado pela estimativa"
      description="O previsto da estimativa entra nas fases e etapas da obra que têm o mesmo nome. Fora a taxa de administração, que não é custo da obra."
      size="md"
      submitLabel="Preencher o orçado"
      onSubmit={() => void confirmar()}
      isPending={salvar.isPending}
      submitDisabled={aGravar.length === 0}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Estimativa</Label>
          <Select value={estimativaId} onValueChange={setEstimativaId}>
            <SelectTrigger>
              <SelectValue
                placeholder={comResultado.length ? "Escolha uma estimativa" : "Nenhuma estimativa calculada"}
              />
            </SelectTrigger>
            <SelectContent>
              {comResultado.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                  {e.clienteNome ? ` · ${e.clienteNome}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <Checkbox checked={substituir} onCheckedChange={(v) => setSubstituir(v === true)} />
          Substituir valores que já estão preenchidos
        </label>

        {plano && (
          <div className="space-y-3">
            {plano.linhas.length === 0 ? (
              <p className="rounded-xl bg-warning-soft px-3 py-2.5 text-sm text-warning-strong">
                Nenhuma fase ou etapa da obra tem o mesmo nome que a estimativa. Confira os nomes no cronograma.
              </p>
            ) : (
              <ul className="max-h-64 divide-y divide-black/5 overflow-y-auto rounded-xl border border-border">
                {plano.linhas.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-ink">{l.caminho}</span>
                    {l.mantido ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        mantido · {formatCurrency(l.anterior)}
                      </span>
                    ) : (
                      <span className="shrink-0 tabular-nums text-ink">
                        {l.anterior > 0 && (
                          <span className="mr-1.5 text-xs text-muted-foreground line-through">
                            {formatCurrency(l.anterior)}
                          </span>
                        )}
                        {formatCurrency(l.novo)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {plano.linhas.length > 0 && (
              <p className="text-sm text-ink">
                Total que entra: <span className="font-semibold tabular-nums">{formatCurrency(plano.totalNovo)}</span>
              </p>
            )}
            {plano.semCorrespondencia.length > 0 && (
              <p className="rounded-xl bg-warning-soft px-3 py-2.5 text-xs text-warning-strong">
                Ficaram de fora, porque a obra não tem uma fase com esse nome:{" "}
                {plano.semCorrespondencia.map((s) => `${s.fase} (${formatCurrency(s.valor)})`).join(", ")}.
              </p>
            )}
          </div>
        )}
      </div>
    </FormDialog>
  );
}
