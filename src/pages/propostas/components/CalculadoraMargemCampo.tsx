import { toast } from "sonner";
import type { SimulacaoMargemEstado } from "../hooks/useSimulacaoMargem";
import { useSalvarConfigComercial } from "../hooks/useConfigComercial";
import { CalculadoraMargem } from "./CalculadoraMargem";

interface CalculadoraMargemCampoProps {
  margem: SimulacaoMargemEstado;
  custo: number;
  precoTabela: number;
  onAplicarPreco: (valor: number) => void;
  disabled?: boolean;
  textoSemCusto?: string;
}

/** Calculadora do formulário de proposta, já ligada ao padrão da empresa (SPEC 168). */
export function CalculadoraMargemCampo({
  margem,
  custo,
  precoTabela,
  onAplicarPreco,
  disabled,
  textoSemCusto,
}: CalculadoraMargemCampoProps) {
  const salvar = useSalvarConfigComercial();
  return (
    <CalculadoraMargem
      custo={custo}
      precoTabela={precoTabela}
      config={margem.config}
      value={margem.simulacao}
      onChange={margem.setSimulacao}
      onAplicarPreco={onAplicarPreco}
      textoSemCusto={textoSemCusto}
      onSalvarPadrao={(sim) =>
        salvar.mutate(
          { ...margem.config, aliquotaImpostoPct: sim.impostoPct, margemAlvoPct: sim.margemAlvoPct },
          {
            onSuccess: () => toast.success("Padrão da empresa atualizado"),
            onError: () => toast.error("Não foi possível salvar o padrão"),
          }
        )
      }
      salvandoPadrao={salvar.isPending}
      disabled={disabled}
    />
  );
}
