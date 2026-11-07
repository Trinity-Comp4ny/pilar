import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";
import { jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { getClientKey, limitarOuResponder } from "../_shared/db-rate-limit.ts";
import { lerInteresseDemo } from "./entrada.ts";

// Clique em "Agendar demonstração" na landing (SPEC 149): grava de onde veio o
// visitante (Google, ChatGPT, LinkedIn...) em demo_interesses. Público e sem
// login; a landing manda por sendBeacon (text/plain, sem preflight). Sem dado
// pessoal, com limite por IP para não virar vetor de spam.

serve(
  withSentry("registrar-interesse-demo", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const texto = (await req.text().catch(() => "")).slice(0, 4000);
    const interesse = lerInteresseDemo(texto);
    if (!interesse) return safeErrorResponse(400, "Corpo inválido", req);

    const svc = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const bloqueio = await limitarOuResponder(svc, req, {
      bucket: "demo_interesse",
      key: getClientKey(req),
      max: 20,
      windowSeconds: 3600,
    });
    if (bloqueio) return bloqueio;

    const { error } = await svc.from("demo_interesses").insert(interesse);
    if (error) return safeErrorResponse(500, "Falha ao registrar", req);

    return jsonResponse({ ok: true }, 200, req);
  })
);
