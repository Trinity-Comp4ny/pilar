import { z } from "zod";
import {
  dataVencimentoField,
  descricaoField,
  valorCurrencyField,
  parcelasField,
  optionalStringField,
} from "./financialFields";

export const receitaSchema = z
  .object({
    dataVencimento: dataVencimentoField,
    descricao: descricaoField,
    valorTotal: valorCurrencyField,
    status: z.enum(["Recebida", "Pendente"]).default("Pendente"),
    parcelas: parcelasField,
    projetoID: optionalStringField,
    categoriaId: optionalStringField,
    formaPagamento: optionalStringField,
    notaFiscal: optionalStringField,
    contaId: optionalStringField,
    clienteId: optionalStringField,
    observacao: optionalStringField,
    recorrencia: z.string().default("Nenhuma"),
  })
  .refine(
    (data) => {
      if (data.status === "Recebida") {
        return !!data.contaId;
      }
      return true;
    },
    {
      message: "Para receitas recebidas, selecione a Conta de destino.",
      path: ["contaId"],
    }
  );

export type ReceitaFormData = z.infer<typeof receitaSchema>;

export const receitaDefaultValues: ReceitaFormData = {
  dataVencimento: new Date(),
  descricao: "",
  valorTotal: "",
  status: "Pendente",
  parcelas: "1",
  projetoID: "",
  categoriaId: "",
  formaPagamento: "",
  notaFiscal: "",
  contaId: "",
  clienteId: "",
  observacao: "",
  recorrencia: "Nenhuma",
};
