import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("turnstile-verify");

// Verifica token Cloudflare Turnstile server-side
// Necessário env TURNSTILE_SECRET_KEY

serve(
  withSentry("turnstile-verify", async (req) => {
    const corsHeaders = getCorsHeaders(req);

    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
      if (!secret) {
        // Fail-closed: sem secret configurado não dá pra verificar nada, então dizer
        // "success" mascarava a falta de configuração em vez de acusá-la (achado do
        // estudo de arquitetura de 2026-08-17). O smoke test do Checkly precisa de um
        // sinal de falha real aqui, não um 200 que nunca detecta a variável ausente.
        log.error("TURNSTILE_SECRET_KEY ausente — verificação indisponível");
        return new Response(JSON.stringify({ success: false, error: "turnstile-not-configured" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { token } = await req.json();
      if (!token || typeof token !== "string") {
        return new Response(JSON.stringify({ success: false, error: "missing-token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "";

      const form = new URLSearchParams();
      form.append("secret", secret);
      form.append("response", token);
      if (ip) form.append("remoteip", ip);

      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: form,
      });
      const result = (await res.json()) as { success: boolean; "error-codes"?: string[] };

      return new Response(JSON.stringify({ success: result.success }), {
        status: result.success ? 200 : 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: unknown) {
      log.error("turnstile verification failed", error);
      return new Response(JSON.stringify({ success: false, error: "internal" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  })
);
