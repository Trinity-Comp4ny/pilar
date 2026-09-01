/**
 * pilar-token-pack-create — compra avulsa de pacote de tokens (SPEC 077, Fase 3
 * do motor de tokens). Sistema B (Asaas da plataforma).
 *
 * Deploy: supabase functions deploy pilar-token-pack-create
 * (JWT obrigatório — só admin da própria empresa)
 *
 * Cria a cobrança avulsa no Asaas; o crédito no ledger só acontece na confirmação
 * de pagamento, processada por pilar-checkout-webhook.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { createPayment, getPixQrCode, type AsaasPayment } from "../_shared/asaas-platform.ts";
import { createLogger } from "../_shared/logger.ts";
import { checkDbRateLimit, getClientKey } from "../_shared/db-rate-limit.ts";
import { parseOr400, z } from "../_shared/schemas.ts";

const log = createLogger("pilar-token-pack-create");

// Números fixados em DECISOES.md 2026-09-01 (MOTOR_DE_TOKENS.md §3). Mudar exige
// decisão própria, não só editar esta constante.
const TOKENS_POR_PACOTE = 500_000;
const VALOR_CENTAVOS_POR_PACOTE = 4900;

const creditCardSchema = z.object({
  holderName: z.string().trim().min(2).max(200),
  number: z.string().regex(/^\d{13,19}$/, "número de cartão inválido"),
  expiryMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, "mês inválido"),
  expiryYear: z.string().regex(/^\d{4}$/, "ano inválido"),
  ccv: z.string().regex(/^\d{3,4}$/, "CCV inválido"),
});

const holderInfoSchema = z.object({
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

const purchaseSchema = z
  .object({
    quantidade_pacotes: z.number().int().min(1).max(20),
    billing_type: z.enum(["CREDIT_CARD", "PIX", "BOLETO"]),
    credit_card: creditCardSchema.optional(),
    credit_card_holder_info: holderInfoSchema.optional(),
  })
  .refine(
    (v) => v.billing_type !== "CREDIT_CARD" || (v.credit_card && v.credit_card_holder_info),
    { message: "Dados do cartão e do titular são obrigatórios para CREDIT_CARD" }
  );

type PurchasePayload = z.infer<typeof purchaseSchema>;

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

serve(
  withSentry("pilar-token-pack-create", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, req);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Token obrigatório" }, 401, req);
    }

    const userClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // --- Auth + role ---
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();

    if (userErr || !user) {
      return jsonResponse({ error: "Não autenticado" }, 401, req);
    }

    const { data: profile } = await admin.from("profiles").select("empresa_id, role").eq("id", user.id).maybeSingle();

    const isAdmin = profile?.role === "admin" || profile?.role === "ultra_admin";
    if (!profile?.empresa_id || !isAdmin) {
      return jsonResponse({ error: "Apenas admin da empresa pode comprar tokens" }, 403, req);
    }

    // --- Rate limit por empresa (DB, atômico cross-instance) ---
    const rl = await checkDbRateLimit(admin, {
      bucket: "token_pack_create",
      key: getClientKey(req, profile.empresa_id),
      max: 10,
      windowSeconds: 3600,
    });
    if (rl.rpcError) {
      log.error("rate limit check failed — rejecting request (fail-closed)", { rpcError: rl.rpcError });
      return jsonResponse({ error: "Serviço temporariamente indisponível. Tente novamente em instantes." }, 503, req);
    }
    if (!rl.allowed) {
      return jsonResponse({ error: "Muitas tentativas. Aguarde antes de tentar novamente." }, 429, req);
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonResponse({ error: "JSON inválido" }, 400, req);
    }

    const parsed = parseOr400(purchaseSchema, raw);
    if (!parsed.ok) return jsonResponse({ error: parsed.error }, 400, req);
    const body: PurchasePayload = parsed.data;

    // --- Empresa precisa ter cobrança ativa no Sistema B (fora de escopo: isenta) ---
    const { data: sub } = await admin
      .from("pilar_subscriptions")
      .select("asaas_customer_id")
      .eq("empresa_id", profile.empresa_id)
      .maybeSingle();

    if (!sub?.asaas_customer_id) {
      return jsonResponse(
        {
          error:
            "Sua empresa ainda não tem cobrança ativa. Fale com o suporte para ativar antes de comprar tokens.",
        },
        400,
        req
      );
    }

    const valorCentavos = body.quantidade_pacotes * VALOR_CENTAVOS_POR_PACOTE;
    const valor = valorCentavos / 100;

    // --- Cria a compra pendente ANTES do Asaas (mesmo padrão do checkout de
    // signup: se a chamada ao Asaas falhar no meio, já existe uma linha que o
    // webhook consegue achar por id/asaas_payment_id) ---
    const { data: purchase, error: purchaseErr } = await admin
      .from("pilar_token_pack_purchases")
      .insert({
        empresa_id: profile.empresa_id,
        user_id: user.id,
        quantidade_pacotes: body.quantidade_pacotes,
        tokens_pacote: TOKENS_POR_PACOTE,
        valor_centavos: valorCentavos,
        billing_type: body.billing_type,
        status: "pending",
      })
      .select("id")
      .single();

    if (purchaseErr || !purchase) {
      log.error("purchase insert failed", purchaseErr, { empresa_id: profile.empresa_id });
      return jsonResponse({ error: "Erro ao iniciar compra" }, 500, req);
    }

    // --- Asaas: cobrança avulsa ---
    const remoteIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

    let payment: AsaasPayment;
    try {
      payment = await createPayment({
        customer: sub.asaas_customer_id,
        billingType: body.billing_type,
        value: valor,
        dueDate: todayISO(),
        description: `Pilar — ${body.quantidade_pacotes} pacote(s) de ${TOKENS_POR_PACOTE.toLocaleString("pt-BR")} tokens`,
        externalReference: purchase.id,
        ...(body.billing_type === "CREDIT_CARD" && body.credit_card && body.credit_card_holder_info
          ? { creditCard: body.credit_card, creditCardHolderInfo: body.credit_card_holder_info, remoteIp }
          : {}),
      });
    } catch (err) {
      await admin.from("pilar_token_pack_purchases").update({ status: "failed" }).eq("id", purchase.id);

      const msg = err instanceof Error ? err.message : "Erro Asaas";
      return jsonResponse({ error: `Falha ao criar cobrança: ${msg}` }, 502, req);
    }

    // --- Metadata para o front renderizar ---
    const metadata: Record<string, unknown> = {
      billing_type: body.billing_type,
      value: valor,
      payment_id: payment.id,
      invoice_url: payment.invoiceUrl ?? null,
    };

    if (body.billing_type === "PIX") {
      try {
        const qr = await getPixQrCode(payment.id);
        metadata.pix = {
          encoded_image: qr.encodedImage,
          payload: qr.payload,
          expiration_date: qr.expirationDate,
        };
      } catch (err) {
        log.warn("pix qr failed", { purchase_id: purchase.id, payment_id: payment.id, err: String(err) });
      }
    }

    if (body.billing_type === "BOLETO") {
      metadata.boleto = {
        bank_slip_url: payment.bankSlipUrl ?? null,
        identification_field: payment.identificationField ?? null,
        nosso_numero: payment.nossoNumero ?? null,
      };
    }

    const initialStatus = payment.status === "CONFIRMED" || payment.status === "RECEIVED" ? "paid" : "pending";

    await admin
      .from("pilar_token_pack_purchases")
      .update({
        asaas_payment_id: payment.id,
        payment_metadata: metadata,
        status: initialStatus,
        paid_at: initialStatus === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", purchase.id);

    return jsonResponse(
      {
        success: true,
        purchase_id: purchase.id,
        billing_type: body.billing_type,
        payment_status: initialStatus,
        tokens: body.quantidade_pacotes * TOKENS_POR_PACOTE,
        value: valor,
        metadata,
      },
      200,
      req
    );
  })
);
