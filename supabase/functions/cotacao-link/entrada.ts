import { validar, z } from "../_shared/schemas.ts";

// SPEC 144: o fornecedor abre o link sem login. O token vem no CORPO (nunca na URL, que cai em log)
// e tem o formato que o banco gera: 32 bytes em base64url, 43 caracteres.
const tokenSchema = z
  .string()
  .trim()
  .min(32, "Link inválido")
  .max(64, "Link inválido")
  .regex(/^[A-Za-z0-9_-]+$/, "Link inválido");

const valorSchema = z
  .number({ invalid_type_error: "Informe um valor válido" })
  .finite("Informe um valor válido")
  .gt(0, "O valor precisa ser maior que zero")
  .max(999_999_999, "Valor alto demais")
  .transform((v) => Math.round(v * 100) / 100);

const opcional = <T extends z.ZodTypeAny>(s: T) =>
  z
    .union([s, z.null()])
    .optional()
    .transform((v) => v ?? null);

export const consultarSchema = z.object({ acao: z.literal("consultar"), token: tokenSchema });

export const responderSchema = z.object({
  acao: z.literal("responder"),
  token: tokenSchema,
  valor: valorSchema,
  valor_parcelado: opcional(valorSchema),
  condicao_pagamento: z
    .string()
    .trim()
    .min(1, "Informe a condição de pagamento")
    .max(200, "Condição de pagamento longa demais"),
  desconto_pct: opcional(z.number().finite().min(0, "Desconto inválido").max(100, "Desconto inválido")),
  prazo_entrega_dias: z
    .number({ invalid_type_error: "Informe o prazo em dias" })
    .int("O prazo é um número inteiro de dias")
    .min(0, "Prazo inválido")
    .max(3650, "Prazo longo demais"),
  observacoes: opcional(z.string().trim().max(1000, "Observação longa demais")),
});

export const entradaSchema = z.discriminatedUnion("acao", [consultarSchema, responderSchema]);

export type Entrada = z.output<typeof entradaSchema>;

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);

/** Corpo máximo aceito: a resposta mais cheia cabe em poucas centenas de bytes. */
export const MAX_CORPO_BYTES = 8 * 1024;

/** SHA-256 em hex: o mesmo que o banco guarda em `token_hash`. */
export async function hashDoToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

type Json = Record<string, unknown>;
const texto = (v: unknown) => (typeof v === "string" ? v : null);
const numero = (v: unknown) => (typeof v === "number" ? v : null);

/**
 * Lista fixa do que sai para o fornecedor. O RPC já devolve só isto, mas a borda não repassa o
 * objeto: se uma coluna entrar no JSON por engano, ela não chega à página pública.
 */
export function saidaDaConsulta(rpc: unknown): Json {
  const r = (rpc ?? {}) as Json;
  if (r.ok !== true) return { ok: false };
  const atual = r.resposta_atual as Json | null | undefined;
  return {
    ok: true,
    empresa_nome: texto(r.empresa_nome),
    descricao: texto(r.descricao),
    quantidade: numero(r.quantidade),
    unidade: texto(r.unidade),
    prazo_necessidade: texto(r.prazo_necessidade),
    observacoes: texto(r.observacoes),
    expira_em: texto(r.expira_em),
    resposta_atual: atual
      ? {
          valor: numero(atual.valor),
          valor_parcelado: numero(atual.valor_parcelado),
          condicao_pagamento: texto(atual.condicao_pagamento),
          desconto_pct: numero(atual.desconto_pct),
          prazo_entrega_dias: numero(atual.prazo_entrega_dias),
          observacoes: texto(atual.observacoes),
        }
      : null,
  };
}
