import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { authenticateUser, isUUID, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { sendEmail, templateCobrancaDireta } from "../_shared/email.ts";
import { EMAIL_RE } from "../_shared/validators.ts";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

  const auth = await authenticateUser(req);
  if (auth.error) return auth.error;
  const { supabase: supabaseClient, user } = auth;

  try {
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("empresa_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.empresa_id) return safeErrorResponse(403, "Perfil sem empresa", req);
    if (!["admin", "financeiro", "operacional"].includes(profile.role)) {
      return safeErrorResponse(403, "Sem permissão para enviar cobrança", req);
    }

    const { receita_id } = await req.json();
    if (!isUUID(receita_id)) return safeErrorResponse(400, "receita_id inválido", req);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: receita, error: receitaError } = await supabaseAdmin
      .from("receitas")
      .select(
        "id, descricao, valor, data_vencimento, status, empresa_id, cliente_id, clientes(nome, email), empresas(nome, pix_chave, pix_instrucoes)"
      )
      .eq("id", receita_id)
      .single();

    if (receitaError || !receita) return safeErrorResponse(404, "Receita não encontrada", req);

    const rec = receita as unknown as {
      id: string;
      descricao: string;
      valor: number;
      data_vencimento: string;
      status: string;
      empresa_id: string;
      clientes: { nome: string; email: string | null } | null;
      empresas: { nome: string; pix_chave: string | null; pix_instrucoes: string | null };
    };

    if (rec.empresa_id !== profile.empresa_id) return safeErrorResponse(403, "Acesso negado", req);

    const clienteEmail = rec.clientes?.email;
    if (!clienteEmail || !EMAIL_RE.test(clienteEmail)) {
      return safeErrorResponse(400, "Cliente sem email válido cadastrado", req);
    }

    const hoje = new Date().toISOString().split("T")[0];
    const vencida = rec.data_vencimento < hoje && rec.status === "Pendente";

    await sendEmail({
      to: clienteEmail,
      subject: vencida ? `Fatura em atraso: ${rec.descricao}` : `Lembrete de pagamento: ${rec.descricao}`,
      html: templateCobrancaDireta({
        clienteNome: rec.clientes?.nome || "",
        empresaNome: rec.empresas.nome,
        descricao: rec.descricao,
        valorFormatado: formatCurrency(Number(rec.valor)),
        dataVencimento: formatDate(rec.data_vencimento),
        vencida,
        pixChave: rec.empresas.pix_chave || undefined,
        pixInstrucoes: rec.empresas.pix_instrucoes || undefined,
      }),
    });

    return jsonResponse({ success: true, email: clienteEmail, vencida }, 200, req);
  } catch (err) {
    console.error("[send-invoice-reminder]", err);
    return safeErrorResponse(
      500,
      `Erro ao enviar cobrança: ${err instanceof Error ? err.message : "desconhecido"}`,
      req
    );
  }
});
