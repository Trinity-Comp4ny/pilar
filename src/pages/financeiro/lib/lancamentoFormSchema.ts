import { z } from "zod";
import { parseCurrencyString } from "@/lib/currencyUtils";
import type { TipoLancamento } from "../hooks/useLancamentosUnified";

export const schema = z
  .object({
    descricao: z.string().min(1, "Descrição obrigatória"),
    valorTotal: z
      .string()
      .min(1, "Valor obrigatório")
      .refine((v) => parseCurrencyString(v) > 0, "Valor deve ser maior que zero"),
    dataVencimento: z.date({ required_error: "Data obrigatória" }),
    status: z.string(),
    formaPagamento: z.string().optional().default(""),
    parcelas: z
      .string()
      .optional()
      .default("1")
      .refine((v) => {
        const n = parseInt(v || "1", 10);
        return Number.isInteger(n) && n >= 1 && n <= 60;
      }, "Parcelas deve ser entre 1 e 60"),
    categoriaId: z.string().optional().default(""),
    projetoId: z.string().optional().default(""),
    contaId: z.string().optional().default(""),
    cartaoId: z.string().optional().default(""),
    clienteId: z.string().optional().default(""),
    fornecedorId: z.string().optional().default(""),
    centroCustoId: z.string().optional().default(""),
    dataCompetencia: z.date().optional(),
    notaFiscal: z.string().optional().default(""),
    observacao: z.string().optional().default(""),
    recorrente: z.boolean().optional().default(false),
    periodicidade: z.string().optional().default("mensal"),
  })
  .refine(
    (d) => {
      if (d.status === "Recebida" || d.status === "Pago") return !!(d.contaId || d.cartaoId);
      return true;
    },
    { message: "Conta obrigatória para lançamentos efetivados", path: ["contaId"] }
  )
  .refine((d) => !(d.contaId && d.cartaoId), { message: "Selecione apenas Conta OU Cartão", path: ["cartaoId"] });

export type FormData = z.infer<typeof schema>;

export const defaultValues = (tipo: TipoLancamento): FormData => ({
  descricao: "",
  valorTotal: "",
  dataVencimento: new Date(),
  status: tipo === "receita" ? "Pendente" : "Pendente",
  formaPagamento: "",
  parcelas: "1",
  categoriaId: "",
  projetoId: "",
  contaId: "",
  cartaoId: "",
  clienteId: "",
  fornecedorId: "",
  centroCustoId: "",
  dataCompetencia: undefined,
  notaFiscal: "",
  observacao: "",
  recorrente: false,
  periodicidade: "mensal",
});
