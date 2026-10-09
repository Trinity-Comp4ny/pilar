-- Advisors de performance do Supabase (2026-10-09): índices duplicados e auth_rls_initplan.
--
-- 1. Índices duplicados: mesma tabela, mesmas colunas, mesmo predicado. Cada um custa
--    escrita e espaço sem ganho de leitura. Fica o da constraint (ou o mais antigo);
--    projetos_unique_empresa_codigo é o nome que src/lib/safeError.ts traduz.
-- 2. auth.uid() direto na policy é avaliado linha a linha. Dentro de (SELECT ...) o
--    planner calcula uma vez por consulta (InitPlan). Mesma regra, mesmo resultado;
--    só muda o custo. pgTAP rls_auth_uid_initplan.sql impede a volta.

-- =====================================================================
-- 1. Índices duplicados
-- =====================================================================

DROP INDEX IF EXISTS public.idx_campo_accounts_email;          -- = campo_accounts_email_key
DROP INDEX IF EXISTS public.idx_despesas_centro_custo_id;      -- = despesas_centro_custo_idx
DROP INDEX IF EXISTS public.idx_faturas_conta_pgto;            -- = idx_faturas_conta_pagamento_id
DROP INDEX IF EXISTS public.idx_folha_pessoa;                  -- = idx_folha_pagamento_pessoa_id
DROP INDEX IF EXISTS public.idx_obra_rdo_obra_data;            -- = obra_rdo_obra_id_data_key
DROP INDEX IF EXISTS public.idx_pilar_pending_signups_session; -- = pilar_pending_signups_checkout_session_token_key
DROP INDEX IF EXISTS public.idx_pilar_subscriptions_empresa;   -- = pilar_subscriptions_empresa_id_key
DROP INDEX IF EXISTS public.idx_receitas_centro_custo_id;      -- = receitas_centro_custo_idx
ALTER TABLE public.projeto_orcamento_fases
  DROP CONSTRAINT IF EXISTS projeto_orcamento_fases_projeto_disciplina_uq; -- = orcamento_unique_projeto_disciplina
ALTER TABLE public.projetos
  DROP CONSTRAINT IF EXISTS projetos_empresa_codigo_uq;         -- = projetos_unique_empresa_codigo

-- =====================================================================
-- 2. auth.uid() avaliado uma vez por consulta
-- =====================================================================

ALTER POLICY limite_usuario_select ON public.ai_token_limite_usuario
  USING (((user_id = (SELECT auth.uid())) OR ((empresa_id = get_user_empresa_id()) AND can_manage_equipe()) OR is_ultra_admin()));
ALTER POLICY solicitacao_select ON public.ai_token_solicitacao
  USING (((user_id = (SELECT auth.uid())) OR ((empresa_id = get_user_empresa_id()) AND can_manage_equipe()) OR is_ultra_admin()));
ALTER POLICY asaas_webhook_logs_select ON public.asaas_webhook_logs
  USING ((empresa_id IN ( SELECT profiles.empresa_id FROM profiles WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY chat_messages_owner_all ON public.chat_messages
  USING ((EXISTS ( SELECT 1 FROM chat_sessions s WHERE ((s.id = chat_messages.session_id) AND (s.user_id = (SELECT auth.uid()))))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM chat_sessions s WHERE ((s.id = chat_messages.session_id) AND (s.user_id = (SELECT auth.uid()))))));
ALTER POLICY chat_sessions_owner_all ON public.chat_sessions
  USING (((user_id = (SELECT auth.uid())) AND (empresa_id = get_user_empresa_id())))
  WITH CHECK (((user_id = (SELECT auth.uid())) AND (empresa_id = get_user_empresa_id())));
ALTER POLICY "Cookie Consents Insert Own" ON public.cookie_consents
  WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "Cookie Consents Select Own" ON public.cookie_consents
  USING ((user_id = (SELECT auth.uid())));
ALTER POLICY ddr_self_read ON public.data_deletion_requests
  USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "user creates own export requests" ON public.data_export_requests
  WITH CHECK (((SELECT auth.uid()) = user_id));
ALTER POLICY "user sees own export requests" ON public.data_export_requests
  USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "Feature Suggestions Insert Own" ON public.feature_suggestions
  WITH CHECK ((created_by = (SELECT auth.uid())));
ALTER POLICY impersonation_sessions_admin_read ON public.impersonation_sessions
  USING ((admin_id = (SELECT auth.uid())));
ALTER POLICY jobs_empresa_insert ON public.jobs
  WITH CHECK (((empresa_id = get_user_empresa_id()) AND (status = 'pending'::job_status) AND (progress = 0) AND (attempts = 0) AND (result IS NULL) AND (stage IS NULL) AND ((created_by IS NULL) OR (created_by = (SELECT auth.uid())))));
ALTER POLICY notificacao_preferencias_delete ON public.notificacao_preferencias
  USING ((user_id = (SELECT auth.uid())));
ALTER POLICY notificacao_preferencias_insert ON public.notificacao_preferencias
  WITH CHECK (((user_id = (SELECT auth.uid())) AND (empresa_id = get_user_empresa_id())));
ALTER POLICY notificacao_preferencias_select ON public.notificacao_preferencias
  USING ((user_id = (SELECT auth.uid())));
ALTER POLICY notificacao_preferencias_update ON public.notificacao_preferencias
  USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY notificacoes_select ON public.notificacoes
  USING (((destinatario_id = (SELECT auth.uid())) AND ((empresa_id = get_user_empresa_id()) OR is_ultra_admin())));
ALTER POLICY notificacoes_update ON public.notificacoes
  USING ((destinatario_id = (SELECT auth.uid())))
  WITH CHECK ((destinatario_id = (SELECT auth.uid())));
ALTER POLICY "Usuario edita seu profile" ON public.profiles
  USING ((id = (SELECT auth.uid())))
  WITH CHECK ((id = (SELECT auth.uid())));
ALTER POLICY "Terms Acceptances Insert Own" ON public.terms_acceptances
  WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "Terms Acceptances Select Own" ON public.terms_acceptances
  USING ((user_id = (SELECT auth.uid())));
ALTER POLICY insert_own ON public.timesheet_lancamentos
  WITH CHECK (((empresa_id = get_user_empresa_id()) AND (user_id = (SELECT auth.uid()))));
ALTER POLICY update_own_pending ON public.timesheet_lancamentos
  USING (((empresa_id = get_user_empresa_id()) AND ((user_id = (SELECT auth.uid())) OR user_has_feature('pessoas'::text))));
ALTER POLICY self_read_ultra_admin_modes ON public.ultra_admin_modes
  USING ((user_id = (SELECT auth.uid())));
