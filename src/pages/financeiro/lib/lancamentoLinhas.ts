import { addMonths, format } from "date-fns";
import type { FormData } from "./lancamentoFormSchema";

/**
 * Status de um lançamento em aberto pela data: vencido = "Atrasado", senão "Pendente".
 * O job diário faz o mesmo; calcular aqui evita que um vencimento adiado continue
 * "Atrasado" (ou um passado apareça "Pendente") até a próxima rodada.
 */
export function statusEmAberto(status: string, vencimento: Date): string {
  if (status !== "Pendente") return status;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(vencimento);
  venc.setHours(0, 0, 0, 0);
  return venc < hoje ? "Atrasado" : "Pendente";
}

interface OpcoesLinhas {
  isReceita: boolean;
  numParcelas: number;
  valorNum: number;
  grupoParcela: string | null;
  dataCompetencia: string;
}

/**
 * Linhas de um lançamento novo (1 ou N parcelas mensais). A última parcela absorve
 * o arredondamento para a soma fechar no centavo. Só a primeira pode nascer paga.
 * O payload vai para rpc_lancamentos_criar; empresa_id é do servidor.
 */
export function montarLinhasNovas(
  data: FormData,
  { isReceita, numParcelas, valorNum, grupoParcela, dataCompetencia }: OpcoesLinhas
) {
  const valorParcela = Math.round((valorNum / numParcelas) * 100) / 100;
  const dataCompetenciaStr = dataCompetencia;
  return Array.from({ length: numParcelas }, (_, i) => {
    const dataParcela = addMonths(data.dataVencimento, i);
    const dataStr = format(dataParcela, "yyyy-MM-dd");
    const isUltima = i === numParcelas - 1 && numParcelas > 1;
    const valorFinal = isUltima ? Math.round((valorNum - valorParcela * (numParcelas - 1)) * 100) / 100 : valorParcela;
    const desc = numParcelas > 1 ? `${data.descricao} (${i + 1}/${numParcelas})` : data.descricao;
    const isPrimeira = i === 0;
    return isReceita
      ? {
          data_vencimento: dataStr,
          data_recebimento: isPrimeira && data.status === "Recebida" ? dataStr : null,
          data_competencia: dataCompetenciaStr,
          descricao: desc,
          valor: valorFinal,
          status: isPrimeira && data.status === "Recebida" ? "Recebido" : statusEmAberto("Pendente", dataParcela),
          forma_pagamento: data.formaPagamento || null,
          categoria_id: data.categoriaId || null,
          projeto_id: data.projetoId || null,
          conta_id: data.contaId || null,
          cliente_id: data.clienteId || null,
          centro_custo_id: data.centroCustoId || null,
          nota_fiscal: data.notaFiscal || null,
          observacao: data.observacao || null,
          grupo_parcela: grupoParcela,
          parcela_numero: numParcelas > 1 ? i + 1 : null,
          parcela_total: numParcelas > 1 ? numParcelas : null,
        }
      : {
          data_vencimento: dataStr,
          data_pagamento: isPrimeira && data.status === "Pago" ? dataStr : null,
          data_competencia: dataCompetenciaStr,
          descricao: desc,
          valor: valorFinal,
          status: isPrimeira && data.status === "Pago" ? "Pago" : statusEmAberto("Pendente", dataParcela),
          forma_pagamento: data.formaPagamento || null,
          categoria_id: data.categoriaId || null,
          projeto_id: data.projetoId || null,
          conta_id: data.contaId || null,
          cartao_id: data.cartaoId || null,
          fornecedor_id: data.fornecedorId || null,
          centro_custo_id: data.centroCustoId || null,
          nota_fiscal: data.notaFiscal || null,
          observacao: data.observacao || null,
          grupo_parcela: grupoParcela,
          parcela_numero: numParcelas > 1 ? i + 1 : null,
          parcela_total: numParcelas > 1 ? numParcelas : null,
          recorrente: data.recorrente,
          periodicidade: data.recorrente ? data.periodicidade : null,
        };
  });
}
