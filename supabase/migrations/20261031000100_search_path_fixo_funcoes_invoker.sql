-- Fixa o search_path das 26 funções SECURITY INVOKER do schema public que ainda não tinham
-- (advisor `function_search_path_mutable`, produção em 2026-10-14).
--
-- As SECURITY DEFINER já estavam fechadas (migration 20260849000000, baseline
-- `search_path_mutavel` = 0). Estas são INVOKER, então o risco é menor (rodam com o
-- privilégio de quem chama), mas o advisor segue acusando e a regra "toda função do app tem
-- search_path fixo" fica mais simples de travar por teste do que "só as DEFINER".
--
-- Seguro porque: nenhuma usa objeto de extensão sem qualificar (digest, crypt, similarity,
-- unaccent...). A única que fala com extensão, sentry_cron_checkin, chama `net.http_get`
-- qualificado e `gen_random_uuid()` (núcleo do Postgres). `pg_catalog` é sempre consultado
-- primeiro; `pg_temp` por último impede objeto temporário de sombrear nome de tabela.
--
-- Fora de escopo, de propósito: pg_trgm instalada em public (advisor `extension_in_public`).
-- Mover exige recriar os índices GIN que dependem dela; o ganho não paga o risco.

ALTER FUNCTION public._finance_display_date(date, date, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.audit_log_cleanup_monitored() SET search_path = public, pg_temp;
ALTER FUNCTION public.auto_complete_disciplinas() SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_status_data() SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_expired_pending_signups_monitored() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_despesa_data_pagamento() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_receita_data_recebimento() SET search_path = public, pg_temp;
ALTER FUNCTION public.gerar_notificacoes_ambient_monitored() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_finance_categorias(text, date, date) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_finance_chart_mensal(date, date) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_finance_chart_periodo(date, date) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_finance_stats(date, date) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_grupos_parcela_resumo(uuid[]) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_lancamentos_kpis(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_lancamentos_pagina(text, text, text, text, uuid[], uuid[], uuid[], uuid[], text[], numeric, numeric, text, text, text, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_lancamentos_resumo(text, text, text, text, uuid[], uuid[], uuid[], uuid[], text[], numeric, numeric, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.notificacoes_email_imediato_monitored() SET search_path = public, pg_temp;
ALTER FUNCTION public.notificacoes_email_semanal_monitored() SET search_path = public, pg_temp;
ALTER FUNCTION public.pilar_disciplina_status_canonico(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.pilar_status_bucket(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_company_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.rate_limit_cleanup_monitored() SET search_path = public, pg_temp;
ALTER FUNCTION public.sentry_cron_checkin(text, text, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_disciplina_codigo() SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_feature_flags_touch_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_protect_ultra_admin() SET search_path = public, pg_temp;
