/**
 * pilar-checkout-create — endpoint público de checkout da plataforma Pilar.
 *
 * Deploy: supabase functions deploy pilar-checkout-create --no-verify-jwt
 *
 * Cria pending_signup + customer Asaas + subscription recorrente.
 * Retorna payload pro front renderizar a confirmação (cartão) ou PIX/boleto embed.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, jsonResponse, optionsResponse } from "../_shared/cors.ts";
import {
  createCustomer,
  createSubscription,
  findCustomerByCpfCnpj,
  getPixQrCode,
  getSubscriptionPayments,
  type AsaasPayment,
} from "../_shared/asaas-platform.ts";

interface CheckoutPayload {
  email: string;
  nome: string;
  company_name: string;
  cpf_cnpj: string;
  telefone?: string;
  plan_slug: string;
  billing_cycle: "monthly" | "yearly";
  billing_type: "CREDIT_CARD" | "PIX" | "BOLETO";
  credit_card?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  credit_card_holder_info?: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone?: string;
  };
}

function validCpfCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 || digits.length === 14;
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, req);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  let body: CheckoutPayload;
  try {
    body = (await req.json()) as CheckoutPayload;
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400, req);
  }

  // --- Validação ---
  const email = body.email?.trim().toLowerCase();
  if (!email || !validEmail(email)) {
    return jsonResponse({ error: "Email inválido" }, 400, req);
  }
  if (!body.nome || body.nome.trim().length < 2) {
    return jsonResponse({ error: "Nome obrigatório" }, 400, req);
  }
  if (!body.company_name || body.company_name.trim().length < 2) {
    return jsonResponse({ error: "Nome da empresa obrigatório" }, 400, req);
  }
  if (!validCpfCnpj(body.cpf_cnpj)) {
    return jsonResponse({ error: "CPF/CNPJ inválido" }, 400, req);
  }
  if (!["CREDIT_CARD", "PIX", "BOLETO"].includes(body.billing_type)) {
    return jsonResponse({ error: "Forma de pagamento inválida" }, 400, req);
  }
  if (!["monthly", "yearly"].includes(body.billing_cycle)) {
    return jsonResponse({ error: "Ciclo inválido" }, 400, req);
  }
  if (body.billing_type === "CREDIT_CARD") {
    if (!body.credit_card?.number || !body.credit_card.ccv) {
      return jsonResponse({ error: "Dados do cartão ausentes" }, 400, req);
    }
    if (!body.credit_card_holder_info?.cpfCnpj || !body.credit_card_holder_info.postalCode) {
      return jsonResponse({ error: "Dados do titular ausentes" }, 400, req);
    }
  }

  // --- Rate limit por IP ---
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  try {
    const { data: rlAllowed } = await admin.rpc("check_rate_limit", {
      p_action: "checkout_create",
      p_key: clientIp,
      p_max_attempts: 5,
      p_window_seconds: 3600,
    });
    if (rlAllowed === false) {
      return jsonResponse({ error: "Muitas tentativas. Aguarde antes de tentar novamente." }, 429, req);
    }
  } catch {
    // falha no rate limit não bloqueia — log e segue
    console.warn("[pilar-checkout-create] rate limit check failed");
  }

  // --- Email já existe? ---
  try {
    const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();

    if (existing) {
      return jsonResponse({ error: "Já existe uma conta com esse email. Faça login em /login." }, 409, req);
    }
  } catch {
    // segue
  }

  // --- Signup pendente duplicado? ---
  try {
    const { data: pendingSignup } = await admin
      .from("pilar_pending_signups")
      .select("id, payment_status")
      .eq("email", email)
      .eq("payment_status", "pending")
      .maybeSingle();

    if (pendingSignup) {
      return jsonResponse(
        {
          error:
            "Já existe um checkout em andamento com esse email. Verifique sua caixa de entrada ou aguarde alguns minutos.",
        },
        409,
        req
      );
    }
  } catch {
    // segue
  }

  // --- Plano ---
  const { data: plan, error: planErr } = await admin
    .from("pilar_subscription_plans")
    .select("id, slug, nome, preco_mensal, preco_anual, ativo")
    .eq("slug", body.plan_slug)
    .eq("ativo", true)
    .maybeSingle();

  if (planErr || !plan) {
    return jsonResponse({ error: "Plano não encontrado" }, 404, req);
  }

  const value = body.billing_cycle === "yearly" ? plan.preco_anual : plan.preco_mensal;
  if (!value || value <= 0) {
    return jsonResponse({ error: "Valor do plano indisponível" }, 400, req);
  }

  // --- Cria pending_signup (antes do Asaas, pra ter externalReference) ---
  const { data: signup, error: signupErr } = await admin
    .from("pilar_pending_signups")
    .insert({
      email,
      nome: body.nome.trim(),
      company_name: body.company_name.trim(),
      cpf_cnpj: body.cpf_cnpj.replace(/\D/g, ""),
      telefone: body.telefone?.replace(/\D/g, "") ?? null,
      plan_id: plan.id,
      billing_cycle: body.billing_cycle,
      billing_type: body.billing_type,
      payment_status: "pending",
    })
    .select("id, checkout_session_token")
    .single();

  if (signupErr || !signup) {
    console.error("[pilar-checkout-create] signup insert failed", signupErr);
    return jsonResponse({ error: "Erro ao iniciar checkout" }, 500, req);
  }

  // --- Asaas: customer ---
  let customerId: string;
  try {
    const existing = await findCustomerByCpfCnpj(body.cpf_cnpj);
    if (existing) {
      customerId = existing.id;
    } else {
      const created = await createCustomer({
        name: body.nome.trim(),
        email,
        cpfCnpj: body.cpf_cnpj,
        phone: body.telefone ?? undefined,
        externalReference: `signup:${signup.id}`,
      });
      customerId = created.id;
    }
  } catch (err) {
    await admin.from("pilar_pending_signups").update({ payment_status: "failed" }).eq("id", signup.id);

    const msg = err instanceof Error ? err.message : "Erro Asaas";
    return jsonResponse({ error: `Falha ao criar cliente: ${msg}` }, 502, req);
  }

  await admin.from("pilar_pending_signups").update({ asaas_customer_id: customerId }).eq("id", signup.id);

  // --- Asaas: subscription ---
  const remoteIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

  let subscriptionId: string;
  let firstPayment: AsaasPayment | null = null;

  try {
    const sub = await createSubscription({
      customer: customerId,
      billingType: body.billing_type,
      value,
      cycle: body.billing_cycle === "yearly" ? "YEARLY" : "MONTHLY",
      nextDueDate: todayISO(),
      description: `Pilar ${plan.nome} — assinatura ${body.billing_cycle === "yearly" ? "anual" : "mensal"}`,
      externalReference: signup.id,
      ...(body.billing_type === "CREDIT_CARD" && body.credit_card && body.credit_card_holder_info
        ? {
            creditCard: body.credit_card,
            creditCardHolderInfo: body.credit_card_holder_info,
            remoteIp,
          }
        : {}),
    });
    subscriptionId = sub.id;

    const payments = await getSubscriptionPayments(subscriptionId);
    firstPayment = payments[0] ?? null;
  } catch (err) {
    await admin.from("pilar_pending_signups").update({ payment_status: "failed" }).eq("id", signup.id);

    const msg = err instanceof Error ? err.message : "Erro Asaas";
    return jsonResponse({ error: `Falha ao criar assinatura: ${msg}` }, 502, req);
  }

  // --- Metadata para o front renderizar ---
  const metadata: Record<string, unknown> = {
    billing_type: body.billing_type,
    value,
    cycle: body.billing_cycle,
    payment_id: firstPayment?.id ?? null,
    invoice_url: firstPayment?.invoiceUrl ?? null,
  };

  if (body.billing_type === "PIX" && firstPayment) {
    try {
      const qr = await getPixQrCode(firstPayment.id);
      metadata.pix = {
        encoded_image: qr.encodedImage,
        payload: qr.payload,
        expiration_date: qr.expirationDate,
      };
    } catch (err) {
      console.warn("[pilar-checkout-create] pix qr failed", err);
    }
  }

  if (body.billing_type === "BOLETO" && firstPayment) {
    metadata.boleto = {
      bank_slip_url: firstPayment.bankSlipUrl ?? null,
      identification_field: firstPayment.identificationField ?? null,
      nosso_numero: firstPayment.nossoNumero ?? null,
    };
  }

  // Status inicial — cartão aprovado na hora atualiza já aqui
  const initialStatus =
    body.billing_type === "CREDIT_CARD" && (firstPayment?.status === "CONFIRMED" || firstPayment?.status === "RECEIVED")
      ? "paid"
      : "pending";

  await admin
    .from("pilar_pending_signups")
    .update({
      asaas_subscription_id: subscriptionId,
      asaas_payment_id: firstPayment?.id ?? null,
      payment_metadata: metadata,
      payment_status: initialStatus,
      paid_at: initialStatus === "paid" ? new Date().toISOString() : null,
    })
    .eq("id", signup.id);

  return jsonResponse(
    {
      success: true,
      session_token: signup.checkout_session_token,
      billing_type: body.billing_type,
      payment_status: initialStatus,
      plan: {
        slug: plan.slug,
        nome: plan.nome,
        cycle: body.billing_cycle,
        value,
      },
      metadata,
    },
    200,
    req
  );
});
