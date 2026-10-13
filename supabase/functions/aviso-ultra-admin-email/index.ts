/**
 * aviso-ultra-admin-email: manda por e-mail, na hora, cada aviso de plataforma
 * que chega no sino de um ultra admin (SPEC 113): feedback do app, novo
 * cadastro, ativar plano bloqueado, e qualquer `notificar_ultra_admins` futuro.
 *
 * Deploy: supabase functions deploy aviso-ultra-admin-email --no-verify-jwt
 * Chamada pelo trigger AFTER INSERT de notificacoes (categoria sistema,
 * destinatário ultra admin) via pg_net, com:
 *   Authorization: Bearer <CRON_SECRET>
 *   POST { "notificacao_id": "<uuid>" }
 *
 * Um e-mail por notificação, fora do resumo do notificacoes-email-cron (que
 * filtra pela empresa do destinatário e mistura com alertas financeiros).
 * Idempotente: pula notificação já marcada e usa Idempotency-Key no Resend.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  BRAND,
  sendEmail,
  templateAvisoPlataforma,
  templateFeedbackRecebido,
  type EmailTemplate,
} from "../_shared/email/index.ts";
import { createLogger } from "../_shared/logger.ts";
import { z } from "../_shared/schemas.ts";
import { withSentry } from "../_shared/sentry.ts";
import { dicaResposta, formatarData, urlAbsoluta } from "./regras.ts";

const log = createLogger("aviso-ultra-admin-email");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const payloadSchema = z.object({ notificacao_id: z.string().uuid() });

type Notificacao = {
  id: string;
  destinatario_id: string;
  empresa_id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  referencia_id: string | null;
  created_at: string;
  email_enviado_em: string | null;
};

type FeedbackRow = {
  tipo: string;
  titulo: string | null;
  descricao: string;
  created_by: string;
  print_path: string | null;
  contexto: { rota?: unknown } | null;
};

type Montado = { template: EmailTemplate; replyTo: string | null };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function emailDoPerfil(
  admin: SupabaseClient,
  id: string | null
): Promise<{ nome: string | null; email: string | null }> {
  if (!id) return { nome: null, email: null };
  const { data } = await admin.from("profiles").select("nome, email").eq("id", id).maybeSingle();
  return { nome: (data?.nome as string | null) ?? null, email: (data?.email as string | null) ?? null };
}

/** Feedback ganha e-mail próprio (texto inteiro, tela, print); reply-to vai pra quem enviou. */
async function montarFeedback(
  admin: SupabaseClient,
  n: Notificacao,
  empresaNome: string | null
): Promise<Montado | null> {
  if (!n.referencia_id) return null;
  const { data: feedback } = (await admin
    .from("feature_suggestions")
    .select("tipo, titulo, descricao, created_by, print_path, contexto")
    .eq("id", n.referencia_id)
    .maybeSingle()) as { data: FeedbackRow | null };
  if (!feedback) return null;

  const autor = await emailDoPerfil(admin, feedback.created_by);
  return {
    replyTo: autor.email,
    template: templateFeedbackRecebido({
      tipo: feedback.tipo === "bug" ? "bug" : "sugestao",
      titulo: feedback.titulo,
      descricao: feedback.descricao,
      autor: autor.nome || autor.email || "Usuário",
      empresaNome,
      rota: typeof feedback.contexto?.rota === "string" ? feedback.contexto.rota : null,
      temPrint: !!feedback.print_path,
      enviadoEm: formatarData(n.created_at),
      painelUrl: urlAbsoluta(n.link, BRAND.appUrl),
    }),
  };
}

serve(
  withSentry("aviso-ultra-admin-email", async (req) => {
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token || !CRON_SECRET || token !== CRON_SECRET) return json({ error: "unauthorized" }, 401);

    const parsed = payloadSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "notificacao_id inválido" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: n, error: nErr } = (await admin
      .from("notificacoes")
      .select(
        "id, destinatario_id, empresa_id, tipo, titulo, mensagem, link, referencia_id, created_at, email_enviado_em"
      )
      .eq("id", parsed.data.notificacao_id)
      .maybeSingle()) as { data: Notificacao | null; error: unknown };

    if (nErr) {
      log.error("falha ao ler notificação", nErr as Error, { notificacao_id: parsed.data.notificacao_id });
      return json({ error: "query failed" }, 500);
    }
    if (!n) return json({ error: "notificação não encontrada" }, 404);
    if (n.email_enviado_em) return json({ enviado: false, motivo: "já enviado" }, 200);

    // Defesa em profundidade: o trigger já filtra, mas a função só fala com ultra admin.
    const { data: destinatario } = await admin
      .from("profiles")
      .select("email, role")
      .eq("id", n.destinatario_id)
      .maybeSingle();
    if (destinatario?.role !== "ultra_admin" || !destinatario.email) {
      return json({ enviado: false, motivo: "destinatário não é ultra admin com e-mail" }, 200);
    }

    const { data: empresa } = await admin
      .from("empresas")
      .select("nome, owner_id")
      .eq("id", n.empresa_id)
      .maybeSingle();
    const empresaNome = (empresa?.nome as string | null) ?? null;

    const montado: Montado = (n.tipo === "feedback_recebido" ? await montarFeedback(admin, n, empresaNome) : null) ?? {
      // Novo cadastro: responder o e-mail fala direto com quem se cadastrou.
      replyTo: n.tipo === "novo_cadastro" ? (await emailDoPerfil(admin, empresa?.owner_id ?? null)).email : null,
      template: templateAvisoPlataforma({
        titulo: n.titulo,
        mensagem: n.mensagem,
        empresaNome,
        enviadoEm: formatarData(n.created_at),
        url: urlAbsoluta(n.link, BRAND.appUrl),
        dicaResposta: dicaResposta(n.tipo),
      }),
    };

    const resultado = await sendEmail({
      classe: "plataforma",
      tipo: `aviso_ultra_admin_${n.tipo}`,
      to: destinatario.email,
      ...(montado.replyTo ? { replyTo: montado.replyTo } : {}),
      referencia: { tipo: "notificacoes", id: n.id },
      idempotencyKey: `aviso-ultra-admin-${n.id}`,
      ...montado.template,
    });

    // Suprimido ou dry-run também marca: email_envios guarda o motivo real.
    await admin.from("notificacoes").update({ email_enviado_em: new Date().toISOString() }).eq("id", n.id);

    log.info("aviso enviado ao ultra admin", { notificacao_id: n.id, tipo: n.tipo, ok: resultado.ok });
    return json({ enviado: resultado.ok }, 200);
  })
);
