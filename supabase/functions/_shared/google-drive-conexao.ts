/**
 * Conexão da empresa com o Google Drive (SPEC 163): lê a config do ambiente e entrega um
 * token de acesso a partir do refresh token cifrado em google_drive_conexoes.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type ConfigGoogle, decifrar, tokenDeAcesso } from "./google-drive.ts";

export interface AmbienteDrive extends ConfigGoogle {
  chaveToken: string;
  siteUrl: string;
}

/** Config do Google; null quando o ambiente não tem as chaves (a função responde 503). */
export function ambienteDrive(env: (k: string) => string | undefined = (k) => Deno.env.get(k)): AmbienteDrive | null {
  const clientId = env("GOOGLE_DRIVE_CLIENT_ID");
  const clientSecret = env("GOOGLE_DRIVE_CLIENT_SECRET");
  const chaveToken = env("GOOGLE_DRIVE_TOKEN_KEY");
  const base = env("SUPABASE_URL");
  if (!clientId || !clientSecret || !chaveToken || !base) return null;
  return {
    clientId,
    clientSecret,
    chaveToken,
    redirectUri: env("GOOGLE_DRIVE_REDIRECT_URI") ?? `${base.replace(/\/$/, "")}/functions/v1/google-drive-oauth`,
    // APP_URL é o app; PUBLIC_SITE_URL é o site de marketing (DEPLOY_CHECKLIST).
    siteUrl: (env("APP_URL") ?? "https://app.pilarsoft.com.br").replace(/\/$/, ""),
  };
}

export interface ConexaoDrive {
  empresa_id: string;
  google_email: string;
  refresh_token_cifrado: string;
  pasta_raiz_id: string;
}

export async function carregarConexao(svc: SupabaseClient, empresaId: string): Promise<ConexaoDrive | null> {
  const { data, error } = await svc
    .from("google_drive_conexoes")
    .select("empresa_id, google_email, refresh_token_cifrado, pasta_raiz_id")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error) throw error;
  return (data as ConexaoDrive | null) ?? null;
}

export async function acessoDaConexao(amb: AmbienteDrive, conexao: ConexaoDrive): Promise<string> {
  const refresh = await decifrar(conexao.refresh_token_cifrado, amb.chaveToken);
  return tokenDeAcesso(amb, refresh);
}

/** Caminho de retorno no app: relativo, sem "//" (não vira redirecionamento aberto). */
export function retornoSeguro(valor: unknown): string {
  if (typeof valor !== "string") return "/";
  const v = valor.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\") || v.length > 300) return "/";
  return v;
}

/** Junta `drive=<status>` ao caminho de retorno, preservando a query que já existir. */
export function urlDeRetorno(siteUrl: string, retorno: string, status: "conectado" | "erro" | "negado"): string {
  const u = new URL(retornoSeguro(retorno), siteUrl);
  u.searchParams.set("drive", status);
  return u.toString();
}
