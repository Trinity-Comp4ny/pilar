/**
 * Edge function: ultra-admin-empresas
 *
 * GET    /ultra-admin-empresas           → lista empresas (com contagem de usuários)
 * GET    /ultra-admin-empresas?id=<uuid> → detalhe: empresa + usuários
 * PUT    /ultra-admin-empresas           → atualizar features de uma empresa
 *
 * Requer role = ultra_admin.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { isUUID, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
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

        const [{ data: empresa, error: empErr }, { data: usuarios, error: usrErr }] = await Promise.all([
          svc.from("empresas").select("*").eq("id", id).single(),
          svc.from("profiles").select("id, nome, email, role, features").eq("empresa_id", id),
        ]);

        if (empErr || !empresa) return safeErrorResponse(404, "Empresa não encontrada", req);

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

    // ─── PUT: atualizar features da empresa ───────────────────────────────
    if (req.method === "PUT") {
      const body = await req.json();
      const { empresa_id, features } = body ?? {};

      if (!isUUID(empresa_id)) return safeErrorResponse(400, "empresa_id inválido", req);
      if (!features || typeof features !== "object") return safeErrorResponse(400, "features obrigatório", req);

      const { data: emp } = await svc.from("empresas").select("nome, features").eq("id", empresa_id).single();

      const { error } = await svc.from("empresas").update({ features }).eq("id", empresa_id);

      if (error) return safeErrorResponse(400, error.message, req);

      await logAction(svc, {
        actorId: userId,
        actorEmail,
        actorRole: "ultra_admin",
        action: "update_company_features",
        category: "empresa",
        targetType: "empresa",
        targetId: empresa_id,
        targetName: emp?.nome ?? empresa_id,
        empresaId: empresa_id,
        metadata: { old: emp?.features, new: features },
        req,
      });

      return jsonResponse({ success: true }, 200, req);
    }

    return safeErrorResponse(405, "Method not allowed", req);
  })
);
