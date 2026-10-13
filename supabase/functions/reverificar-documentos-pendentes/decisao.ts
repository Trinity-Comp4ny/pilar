import { type CnpjConsultaResultado, situacaoPermiteSubirNivel } from "../verificar-documento/documento.ts";

/**
 * O que fazer com um CNPJ pendente depois de reconsultar a BrasilAPI:
 *  - API fora do ar: tenta de novo amanhã;
 *  - ATIVA: verifica;
 *  - qualquer outra situação (BAIXADA, INAPTA, SUSPENSA...): recusa, e o admin informa de novo.
 */
export function decidirReverificacao(consulta: CnpjConsultaResultado): "aguardar" | "recusar" | "verificar" {
  if (consulta.status === "indisponivel") return "aguardar";
  return situacaoPermiteSubirNivel(consulta.info.situacaoCadastral) ? "verificar" : "recusar";
}
