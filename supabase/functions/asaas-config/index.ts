import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createAdminClient, createAuthClient } from "../_shared/ai-client.ts";

serve(
  withSentry("asaas-config", async (req) => {
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
        action: "get" | "save" | "remover" | "testar";
        api_key?: string;
        ambiente?: string;
      };

      // Carrega config — nunca retorna api_key ao frontend
      if (action === "get") {
        const { data } = await adminClient
          .from("asaas_config")
          .select("ambiente, updated_at")
          .eq("empresa_id", empresaId)
          .maybeSingle();

        return new Response(
          JSON.stringify({
            data: data ? { configurado: true, ambiente: data.ambiente } : null,
          }),
          { headers: { ...corsH, "Content-Type": "application/json" }, status: 200 }
        );
      }

      // Salva config. A api_key nunca é escrita direto na tabela: primeiro
      // garante a linha (ambiente + empresa_id, sem segredo), depois — só se
      // uma chave nova foi enviada — chama a RPC que cifra antes de gravar
      // (set_asaas_api_key, migration 20260850000000). Nunca no mesmo upsert:
      // a RPC precisa que a linha já exista pra fazer o UPDATE.
      if (action === "save") {
        if (!["sandbox", "producao"].includes(ambiente ?? "")) throw new Error("Ambiente inválido");

        // Verifica se já existe config para decidir se api_key é obrigatória
        const { data: existing } = await adminClient
          .from("asaas_config")
          .select("empresa_id")
          .eq("empresa_id", empresaId)
          .maybeSingle();

        if (!existing && !api_key?.trim()) throw new Error("API key é obrigatória na primeira configuração");

        const { error: upsertError } = await adminClient
          .from("asaas_config")
          .upsert(
            { empresa_id: empresaId, ambiente, updated_at: new Date().toISOString() },
            { onConflict: "empresa_id" }
          );

        if (upsertError) throw upsertError;

        if (api_key?.trim()) {
          const { error: keyError } = await adminClient.rpc("set_asaas_api_key", {
            p_empresa_id: empresaId,
            p_api_key: api_key.trim(),
          });
          if (keyError) throw keyError;
        }

        const { data: updated } = await adminClient
          .from("asaas_config")
          .select("ambiente")
          .eq("empresa_id", empresaId)
          .single();

        return new Response(
          JSON.stringify({
            success: true,
            data: updated ? { configurado: true, ambiente: updated.ambiente } : null,
          }),
          { headers: { ...corsH, "Content-Type": "application/json" }, status: 200 }
        );
      }

      // Remove a integração (desconecta o Asaas desta empresa)
      if (action === "remover") {
        const { error } = await adminClient.from("asaas_config").delete().eq("empresa_id", empresaId);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsH, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Testa a conexão com o Asaas usando a chave salva (server-side). A chave
      // nunca é selecionada direto da coluna: sempre via get_asaas_api_key, que
      // decifra (migration 20260850000000). ambiente continua vindo direto da
      // tabela porque não é segredo.
      if (action === "testar") {
        const { data: cfg } = await adminClient
          .from("asaas_config")
          .select("ambiente")
          .eq("empresa_id", empresaId)
          .maybeSingle();

        if (!cfg) throw new Error("Nenhuma integração configurada para testar");

        const { data: apiKeyDecifrada, error: keyError } = await adminClient.rpc("get_asaas_api_key", {
          p_empresa_id: empresaId,
        });
        if (keyError || !apiKeyDecifrada) throw new Error("Nenhuma integração configurada para testar");

        const base = cfg.ambiente === "producao" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";

        let res: Response;
        try {
          res = await fetch(`${base}/myAccount`, {
            headers: { access_token: apiKeyDecifrada as string, "Content-Type": "application/json" },
          });
        } catch {
          return new Response(
            JSON.stringify({ success: true, valido: false, mensagem: "Não foi possível conectar ao Asaas." }),
            { headers: { ...corsH, "Content-Type": "application/json" }, status: 200 }
          );
        }

        if (!res.ok) {
          const mensagem =
            res.status === 401 ? "Chave inválida ou sem permissão." : `Falha na conexão (HTTP ${res.status}).`;
          return new Response(JSON.stringify({ success: true, valido: false, mensagem }), {
            headers: { ...corsH, "Content-Type": "application/json" },
            status: 200,
          });
        }

        const acc = (await res.json().catch(() => ({}))) as { name?: string; email?: string };
        return new Response(JSON.stringify({ success: true, valido: true, conta: acc?.name ?? acc?.email ?? null }), {
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
  })
);
