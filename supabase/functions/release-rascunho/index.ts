/**
 * release-rascunho: grava o rascunho das novidades de um release (SPEC 152).
 *
 * Deploy: supabase functions deploy release-rascunho --no-verify-jwt
 *
 *   POST /functions/v1/release-rascunho
 *   Authorization: Bearer <RELEASE_NOTAS_TOKEN>
 *   { "sha": "<commit de main>", "commits": [{ "sha": "...", "mensagem": "..." }] }
 *
 * Chamada pelo GitHub Actions no push em main (release). Lê as linhas `Novidade:` dos commits e
 * grava a release como rascunho; o ultra admin revisa e publica em /ultra-admin/releases.
 * Repetir a chamada é seguro: rascunho do mesmo sha é refeito, release já publicada não muda.
 * Sem nenhuma novidade nos commits, não cria nada.
 *
 * Resposta: { release_id: string | null, itens: number, avisos: string[], ignorado?: string }.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";
import { createLogger } from "../_shared/logger.ts";
import { cronAutorizado } from "../_shared/cron-auth.ts";
import { lerEntrada, lerNotas, tituloPadrao } from "./notas.ts";

const log = createLogger("release-rascunho");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RELEASE_NOTAS_TOKEN = Deno.env.get("RELEASE_NOTAS_TOKEN") ?? "";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

serve(
  withSentry("release-rascunho", async (req) => {
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
    if (!cronAutorizado(req.headers, RELEASE_NOTAS_TOKEN)) return json({ error: "unauthorized" }, 401);

    const entrada = lerEntrada(await req.json().catch(() => null));
    if (!entrada.ok) return json({ error: entrada.erro }, 400);

    const { itens, avisos } = lerNotas(entrada.commits);
    if (itens.length === 0) return json({ release_id: null, itens: 0, avisos }, 200);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: existente, error: erroBusca } = await admin
      .from("product_releases")
      .select("id, publicada_em")
      .eq("sha", entrada.sha)
      .maybeSingle();
    if (erroBusca) {
      log.error("falha ao buscar release", erroBusca);
      return json({ error: "falha ao gravar" }, 500);
    }
    if (existente?.publicada_em) {
      return json({ release_id: existente.id, itens: 0, avisos, ignorado: "release já publicada" }, 200);
    }

    let releaseId = existente?.id ?? null;
    if (!releaseId) {
      const { data: criada, error } = await admin
        .from("product_releases")
        .insert({ sha: entrada.sha, titulo: tituloPadrao(new Date()) })
        .select("id")
        .single();
      if (error || !criada) {
        log.error("falha ao criar release", error);
        return json({ error: "falha ao gravar" }, 500);
      }
      releaseId = criada.id;
    } else {
      // Rascunho refeito: os itens vêm de novo dos commits.
      const { error } = await admin.from("product_release_itens").delete().eq("release_id", releaseId);
      if (error) {
        log.error("falha ao limpar itens do rascunho", error);
        return json({ error: "falha ao gravar" }, 500);
      }
    }

    const { error: erroItens } = await admin
      .from("product_release_itens")
      .insert(itens.map((item, ordem) => ({ ...item, release_id: releaseId, ordem })));
    if (erroItens) {
      log.error("falha ao gravar itens", erroItens);
      return json({ error: "falha ao gravar" }, 500);
    }

    log.info("rascunho gravado", { release_id: releaseId, itens: itens.length, avisos: avisos.length });
    return json({ release_id: releaseId, itens: itens.length, avisos }, 200);
  })
);
