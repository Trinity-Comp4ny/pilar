import { addBusinessDays, formatDateLocal, parseDateLocal } from "@/lib/businessDays";
import type { FluxoEtapa } from "@/types/fluxoDisciplinas";

export interface EtapaComDatas {
  ordem: number;
  data_inicio?: string;
  data_previsao?: string;
}

/**
 * Cascata de datas por etapa de fluxo: a primeira etapa herda data_inicio do
 * projeto; cada etapa seguinte herda data_inicio da data_previsao da anterior.
 * Etapa sem duracao_dias_uteis fica sem data_previsao e quebra a cadeia a partir
 * dali (a próxima etapa também não recebe data_inicio).
 */
export function calcularDatasEtapasFluxo(
  etapas: Pick<FluxoEtapa, "ordem" | "duracao_dias_uteis">[],
  dataInicioProjeto: string | undefined
): EtapaComDatas[] {
  if (!dataInicioProjeto) return etapas.map((e) => ({ ordem: e.ordem }));

  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  let cursorInicio: string | undefined = dataInicioProjeto;
  const resultado: EtapaComDatas[] = [];

  for (const etapa of ordenadas) {
    if (!cursorInicio) {
      resultado.push({ ordem: etapa.ordem });
      continue;
    }

    const inicio = cursorInicio;
    let previsao: string | undefined;
    if (etapa.duracao_dias_uteis && etapa.duracao_dias_uteis > 0) {
      previsao = formatDateLocal(addBusinessDays(parseDateLocal(inicio), etapa.duracao_dias_uteis));
    }

    resultado.push({ ordem: etapa.ordem, data_inicio: inicio, data_previsao: previsao });
    cursorInicio = previsao;
  }

  return resultado;
}
