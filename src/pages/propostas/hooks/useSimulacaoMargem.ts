import { useState } from "react";
import type { Json } from "@/integrations/supabase/types";
import { aplicaDesconto } from "@/lib/margemLiquida";
import type { SimulacaoMargem } from "../components/CalculadoraMargem";
import { lerSimulacao, montarSnapshot } from "../lib/simulacaoSnapshot";
import { CONFIG_COMERCIAL_PADRAO, useConfigComercial } from "./useConfigComercial";

/**
 * Estado da simulação de margem do formulário de proposta (SPEC 168). Concentra a hidratação
 * ao editar e a montagem do valor e do snapshot ao salvar, para a tela só delegar.
 */
export function useSimulacaoMargem(podeVer: boolean) {
  const { data: config = CONFIG_COMERCIAL_PADRAO } = useConfigComercial(podeVer);
  const [simulacao, setSimulacao] = useState<SimulacaoMargem | null>(null);

  /**
   * Restaura a simulação gravada e devolve o valor que o campo deve mostrar. O valor gravado
   * já é o preço com desconto; o campo mostra o de tabela para o desconto não ser aplicado
   * duas vezes ao salvar de novo.
   */
  const hidratar = (dadosSimulacao: unknown, valorGravado: number | null | undefined) => {
    const snap = podeVer ? lerSimulacao(dadosSimulacao as Json | null) : null;
    setSimulacao(snap?.simulacao ?? null);
    return snap?.precoTabela ?? valorGravado;
  };

  /** Valor final (com desconto) e o snapshot a gravar; sem simulação válida, devolve o valor base. */
  const aplicar = (valorBase: number | undefined, custo: number) => {
    if (!podeVer || !simulacao || custo <= 0 || !valorBase) return { valorProposto: valorBase, extra: {} };
    return {
      valorProposto: aplicaDesconto(valorBase, simulacao.descontoPct),
      extra: { dados_simulacao: montarSnapshot(simulacao, valorBase, custo, config) },
    };
  };

  return { ativo: podeVer, config, simulacao, setSimulacao, hidratar, aplicar };
}

export type SimulacaoMargemEstado = ReturnType<typeof useSimulacaoMargem>;
