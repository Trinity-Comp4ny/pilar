-- Índice nas chaves estrangeiras que ficaram sem cobertura (advisor `unindexed_foreign_keys`,
-- 135 achados em produção em 2026-10-14; baseline do audit-security: fk_sem_indice 126).
--
-- Por que importa: sem índice no lado filho, todo DELETE/UPDATE da tabela-pai varre o filho
-- inteiro (excluir projeto, pessoa ou empresa) e todo join por FK vira seq scan. Hoje o banco
-- tem 35 MB e ninguém sente; `tarefas.projeto_id`, `tarefas.responsavel_id` e
-- `obras.projeto_id` são join de tela e crescem com o uso.
--
-- Cobre 83 das 135: toda FK para `empresas` (coluna de tenant), toda FK com ON DELETE
-- CASCADE / SET NULL e toda FK para tabela de domínio. Ficam de fora de propósito 52 FKs de
-- auditoria (created_by, updated_by, criado_por...) para auth.users com NO ACTION: ninguém
-- filtra por elas e o custo de escrita não paga. O pgTAP `fk_sem_indice.sql` trava essa regra.
--
-- Tabelas pequenas: CREATE INDEX comum (bloqueia escrita por milissegundos). IF NOT EXISTS
-- deixa a migration idempotente.

CREATE INDEX IF NOT EXISTS idx_ai_token_ledger_agent_run_id ON public.ai_token_ledger (agent_run_id);
CREATE INDEX IF NOT EXISTS idx_ai_token_limite_usuario_user_id ON public.ai_token_limite_usuario (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_token_solicitacao_user_id ON public.ai_token_solicitacao (user_id);
CREATE INDEX IF NOT EXISTS idx_asaas_webhook_logs_empresa_id ON public.asaas_webhook_logs (empresa_id);
CREATE INDEX IF NOT EXISTS idx_campo_accounts_created_by ON public.campo_accounts (created_by);
CREATE INDEX IF NOT EXISTS idx_cartoes_conta_pagamento_id ON public.cartoes (conta_pagamento_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_empresa_id ON public.chat_sessions (empresa_id);
CREATE INDEX IF NOT EXISTS idx_consentimentos_cobranca_plan_id ON public.consentimentos_cobranca (plan_id);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_empresa_id ON public.data_deletion_requests (empresa_id);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_processed_by ON public.data_deletion_requests (processed_by);
CREATE INDEX IF NOT EXISTS idx_data_export_requests_empresa_id ON public.data_export_requests (empresa_id);
CREATE INDEX IF NOT EXISTS idx_escopo_historico_escopo_id ON public.escopo_historico (escopo_id);
CREATE INDEX IF NOT EXISTS idx_feature_suggestions_empresa_id ON public.feature_suggestions (empresa_id);
CREATE INDEX IF NOT EXISTS idx_grupos_parcela_categoria_id ON public.grupos_parcela (categoria_id);
CREATE INDEX IF NOT EXISTS idx_grupos_parcela_centro_custo_id ON public.grupos_parcela (centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_grupos_parcela_renegociado_de ON public.grupos_parcela (renegociado_de);
CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON public.jobs (created_by);
CREATE INDEX IF NOT EXISTS idx_marcos_faturamento_receita_id ON public.marcos_faturamento (receita_id);
CREATE INDEX IF NOT EXISTS idx_notificacao_preferencias_empresa_id ON public.notificacao_preferencias (empresa_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_empresa_id ON public.notificacoes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_conta_lancamento_empresa_id ON public.obra_conta_lancamento (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_conta_lancamento_fornecedor_id ON public.obra_conta_lancamento (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_obra_cotacao_empresa_id ON public.obra_cotacao (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_cotacao_proposta_vencedora_id ON public.obra_cotacao (proposta_vencedora_id);
CREATE INDEX IF NOT EXISTS idx_obra_cotacao_proposta_empresa_id ON public.obra_cotacao_proposta (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_cotacao_proposta_fornecedor_id ON public.obra_cotacao_proposta (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_obra_cotacao_proposta_item_empresa_id ON public.obra_cotacao_proposta_item (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_frente_empresa_id ON public.obra_frente (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_frente_parent_id ON public.obra_frente (parent_id);
CREATE INDEX IF NOT EXISTS idx_obra_material_empresa_id ON public.obra_material (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_material_mov_empresa_id ON public.obra_material_mov (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_material_mov_obra_conta_lancamento_id ON public.obra_material_mov (obra_conta_lancamento_id);
CREATE INDEX IF NOT EXISTS idx_obra_material_mov_obra_frente_id ON public.obra_material_mov (obra_frente_id);
CREATE INDEX IF NOT EXISTS idx_obra_material_mov_obra_rdo_id ON public.obra_material_mov (obra_rdo_id);
CREATE INDEX IF NOT EXISTS idx_obra_orcamento_etapa_empresa_id ON public.obra_orcamento_etapa (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_orcamento_etapa_obra_frente_id ON public.obra_orcamento_etapa (obra_frente_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_autor_id ON public.obra_rdo (autor_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_campo_account_id ON public.obra_rdo (campo_account_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_empresa_id ON public.obra_rdo (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_efetivo_campo_account_id ON public.obra_rdo_efetivo (campo_account_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_efetivo_empresa_id ON public.obra_rdo_efetivo (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_efetivo_fornecedor_id ON public.obra_rdo_efetivo (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_foto_campo_account_id ON public.obra_rdo_foto (campo_account_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_foto_empresa_id ON public.obra_rdo_foto (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_impedimento_campo_account_id ON public.obra_rdo_impedimento (campo_account_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_impedimento_empresa_id ON public.obra_rdo_impedimento (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_medicao_campo_account_id ON public.obra_rdo_medicao (campo_account_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_medicao_empresa_id ON public.obra_rdo_medicao (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_tarefa_campo_account_id ON public.obra_rdo_tarefa (campo_account_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_tarefa_empresa_id ON public.obra_rdo_tarefa (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_visita_campo_account_id ON public.obra_rdo_visita (campo_account_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_visita_empresa_id ON public.obra_rdo_visita (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_visita_fornecedor_id ON public.obra_rdo_visita (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_obras_projeto_id ON public.obras (projeto_id);
CREATE INDEX IF NOT EXISTS idx_obras_responsavel_id ON public.obras (responsavel_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_versoes_empresa_id ON public.orcamento_versoes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_profile_id ON public.pessoas (profile_id);
CREATE INDEX IF NOT EXISTS idx_pilar_checkout_webhook_logs_pending_signup_id ON public.pilar_checkout_webhook_logs (pending_signup_id);
CREATE INDEX IF NOT EXISTS idx_pilar_checkout_webhook_logs_subscription_id ON public.pilar_checkout_webhook_logs (subscription_id);
CREATE INDEX IF NOT EXISTS idx_pilar_pending_signups_empresa_owner_pending_id ON public.pilar_pending_signups (empresa_owner_pending_id);
CREATE INDEX IF NOT EXISTS idx_pilar_pending_signups_plan_id ON public.pilar_pending_signups (plan_id);
CREATE INDEX IF NOT EXISTS idx_pilar_subscriptions_pending_signup_id ON public.pilar_subscriptions (pending_signup_id);
CREATE INDEX IF NOT EXISTS idx_pilar_subscriptions_plan_id ON public.pilar_subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS idx_portal_download_logs_cliente_id ON public.portal_download_logs (cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_entregas_empresa_id ON public.portal_entregas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_profiles_empresa_id ON public.profiles (empresa_id);
CREATE INDEX IF NOT EXISTS idx_projeto_disciplina_checklist_concluido_por ON public.projeto_disciplina_checklist (concluido_por);
CREATE INDEX IF NOT EXISTS idx_projeto_disciplina_checklist_responsaveis_pessoa_id ON public.projeto_disciplina_checklist_responsaveis (pessoa_id);
CREATE INDEX IF NOT EXISTS idx_projeto_disciplina_pausas_pausado_por ON public.projeto_disciplina_pausas (pausado_por);
CREATE INDEX IF NOT EXISTS idx_projeto_disciplina_pausas_retomado_por ON public.projeto_disciplina_pausas (retomado_por);
CREATE INDEX IF NOT EXISTS idx_projeto_disciplina_revisoes_concluida_por ON public.projeto_disciplina_revisoes (concluida_por);
CREATE INDEX IF NOT EXISTS idx_projeto_disciplina_revisoes_registrada_por ON public.projeto_disciplina_revisoes (registrada_por);
CREATE INDEX IF NOT EXISTS idx_projeto_status_historico_mudado_por ON public.projeto_status_historico (mudado_por);
CREATE INDEX IF NOT EXISTS idx_proposta_disciplinas_empresa_id ON public.proposta_disciplinas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_status_incident_updates_created_by ON public.status_incident_updates (created_by);
CREATE INDEX IF NOT EXISTS idx_status_incidents_created_by ON public.status_incidents (created_by);
CREATE INDEX IF NOT EXISTS idx_tarefa_responsaveis_pessoa_id ON public.tarefa_responsaveis (pessoa_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_projeto_id ON public.tarefas (projeto_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel_id ON public.tarefas (responsavel_id);
CREATE INDEX IF NOT EXISTS idx_terms_acceptances_empresa_id ON public.terms_acceptances (empresa_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_lancamentos_aprovado_por ON public.timesheet_lancamentos (aprovado_por);
CREATE INDEX IF NOT EXISTS idx_timesheet_lancamentos_fase_id ON public.timesheet_lancamentos (fase_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_lancamentos_user_id ON public.timesheet_lancamentos (user_id);
