import { z } from "zod";
import {
  dataVencimentoField,
  descricaoField,
  valorCurrencyField,
  parcelasField,
  optionalStringField,
} from "./financialFields";

export const despesaSchema = z
  .object({
    dataVencimento: dataVencimentoField,
    descricao: descricaoField,
    valorTotal: valorCurrencyField,
    status: z.enum(["Pago", "Pendente"]).default("Pendente"),
    parcelas: parcelasField,
    categoriaId: optionalStringField,
    formaPagamento: optionalStringField,
    fornecedorId: optionalStringField,
    projetoID: optionalStringField,
    notaFiscal: optionalStringField,
    contaId: optionalStringField,
    cartaoId: optionalStringField,
    observacao: optionalStringField,
    recorrente: z.boolean().default(false),
    periodicidade: z.string().optional().default("mensal"),
  })
  .refine(
    (data) => {
      if (data.status === "Pago") {
        return !!(data.contaId || data.cartaoId);
      }
      return true;
    },
    {
      message: "Para despesas pagas, selecione a Conta ou Cartão de Crédito.",
      path: ["contaId"],
    }
  )
  .refine(
    (data) => {
      if (data.contaId && data.cartaoId) return false;
      return true;
    },
    {
      message: "Selecione apenas Conta OU Cartão, não ambos.",
      path: ["cartaoId"],
    }
  );

export type DespesaFormData = z.infer<typeof despesaSchema>;

export const despesaDefaultValues: DespesaFormData = {
  dataVencimento: new Date(),
  descricao: "",
  valorTotal: "",
  status: "Pendente",
  parcelas: "1",
  categoriaId: "",
  formaPagamento: "",
  fornecedorId: "",
  projetoID: "",
  notaFiscal: "",
  contaId: "",
  cartaoId: "",
  observacao: "",
  recorrente: false,
  periodicidade: "mensal",
};
