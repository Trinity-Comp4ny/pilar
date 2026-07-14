/**
 * Edge function: ultra-admin-empresas
 *
 * GET    /ultra-admin-empresas           → lista empresas (com contagem de usuários)
 * GET    /ultra-admin-empresas?id=<uuid> → detalhe: empresa + usuários
 * POST   /ultra-admin-empresas           → criar empresa + assinatura Starter + convidar dono
 * PUT    /ultra-admin-empresas           → atualizar features de uma empresa
 *
 * Requer role = ultra_admin.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { isUUID, jsonResponse, optionsResponse, safeErrorResponse, getTrustedOrigin } from "../_shared/cors.ts";
import { requireUltraAdmin } from "../_shared/admin-auth.ts";
import { logAction } from "../_shared/audit.ts";
import { withSentry } from "../_shared/sentry.ts";

serve(
  withSentry("ultra-admin-empresas", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);

    const auth = await requireUltraAdmin(req);
    if (auth.error) return auth.error;
    const { svc, userId, actorEmail } = auth;

    const url = new URL(req.url);

    // ─── GET: lista ou detalhe ─────────────────────────────────────────────
    if (req.method === "GET") {
      const id = url.searchParams.get("id");

      if (id) {
        if (!isUUID(id)) return safeErrorResponse(400, "id inválido", req);

        const [{ data: empresa, error: empErr }, { data: usuarios, error: usrErr }, { data: convites }] =
          await Promise.all([
            svc.from("empresas").select("*").eq("id", id).single(),
            svc.from("profiles").select("id, nome, email, role, features").eq("empresa_id", id),
            svc
              .from("convites")
              .select("id, email, nome, cargo, features, expira_em")
              .eq("empresa_id", id)
              .is("usado_em", null)
              .gt("expira_em", new Date().toISOString()),
          ]);

        if (empErr || !empresa) return safeErrorResponse(404, "Empresa não encontrada", req);
        if (usrErr) return safeErrorResponse(500, "Falha ao buscar usuários da empresa", req);

        // Buscar plano da empresa
        const { data: sub } = await svc
          .from("pilar_subscriptions")
          .select("plan_id, pilar_subscription_plans(slug)")
          .eq("empresa_id", id)
          .maybeSingle();

        return jsonResponse(
          {
            empresa,
            plano: (sub?.pilar_subscription_plans as { slug?: string } | null)?.slug ?? "starter",
            usuarios: usuarios ?? [],
            convites: convites ?? [],
          },
          200,
          req
        );
      }

      // Lista todas as empresas
      const { data: empresas, error } = await svc
        .from("empresas")
        .select("id, nome, cnpj, status, features, created_at")
        .order("created_at", { ascending: false });

      if (error) return safeErrorResponse(500, error.message, req);

      // Contar usuários por empresa
      const ids = (empresas ?? []).map((e) => e.id);
      const { data: counts } = await svc.from("profiles").select("empresa_id").in("empresa_id", ids);

      const countMap: Record<string, number> = {};
      for (const row of counts ?? []) {
        if (row.empresa_id) countMap[row.empresa_id] = (countMap[row.empresa_id] ?? 0) + 1;
      }

      // Buscar planos
      const { data: subs } = await svc
        .from("pilar_subscriptions")
        .select("empresa_id, pilar_subscription_plans(slug)")
        .in("empresa_id", ids);

      const planMap: Record<string, string> = {};
      for (const sub of subs ?? []) {
        planMap[sub.empresa_id] = (sub.pilar_subscription_plans as { slug?: string } | null)?.slug ?? "starter";
      }

      const result = (empresas ?? []).map((e) => ({
        ...e,
        usersCount: countMap[e.id] ?? 0,
        plano: planMap[e.id] ?? "starter",
      }));

      return jsonResponse(result, 200, req);
    }

    // ─── POST: criar empresa + assinatura Starter + convidar dono ─────────
    if (req.method === "POST") {
      const body = await req.json();
      const nome = typeof body?.nome === "string" ? body.nome.trim() : "";
      const cnpj = typeof body?.cnpj === "string" && body.cnpj.trim() ? body.cnpj.trim() : null;
      const ownerEmail = typeof body?.owner_email === "string" ? body.owner_email.trim().toLowerCase() : "";
      const ownerNome = typeof body?.owner_nome === "string" && body.owner_nome.trim() ? body.owner_nome.trim() : null;

      if (!nome) return safeErrorResponse(400, "Nome da empresa é obrigatório", req);
      if (!ownerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) {
        return safeErrorResponse(400, "E-mail do dono inválido", req);
      }

      // 1. Cria a empresa (service_role bypassa RLS)
      const { data: empresa, error: empErr } = await svc
        .from("empresas")
        .insert({ nome, cnpj, email: ownerEmail, status: "active", created_by: userId })
        .select("id, nome")
        .single();

      if (empErr || !empresa) return safeErrorResponse(400, empErr?.message ?? "Falha ao criar empresa", req);

      // 2. Assinatura Starter ativa (plano resolvido por slug em runtime)
      const { data: plan } = await svc
        .from("pilar_subscription_plans")
        .select("id")
        .eq("slug", "starter")
        .maybeSingle();

      if (plan?.id) {
        await svc.from("pilar_subscriptions").insert({ empresa_id: empresa.id, plan_id: plan.id, status: "active" });
      }

      // 3. Convida o dono como admin (reusa convites + inviteUserByEmail)
      let inviteWarning: string | null = null;
      const redirectOrigin = getTrustedOrigin(req);
      if (!redirectOrigin) {
        inviteWarning = "Empresa criada, mas o convite não foi enviado (origin não permitido). Reenvie pelo detalhe.";
      } else {
        const { data: convite, error: convErr } = await svc
          .from("convites")
          .insert({ empresa_id: empresa.id, email: ownerEmail, cargo: "admin", nome: ownerNome, features: {}, criado_por: userId })
          .select("token")
          .single();

        if (convErr || !convite) {
          inviteWarning = "Empresa criada, mas falha ao gerar o convite do dono. Convide pelo detalhe da empresa.";
        } else {
          const { error: inviteError } = await svc.auth.admin.inviteUserByEmail(ownerEmail, {
            redirectTo: `${redirectOrigin}/profile-setup`,
            data: { invite_token: convite.token, nome: ownerNome ?? "" },
          });
          if (inviteError) {
            inviteWarning = "Empresa criada, mas o e-mail de convite ao dono falhou. Reenvie pelo detalhe da empresa.";
          }
        }
      }

      await logAction(svc, {
        actorId: userId,
        actorEmail,
        actorRole: "ultra_admin",
        action: "create_company",
        category: "empresa",
        targetType: "empresa",
        targetId: empresa.id,
        targetName: empresa.nome,
        empresaId: empresa.id,
        metadata: { owner_email: ownerEmail, plano: "starter", invite_warning: inviteWarning },
        req,
      });

      return jsonResponse({ success: true, empresa_id: empresa.id, warning: inviteWarning }, 200, req);
    }

    // ─── PUT: atualizar empresa (features, dados cadastrais, status, plano) ─
    if (req.method === "PUT") {
      const body = await req.json();
      const { empresa_id, features, nome, cnpj, status, plano } = body ?? {};

      if (!isUUID(empresa_id)) return safeErrorResponse(400, "empresa_id inválido", req);

      const { data: emp } = await svc
        .from("empresas")
        .select("nome, features, status")
        .eq("id", empresa_id)
        .single();
      if (!emp) return safeErrorResponse(404, "Empresa não encontrada", req);

      // Monta o update de empresas só com os campos enviados
      const empresaUpdate: Record<string, unknown> = {};
      if (features && typeof features === "object") empresaUpdate.features = features;
      if (typeof nome === "string" && nome.trim()) empresaUpdate.nome = nome.trim();
      if (typeof cnpj === "string") empresaUpdate.cnpj = cnpj.trim() || null;
      if (typeof status === "string") {
        if (!["active", "suspended", "cancelled"].includes(status)) {
          return safeErrorResponse(400, "status inválido", req);
        }
        empresaUpdate.status = status;
      }

      if (Object.keys(empresaUpdate).length > 0) {
        const { error } = await svc.from("empresas").update(empresaUpdate).eq("id", empresa_id);
        if (error) return safeErrorResponse(400, error.message, req);
      }

      // Troca de plano (opcional): resolve o slug e faz upsert da assinatura
      if (typeof plano === "string") {
        if (!["starter", "pro", "enterprise"].includes(plano)) {
          return safeErrorResponse(400, "plano inválido", req);
        }
        const { data: plan } = await svc
          .from("pilar_subscription_plans")
          .select("id")
          .eq("slug", plano)
          .maybeSingle();
        if (!plan?.id) return safeErrorResponse(400, "plano não encontrado", req);

        const { data: existingSub } = await svc
          .from("pilar_subscriptions")
          .select("id")
          .eq("empresa_id", empresa_id)
          .maybeSingle();

        if (existingSub?.id) {
          await svc.from("pilar_subscriptions").update({ plan_id: plan.id }).eq("id", existingSub.id);
        } else {
          await svc.from("pilar_subscriptions").insert({ empresa_id, plan_id: plan.id, status: "active" });
        }
      }

      await logAction(svc, {
        actorId: userId,
        actorEmail,
        actorRole: "ultra_admin",
        action: "update_company",
        category: "empresa",
        targetType: "empresa",
        targetId: empresa_id,
        targetName: (typeof nome === "string" && nome.trim()) || emp.nome || empresa_id,
        empresaId: empresa_id,
        metadata: {
          fields: Object.keys(empresaUpdate),
          plano: typeof plano === "string" ? plano : undefined,
          old_status: emp.status,
        },
        req,
      });

      return jsonResponse({ success: true }, 200, req);
    }

    return safeErrorResponse(405, "Method not allowed", req);
  })
);
