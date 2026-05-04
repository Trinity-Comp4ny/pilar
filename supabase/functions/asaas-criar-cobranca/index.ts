import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { getCorsHeaders, corsHeaders } from "../_shared/cors.ts";
import { createAdminClient, createAuthClient } from "../_shared/ai-client.ts";

const ASAAS_BASE_URL = {
  sandbox: "https://sandbox.asaas.com/api/v3",
  producao: "https://api.asaas.com/v3",
};

serve(
  withSentry("asaas-criar-cobranca", async (req) => {
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

      const { data: profile } = await authClient.from("profiles").select("empresa_id").eq("id", user.id).single();

      if (!profile?.empresa_id) throw new Error("Usuário não vinculado a empresa");
      const empresaId = profile.empresa_id as string;

      // Buscar config Asaas da empresa
      const { data: config } = await adminClient
        .from("asaas_config")
        .select("api_key, ambiente")
        .eq("empresa_id", empresaId)
        .maybeSingle();

      if (!config) {
        throw new Error(
          "Configuração Asaas não encontrada. Configure a API key em Financeiro → Receitas → Configurações → Asaas."
        );
      }

      const { receita_id, billing_type } = (await req.json()) as {
        receita_id: string;
        billing_type: "PIX" | "BOLETO";
      };

      if (!receita_id) throw new Error("receita_id é obrigatório");
      if (!["PIX", "BOLETO"].includes(billing_type)) {
        throw new Error("billing_type deve ser PIX ou BOLETO");
      }

      // Buscar receita + cliente
      const { data: receita, error: receitaError } = await adminClient
        .from("receitas")
        .select("*, clientes(id, nome, cpf_cnpj, email, asaas_customer_id)")
        .eq("id", receita_id)
        .eq("empresa_id", empresaId)
        .single();

      if (receitaError || !receita) throw new Error("Receita não encontrada");
      if (receita.asaas_payment_id) {
        throw new Error("Esta receita já possui uma cobrança Asaas criada");
      }
      if (!receita.clientes) {
        throw new Error("Receita não possui cliente vinculado. Vincule um cliente antes de cobrar.");
      }

      const baseUrl = ASAAS_BASE_URL[config.ambiente as keyof typeof ASAAS_BASE_URL];
      const asaasHeaders = {
        "Content-Type": "application/json",
        access_token: config.api_key,
      };

      // Criar ou reutilizar customer Asaas
      let customerId: string = receita.clientes.asaas_customer_id ?? "";

      // Validar CPF/CNPJ se presente
      const cpfCnpjNumeros = receita.clientes.cpf_cnpj?.replace(/\D/g, "") ?? "";
      if (cpfCnpjNumeros && cpfCnpjNumeros.length !== 11 && cpfCnpjNumeros.length !== 14) {
        throw new Error(
          `CPF/CNPJ do cliente inválido (${cpfCnpjNumeros.length} dígitos). Corrija os dados do cliente antes de gerar a cobrança.`
        );
      }

      if (!customerId) {
        // Buscar por CPF/CNPJ primeiro
        if (cpfCnpjNumeros) {
          const searchResp = await fetch(`${baseUrl}/customers?cpfCnpj=${cpfCnpjNumeros}`, { headers: asaasHeaders });
          if (searchResp.ok) {
            const searchData = (await searchResp.json()) as { data?: Array<{ id: string }> };
            if (searchData.data && searchData.data.length > 0) {
              customerId = searchData.data[0].id;
            }
          }
        }

        // Criar se não encontrado
        if (!customerId) {
          const createResp = await fetch(`${baseUrl}/customers`, {
            method: "POST",
            headers: asaasHeaders,
            body: JSON.stringify({
              name: receita.clientes.nome,
              ...(cpfCnpjNumeros.length > 0 ? { cpfCnpj: cpfCnpjNumeros } : {}),
              ...(receita.clientes.email ? { email: receita.clientes.email } : {}),
            }),
          });

          const customerData = (await createResp.json()) as {
            id?: string;
            errors?: Array<{ description: string }>;
          };

          if (!createResp.ok) {
            const msg = customerData.errors?.[0]?.description ?? "Erro desconhecido";
            throw new Error(`Erro ao criar customer Asaas: ${msg}`);
          }

          customerId = customerData.id!;
        }

        // Persistir customer_id no cliente
        await adminClient.from("clientes").update({ asaas_customer_id: customerId }).eq("id", receita.clientes.id);
      }

      // Criar cobrança no Asaas
      const paymentResp = await fetch(`${baseUrl}/payments`, {
        method: "POST",
        headers: asaasHeaders,
        body: JSON.stringify({
          customer: customerId,
          billingType: billing_type,
          value: receita.valor,
          dueDate: receita.data_vencimento,
          description: receita.descricao,
          externalReference: receita.id,
        }),
      });

      const paymentData = (await paymentResp.json()) as {
        id?: string;
        status?: string;
        invoiceUrl?: string;
        bankSlipUrl?: string;
        errors?: Array<{ description: string }>;
      };

      if (!paymentResp.ok) {
        const msg = paymentData.errors?.[0]?.description ?? "Erro desconhecido";
        throw new Error(`Erro ao criar cobrança Asaas: ${msg}`);
      }

      const paymentUrl = paymentData.invoiceUrl ?? paymentData.bankSlipUrl ?? null;

      // Salvar dados Asaas na receita
      await adminClient
        .from("receitas")
        .update({
          asaas_payment_id: paymentData.id,
          asaas_payment_url: paymentUrl,
          asaas_payment_status: paymentData.status,
          asaas_billing_type: billing_type,
        })
        .eq("id", receita_id);

      return new Response(
        JSON.stringify({
          success: true,
          payment_id: paymentData.id,
          payment_url: paymentUrl,
          status: paymentData.status,
        }),
        { headers: { ...corsH, "Content-Type": "application/json" }, status: 200 }
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      return new Response(JSON.stringify({ error: message }), {
        headers: { ...corsH, "Content-Type": "application/json" },
        status: 400,
      });
    }
  })
);
