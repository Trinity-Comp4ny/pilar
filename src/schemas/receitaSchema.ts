import { z } from "zod";

export const receitaSchema = z.object({
  dataVencimento: z.date({ required_error: "Data é obrigatória" }),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  valorTotal: z.string().min(1, "Valor é obrigatório"),
  status: z.enum(["Recebida", "Pendente"]).default("Recebida"),
  parcelas: z.string().default("1"),
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
  valorTotal: "R$ 0,00",
  status: "Recebida",
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
