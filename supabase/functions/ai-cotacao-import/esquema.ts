import { z } from "../_shared/schemas.ts";

export const MIME_PERMITIDOS = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
// Teto de tamanho do arquivo (base64). ~8MB de binário ≈ 11.2M chars base64.
export const MAX_BASE64_CHARS = 11_200_000;

export const ItemSchema = z.object({
  descricao: z.string().min(1),
  quantidade: z.number().nonnegative().nullable().optional(),
  unidade: z.string().nullable().optional(),
  preco_unitario: z.number().nonnegative().nullable().optional(),
  valor_total: z.number().nonnegative(),
});

// O modelo às vezes devolve o array na raiz em vez do objeto. Este preprocess
// embrulha o array na chave certa antes de validar.
export const embrulhaSeArray = (chave: string) => (v: unknown) => (Array.isArray(v) ? { [chave]: v } : v);

export const CestaObjSchema = z.object({
  fornecedor_nome: z.string().nullable().optional(),
  itens: z.array(ItemSchema).default([]),
  avisos: z.array(z.string()).default([]),
});
export const CestaSchema = z.preprocess(embrulhaSeArray("itens"), CestaObjSchema);

export const ItemUnicoSchema = z.object({
  fornecedor_nome: z.string().nullable().optional(),
  valor_total: z.number().nonnegative(),
  prazo_entrega_dias: z.number().int().nonnegative().nullable().optional(),
  condicao_pagamento: z.string().nullable().optional(),
  avisos: z.array(z.string()).default([]),
});

// Comparativo: uma proposta por LOJA (coluna), com preço à vista e parcelado.
export const PropostaComparativaSchema = z.object({
  fornecedor_nome: z.string().min(1),
  quantidade: z.number().positive().nullable().optional(),
  unidade: z.string().nullable().optional(),
  valor_a_vista: z.number().nonnegative(),
  valor_parcelado: z.number().nonnegative().nullable().optional(),
  condicao_pagamento: z.string().nullable().optional(),
  confianca: z.number().min(0).max(1).default(0.7),
});
export const ComparativoObjSchema = z.object({
  item_nome: z.string().nullable().optional(),
  propostas: z.array(PropostaComparativaSchema).default([]),
  avisos: z.array(z.string()).default([]),
});
export const ComparativoSchema = z.preprocess(embrulhaSeArray("propostas"), ComparativoObjSchema);

export const ClassificacaoSchema = z.object({
  tipo: z.enum(["comparativo", "cesta"]),
  confianca: z.number().min(0).max(1).default(0.7),
  motivo: z.string().nullable().optional(),
});

// O contexto (nome do item, obra) vai para o prompt: texto curto, sem quebra de linha.
export const MAX_CONTEXTO_CHARS = 500;
export type ModoPedido = "item" | "cesta" | "comparativo" | "auto";

export function lerEntrada(
  corpo: unknown
):
  | { ok: true; mimeType: string; arquivoBase64: string; modoPedido: ModoPedido; contexto: string }
  | { ok: false; error: string } {
  const b = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  const mimeType = typeof b.mimeType === "string" ? b.mimeType : "";
  const arquivoBase64 = typeof b.arquivoBase64 === "string" ? b.arquivoBase64 : "";
  const modoPedido: ModoPedido = b.modo === "item" || b.modo === "cesta" || b.modo === "comparativo" ? b.modo : "auto";
  const contexto =
    typeof b.contexto === "string" ? b.contexto.replace(/\s+/g, " ").trim().slice(0, MAX_CONTEXTO_CHARS) : "";

  if (!arquivoBase64) return { ok: false, error: "Nenhum arquivo enviado" };
  if (!MIME_PERMITIDOS.includes(mimeType)) {
    return { ok: false, error: "Formato não suportado. Envie PDF, PNG, JPG ou WebP." };
  }
  if (arquivoBase64.length > MAX_BASE64_CHARS) {
    return { ok: false, error: "Arquivo grande demais (máx. 8 MB). Reduza ou divida o orçamento." };
  }
  return { ok: true, mimeType, arquivoBase64, modoPedido, contexto };
}
