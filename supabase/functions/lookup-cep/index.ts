import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { captureException, withSentry } from "../_shared/sentry.ts";
import { jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { getRateLimitKey, RateLimiter } from "../_shared/rate-limiter.ts";

// Busca de CEP sem autenticação (usado no checkout pré-login). BrasilAPI
// primeiro, ViaCEP como fallback se cair, mudar de formato, ou não achar o
// CEP na primeira base. Ver ADR 0033.

const limiter = new RateLimiter(30, 60_000);

interface CepResult {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

const brasilApiSchema = z.object({
  cep: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  street: z.string().optional(),
  neighborhood: z.string().optional(),
});

const viaCepSchema = z.union([
  z.object({ erro: z.literal(true) }),
  z.object({
    cep: z.string().optional(),
    logradouro: z.string().optional(),
    bairro: z.string().optional(),
    localidade: z.string().min(1),
    uf: z.string().min(1),
  }),
]);

async function fromBrasilApi(cepDigits: string): Promise<CepResult | null> {
  const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepDigits}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`BrasilAPI retornou ${res.status}`);
  const raw = await res.json();
  const parsed = brasilApiSchema.safeParse(raw);
  if (!parsed.success) {
    await captureException(new Error("BrasilAPI: formato de resposta mudou"), {
      fn: "lookup-cep",
      tags: { provider: "brasilapi", reason: "shape-mismatch" },
      extra: { issues: parsed.error.issues, raw },
    });
    return null;
  }
  const d = parsed.data;
  return {
    cep: d.cep ?? cepDigits,
    street: d.street ?? "",
    neighborhood: d.neighborhood ?? "",
    city: d.city,
    state: d.state,
  };
}

async function fromViaCep(cepDigits: string): Promise<CepResult | null> {
  const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
  if (!res.ok) throw new Error(`ViaCEP retornou ${res.status}`);
  const raw = await res.json();
  const parsed = viaCepSchema.safeParse(raw);
  if (!parsed.success) {
    await captureException(new Error("ViaCEP: formato de resposta mudou"), {
      fn: "lookup-cep",
      tags: { provider: "viacep", reason: "shape-mismatch" },
      extra: { issues: parsed.error.issues, raw },
    });
    return null;
  }
  if ("erro" in parsed.data) return null;
  const d = parsed.data;
  return {
    cep: d.cep ?? cepDigits,
    street: d.logradouro ?? "",
    neighborhood: d.bairro ?? "",
    city: d.localidade,
    state: d.uf,
  };
}

serve(
  withSentry("lookup-cep", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const key = getRateLimitKey(req);
    if (!limiter.allow(key)) {
      return safeErrorResponse(429, "Rate limit excedido", req);
    }

    const body = (await req.json().catch(() => ({}))) as { cep?: string };
    const digits = (body.cep ?? "").replace(/\D/g, "");
    if (digits.length !== 8) {
      return jsonResponse({ error: "CEP inválido" }, 400, req);
    }

    let result: CepResult | null = null;
    try {
      result = await fromBrasilApi(digits);
    } catch (err) {
      await captureException(err, { fn: "lookup-cep", tags: { provider: "brasilapi", reason: "request-failed" } });
    }

    if (!result) {
      try {
        result = await fromViaCep(digits);
      } catch (err) {
        await captureException(err, { fn: "lookup-cep", tags: { provider: "viacep", reason: "request-failed" } });
      }
    }

    if (!result) {
      return jsonResponse({ found: false }, 200, req);
    }

    return jsonResponse({ found: true, ...result }, 200, req);
  })
);
