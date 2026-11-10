/**
 * Conexão do Google Drive da empresa (SPEC 162).
 *
 *   POST { acao: "iniciar", retorno }  admin: devolve a URL de consentimento do Google.
 *   GET  ?code&state                   retorno do Google: troca o código, cria a pasta
 *                                      "Pilar" no Drive e volta para o app.
 *   POST { acao: "desconectar" }       admin: revoga o token e apaga a conexão.
 *
 * verify_jwt = false porque o Google chama o GET sem token da Pilar; os POSTs autenticam
 * o usuário aqui dentro. O state (só o hash no banco) amarra o retorno a quem iniciou.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";
import { authenticateUser, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { limitarOuResponder } from "../_shared/db-rate-limit.ts";
import { createLogger } from "../_shared/logger.ts";
import { lerJson } from "../_shared/schemas.ts";
import {
  cifrar,
  criarPasta,
  decifrar,
  emailDoIdToken,
  hashDoEstado,
  novoEstado,
  revogar,
  trocarCodigo,
  urlDeAutorizacao,
} from "../_shared/google-drive.ts";
import { ambienteDrive, carregarConexao, retornoSeguro, urlDeRetorno } from "../_shared/google-drive-conexao.ts";
import { lerAcao } from "./entrada.ts";

const log = createLogger("google-drive-oauth");
const PAPEIS_ADMIN = ["admin", "ultra_admin"];
const VALIDADE_ESTADO_MS = 10 * 60 * 1000;

function servico() {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
}

serve(
  withSentry("google-drive-oauth", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);

    const amb = ambienteDrive();
    if (req.method === "GET") return retornoDoGoogle(req, amb);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);
    if (!amb) return safeErrorResponse(503, "Integração com o Google Drive ainda não configurada", req);

    const auth = await authenticateUser(req);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;

    const { data: perfil } = await supabase.from("profiles").select("empresa_id, role").eq("id", user.id).single();
    if (!perfil?.empresa_id) return safeErrorResponse(403, "Você precisa pertencer a uma empresa", req);
    if (!PAPEIS_ADMIN.includes(perfil.role)) {
      return safeErrorResponse(403, "Só o admin conecta o Google Drive do escritório", req);
    }

    const entrada = lerAcao(await lerJson(req));
    if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);

    const svc = servico();
    const bloqueio = await limitarOuResponder(svc, req, {
      bucket: "google_drive_oauth",
      key: `empresa:${perfil.empresa_id}`,
      max: 20,
      windowSeconds: 3600,
    });
    if (bloqueio) return bloqueio;

    try {
      if (entrada.data.acao === "iniciar") {
        const { estado, hash } = await novoEstado();
        const { error } = await svc.from("google_drive_oauth_estados").insert({
          estado_hash: hash,
          empresa_id: perfil.empresa_id,
          usuario_id: user.id,
          retorno: retornoSeguro(entrada.data.retorno),
          expira_em: new Date(Date.now() + VALIDADE_ESTADO_MS).toISOString(),
        });
        if (error) throw error;
        return jsonResponse({ url: urlDeAutorizacao(amb, estado, user.email ?? undefined) }, 200, req);
      }

      // desconectar
      const conexao = await carregarConexao(svc, perfil.empresa_id);
      if (conexao) {
        try {
          await revogar(await decifrar(conexao.refresh_token_cifrado, amb.chaveToken));
        } catch (e) {
          // Revogar é cortesia: a conexão sai daqui de qualquer jeito.
          log.warn("revogar token no Google falhou", { erro: String(e) });
        }
        await svc.from("drive_pastas").delete().eq("empresa_id", perfil.empresa_id);
        await svc.from("google_drive_conexoes").delete().eq("empresa_id", perfil.empresa_id);
      }
      return jsonResponse({ ok: true }, 200, req);
    } catch (e) {
      log.error("falha na ação do OAuth do Drive", e, { acao: entrada.data.acao });
      return safeErrorResponse(500, "Não foi possível concluir. Tente de novo.", req);
    }
  })
);

async function retornoDoGoogle(req: Request, amb: ReturnType<typeof ambienteDrive>): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const estado = params.get("state") ?? "";
  const site = amb?.siteUrl ?? "https://app.pilarsoft.com.br";
  const voltar = (retorno: string, status: "conectado" | "erro" | "negado") =>
    Response.redirect(urlDeRetorno(site, retorno, status), 302);

  if (!amb || !estado) return voltar("/", "erro");

  const svc = servico();
  const hash = await hashDoEstado(estado);
  const { data: registro } = await svc
    .from("google_drive_oauth_estados")
    .select("empresa_id, usuario_id, retorno, expira_em")
    .eq("estado_hash", hash)
    .maybeSingle();
  // Uso único: apaga já, valendo ou não.
  await svc.from("google_drive_oauth_estados").delete().eq("estado_hash", hash);
  if (!registro || new Date(registro.expira_em).getTime() < Date.now()) return voltar("/", "erro");

  const retorno = registro.retorno ?? "/";
  if (params.get("error")) return voltar(retorno, "negado");
  const code = params.get("code");
  if (!code) return voltar(retorno, "erro");

  try {
    const tokens = await trocarCodigo(amb, code);
    const email = emailDoIdToken(tokens.id_token);
    if (!tokens.refresh_token || !email) {
      log.error("Google não devolveu refresh_token ou e-mail", null, { empresa_id: registro.empresa_id });
      return voltar(retorno, "erro");
    }

    const { data: empresa } = await svc.from("empresas").select("nome").eq("id", registro.empresa_id).maybeSingle();
    const raiz = await criarPasta(tokens.access_token, `Pilar - ${empresa?.nome ?? "Escritório"}`, "");

    // Conta trocada: as pastas antigas eram da outra conta e a Pilar não as enxerga mais.
    const anterior = await carregarConexao(svc, registro.empresa_id);
    if (anterior) await svc.from("drive_pastas").delete().eq("empresa_id", registro.empresa_id);

    const { error } = await svc.from("google_drive_conexoes").upsert({
      empresa_id: registro.empresa_id,
      google_email: email,
      refresh_token_cifrado: await cifrar(tokens.refresh_token, amb.chaveToken),
      pasta_raiz_id: raiz.id,
      conectado_por: registro.usuario_id,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return voltar(retorno, "conectado");
  } catch (e) {
    log.error("falha ao conectar o Google Drive", e, { empresa_id: registro.empresa_id });
    return voltar(retorno, "erro");
  }
}
