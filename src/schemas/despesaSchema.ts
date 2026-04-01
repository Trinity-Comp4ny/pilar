import { z } from "zod";

export const despesaSchema = z.object({
  dataVencimento: z.date({ required_error: "Data é obrigatória" }),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  valorTotal: z.string().min(1, "Valor é obrigatório"),
  status: z.enum(["Pago", "Pendente"]).default("Pago"),
  parcelas: z.string().default("1"),
  categoriaId: z.string().optional().default(""),
  formaPagamento: z.string().optional().default(""),
  fornecedorId: z.string().optional().default(""),
  projetoID: z.string().optional().default(""),
  notaFiscal: z.string().optional().default(""),
  contaId: z.string().optional().default(""),
  cartaoId: z.string().optional().default(""),
  observacao: z.string().optional().default(""),
  recorrencia: z.string().default("Nenhuma"),
}).refine(
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
);

export type DespesaFormData = z.infer<typeof despesaSchema>;

export const despesaDefaultValues: DespesaFormData = {
  dataVencimento: new Date(),
  descricao: "",
  valorTotal: "R$ 0,00",
  status: "Pago",
  parcelas: "1",
  categoriaId: "",
  formaPagamento: "",
  fornecedorId: "",
  projetoID: "",
  notaFiscal: "",
  contaId: "",
  cartaoId: "",
  observacao: "",
  recorrencia: "Nenhuma",
};
