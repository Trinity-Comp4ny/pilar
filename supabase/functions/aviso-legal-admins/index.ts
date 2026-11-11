/**
 * Aviso legal por e-mail a todos os administradores ativos (Termos v2, cláusula 15 e
 * Anexo A5). Só ultra admin, com MFA. "simular" conta quem recebe e quem já recebeu;
 * "enviar" manda a quem ainda não recebeu. O conteúdo vem do catálogo (avisos.ts),
 * nunca do corpo da requisição.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { requireUltraAdmin } from "../_shared/admin-auth.ts";
import { logAction } from "../_shared/audit.ts";
import { jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { BRAND, sendEmail, templateAvisoLegal } from "../_shared/email/index.ts";
import { createLogger } from "../_shared/logger.ts";
import { lerJson } from "../_shared/schemas.ts";
import { withSentry } from "../_shared/sentry.ts";
import { type Administrador, chaveIdempotencia, destinatarios, lerEntrada } from "./avisos.ts";

const log = createLogger("aviso-legal-admins");

// Status em que o e-mail já saiu (ou está saindo): não reenviar.
const JA_ENVIADO = ["enviando", "enviado", "entregue", "atrasado"];

serve(
  withSentry("aviso-legal-admins", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const auth = await requireUltraAdmin(req);
    if (auth.error) return auth.error;
    const { svc, userId, actorEmail } = auth;

    const entrada = lerEntrada(await lerJson(req));
    if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);
    const { aviso, enviar } = entrada;

    const { data: perfis, error: perfisErr } = await svc
      .from("profiles")
      .select("id, email, first_name, role, desativado_em")
      .eq("role", "admin")
      .is("desativado_em", null);
    if (perfisErr) {
      log.error("falha ao listar administradores", perfisErr);
      return safeErrorResponse(500, "Não foi possível listar os administradores", req);
    }

    const alvo = destinatarios((perfis ?? []) as Administrador[]);
    const chaves = alvo.map((p) => chaveIdempotencia(aviso.id, p.id));

    const { data: enviados, error: enviadosErr } = chaves.length
      ? await svc.from("email_envios").select("idempotency_key").in("idempotency_key", chaves).in("status", JA_ENVIADO)
      : { data: [], error: null };
    if (enviadosErr) {
      log.error("falha ao consultar envios", enviadosErr);
      return safeErrorResponse(500, "Não foi possível consultar os envios anteriores", req);
    }
    const jaRecebeu = new Set((enviados ?? []).map((e) => e.idempotency_key as string));
    const pendentes = alvo.filter((p) => !jaRecebeu.has(chaveIdempotencia(aviso.id, p.id)));

    if (!enviar) {
      return jsonResponse(
        { aviso: aviso.nome, administradores: alvo.length, ja_receberam: jaRecebeu.size, pendentes: pendentes.length },
        200,
        req
      );
    }

    let enviadosAgora = 0;
    let falhas = 0;
    for (const p of pendentes) {
      const email = templateAvisoLegal({
        nome: p.first_name?.trim() || "administrador",
        assunto: aviso.assunto,
        titulo: aviso.titulo,
        lead: aviso.lead,
        itens: aviso.itens,
        vigencia: aviso.vigencia,
        link: `${BRAND.siteUrl}${aviso.caminho}`,
        linkLabel: aviso.linkLabel,
        rodape: aviso.rodape,
      });
      try {
        const r = await sendEmail({
          classe: "plataforma",
          tipo: "aviso_legal",
          to: p.email,
          subject: email.subject,
          html: email.html,
          referencia: { tipo: "aviso_legal", id: null },
          idempotencyKey: chaveIdempotencia(aviso.id, p.id),
        });
        if (r.ok) enviadosAgora++;
        else falhas++;
      } catch (error) {
        falhas++;
        log.error("falha ao enviar aviso legal", error);
      }
    }

    await logAction(svc, {
      actorId: userId,
      actorEmail,
      actorRole: "ultra_admin",
      action: "aviso_legal_enviado",
      category: "empresa",
      targetType: "aviso_legal",
      targetName: aviso.id,
      metadata: { administradores: alvo.length, ja_receberam: jaRecebeu.size, enviados: enviadosAgora, falhas },
      req,
    });

    return jsonResponse(
      {
        aviso: aviso.nome,
        administradores: alvo.length,
        ja_receberam: jaRecebeu.size,
        enviados: enviadosAgora,
        falhas,
      },
      200,
      req
    );
  })
);
