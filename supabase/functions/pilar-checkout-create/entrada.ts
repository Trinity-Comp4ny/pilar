import { cpfCnpjSchema, emailSchema, nameSchema, phoneSchema, z } from "../_shared/schemas.ts";

export const creditCardSchema = z.object({
  holderName: z.string().trim().min(2).max(200),
  number: z.string().regex(/^\d{13,19}$/, "número de cartão inválido"),
  expiryMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, "mês inválido"),
  expiryYear: z.string().regex(/^\d{4}$/, "ano inválido"),
  ccv: z.string().regex(/^\d{3,4}$/, "CCV inválido"),
});

export const holderInfoSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: emailSchema,
  cpfCnpj: cpfCnpjSchema,
  postalCode: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 8, "CEP inválido"),
  addressNumber: z.string().trim().min(1).max(20),
  phone: phoneSchema,
});

export const checkoutSchema = z
  .object({
    email: emailSchema,
    nome: nameSchema,
    company_name: nameSchema,
    cpf_cnpj: cpfCnpjSchema,
    telefone: phoneSchema,
    plan_slug: z.string().trim().min(1).max(64),
    billing_cycle: z.enum(["monthly", "yearly"]),
    billing_type: z.enum(["CREDIT_CARD", "PIX", "BOLETO"]),
    credit_card: creditCardSchema.optional(),
    credit_card_holder_info: holderInfoSchema.optional(),
  })
  .refine((v) => v.billing_type !== "CREDIT_CARD" || (v.credit_card && v.credit_card_holder_info), {
    message: "Dados do cartão e do titular são obrigatórios para CREDIT_CARD",
  });

export type CheckoutPayload = z.infer<typeof checkoutSchema>;

/** Mensagem do Asaas quando o banco emissor recusa o cartão (não é falha da plataforma). */
export function cartaoRecusado(mensagem: string): boolean {
  return /transa[cç][aã]o n[aã]o autorizada/i.test(mensagem);
}
