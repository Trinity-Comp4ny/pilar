import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { captureException, withSentry } from "../_shared/sentry.ts";
import { jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { getRateLimitKey, RateLimiter } from "../_shared/rate-limiter.ts";
import { fromBrasilApi, fromViaCep, type CepResult } from "./providers.ts";

// Busca de CEP sem autenticação (usado no checkout pré-login). BrasilAPI
// primeiro, ViaCEP como fallback se cair, mudar de formato, ou não achar o
// CEP na primeira base. Ver ADR 0033.

const limiter = new RateLimiter(30, 60_000);

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
