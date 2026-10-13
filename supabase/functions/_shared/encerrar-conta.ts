/**
 * Encerrar conta sem apagar o usuário (SPEC 116, ADR 0057).
 *
 * `auth.admin.deleteUser` falha para quem criou qualquer registro (~55 colunas de
 * autoria sem ON DELETE) e, quando passa, o CASCADE leva o aceite dos termos e o próprio
 * pedido LGPD. Aqui encerrar é bloquear no Auth e marcar `profiles.desativado_em`; a
 * exclusão LGPD também tira o dado pessoal.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Bloqueio sem prazo: o GoTrue só aceita duração, então 100 anos. */
export const BLOQUEIO_PERMANENTE = "876000h";

export const PERFIL_ANONIMO = {
  nome: "Usuário removido",
  first_name: "Usuário",
  last_name: "removido",
  contato: null,
  avatar_url: null,
} as const;

/** Domínio reservado (RFC 2606): nunca entrega, e libera o e-mail real para outra conta. */
export function emailNeutro(userId: string): string {
  return `removido-${userId}@usuarios.pilarsoft.invalid`;
}

/** Dado pessoal que a exclusão apaga: tabela e coluna do titular. */
export const TABELAS_APAGADAS = [
  { tabela: "chat_sessions", coluna: "user_id" }, // chat_messages sai em cascata
  { tabela: "notificacoes", coluna: "destinatario_id" },
  { tabela: "notificacao_preferencias", coluna: "user_id" },
  { tabela: "mfa_backup_codes", coluna: "user_id" },
  { tabela: "feature_suggestions", coluna: "created_by" },
  { tabela: "ai_token_limite_usuario", coluna: "user_id" },
  { tabela: "ai_token_solicitacao", coluna: "user_id" },
] as const;

/** Buckets em que o titular tem pasta própria (`<user_id>/...`). */
export const BUCKETS_DO_TITULAR = ["user-avatars", "feedback-prints", "lgpd-exportacoes"] as const;

/**
 * Fica de propósito (SPEC 116, req. 7): base legal (prova de aceite e de atendimento,
 * auditoria, cobrança) ou dado da empresa. Documentado aqui para o teste conferir que
 * nada desta lista entra em TABELAS_APAGADAS.
 */
export const TABELAS_MANTIDAS = [
  "terms_acceptances",
  "consentimentos_cobranca",
  "cookie_consents",
  "audit_logs",
  "ai_token_ledger",
  "data_export_requests",
  "data_deletion_requests",
  "timesheet_lancamentos",
  "pessoas",
] as const;

export type Resultado = { ok: true } | { ok: false; erro: string };

/** Bloqueia o login e tira a conta de equipe, vagas e RLS. Idempotente. */
export async function desativarConta(svc: SupabaseClient, userId: string): Promise<Resultado> {
  const { error: authErr } = await svc.auth.admin.updateUserById(userId, { ban_duration: BLOQUEIO_PERMANENTE });
  if (authErr) return { ok: false, erro: `auth: ${authErr.message}` };

  const { error } = await svc
    .from("profiles")
    .update({ desativado_em: new Date().toISOString() })
    .eq("id", userId)
    .is("desativado_em", null);
  if (error) return { ok: false, erro: `profiles: ${error.message}` };
  return { ok: true };
}

/**
 * Exclusão LGPD: apaga o dado pessoal, anonimiza perfil e Auth e desativa. Cada passo
 * é idempotente, então rodar de novo depois de uma falha termina o trabalho.
 */
export async function anonimizarTitular(svc: SupabaseClient, userId: string): Promise<Resultado> {
  for (const { tabela, coluna } of TABELAS_APAGADAS) {
    const { error } = await svc.from(tabela).delete().eq(coluna, userId);
    if (error) return { ok: false, erro: `${tabela}: ${error.message}` };
  }

  for (const bucket of BUCKETS_DO_TITULAR) {
    const { data: arquivos, error } = await svc.storage.from(bucket).list(userId);
    if (error) return { ok: false, erro: `storage ${bucket}: ${error.message}` };
    if (!arquivos?.length) continue;
    const { error: rmErr } = await svc.storage.from(bucket).remove(arquivos.map((a) => `${userId}/${a.name}`));
    if (rmErr) return { ok: false, erro: `storage ${bucket}: ${rmErr.message}` };
  }

  const { data: fatores, error: mfaErr } = await svc.auth.admin.mfa.listFactors({ userId });
  if (mfaErr) return { ok: false, erro: `mfa: ${mfaErr.message}` };
  for (const fator of fatores?.factors ?? []) {
    const { error } = await svc.auth.admin.mfa.deleteFactor({ id: fator.id, userId });
    if (error) return { ok: false, erro: `mfa: ${error.message}` };
  }

  const email = emailNeutro(userId);
  const { error: authErr } = await svc.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
    user_metadata: {},
    ban_duration: BLOQUEIO_PERMANENTE,
  });
  if (authErr) return { ok: false, erro: `auth: ${authErr.message}` };

  const { error: perfilErr } = await svc
    .from("profiles")
    .update({ ...PERFIL_ANONIMO, email })
    .eq("id", userId);
  if (perfilErr) return { ok: false, erro: `profiles: ${perfilErr.message}` };

  return desativarConta(svc, userId);
}
