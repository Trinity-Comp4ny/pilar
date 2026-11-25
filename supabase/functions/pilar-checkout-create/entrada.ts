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
    billing_type: z.enum(["CREDIT_CARD", "PIX", "BOLETO", "PIX_AUTOMATICO"]),
    credit_card: creditCardSchema.optional(),
    credit_card_holder_info: holderInfoSchema.optional(),
    // Origem do visitante, repassada pela landing. Informativa: nunca bloqueia a compra.
    canal: z.string().optional(),
    origem: z.record(z.unknown()).optional(),
  })
  .refine((v) => v.billing_type !== "CREDIT_CARD" || (v.credit_card && v.credit_card_holder_info), {
    message: "Dados do cartão e do titular são obrigatórios para CREDIT_CARD",
  });

export type CheckoutPayload = z.infer<typeof checkoutSchema>;

/** Mensagem do Asaas quando o banco emissor recusa o cartão (não é falha da plataforma). */
export function cartaoRecusado(mensagem: string): boolean {
  return /transa[cç][aã]o n[aã]o autorizada/i.test(mensagem);
}

const CHAVES_ORIGEM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "ref"];

/**
 * Canal e UTMs que a landing repassou. Dado informado pelo cliente e só
 * informativo: o que não bate com o formato é descartado, nunca vira erro de compra.
 */
export function origemDoCheckout(body: { canal?: string; origem?: Record<string, unknown> }): {
  canal: string | null;
  origem: Record<string, string> | null;
} {
  const canal = body.canal?.trim().toLowerCase() ?? "";
  const origem: Record<string, string> = {};
  for (const chave of CHAVES_ORIGEM) {
    const v = body.origem?.[chave];
    if (typeof v === "string" && v.trim()) origem[chave] = v.trim().slice(0, 200);
  }
  return {
    canal: /^[a-z0-9_.-]{1,40}$/.test(canal) ? canal : null,
    origem: Object.keys(origem).length > 0 ? origem : null,
  };
}
