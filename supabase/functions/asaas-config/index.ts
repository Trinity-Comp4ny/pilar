import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createAdminClient, createAuthClient } from "../_shared/ai-client.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });

  const corsH = getCorsHeaders(req);

  try {
    const authClient = createAuthClient(req);
    const adminClient = createAdminClient();

    // Autenticação
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();
    if (userError || !user) throw new Error("Não autenticado");

    const { data: profile } = await adminClient.from("profiles").select("empresa_id").eq("id", user.id).single();

    if (!profile?.empresa_id) throw new Error("Empresa não encontrada");
    const empresaId = profile.empresa_id as string;

    const { action, api_key, ambiente } = (await req.json()) as {
      action: "get" | "save" | "regenerar_token";
      api_key?: string;
      ambiente?: string;
    };

    // Carrega config — nunca retorna api_key ao frontend
    if (action === "get") {
      const { data } = await adminClient
        .from("asaas_config")
        .select("ambiente, webhook_token, updated_at")
        .eq("empresa_id", empresaId)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          data: data ? { configurado: true, ambiente: data.ambiente, webhook_token: data.webhook_token } : null,
        }),
        { headers: { ...corsH, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Salva config
    if (action === "save") {
      if (!["sandbox", "producao"].includes(ambiente ?? "")) throw new Error("Ambiente inválido");

      // Verifica se já existe config para decidir se api_key é obrigatória
      const { data: existing } = await adminClient
        .from("asaas_config")
        .select("empresa_id")
        .eq("empresa_id", empresaId)
        .maybeSingle();

      if (!existing && !api_key?.trim()) throw new Error("API key é obrigatória na primeira configuração");

      const upsertPayload: Record<string, unknown> = {
        empresa_id: empresaId,
        ambiente,
        updated_at: new Date().toISOString(),
      };

      if (api_key?.trim()) {
        upsertPayload.api_key = api_key.trim();
      }

      const { error } = await adminClient.from("asaas_config").upsert(upsertPayload, { onConflict: "empresa_id" });

      if (error) throw error;

      // Retorna config atualizada (com webhook_token)
      const { data: updated } = await adminClient
        .from("asaas_config")
        .select("ambiente, webhook_token")
        .eq("empresa_id", empresaId)
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          data: updated
            ? { configurado: true, ambiente: updated.ambiente, webhook_token: updated.webhook_token }
            : null,
        }),
        { headers: { ...corsH, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Regenera o webhook_token da empresa
    if (action === "regenerar_token") {
      const novoToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

      const { error } = await adminClient
        .from("asaas_config")
        .update({ webhook_token: novoToken, updated_at: new Date().toISOString() })
        .eq("empresa_id", empresaId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, webhook_token: novoToken }), {
        headers: { ...corsH, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("action inválida");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsH, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
