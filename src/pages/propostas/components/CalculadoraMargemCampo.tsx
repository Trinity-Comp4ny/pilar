import { useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { formatValorToInput, parseCurrencyString } from "@/lib/currencyUtils";
import type { SimulacaoMargemEstado } from "../hooks/useSimulacaoMargem";
import { useSalvarConfigComercial } from "../hooks/useConfigComercial";
import { CalculadoraMargem } from "./CalculadoraMargem";
import { MeiosRecebimentoDialog } from "./MeiosRecebimentoDialog";

interface CalculadoraMargemCampoProps {
  margem: SimulacaoMargemEstado;
  custo: number;
  precoTabela: number;
  onAplicarPreco: (valor: number) => void;
  disabled?: boolean;
  /** Obra/serviço: sem horas por disciplina, o custo é digitado aqui. */
  obra?: boolean;
}

/** Calculadora do formulário de proposta, já ligada ao padrão da empresa (SPEC 168). */
export function CalculadoraMargemCampo({
  margem,
  custo,
  precoTabela,
  onAplicarPreco,
  disabled,
  obra,
}: CalculadoraMargemCampoProps) {
  const salvar = useSalvarConfigComercial();
  const [taxasAbertas, setTaxasAbertas] = useState(false);
  return (
    <>
      {obra && (
        <div className="space-y-2">
          <Label htmlFor="proposta-custo-obra">Custo previsto da obra (só você vê)</Label>
          <MoneyInput
            id="proposta-custo-obra"
            value={margem.custoManual ? formatValorToInput(margem.custoManual) : ""}
            onChange={(v) => margem.setCustoManual(parseCurrencyString(v))}
            disabled={disabled}
            placeholder="R$ 0,00"
          />
          <p className="text-2xs text-muted-foreground">
            Material, mão de obra e o que mais sair do seu bolso. Com ele a calculadora mostra a margem e o desconto
            máximo.
          </p>
        </div>
      )}
      <CalculadoraMargem
        custo={custo}
        precoTabela={precoTabela}
        config={margem.config}
        value={margem.simulacao}
        onChange={margem.setSimulacao}
        onAplicarPreco={onAplicarPreco}
        textoSemCusto={obra ? "Informe o custo previsto da obra para ver a margem e o desconto máximo." : undefined}
        onSalvarPadrao={(sim) =>
          salvar.mutate(
            { ...margem.config, aliquotaImpostoPct: sim.impostoPct, margemAlvoPct: sim.margemAlvoPct },
            {
              onSuccess: () => toast.success("Padrão da empresa atualizado"),
              onError: () => toast.error("Não foi possível salvar o padrão"),
            }
          )
        }
        onEditarTaxas={() => setTaxasAbertas(true)}
        salvandoPadrao={salvar.isPending}
        disabled={disabled}
      />
      <MeiosRecebimentoDialog open={taxasAbertas} onOpenChange={setTaxasAbertas} config={margem.config} />
    </>
  );
}
