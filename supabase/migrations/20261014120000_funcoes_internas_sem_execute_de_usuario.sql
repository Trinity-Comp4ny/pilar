-- Funções internas sem EXECUTE para usuário logado.
--
-- No Supabase, função criada em public nasce executável por anon e authenticated. A
-- migration 20260836000000 tirou o anon das SECURITY DEFINER; o authenticated ficou.
-- Estas funções não checam quem chama porque foram feitas para rodar só a partir de
-- Edge Function com service role, de outra função SECURITY DEFINER ou do pg_cron.
-- Nenhuma é chamada pelo front.
--
-- Regra que fica (pgTAP funcoes_internas_grants.sql): SECURITY DEFINER com prefixo "_"
-- não é executável por anon nem authenticated, e a lista nomeada abaixo também não.

-- Chamadas por Edge Function com service role: tira o usuário, garante o service_role.
REVOKE EXECUTE ON FUNCTION
  public._campo_create_account(uuid, uuid, text, text, text, uuid),
  public._campo_create_account_convite(uuid, uuid, text, text, text, uuid),
  public._campo_registrar_foto(text, uuid, text),
  public._portal_create_account(uuid, uuid, text, text, text, uuid),
  public._portal_create_account_convite(uuid, uuid, text, text, text, uuid),
  public._portal_reset_password(uuid, text),
  public._portal_reset_password_convite(uuid, text),
  public.regenerate_convite_token(uuid),
  public.portal_aprovar_proposta_atomica(uuid, uuid),
  public.check_rate_limit(text, text, integer, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public._campo_create_account(uuid, uuid, text, text, text, uuid),
  public._campo_create_account_convite(uuid, uuid, text, text, text, uuid),
  public._campo_registrar_foto(text, uuid, text),
  public._portal_create_account(uuid, uuid, text, text, text, uuid),
  public._portal_create_account_convite(uuid, uuid, text, text, text, uuid),
  public._portal_reset_password(uuid, text),
  public._portal_reset_password_convite(uuid, text),
  public.regenerate_convite_token(uuid),
  public.portal_aprovar_proposta_atomica(uuid, uuid),
  public.check_rate_limit(text, text, integer, integer)
TO service_role;

-- Chamadas só por outras funções SECURITY DEFINER (rodam como dono) ou pelo pg_cron.
REVOKE EXECUTE ON FUNCTION
  public._soft_delete_guard(text),
  public.notificar(uuid, uuid[], text, text, text, text, text, text, uuid, text, timestamptz),
  public._nome_do_ator(uuid),
  public._notificar_proxima_etapa(uuid, uuid),
  public._notificar_tarefa_atribuida(uuid, uuid),
  public._notif_resp_tarefa(uuid),
  public._notif_resp_disciplina(uuid),
  public._notif_resp_projeto(uuid),
  public._notif_ve_financeiro(uuid),
  public._notif_gestao(uuid),
  public._notif_gestao_operacional(uuid),
  public.find_or_create_fatura(uuid, date),
  public.recalc_disciplina_status_por_checklist(uuid),
  public.recalc_grupo_parcela_status(uuid),
  public.rpc_atualizar_status_atrasados(),
  public.gerar_alertas_ambient(),
  public.gerar_notificacoes_ambient(),
  public.gerar_notificacoes_ambient_monitored(),
  public.cleanup_expired_pending_signups(),
  public.cleanup_expired_pending_signups_monitored(),
  public.rate_limit_cleanup(),
  public.rate_limit_cleanup_monitored(),
  public.audit_log_cleanup_monitored(),
  public.notificacoes_email_imediato_monitored(),
  public.notificacoes_email_semanal_monitored()
FROM PUBLIC, anon, authenticated;
