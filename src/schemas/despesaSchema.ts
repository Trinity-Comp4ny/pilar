import { z } from "zod";
import { parseCurrencyString } from "@/lib/currencyUtils";

export const despesaSchema = z.object({
  dataVencimento: z.date({ required_error: "Data é obrigatória" }),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  valorTotal: z.string().min(1, "Valor é obrigatório").refine(
    (val) => {
      const parsed = parseCurrencyString(val);
      return parsed > 0;
    },
    { message: "Valor deve ser maior que zero" }
  ),
  status: z.enum(["Pago", "Pendente"]).default("Pendente"),
  parcelas: z.string().default("1").refine(
    (val) => {
      const num = parseInt(val);
      return num >= 1 && num <= 60;
    },
    { message: "Parcelas deve ser entre 1 e 60" }
  ),
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
).refine(
  (data) => {
    // Se tem cartão, não pode ter conta (e vice-versa)
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
  recorrencia: "Nenhuma",
};
