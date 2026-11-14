// mcp — conector da Pilar para ChatGPT, Claude e outros clientes MCP (SPEC 151).
//
// O usuário cola a URL do conector no ChatGPT/Claude. O cliente chama esta função sem token,
// recebe 401 com o endereço dos metadados (RFC 9728), descobre o servidor OAuth 2.1 do
// Supabase Auth, manda o usuário para a tela de autorização da Pilar (/oauth/autorizar) e
// volta com um token do usuário. Daí em diante cada chamada traz esse token.
//
// Tudo é leitura e com o cliente do usuário: a RLS decide o que aparece, igual ao app. O token
// de app externo não escreve em lugar nenhum (pre-request do banco e recusarAppExterno nas
// outras funções); esta é a única função que o aceita.
//
// verify_jwt = false no config.toml: o 401 precisa sair DAQUI, com o WWW-Authenticate que
// inicia o OAuth. O gateway devolveria um 401 seco e o cliente não saberia onde fazer login.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry, setSentryUser } from "../_shared/sentry.ts";
import { limitarOuResponder } from "../_shared/db-rate-limit.ts";
import { lerJson } from "../_shared/schemas.ts";
import { createLogger } from "../_shared/logger.ts";
import { clientIdDoAppExterno } from "../_shared/app-externo.ts";
import { DESCRICOES, executarFerramenta } from "./ferramentas.ts";
import {
  cabecalhoNaoAutorizado,
  type EnderecosMcp,
  metadadosDoRecurso,
  processarCorpo,
  resultadoErro,
} from "./protocolo.ts";

const log = createLogger("mcp");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/** Chamadas por usuário por minuto: uma conversa faz poucas; isso só segura abuso e laço. */
const CHAMADAS_POR_MINUTO = 120;

/**
 * Endereços públicos. Com domínio próprio (api.pilarsoft.com.br), MCP_PUBLIC_URL e
 * MCP_AUTH_ISSUER apontam para ele e o usuário nunca vê o endereço do provedor. Sem eles, o
 * padrão é o endereço do projeto, que funciona igual.
 */
function enderecos(): EnderecosMcp {
  const base = SUPABASE_URL.replace(/\/$/, "");
  return {
    recurso: (Deno.env.get("MCP_PUBLIC_URL") ?? `${base}/functions/v1/mcp`).replace(/\/$/, ""),
    servidorDeAutorizacao: (Deno.env.get("MCP_AUTH_ISSUER") ?? `${base}/auth/v1`).replace(/\/$/, ""),
  };
}

// O cliente MCP é um servidor (ChatGPT, Claude) ou um app de desktop, não uma página do app:
// CORS aberto não expõe nada, porque toda resposta com dado exige o token no header.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "www-authenticate, mcp-session-id",
};

function resposta(corpo: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(corpo === null ? null : JSON.stringify(corpo), {
    status,
    headers: {
      ...CORS,
      "X-Content-Type-Options": "nosniff",
      ...(corpo !== null && { "Content-Type": "application/json" }),
      ...extra,
    },
  });
}

function naoAutorizado(tokenInvalido: boolean): Response {
  return resposta(
    { error: tokenInvalido ? "invalid_token" : "unauthorized", error_description: "Conecte sua conta da Pilar." },
    401,
    { "WWW-Authenticate": cabecalhoNaoAutorizado(enderecos(), tokenInvalido) }
  );
}

/**
 * Motivo para não servir dados, ou null. Espelha o PrivateRoute do app: assinatura cancelada
 * (fora do período pago) ou expirada sem a janela de somente leitura bloqueia o acesso.
 */
async function bloqueioDaEmpresa(admin: SupabaseClient, empresaId: string): Promise<string | null> {
  const [{ data: assinatura }, { data: empresa }] = await Promise.all([
    admin.from("pilar_subscriptions").select("status, current_period_end").eq("empresa_id", empresaId).maybeSingle(),
    admin.from("empresas").select("leitura_desde").eq("id", empresaId).maybeSingle(),
  ]);
  if (!assinatura) return null;
  const aindaPago =
    assinatura.status === "canceled" &&
    assinatura.current_period_end &&
    new Date(String(assinatura.current_period_end)) > new Date();
  if (assinatura.status === "canceled" && !aindaPago) {
    return "A assinatura da Pilar deste escritório está cancelada. Regularize no app para voltar a consultar.";
  }
  if (assinatura.status === "expired" && !empresa?.leitura_desde) {
    return "A assinatura da Pilar deste escritório expirou. Regularize no app para voltar a consultar.";
  }
  return null;
}

serve(
  withSentry("mcp", async (req: Request) => {
    if (req.method === "OPTIONS") return resposta(null, 204);

    const caminho = new URL(req.url).pathname;
    if (caminho.endsWith("/.well-known/oauth-protected-resource")) {
      if (req.method !== "GET") return resposta({ error: "method_not_allowed" }, 405, { Allow: "GET" });
      return resposta(metadadosDoRecurso(enderecos()), 200, { "Cache-Control": "public, max-age=3600" });
    }

    // Sem sessão e sem stream: GET (abrir SSE) e DELETE (encerrar sessão) não se aplicam.
    if (req.method !== "POST") return resposta({ error: "method_not_allowed" }, 405, { Allow: "POST" });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ") || authHeader.length <= "Bearer ".length) return naoAutorizado(false);

    const comoUsuario = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: erroAuth,
    } = await comoUsuario.auth.getUser();
    if (erroAuth || !user) return naoAutorizado(true);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const limite = await limitarOuResponder(admin, req, {
      bucket: "mcp",
      key: `uid:${user.id}`,
      max: CHAMADAS_POR_MINUTO,
      windowSeconds: 60,
    });
    if (limite) return limite;

    const { data: perfil } = await comoUsuario.from("profiles").select("empresa_id").eq("id", user.id).maybeSingle();
    const empresaId = (perfil?.empresa_id as string | undefined) ?? null;
    if (!empresaId) {
      return resposta({ error: "forbidden", error_description: "Conta sem escritório na Pilar." }, 403);
    }
    setSentryUser({ id: user.id, empresa_id: empresaId });

    const clientId = clientIdDoAppExterno(authHeader);
    const bloqueio = await bloqueioDaEmpresa(admin, empresaId);

    const corpo = await lerJson(req);
    const respostas = await processarCorpo(corpo, {
      ferramentas: DESCRICOES,
      async executar(nome, argumentos) {
        if (bloqueio && DESCRICOES.some((d) => d.name === nome)) return resultadoErro(bloqueio);
        const inicio = Date.now();
        const resultado = await executarFerramenta(comoUsuario, nome, argumentos);
        // Trilha de auditoria: quem, de qual app, qual ferramenta. Os argumentos ficam de fora
        // (podem ter nome de cliente) e o resultado também.
        log.info("ferramenta chamada", {
          ferramenta: nome,
          user_id: user.id,
          empresa_id: empresaId,
          client_id: clientId,
          erro: resultado?.isError === true,
          ms: Date.now() - inicio,
        });
        return resultado;
      },
    });

    // Só notificação: 202 sem corpo, como pede o transporte Streamable HTTP.
    if (respostas === null) return resposta(null, 202);
    return resposta(respostas, 200);
  })
);
