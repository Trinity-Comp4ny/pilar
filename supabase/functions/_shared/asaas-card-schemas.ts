/**
 * Validação de payload de cartão de crédito pro Asaas de plataforma. Usado
 * por pilar-token-pack-create (cobrança avulsa) e ativar-plano (tokenização
 * sem cobrança, SPEC 098 Fase 2B) — mesmo shape nos dois casos.
 */

import { z } from "./schemas.ts";

export const creditCardSchema = z.object({
  holderName: z.string().trim().min(2).max(200),
  number: z.string().regex(/^\d{13,19}$/, "número de cartão inválido"),
  expiryMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, "mês inválido"),
  expiryYear: z.string().regex(/^\d{4}$/, "ano inválido"),
  ccv: z.string().regex(/^\d{3,4}$/, "CCV inválido"),
});

export const creditCardHolderInfoSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().toLowerCase().email(),
  cpfCnpj: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 11 || v.length === 14, "CPF/CNPJ inválido"),
  postalCode: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 8, "CEP inválido"),
  addressNumber: z.string().trim().min(1).max(20),
  phone: z.string().trim().max(20).optional(),
});
