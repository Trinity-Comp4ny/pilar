import { z } from "zod";
import { parseCurrencyString } from "@/lib/currencyUtils";

export const receitaSchema = z.object({
  dataVencimento: z.date({ required_error: "Data é obrigatória" }),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  valorTotal: z.string().min(1, "Valor é obrigatório").refine(
    (val) => {
      const parsed = parseCurrencyString(val);
      return parsed > 0;
    },
    { message: "Valor deve ser maior que zero" }
  ),
  status: z.enum(["Recebida", "Pendente"]).default("Pendente"),
  parcelas: z.string().default("1").refine(
    (val) => {
      const num = parseInt(val);
      return num >= 1 && num <= 60;
    },
    { message: "Parcelas deve ser entre 1 e 60" }
  ),
  projetoID: z.string().optional().default(""),
  categoriaId: z.string().optional().default(""),
  formaPagamento: z.string().optional().default(""),
  notaFiscal: z.string().optional().default(""),
  contaId: z.string().optional().default(""),
  clienteId: z.string().optional().default(""),
  observacao: z.string().optional().default(""),
  recorrencia: z.string().default("Nenhuma"),
});

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
