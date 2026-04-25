
drop trigger if exists "tr_audit_asaas_config" on "public"."asaas_config";

drop trigger if exists "tr_audit_chain_hash" on "public"."audit_logs";

drop trigger if exists "tr_audit_no_delete" on "public"."audit_logs";

drop trigger if exists "tr_audit_no_update" on "public"."audit_logs";

drop trigger if exists "tr_generate_critical_alert" on "public"."audit_logs";

drop trigger if exists "tr_audit_cartoes_credito" on "public"."cartoes_credito";

drop trigger if exists "tr_audit_cliente_portal_accounts" on "public"."cliente_portal_accounts";

drop trigger if exists "tr_audit_convites" on "public"."convites";

drop trigger if exists "tr_pilar_link_subscription_on_owner_used" on "public"."empresa_owners_pending";

drop trigger if exists "tr_audit_marcos_faturamento" on "public"."marcos_faturamento";

drop trigger if exists "tr_pilar_pending_signups_touch" on "public"."pilar_pending_signups";

drop trigger if exists "tr_pilar_subscriptions_touch" on "public"."pilar_subscriptions";

drop trigger if exists "tr_audit_portal_tokens" on "public"."portal_tokens";

drop trigger if exists "tr_enforce_profile_immutable" on "public"."profiles";

drop trigger if exists "tr_audit_propostas" on "public"."propostas";

drop trigger if exists "tr_audit_clientes" on "public"."clientes";

drop trigger if exists "tr_audit_contas" on "public"."contas";

drop trigger if exists "tr_audit_despesas" on "public"."despesas";

drop trigger if exists "tr_audit_empresas" on "public"."empresas";

drop trigger if exists "tr_audit_fornecedores" on "public"."fornecedores";

drop trigger if exists "tr_audit_leads" on "public"."leads";

drop trigger if exists "tr_audit_profiles" on "public"."profiles";

drop trigger if exists "tr_audit_projetos" on "public"."projetos";

drop trigger if exists "tr_audit_receitas" on "public"."receitas";

drop policy "asaas_config_admin_delete_mfa" on "public"."asaas_config";

drop policy "asaas_config_admin_insert_mfa" on "public"."asaas_config";

drop policy "asaas_config_admin_select" on "public"."asaas_config";

drop policy "asaas_config_admin_update_mfa" on "public"."asaas_config";

drop policy "asaas_webhook_logs_admin_select" on "public"."asaas_webhook_logs";

drop policy "audit_logs_admin_read" on "public"."audit_logs";

drop policy "convites_admin_full" on "public"."convites";

drop policy "critical_alerts_admin_read" on "public"."critical_alerts";

drop policy "plans_public_read" on "public"."pilar_subscription_plans";

drop policy "pilar_subscriptions_empresa_read" on "public"."pilar_subscriptions";

drop policy "portal_download_logs_admin" on "public"."portal_download_logs";

revoke delete on table "public"."audit_logs" from "anon";

revoke insert on table "public"."audit_logs" from "anon";

revoke references on table "public"."audit_logs" from "anon";

revoke select on table "public"."audit_logs" from "anon";

revoke trigger on table "public"."audit_logs" from "anon";

revoke truncate on table "public"."audit_logs" from "anon";

revoke update on table "public"."audit_logs" from "anon";

revoke delete on table "public"."audit_logs" from "authenticated";

revoke insert on table "public"."audit_logs" from "authenticated";

revoke references on table "public"."audit_logs" from "authenticated";

revoke select on table "public"."audit_logs" from "authenticated";

revoke trigger on table "public"."audit_logs" from "authenticated";

revoke truncate on table "public"."audit_logs" from "authenticated";

revoke update on table "public"."audit_logs" from "authenticated";

revoke delete on table "public"."audit_logs" from "service_role";

revoke insert on table "public"."audit_logs" from "service_role";

revoke references on table "public"."audit_logs" from "service_role";

revoke select on table "public"."audit_logs" from "service_role";

revoke trigger on table "public"."audit_logs" from "service_role";

revoke truncate on table "public"."audit_logs" from "service_role";

revoke update on table "public"."audit_logs" from "service_role";

revoke delete on table "public"."convites" from "anon";

revoke insert on table "public"."convites" from "anon";

revoke references on table "public"."convites" from "anon";

revoke select on table "public"."convites" from "anon";

revoke trigger on table "public"."convites" from "anon";

revoke truncate on table "public"."convites" from "anon";

revoke update on table "public"."convites" from "anon";

revoke delete on table "public"."convites" from "authenticated";

revoke insert on table "public"."convites" from "authenticated";

revoke references on table "public"."convites" from "authenticated";

revoke select on table "public"."convites" from "authenticated";

revoke trigger on table "public"."convites" from "authenticated";

revoke truncate on table "public"."convites" from "authenticated";

revoke update on table "public"."convites" from "authenticated";

revoke delete on table "public"."convites" from "service_role";

revoke insert on table "public"."convites" from "service_role";

revoke references on table "public"."convites" from "service_role";

revoke select on table "public"."convites" from "service_role";

revoke trigger on table "public"."convites" from "service_role";

revoke truncate on table "public"."convites" from "service_role";

revoke update on table "public"."convites" from "service_role";

revoke delete on table "public"."critical_alerts" from "anon";

revoke insert on table "public"."critical_alerts" from "anon";

revoke references on table "public"."critical_alerts" from "anon";

revoke select on table "public"."critical_alerts" from "anon";

revoke trigger on table "public"."critical_alerts" from "anon";

revoke truncate on table "public"."critical_alerts" from "anon";

revoke update on table "public"."critical_alerts" from "anon";

revoke delete on table "public"."critical_alerts" from "authenticated";

revoke insert on table "public"."critical_alerts" from "authenticated";

revoke references on table "public"."critical_alerts" from "authenticated";

revoke select on table "public"."critical_alerts" from "authenticated";

revoke trigger on table "public"."critical_alerts" from "authenticated";

revoke truncate on table "public"."critical_alerts" from "authenticated";

revoke update on table "public"."critical_alerts" from "authenticated";

revoke delete on table "public"."critical_alerts" from "service_role";

revoke insert on table "public"."critical_alerts" from "service_role";

revoke references on table "public"."critical_alerts" from "service_role";

revoke select on table "public"."critical_alerts" from "service_role";

revoke trigger on table "public"."critical_alerts" from "service_role";

revoke truncate on table "public"."critical_alerts" from "service_role";

revoke update on table "public"."critical_alerts" from "service_role";

revoke delete on table "public"."empresa_owners_pending" from "anon";

revoke insert on table "public"."empresa_owners_pending" from "anon";

revoke references on table "public"."empresa_owners_pending" from "anon";

revoke select on table "public"."empresa_owners_pending" from "anon";

revoke trigger on table "public"."empresa_owners_pending" from "anon";

revoke truncate on table "public"."empresa_owners_pending" from "anon";

revoke update on table "public"."empresa_owners_pending" from "anon";

revoke delete on table "public"."empresa_owners_pending" from "authenticated";

revoke insert on table "public"."empresa_owners_pending" from "authenticated";

revoke references on table "public"."empresa_owners_pending" from "authenticated";

revoke select on table "public"."empresa_owners_pending" from "authenticated";

revoke trigger on table "public"."empresa_owners_pending" from "authenticated";

revoke truncate on table "public"."empresa_owners_pending" from "authenticated";

revoke update on table "public"."empresa_owners_pending" from "authenticated";

revoke delete on table "public"."empresa_owners_pending" from "service_role";

revoke insert on table "public"."empresa_owners_pending" from "service_role";

revoke references on table "public"."empresa_owners_pending" from "service_role";

revoke select on table "public"."empresa_owners_pending" from "service_role";

revoke trigger on table "public"."empresa_owners_pending" from "service_role";

revoke truncate on table "public"."empresa_owners_pending" from "service_role";

revoke update on table "public"."empresa_owners_pending" from "service_role";

revoke delete on table "public"."mfa_backup_codes" from "anon";

revoke insert on table "public"."mfa_backup_codes" from "anon";

revoke references on table "public"."mfa_backup_codes" from "anon";

revoke select on table "public"."mfa_backup_codes" from "anon";

revoke trigger on table "public"."mfa_backup_codes" from "anon";

revoke truncate on table "public"."mfa_backup_codes" from "anon";

revoke update on table "public"."mfa_backup_codes" from "anon";

revoke delete on table "public"."mfa_backup_codes" from "authenticated";

revoke insert on table "public"."mfa_backup_codes" from "authenticated";

revoke references on table "public"."mfa_backup_codes" from "authenticated";

revoke select on table "public"."mfa_backup_codes" from "authenticated";

revoke trigger on table "public"."mfa_backup_codes" from "authenticated";

revoke truncate on table "public"."mfa_backup_codes" from "authenticated";

revoke update on table "public"."mfa_backup_codes" from "authenticated";

revoke delete on table "public"."mfa_backup_codes" from "service_role";

revoke insert on table "public"."mfa_backup_codes" from "service_role";

revoke references on table "public"."mfa_backup_codes" from "service_role";

revoke select on table "public"."mfa_backup_codes" from "service_role";

revoke trigger on table "public"."mfa_backup_codes" from "service_role";

revoke truncate on table "public"."mfa_backup_codes" from "service_role";

revoke update on table "public"."mfa_backup_codes" from "service_role";

revoke delete on table "public"."pilar_checkout_webhook_logs" from "anon";

revoke insert on table "public"."pilar_checkout_webhook_logs" from "anon";

revoke references on table "public"."pilar_checkout_webhook_logs" from "anon";

revoke select on table "public"."pilar_checkout_webhook_logs" from "anon";

revoke trigger on table "public"."pilar_checkout_webhook_logs" from "anon";

revoke truncate on table "public"."pilar_checkout_webhook_logs" from "anon";

revoke update on table "public"."pilar_checkout_webhook_logs" from "anon";

revoke delete on table "public"."pilar_checkout_webhook_logs" from "authenticated";

revoke insert on table "public"."pilar_checkout_webhook_logs" from "authenticated";

revoke references on table "public"."pilar_checkout_webhook_logs" from "authenticated";

revoke select on table "public"."pilar_checkout_webhook_logs" from "authenticated";

revoke trigger on table "public"."pilar_checkout_webhook_logs" from "authenticated";

revoke truncate on table "public"."pilar_checkout_webhook_logs" from "authenticated";

revoke update on table "public"."pilar_checkout_webhook_logs" from "authenticated";

revoke delete on table "public"."pilar_checkout_webhook_logs" from "service_role";

revoke insert on table "public"."pilar_checkout_webhook_logs" from "service_role";

revoke references on table "public"."pilar_checkout_webhook_logs" from "service_role";

revoke select on table "public"."pilar_checkout_webhook_logs" from "service_role";

revoke trigger on table "public"."pilar_checkout_webhook_logs" from "service_role";

revoke truncate on table "public"."pilar_checkout_webhook_logs" from "service_role";

revoke update on table "public"."pilar_checkout_webhook_logs" from "service_role";

revoke delete on table "public"."pilar_pending_signups" from "anon";

revoke insert on table "public"."pilar_pending_signups" from "anon";

revoke references on table "public"."pilar_pending_signups" from "anon";

revoke select on table "public"."pilar_pending_signups" from "anon";

revoke trigger on table "public"."pilar_pending_signups" from "anon";

revoke truncate on table "public"."pilar_pending_signups" from "anon";

revoke update on table "public"."pilar_pending_signups" from "anon";

revoke delete on table "public"."pilar_pending_signups" from "authenticated";

revoke insert on table "public"."pilar_pending_signups" from "authenticated";

revoke references on table "public"."pilar_pending_signups" from "authenticated";

revoke select on table "public"."pilar_pending_signups" from "authenticated";

revoke trigger on table "public"."pilar_pending_signups" from "authenticated";

revoke truncate on table "public"."pilar_pending_signups" from "authenticated";

revoke update on table "public"."pilar_pending_signups" from "authenticated";

revoke delete on table "public"."pilar_pending_signups" from "service_role";

revoke insert on table "public"."pilar_pending_signups" from "service_role";

revoke references on table "public"."pilar_pending_signups" from "service_role";

revoke select on table "public"."pilar_pending_signups" from "service_role";

revoke trigger on table "public"."pilar_pending_signups" from "service_role";

revoke truncate on table "public"."pilar_pending_signups" from "service_role";

revoke update on table "public"."pilar_pending_signups" from "service_role";

revoke delete on table "public"."pilar_subscription_plans" from "anon";

revoke insert on table "public"."pilar_subscription_plans" from "anon";

revoke references on table "public"."pilar_subscription_plans" from "anon";

revoke select on table "public"."pilar_subscription_plans" from "anon";

revoke trigger on table "public"."pilar_subscription_plans" from "anon";

revoke truncate on table "public"."pilar_subscription_plans" from "anon";

revoke update on table "public"."pilar_subscription_plans" from "anon";

revoke delete on table "public"."pilar_subscription_plans" from "authenticated";

revoke insert on table "public"."pilar_subscription_plans" from "authenticated";

revoke references on table "public"."pilar_subscription_plans" from "authenticated";

revoke select on table "public"."pilar_subscription_plans" from "authenticated";

revoke trigger on table "public"."pilar_subscription_plans" from "authenticated";

revoke truncate on table "public"."pilar_subscription_plans" from "authenticated";

revoke update on table "public"."pilar_subscription_plans" from "authenticated";

revoke delete on table "public"."pilar_subscription_plans" from "service_role";

revoke insert on table "public"."pilar_subscription_plans" from "service_role";

revoke references on table "public"."pilar_subscription_plans" from "service_role";

revoke select on table "public"."pilar_subscription_plans" from "service_role";

revoke trigger on table "public"."pilar_subscription_plans" from "service_role";

revoke truncate on table "public"."pilar_subscription_plans" from "service_role";

revoke update on table "public"."pilar_subscription_plans" from "service_role";

revoke delete on table "public"."pilar_subscriptions" from "anon";

revoke insert on table "public"."pilar_subscriptions" from "anon";

revoke references on table "public"."pilar_subscriptions" from "anon";

revoke select on table "public"."pilar_subscriptions" from "anon";

revoke trigger on table "public"."pilar_subscriptions" from "anon";

revoke truncate on table "public"."pilar_subscriptions" from "anon";

revoke update on table "public"."pilar_subscriptions" from "anon";

revoke delete on table "public"."pilar_subscriptions" from "authenticated";

revoke insert on table "public"."pilar_subscriptions" from "authenticated";

revoke references on table "public"."pilar_subscriptions" from "authenticated";

revoke select on table "public"."pilar_subscriptions" from "authenticated";

revoke trigger on table "public"."pilar_subscriptions" from "authenticated";

revoke truncate on table "public"."pilar_subscriptions" from "authenticated";

revoke update on table "public"."pilar_subscriptions" from "authenticated";

revoke delete on table "public"."pilar_subscriptions" from "service_role";

revoke insert on table "public"."pilar_subscriptions" from "service_role";

revoke references on table "public"."pilar_subscriptions" from "service_role";

revoke select on table "public"."pilar_subscriptions" from "service_role";

revoke trigger on table "public"."pilar_subscriptions" from "service_role";

revoke truncate on table "public"."pilar_subscriptions" from "service_role";

revoke update on table "public"."pilar_subscriptions" from "service_role";

revoke delete on table "public"."portal_download_logs" from "anon";

revoke insert on table "public"."portal_download_logs" from "anon";

revoke references on table "public"."portal_download_logs" from "anon";

revoke select on table "public"."portal_download_logs" from "anon";

revoke trigger on table "public"."portal_download_logs" from "anon";

revoke truncate on table "public"."portal_download_logs" from "anon";

revoke update on table "public"."portal_download_logs" from "anon";

revoke delete on table "public"."portal_download_logs" from "authenticated";

revoke insert on table "public"."portal_download_logs" from "authenticated";

revoke references on table "public"."portal_download_logs" from "authenticated";

revoke select on table "public"."portal_download_logs" from "authenticated";

revoke trigger on table "public"."portal_download_logs" from "authenticated";

revoke truncate on table "public"."portal_download_logs" from "authenticated";

revoke update on table "public"."portal_download_logs" from "authenticated";

revoke delete on table "public"."portal_download_logs" from "service_role";

revoke insert on table "public"."portal_download_logs" from "service_role";

revoke references on table "public"."portal_download_logs" from "service_role";

revoke select on table "public"."portal_download_logs" from "service_role";

revoke trigger on table "public"."portal_download_logs" from "service_role";

revoke truncate on table "public"."portal_download_logs" from "service_role";

revoke update on table "public"."portal_download_logs" from "service_role";

revoke delete on table "public"."rate_limit_attempts" from "anon";

revoke insert on table "public"."rate_limit_attempts" from "anon";

revoke references on table "public"."rate_limit_attempts" from "anon";

revoke select on table "public"."rate_limit_attempts" from "anon";

revoke trigger on table "public"."rate_limit_attempts" from "anon";

revoke truncate on table "public"."rate_limit_attempts" from "anon";

revoke update on table "public"."rate_limit_attempts" from "anon";

revoke delete on table "public"."rate_limit_attempts" from "authenticated";

revoke insert on table "public"."rate_limit_attempts" from "authenticated";

revoke references on table "public"."rate_limit_attempts" from "authenticated";

revoke select on table "public"."rate_limit_attempts" from "authenticated";

revoke trigger on table "public"."rate_limit_attempts" from "authenticated";

revoke truncate on table "public"."rate_limit_attempts" from "authenticated";

revoke update on table "public"."rate_limit_attempts" from "authenticated";

revoke delete on table "public"."rate_limit_attempts" from "service_role";

revoke insert on table "public"."rate_limit_attempts" from "service_role";

revoke references on table "public"."rate_limit_attempts" from "service_role";

revoke select on table "public"."rate_limit_attempts" from "service_role";

revoke trigger on table "public"."rate_limit_attempts" from "service_role";

revoke truncate on table "public"."rate_limit_attempts" from "service_role";

revoke update on table "public"."rate_limit_attempts" from "service_role";

alter table "public"."audit_logs" drop constraint "audit_logs_action_check";

alter table "public"."convites" drop constraint "convites_criado_por_fkey";

alter table "public"."convites" drop constraint "convites_empresa_id_fkey";

alter table "public"."convites" drop constraint "convites_token_key";

alter table "public"."critical_alerts" drop constraint "critical_alerts_empresa_id_fkey";

alter table "public"."critical_alerts" drop constraint "critical_alerts_severity_check";

alter table "public"."empresa_owners_pending" drop constraint "empresa_owners_pending_criado_por_fkey";

alter table "public"."empresa_owners_pending" drop constraint "empresa_owners_pending_email_key";

alter table "public"."empresa_owners_pending" drop constraint "empresa_owners_pending_token_key";

alter table "public"."mfa_backup_codes" drop constraint "mfa_backup_codes_user_id_fkey";

alter table "public"."pilar_checkout_webhook_logs" drop constraint "pilar_checkout_webhook_logs_pending_signup_id_fkey";

alter table "public"."pilar_checkout_webhook_logs" drop constraint "pilar_checkout_webhook_logs_subscription_id_fkey";

alter table "public"."pilar_pending_signups" drop constraint "pilar_pending_signups_billing_cycle_check";

alter table "public"."pilar_pending_signups" drop constraint "pilar_pending_signups_billing_type_check";

alter table "public"."pilar_pending_signups" drop constraint "pilar_pending_signups_checkout_session_token_key";

alter table "public"."pilar_pending_signups" drop constraint "pilar_pending_signups_empresa_owner_pending_id_fkey";

alter table "public"."pilar_pending_signups" drop constraint "pilar_pending_signups_payment_status_check";

alter table "public"."pilar_pending_signups" drop constraint "pilar_pending_signups_plan_id_fkey";

alter table "public"."pilar_subscription_plans" drop constraint "pilar_subscription_plans_slug_key";

alter table "public"."pilar_subscriptions" drop constraint "pilar_subscriptions_billing_cycle_check";

alter table "public"."pilar_subscriptions" drop constraint "pilar_subscriptions_empresa_id_fkey";

alter table "public"."pilar_subscriptions" drop constraint "pilar_subscriptions_empresa_id_key";

alter table "public"."pilar_subscriptions" drop constraint "pilar_subscriptions_pending_signup_id_fkey";

alter table "public"."pilar_subscriptions" drop constraint "pilar_subscriptions_plan_id_fkey";

alter table "public"."pilar_subscriptions" drop constraint "pilar_subscriptions_status_check";

alter table "public"."portal_download_logs" drop constraint "portal_download_logs_cliente_id_fkey";

alter table "public"."portal_download_logs" drop constraint "portal_download_logs_empresa_id_fkey";

alter table "public"."portal_entregas" drop constraint "portal_entregas_entregavel_pai_id_fkey";

drop view if exists "public"."view_security_status";

drop function if exists "public"."_count_cron_jobs"();

drop function if exists "public"."admin_mfa_required"();

drop view if exists "public"."asaas_config_safe";

drop function if exists "public"."audit_log_chain_hash"();

drop function if exists "public"."audit_log_cleanup"();

drop function if exists "public"."audit_log_readonly"();

drop function if exists "public"."audit_log_trigger"();

drop function if exists "public"."audit_log_verify_chain"(p_from timestamp with time zone);

drop function if exists "public"."check_rate_limit"(p_action text, p_key text, p_max_attempts integer, p_window_seconds integer);

drop function if exists "public"."create_convite"(p_email text, p_cargo text, p_nome text);

drop function if exists "public"."create_portal_token"(p_projeto_id uuid, p_cliente_id uuid, p_email_cliente text, p_dias_validade integer);

drop function if exists "public"."enforce_profile_immutable_fields"();

drop function if exists "public"."generate_critical_alert"();

drop function if exists "public"."get_asaas_api_key"(p_empresa_id uuid);

drop function if exists "public"."get_portal_entrega_download_url"(p_entrega_id uuid, p_token text, p_expires_in_seconds integer);

drop function if exists "public"."guard_login_attempt"(p_email text);

drop function if exists "public"."has_aal2"();

drop function if exists "public"."jsonb_diff"(old_data jsonb, new_data jsonb);

drop function if exists "public"."mfa_backup_codes_remaining"();

drop function if exists "public"."mfa_consume_backup_code"(p_code text);

drop function if exists "public"."mfa_generate_backup_codes"();

drop function if exists "public"."portal_logout"(p_token text);

drop trigger if exists "tr_revoke_sessions_on_pwd_change" on "auth"."users";

drop function if exists "public"."revoke_all_sessions_on_password_change"();

drop function if exists "public"."set_asaas_api_key"(p_empresa_id uuid, p_api_key text);

drop function if exists "public"."tg_pilar_link_subscription_on_owner_used"();

drop function if exists "public"."tg_pilar_touch_updated_at"();

drop function if exists "public"."user_mfa_required"();

drop view if exists "public"."view_admins_sem_mfa";

alter table "public"."audit_logs" drop constraint "audit_logs_pkey";

alter table "public"."convites" drop constraint "convites_pkey";

alter table "public"."critical_alerts" drop constraint "critical_alerts_pkey";

alter table "public"."empresa_owners_pending" drop constraint "empresa_owners_pending_pkey";

alter table "public"."mfa_backup_codes" drop constraint "mfa_backup_codes_pkey";

alter table "public"."pilar_checkout_webhook_logs" drop constraint "pilar_checkout_webhook_logs_pkey";

alter table "public"."pilar_pending_signups" drop constraint "pilar_pending_signups_pkey";

alter table "public"."pilar_subscription_plans" drop constraint "pilar_subscription_plans_pkey";

alter table "public"."pilar_subscriptions" drop constraint "pilar_subscriptions_pkey";

alter table "public"."portal_download_logs" drop constraint "portal_download_logs_pkey";

alter table "public"."rate_limit_attempts" drop constraint "rate_limit_attempts_pkey";

drop index if exists "public"."audit_logs_pkey";

drop index if exists "public"."convites_pkey";

drop index if exists "public"."convites_token_key";

drop index if exists "public"."critical_alerts_pkey";

drop index if exists "public"."empresa_owners_pending_email_key";

drop index if exists "public"."empresa_owners_pending_pkey";

drop index if exists "public"."empresa_owners_pending_token_key";

drop index if exists "public"."idx_audit_logs_actor";

drop index if exists "public"."idx_audit_logs_empresa_created";

drop index if exists "public"."idx_audit_logs_row_hash";

drop index if exists "public"."idx_audit_logs_target";

drop index if exists "public"."idx_convites_email";

drop index if exists "public"."idx_convites_empresa";

drop index if exists "public"."idx_convites_token";

drop index if exists "public"."idx_critical_alerts_empresa";

drop index if exists "public"."idx_critical_alerts_unnotified";

drop index if exists "public"."idx_empresa_owners_pending_email";

drop index if exists "public"."idx_empresa_owners_pending_token";

drop index if exists "public"."idx_mfa_backup_codes_user";

drop index if exists "public"."idx_pilar_pending_signups_asaas_payment";

drop index if exists "public"."idx_pilar_pending_signups_asaas_subscription";

drop index if exists "public"."idx_pilar_pending_signups_email";

drop index if exists "public"."idx_pilar_pending_signups_session";

drop index if exists "public"."idx_pilar_subscriptions_asaas_sub";

drop index if exists "public"."idx_pilar_subscriptions_empresa";

drop index if exists "public"."idx_pilar_subscriptions_status";

drop index if exists "public"."idx_pilar_webhook_logs_payment";

drop index if exists "public"."idx_pilar_webhook_logs_subscription";

drop index if exists "public"."idx_portal_download_logs_empresa";

drop index if exists "public"."idx_portal_entregas_empresa_projeto";

drop index if exists "public"."idx_portal_entregas_pai";

drop index if exists "public"."idx_portal_entregas_status";

drop index if exists "public"."idx_portal_tokens_token_hash";

drop index if exists "public"."idx_rate_limit_lookup";

drop index if exists "public"."mfa_backup_codes_pkey";

drop index if exists "public"."pilar_checkout_webhook_logs_pkey";

drop index if exists "public"."pilar_pending_signups_checkout_session_token_key";

drop index if exists "public"."pilar_pending_signups_pkey";

drop index if exists "public"."pilar_subscription_plans_pkey";

drop index if exists "public"."pilar_subscription_plans_slug_key";

drop index if exists "public"."pilar_subscriptions_empresa_id_key";

drop index if exists "public"."pilar_subscriptions_pkey";

drop index if exists "public"."portal_download_logs_pkey";

drop index if exists "public"."rate_limit_attempts_pkey";

drop table "public"."audit_logs";

drop table "public"."convites";

drop table "public"."critical_alerts";

drop table "public"."empresa_owners_pending";

drop table "public"."mfa_backup_codes";

drop table "public"."pilar_checkout_webhook_logs";

drop table "public"."pilar_pending_signups";

drop table "public"."pilar_subscription_plans";

drop table "public"."pilar_subscriptions";

drop table "public"."portal_download_logs";

drop table "public"."rate_limit_attempts";

drop view if exists "public"."view_folha_pagamento";

alter table "public"."projetos" alter column "status" drop default;

alter type "public"."status_projeto" rename to "status_projeto__old_version_to_be_dropped";

create type "public"."status_projeto" as enum ('Planejamento', 'Execução', 'Paralisado', 'Concluído', 'Cancelado', 'Em andamento', 'Revisão');

alter table "public"."projetos" alter column status type "public"."status_projeto" using status::text::"public"."status_projeto";

alter table "public"."projetos" alter column "status" set default 'Planejamento'::public.status_projeto;

drop type "public"."status_projeto__old_version_to_be_dropped";

CREATE OR REPLACE VIEW public.view_folha_pagamento AS
SELECT
  p.id as pessoa_id, p.nome as pessoa_nome, p.cargo, p.empresa_id,
  COALESCE(p.salario_fixo, 0) as salario_fixo,
  COALESCE(p.valor_m2, 0) as valor_m2,
  COUNT(DISTINCT proj.id) as qtd_projetos,
  COALESCE(SUM(proj.area_m2), 0) as total_area_m2,
  COALESCE(SUM(proj.area_m2 * COALESCE(p.valor_m2, 0)), 0) as total_comissao,
  (COALESCE(p.salario_fixo, 0) + COALESCE(SUM(proj.area_m2 * COALESCE(p.valor_m2, 0)), 0)) as total_receber
FROM public.pessoas p
LEFT JOIN public.projetos proj ON proj.empresa_id = p.empresa_id
  AND proj.deleted_at IS NULL
  AND proj.status IN ('Planejamento', 'Em andamento')
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(proj.disciplinas) AS d WHERE (d->>'responsavel_id')::uuid = p.id)
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.nome, p.cargo, p.empresa_id, p.salario_fixo, p.valor_m2;

GRANT SELECT ON public.view_folha_pagamento TO authenticated;

alter table "public"."asaas_config" drop column "api_key_encrypted";

alter table "public"."asaas_config" drop column "api_key_nonce";

alter table "public"."asaas_config" drop column "webhook_token";

alter table "public"."portal_entregas" drop column "arquivo_mime";

alter table "public"."portal_entregas" drop column "arquivo_nome";

alter table "public"."portal_entregas" drop column "arquivo_path";

alter table "public"."portal_entregas" drop column "arquivo_tamanho_bytes";

alter table "public"."portal_entregas" drop column "disciplina";

alter table "public"."portal_entregas" drop column "entregavel_pai_id";

alter table "public"."portal_entregas" drop column "fase";

alter table "public"."portal_entregas" drop column "respondido_empresa_em";

alter table "public"."portal_entregas" drop column "resposta_empresa";

alter table "public"."portal_entregas" drop column "versao";

alter table "public"."portal_tokens" drop column "token_hash";

alter table "public"."portal_tokens" alter column "expira_em" drop default;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.admin_create_company_owner(p_email text, p_nome text, p_company_name text DEFAULT 'Minha Empresa'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  caller_role user_role;
BEGIN
  -- Verifica se quem chama é admin (ou será chamado com service_role)
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem criar donos de empresa';
  END IF;

  -- Retorna as instruções para criação via Supabase Admin API
  -- (o usuário precisa ser criado via auth.admin.createUser com os metadados corretos)
  RETURN json_build_object(
    'instruction', 'Use supabase auth admin createUser com os seguintes metadados',
    'email', p_email,
    'user_metadata', json_build_object(
      'is_company_owner', 'true',
      'company_name', p_company_name,
      'nome', p_nome
    )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_gerar_alertas(p_empresa_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  alert_count INTEGER := 0;
  r RECORD;
BEGIN
  -- 1. Projetos com horas consumidas > 80% e faturamento < 50%
  FOR r IN
    SELECT p.id, p.nome,
      COALESCE(SUM(t.horas), 0) AS horas_consumidas,
      COALESCE(SUM(o.horas_estimadas), 0) AS horas_orcadas,
      COALESCE((SELECT SUM(rv.valor) FROM receitas rv WHERE rv.projeto_id = p.id AND rv.deleted_at IS NULL AND rv.status = 'Recebido'), 0) AS recebido,
      COALESCE(p.valor_contrato, 0) AS valor_contrato
    FROM projetos p
    LEFT JOIN timesheets t ON t.projeto_id = p.id AND t.deleted_at IS NULL AND t.status = 'aprovado'
    LEFT JOIN projeto_orcamento_fases o ON o.projeto_id = p.id AND o.deleted_at IS NULL
    WHERE p.empresa_id = p_empresa_id AND p.deleted_at IS NULL AND p.status = 'Em andamento'
    GROUP BY p.id, p.nome, p.valor_contrato
    HAVING COALESCE(SUM(o.horas_estimadas), 0) > 0
  LOOP
    IF r.horas_orcadas > 0 AND (r.horas_consumidas / r.horas_orcadas) > 0.8
       AND r.valor_contrato > 0 AND (r.recebido / r.valor_contrato) < 0.5 THEN
      IF NOT EXISTS (
        SELECT 1 FROM alertas a
        WHERE a.empresa_id = p_empresa_id AND a.tipo = 'horas_excedidas'
          AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '7 days'
      ) THEN
        INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
        VALUES (p_empresa_id, 'horas_excedidas', 'high',
          'Horas excedidas: ' || r.nome,
          'Projeto consumiu ' || ROUND((r.horas_consumidas / r.horas_orcadas * 100)::numeric, 0) || '% das horas mas faturou apenas ' || ROUND((r.recebido / NULLIF(r.valor_contrato, 0) * 100)::numeric, 0) || '%',
          'projeto', r.id);
        alert_count := alert_count + 1;
      END IF;
    END IF;
  END LOOP;

  -- 2. Receitas atrasadas > 15 dias
  FOR r IN
    SELECT rv.id, rv.descricao, rv.data_vencimento, rv.valor,
      c.nome AS cliente_nome, rv.projeto_id
    FROM receitas rv
    LEFT JOIN clientes c ON c.id = rv.cliente_id
    WHERE rv.empresa_id = p_empresa_id AND rv.deleted_at IS NULL
      AND rv.status = 'Pendente'
      AND rv.data_vencimento < CURRENT_DATE - INTERVAL '15 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM alertas a
      WHERE a.empresa_id = p_empresa_id AND a.tipo = 'pagamento_atrasado'
        AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '7 days'
    ) THEN
      INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
      VALUES (p_empresa_id, 'pagamento_atrasado', 'high',
        'Pagamento atrasado: ' || COALESCE(r.cliente_nome, r.descricao),
        'Receita de R$ ' || TO_CHAR(r.valor, 'FM999G999D00') || ' vencida em ' || TO_CHAR(r.data_vencimento, 'DD/MM/YYYY'),
        'receita', r.id);
      alert_count := alert_count + 1;
    END IF;
  END LOOP;

  -- 3. Receitas vencendo nos próximos 7 dias (alerta preventivo)
  FOR r IN
    SELECT rv.id, rv.descricao, rv.data_vencimento, rv.valor,
      c.nome AS cliente_nome, p.nome AS projeto_nome
    FROM receitas rv
    LEFT JOIN clientes c ON c.id = rv.cliente_id
    LEFT JOIN projetos p ON p.id = rv.projeto_id
    WHERE rv.empresa_id = p_empresa_id AND rv.deleted_at IS NULL
      AND rv.status = 'Pendente'
      AND rv.data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM alertas a
      WHERE a.empresa_id = p_empresa_id AND a.tipo = 'vencimento_proximo'
        AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '7 days'
    ) THEN
      INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
      VALUES (p_empresa_id, 'vencimento_proximo', 'medium',
        'Vencimento próximo: ' || COALESCE(r.projeto_nome, r.descricao),
        'Receita "' || r.descricao || '" de R$ ' || TO_CHAR(r.valor, 'FM999G999D00') || ' vence em ' || TO_CHAR(r.data_vencimento, 'DD/MM/YYYY'),
        'receita', r.id);
      alert_count := alert_count + 1;
    END IF;
  END LOOP;

  -- 4. Marcos de faturamento pendentes com data prevista nos próximos 7 dias
  FOR r IN
    SELECT mf.id, mf.nome, mf.data_prevista, mf.valor,
      p.nome AS projeto_nome
    FROM marcos_faturamento mf
    JOIN projetos p ON p.id = mf.projeto_id
    WHERE p.empresa_id = p_empresa_id AND mf.deleted_at IS NULL
      AND mf.status = 'pendente'
      AND mf.data_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM alertas a
      WHERE a.empresa_id = p_empresa_id AND a.tipo = 'marco_proximo'
        AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '7 days'
    ) THEN
      INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
      VALUES (p_empresa_id, 'marco_proximo', 'medium',
        'Marco próximo: ' || r.projeto_nome,
        'Marco "' || r.nome || '" de R$ ' || TO_CHAR(r.valor, 'FM999G999D00') || ' previsto para ' || TO_CHAR(r.data_prevista, 'DD/MM/YYYY'),
        'marco', r.id);
      alert_count := alert_count + 1;
    END IF;
  END LOOP;

  -- 5. Projetos com recebimento baixo vs progresso das disciplinas
  FOR r IN
    SELECT p.id, p.nome, p.valor_contrato,
      COALESCE((SELECT SUM(rv.valor) FROM receitas rv WHERE rv.projeto_id = p.id AND rv.deleted_at IS NULL AND rv.status IN ('Recebido', 'Pago')), 0) AS recebido,
      COALESCE(p.valor_contrato, 0) AS contrato,
      (SELECT COUNT(*) FILTER (WHERE d.elem->>'status' = 'Concluído') * 100.0 / NULLIF(COUNT(*), 0)
       FROM jsonb_array_elements(p.disciplinas::jsonb) AS d(elem)) AS progresso_pct
    FROM projetos p
    WHERE p.empresa_id = p_empresa_id AND p.deleted_at IS NULL
      AND p.status = 'Em andamento'
      AND p.valor_contrato > 0
      AND jsonb_array_length(COALESCE(p.disciplinas::jsonb, '[]'::jsonb)) > 0
  LOOP
    -- Se progresso > 60% mas recebimento < 30%, alerta
    IF r.progresso_pct IS NOT NULL AND r.progresso_pct > 60
       AND r.contrato > 0 AND (r.recebido / r.contrato) < 0.3 THEN
      IF NOT EXISTS (
        SELECT 1 FROM alertas a
        WHERE a.empresa_id = p_empresa_id AND a.tipo = 'recebimento_baixo'
          AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '14 days'
      ) THEN
        INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
        VALUES (p_empresa_id, 'recebimento_baixo', 'critical',
          'Recebimento baixo: ' || r.nome,
          'Projeto ' || ROUND(r.progresso_pct::numeric, 0) || '% concluído mas apenas ' || ROUND((r.recebido / r.contrato * 100)::numeric, 0) || '% recebido (R$ ' || TO_CHAR(r.recebido, 'FM999G999D00') || ' de R$ ' || TO_CHAR(r.contrato, 'FM999G999D00') || ')',
          'projeto', r.id);
        alert_count := alert_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN alert_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public._portal_create_account(p_cliente_id uuid, p_empresa_id uuid, p_nome text, p_email text, p_senha text, p_created_by uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  INSERT INTO cliente_portal_accounts (cliente_id, empresa_id, nome, email, senha_hash, created_by)
  VALUES (p_cliente_id, p_empresa_id, p_nome, p_email, crypt(p_senha, gen_salt('bf')), p_created_by);
END;
$function$
;

CREATE OR REPLACE FUNCTION public._portal_reset_password(p_account_id uuid, p_nova_senha text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  UPDATE cliente_portal_accounts
  SET senha_hash = crypt(p_nova_senha, gen_salt('bf')),
      token_sessao = NULL,
      token_expira_em = NULL,
      updated_at = NOW()
  WHERE id = p_account_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_status_data()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Se projeto está concluído, verifica se foi no prazo ou com atraso
  IF NEW.status = 'Concluído' AND NEW.data_final IS NOT NULL AND NEW.data_previsao IS NOT NULL THEN
    IF NEW.data_final <= NEW.data_previsao THEN
      NEW.status_data := 'concluido_no_prazo';
    ELSE
      NEW.status_data := 'concluido_com_atraso';
    END IF;
  -- Se projeto está cancelado
  ELSIF NEW.status = 'Cancelado' THEN
    NEW.status_data := 'cancelado';
  -- Se projeto tem data de previsão
  ELSIF NEW.data_previsao IS NOT NULL THEN
    DECLARE
      dias_diferenca INTEGER;
    BEGIN
      dias_diferenca := NEW.data_previsao - CURRENT_DATE;
      
      IF dias_diferenca < 0 THEN
        NEW.status_data := 'em_atraso';
      ELSIF dias_diferenca <= 7 THEN
        NEW.status_data := 'atencao';
      ELSE
        NEW.status_data := 'no_prazo';
      END IF;
    END;
  ELSE
    NEW.status_data := NULL;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.gerar_fatura(p_cartao_id uuid, p_mes integer, p_ano integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fatura_id UUID;
  v_dia_fechamento INTEGER;
  v_dia_vencimento INTEGER;
  v_data_inicio DATE;
  v_data_fim DATE;
  v_data_vencimento DATE;
  v_empresa_id UUID;
  v_valor_total DECIMAL(12,2);
  v_max_day_fim INTEGER;
  v_max_day_venc INTEGER;
BEGIN
  -- Buscar dados do cartão
  SELECT dia_fechamento, dia_vencimento, empresa_id
  INTO v_dia_fechamento, v_dia_vencimento, v_empresa_id
  FROM cartoes_credito WHERE id = p_cartao_id AND deleted_at IS NULL;

  IF v_dia_fechamento IS NULL THEN
    RAISE EXCEPTION 'Cartão não encontrado';
  END IF;

  -- Verificação de segurança
  IF v_empresa_id != public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Calcular datas do ciclo
  -- data_fim = dia_fechamento do mês de referência (limitado ao último dia do mês)
  v_max_day_fim := EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p_ano, p_mes, 1)) + INTERVAL '1 month - 1 day'))::INTEGER;
  v_data_fim := make_date(p_ano, p_mes, LEAST(v_dia_fechamento, v_max_day_fim));

  -- data_inicio = dia_fechamento+1 do mês anterior
  v_data_inicio := (v_data_fim - INTERVAL '1 month')::DATE + INTERVAL '1 day';

  -- data_vencimento = dia_vencimento do mês de referência
  v_max_day_venc := EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p_ano, p_mes, 1)) + INTERVAL '1 month - 1 day'))::INTEGER;
  v_data_vencimento := make_date(p_ano, p_mes, LEAST(v_dia_vencimento, v_max_day_venc));

  -- Se dia_vencimento < dia_fechamento, o vencimento é no mês seguinte
  IF v_dia_vencimento < v_dia_fechamento THEN
    v_data_vencimento := v_data_vencimento + INTERVAL '1 month';
  END IF;

  -- Upsert da fatura
  INSERT INTO faturas (empresa_id, cartao_id, mes_referencia, ano_referencia,
                       data_inicio, data_fim, data_vencimento, status)
  VALUES (v_empresa_id, p_cartao_id, p_mes, p_ano,
          v_data_inicio, v_data_fim, v_data_vencimento, 'Aberta')
  ON CONFLICT (cartao_id, mes_referencia, ano_referencia)
  DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_fatura_id;

  -- Associar despesas não vinculadas ao ciclo
  UPDATE despesas
  SET fatura_id = v_fatura_id
  WHERE cartao_id = p_cartao_id
    AND deleted_at IS NULL
    AND data_vencimento >= v_data_inicio
    AND data_vencimento <= v_data_fim
    AND fatura_id IS NULL;

  -- Atualizar total da fatura
  SELECT COALESCE(SUM(valor), 0) INTO v_valor_total
  FROM despesas
  WHERE fatura_id = v_fatura_id
    AND cartao_id IS NOT NULL
    AND deleted_at IS NULL;

  UPDATE faturas SET valor_total = v_valor_total WHERE id = v_fatura_id;

  RETURN v_fatura_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_cliente_projeto_detail(p_projeto_id uuid, p_token text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente_id UUID;
  v_empresa_id UUID;
  result JSON;
BEGIN
  SELECT cpa.cliente_id, cpa.empresa_id
  INTO v_cliente_id, v_empresa_id
  FROM cliente_portal_accounts cpa
  WHERE cpa.token_sessao = p_token
    AND cpa.token_expira_em > NOW()
    AND cpa.ativo = true;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  SELECT json_build_object(
    'projeto_id', p.id,
    'cliente_id', p.cliente_id,
    'empresa_id', p.empresa_id,
    'projeto_nome', p.nome,
    'projeto_status', p.status,
    'projeto_codigo', p.codigo_projeto,
    'data_inicio', p.data_inicio,
    'data_previsao', p.data_previsao,
    'data_final', p.data_final,
    'valor_contrato', p.valor_contrato,
    'disciplinas', p.disciplinas,
    'cliente_nome', c.nome,
    'empresa_nome', e.nome
  ) INTO result
  FROM projetos p
  JOIN clientes c ON c.id = p.cliente_id
  JOIN empresas e ON e.id = p.empresa_id
  WHERE p.id = p_projeto_id
    AND p.cliente_id = v_cliente_id
    AND p.empresa_id = v_empresa_id
    AND p.deleted_at IS NULL;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_cliente_projetos(p_token text DEFAULT NULL::text)
 RETURNS SETOF json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente_id UUID;
  v_empresa_id UUID;
BEGIN
  -- Valida sessão via token
  SELECT cpa.cliente_id, cpa.empresa_id
  INTO v_cliente_id, v_empresa_id
  FROM cliente_portal_accounts cpa
  WHERE cpa.token_sessao = p_token
    AND cpa.token_expira_em > NOW()
    AND cpa.ativo = true;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  RETURN QUERY
  SELECT json_build_object(
    'projeto_id', p.id,
    'projeto_nome', p.nome,
    'projeto_codigo', p.codigo_projeto,
    'projeto_status', p.status,
    'data_inicio', p.data_inicio,
    'data_previsao', p.data_previsao,
    'valor_contrato', p.valor_contrato,
    'disciplinas', p.disciplinas,
    'empresa_nome', e.nome
  )
  FROM projetos p
  JOIN empresas e ON e.id = p.empresa_id
  WHERE p.cliente_id = v_cliente_id
    AND p.empresa_id = v_empresa_id
    AND p.deleted_at IS NULL
  ORDER BY
    CASE p.status
      WHEN 'Em andamento' THEN 1
      WHEN 'Revisão' THEN 2
      WHEN 'Planejamento' THEN 3
      WHEN 'Paralisado' THEN 4
      WHEN 'Concluído' THEN 5
      WHEN 'Cancelado' THEN 6
    END,
    p.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_folha_preview(p_mes integer, p_ano integer)
 RETURNS TABLE(pessoa_id uuid, nome text, cargo text, salario_fixo numeric, valor_m2 numeric, total_area numeric, total_variavel numeric, total_receber numeric, projetos_nomes text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  RETURN QUERY
  WITH projetos_periodo AS (
    SELECT 
      pr.id,
      pr.nome as projeto_nome,
      pr.area_m2,
      pr.disciplinas
    FROM public.projetos pr
    WHERE pr.empresa_id = v_empresa_id
    AND EXTRACT(MONTH FROM pr.data_inicio) = p_mes
    AND EXTRACT(YEAR FROM pr.data_inicio) = p_ano
  ),
  calculo_por_pessoa AS (
    SELECT 
      pe.id as p_id,
      pe.nome as p_nome,
      pe.cargo as p_cargo,
      COALESCE(pe.salario_fixo, 0) as p_salario_fixo,
      COALESCE(pe.valor_m2, 0) as p_valor_m2,
      COALESCE(SUM(pp.area_m2) FILTER (WHERE pp.id IS NOT NULL), 0) as soma_area,
      array_agg(pp.projeto_nome) FILTER (WHERE pp.id IS NOT NULL) as lista_projetos
    FROM public.pessoas pe
    LEFT JOIN projetos_periodo pp ON EXISTS (
      SELECT 1 
      FROM jsonb_array_elements(pp.disciplinas) as d
      WHERE (d->>'responsavel_id')::uuid = pe.id
    )
    WHERE pe.empresa_id = v_empresa_id
    GROUP BY pe.id
  )
  SELECT 
    c.p_id,
    c.p_nome,
    c.p_cargo,
    c.p_salario_fixo,
    c.p_valor_m2,
    c.soma_area,
    (c.soma_area * c.p_valor_m2)::DECIMAL(10,2) as v_variavel,
    (c.p_salario_fixo + (c.soma_area * c.p_valor_m2))::DECIMAL(10,2) as v_total,
    COALESCE(c.lista_projetos, ARRAY[]::TEXT[])
  FROM calculo_por_pessoa c
  ORDER BY c.p_nome;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_escopo_aprovado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
  v_empresa_id UUID;
BEGIN
  -- Só executa quando status muda para 'aprovado' e tipo é 'aditivo'
  IF NEW.status = 'aprovado' AND NEW.tipo = 'aditivo'
     AND (OLD.status IS DISTINCT FROM 'aprovado') THEN

    v_empresa_id := NEW.empresa_id;

    -- Para cada item do escopo, upsert no orçamento
    FOR v_item IN
      SELECT disciplina, horas, custo
      FROM escopo_itens
      WHERE escopo_id = NEW.id
    LOOP
      INSERT INTO projeto_orcamento_fases (
        empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora, valor_venda
      ) VALUES (
        v_empresa_id, NEW.projeto_id, v_item.disciplina,
        COALESCE(v_item.horas, 0),
        CASE WHEN v_item.horas > 0 THEN COALESCE(v_item.custo, 0) / v_item.horas ELSE 0 END,
        COALESCE(v_item.custo, 0) * 1.3 -- margem 30% sobre custo
      )
      ON CONFLICT (projeto_id, disciplina) DO UPDATE SET
        horas_estimadas = projeto_orcamento_fases.horas_estimadas + COALESCE(v_item.horas, 0),
        valor_venda = projeto_orcamento_fases.valor_venda + (COALESCE(v_item.custo, 0) * 1.3),
        updated_at = NOW();
    END LOOP;

    -- Atualizar valor_contrato do projeto
    IF NEW.valor_aditivo IS NOT NULL AND NEW.valor_aditivo > 0 THEN
      UPDATE projetos
      SET valor_contrato = COALESCE(valor_contrato, 0) + NEW.valor_aditivo,
          updated_at = NOW()
      WHERE id = NEW.projeto_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id UUID;
  v_role user_role;
  meta_empresa_id TEXT;
  meta_cargo TEXT;
  meta_nome TEXT;
  meta_is_owner TEXT;
BEGIN
  meta_empresa_id := NEW.raw_user_meta_data->>'empresa_id_convite';
  meta_cargo := NEW.raw_user_meta_data->>'cargo_convite';
  meta_nome := NEW.raw_user_meta_data->>'nome';
  meta_is_owner := NEW.raw_user_meta_data->>'is_company_owner';

  -- CENÁRIO 1: FUNCIONÁRIO CONVIDADO (tem empresa_id_convite)
  IF meta_empresa_id IS NOT NULL THEN
    v_empresa_id := meta_empresa_id::UUID;
    
    -- Valida que a empresa existe
    IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = v_empresa_id) THEN
      RAISE EXCEPTION 'Empresa do convite não encontrada';
    END IF;
    
    BEGIN
      v_role := meta_cargo::user_role;
    EXCEPTION WHEN OTHERS THEN
      v_role := 'user';
    END;

    INSERT INTO public.profiles (id, empresa_id, nome, email, role, onboarding_completed)
    VALUES (NEW.id, v_empresa_id, COALESCE(meta_nome, NEW.email), NEW.email, v_role, FALSE);

  -- CENÁRIO 2: NOVO DONO DE EMPRESA (criado via admin com flag is_company_owner)
  ELSIF meta_is_owner = 'true' THEN
    INSERT INTO public.empresas (owner_id, nome, onboarding_completed)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa'), FALSE)
    RETURNING id INTO v_empresa_id;

    INSERT INTO public.profiles (id, empresa_id, nome, email, role, onboarding_completed)
    VALUES (NEW.id, v_empresa_id, COALESCE(meta_nome, NEW.email), NEW.email, 'admin', FALSE);

  -- CENÁRIO 3: SIGNUP NÃO AUTORIZADO → rejeitar
  ELSE
    RAISE EXCEPTION 'Cadastro não autorizado. Entre em contato com a equipe comercial.';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_orcamento_versao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dados JSONB;
  v_versao INTEGER;
  v_empresa_id UUID;
BEGIN
  -- Pegar empresa_id do projeto
  SELECT empresa_id INTO v_empresa_id FROM projetos WHERE id = NEW.projeto_id;

  -- Snapshot atual do orçamento
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'disciplina', disciplina,
    'horas_estimadas', horas_estimadas,
    'custo_hora', custo_hora,
    'valor_venda', valor_venda,
    'margem_alvo_pct', margem_alvo_pct
  )), '[]'::JSONB)
  INTO v_dados
  FROM projeto_orcamento_fases
  WHERE projeto_id = NEW.projeto_id AND deleted_at IS NULL;

  -- Próxima versão
  SELECT COALESCE(MAX(versao), 0) + 1 INTO v_versao
  FROM orcamento_versoes
  WHERE projeto_id = NEW.projeto_id;

  -- Salvar versão
  INSERT INTO orcamento_versoes (empresa_id, projeto_id, versao, dados, criado_por, motivo)
  VALUES (v_empresa_id, NEW.projeto_id, v_versao, v_dados, auth.uid(), 'Atualização automática');

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.link_pessoa_profile_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NEW.email IS NOT NULL THEN
        -- Attempt to find a profile with this email
        NEW.profile_id := (SELECT id FROM public.profiles WHERE email = NEW.email LIMIT 1);
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.link_profile_pessoa_after()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- When a profile is created/updated, link it to any existing pessoa with same email
    UPDATE public.pessoas
    SET profile_id = NEW.id
    WHERE email = NEW.email;
    RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.pagar_fatura(p_fatura_id uuid, p_conta_id uuid, p_valor_pago numeric DEFAULT NULL::numeric, p_data_pagamento date DEFAULT CURRENT_DATE)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fatura RECORD;
  v_valor_a_pagar DECIMAL(12,2);
BEGIN
  -- Lock e buscar fatura
  SELECT f.*, cc.nome as cartao_nome
  INTO v_fatura
  FROM faturas f
  JOIN cartoes_credito cc ON f.cartao_id = cc.id
  WHERE f.id = p_fatura_id
    AND f.deleted_at IS NULL
  FOR UPDATE;

  IF v_fatura IS NULL THEN
    RAISE EXCEPTION 'Fatura não encontrada';
  END IF;

  IF v_fatura.empresa_id != public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_fatura.status = 'Paga' THEN
    RAISE EXCEPTION 'Fatura já está paga';
  END IF;

  -- Calcular valor a pagar
  v_valor_a_pagar := COALESCE(p_valor_pago, v_fatura.valor_total - v_fatura.valor_pago);

  IF v_valor_a_pagar <= 0 THEN
    RAISE EXCEPTION 'Valor de pagamento inválido';
  END IF;

  -- 1. Atualizar fatura
  UPDATE faturas SET
    valor_pago = valor_pago + v_valor_a_pagar,
    conta_pagamento_id = p_conta_id,
    data_pagamento = p_data_pagamento,
    status = CASE
      WHEN (valor_pago + v_valor_a_pagar) >= valor_total THEN 'Paga'
      ELSE 'Parcial'
    END
  WHERE id = p_fatura_id;

  -- 2. Se totalmente paga, marcar despesas do cartão como Pago
  IF (v_fatura.valor_pago + v_valor_a_pagar) >= v_fatura.valor_total THEN
    UPDATE despesas SET
      status = 'Pago',
      data_pagamento = p_data_pagamento
    WHERE fatura_id = p_fatura_id
      AND cartao_id IS NOT NULL
      AND deleted_at IS NULL
      AND status = 'Pendente';
  END IF;

  -- 3. Criar débito na conta bancária (marcado como pagamento de fatura)
  INSERT INTO despesas (
    empresa_id,
    descricao,
    valor,
    data_vencimento,
    data_pagamento,
    status,
    conta_id,
    cartao_id,
    fatura_id,
    observacao,
    is_fatura_payment
  ) VALUES (
    v_fatura.empresa_id,
    'Pgto Fatura ' || v_fatura.cartao_nome || ' ' ||
      LPAD(v_fatura.mes_referencia::TEXT, 2, '0') || '/' || v_fatura.ano_referencia,
    v_valor_a_pagar,
    v_fatura.data_vencimento,
    p_data_pagamento,
    'Pago',
    p_conta_id,
    NULL,
    p_fatura_id,
    'Pagamento de fatura de cartão de crédito',
    true
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.portal_login(p_email text, p_senha text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_account RECORD;
  v_token TEXT;
BEGIN
  SELECT id, cliente_id, empresa_id, nome, email, senha_hash, ativo
  INTO v_account
  FROM cliente_portal_accounts
  WHERE email = lower(trim(p_email));

  IF v_account IS NULL THEN
    RAISE EXCEPTION 'Email ou senha inválidos';
  END IF;

  IF NOT v_account.ativo THEN
    RAISE EXCEPTION 'Acesso desativado';
  END IF;

  IF v_account.senha_hash IS NULL OR crypt(p_senha, v_account.senha_hash) != v_account.senha_hash THEN
    RAISE EXCEPTION 'Email ou senha inválidos';
  END IF;

  -- Gera token de sessão
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Atualiza token e último acesso
  UPDATE cliente_portal_accounts
  SET token_sessao = v_token,
      token_expira_em = NOW() + INTERVAL '30 days',
      ultimo_acesso = NOW()
  WHERE id = v_account.id;

  RETURN json_build_object(
    'token', v_token,
    'id', v_account.id,
    'cliente_id', v_account.cliente_id,
    'empresa_id', v_account.empresa_id,
    'nome', v_account.nome,
    'email', v_account.email
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.portal_verify_session(p_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_account RECORD;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN NULL;
  END IF;

  SELECT id, cliente_id, empresa_id, nome, email
  INTO v_account
  FROM cliente_portal_accounts
  WHERE token_sessao = p_token
    AND token_expira_em > NOW()
    AND ativo = true;

  IF v_account IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'id', v_account.id,
    'cliente_id', v_account.cliente_id,
    'empresa_id', v_account.empresa_id,
    'nome', v_account.nome,
    'email', v_account.email
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_calcular_wip(p_mes integer, p_ano integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id UUID;
  v_projeto RECORD;
  v_horas NUMERIC;
  v_custo NUMERIC;
  v_faturado NUMERIC;
  v_recebido NUMERIC;
  v_custo_hora_medio NUMERIC;
  v_count INTEGER := 0;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  FOR v_projeto IN
    SELECT p.id, p.nome
    FROM projetos p
    WHERE p.empresa_id = v_empresa_id
      AND p.deleted_at IS NULL
      AND p.status IN ('Planejamento', 'Em andamento', 'Revisão', 'Concluído')
  LOOP
    -- Custo/hora médio do orçamento
    SELECT COALESCE(
      CASE WHEN SUM(horas_estimadas) > 0
        THEN SUM(horas_estimadas * custo_hora) / SUM(horas_estimadas)
        ELSE 0
      END, 0)
    INTO v_custo_hora_medio
    FROM projeto_orcamento_fases
    WHERE projeto_id = v_projeto.id AND deleted_at IS NULL;

    -- Horas realizadas (aprovadas) até o fim do mês
    SELECT COALESCE(SUM(horas), 0) INTO v_horas
    FROM timesheets
    WHERE projeto_id = v_projeto.id
      AND status = 'aprovado'
      AND deleted_at IS NULL
      AND data <= (make_date(p_ano, p_mes, 1) + INTERVAL '1 month - 1 day')::DATE;

    v_custo := v_horas * v_custo_hora_medio;

    -- Faturado (marcos faturados/recebidos) até o fim do mês
    SELECT COALESCE(SUM(valor), 0) INTO v_faturado
    FROM marcos_faturamento
    WHERE projeto_id = v_projeto.id
      AND status IN ('faturado', 'recebido')
      AND deleted_at IS NULL
      AND data_faturada <= (make_date(p_ano, p_mes, 1) + INTERVAL '1 month - 1 day')::DATE;

    -- Recebido (receitas efetivamente recebidas)
    SELECT COALESCE(SUM(valor), 0) INTO v_recebido
    FROM receitas
    WHERE projeto_id = v_projeto.id
      AND status = 'Recebido'
      AND deleted_at IS NULL
      AND data_recebimento <= (make_date(p_ano, p_mes, 1) + INTERVAL '1 month - 1 day')::DATE;

    -- Skip se tudo zero
    IF v_horas = 0 AND v_faturado = 0 AND v_recebido = 0 THEN
      CONTINUE;
    END IF;

    -- Upsert
    INSERT INTO wip_snapshots (empresa_id, projeto_id, mes, ano, horas_realizadas, custo_realizado, faturado, recebido)
    VALUES (v_empresa_id, v_projeto.id, p_mes, p_ano, v_horas, v_custo, v_faturado, v_recebido)
    ON CONFLICT (projeto_id, mes, ano) DO UPDATE SET
      horas_realizadas = EXCLUDED.horas_realizadas,
      custo_realizado = EXCLUDED.custo_realizado,
      faturado = EXCLUDED.faturado,
      recebido = EXCLUDED.recebido;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_converter_lead_cliente(p_lead_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead RECORD;
  v_empresa_id UUID;
  v_cliente_id UUID;
BEGIN
  -- Buscar o lead
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  -- Verificar se já foi convertido
  IF v_lead.cliente_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead já foi convertido em cliente';
  END IF;

  v_empresa_id := v_lead.empresa_id;

  -- Criar o cliente a partir dos dados do lead
  INSERT INTO clientes (empresa_id, nome, email, contato, origem)
  VALUES (v_empresa_id, v_lead.nome, v_lead.email, v_lead.contato, v_lead.origem)
  RETURNING id INTO v_cliente_id;

  -- Atualizar o lead
  UPDATE leads
  SET status = 'Ganho',
      cliente_id = v_cliente_id,
      convertido_em = NOW()
  WHERE id = p_lead_id;

  RETURN v_cliente_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_converter_proposta_projeto(p_proposta_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proposta RECORD;
  v_empresa_id UUID;
  v_projeto_id UUID;
  v_disc RECORD;
  v_disciplinas_json JSONB := '[]'::JSONB;
  v_codigo TEXT;
  v_seq INT;
BEGIN
  -- Buscar proposta
  SELECT * INTO v_proposta FROM propostas WHERE id = p_proposta_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada';
  END IF;

  IF v_proposta.projeto_id IS NOT NULL THEN
    RAISE EXCEPTION 'Proposta já foi convertida em projeto';
  END IF;

  v_empresa_id := v_proposta.empresa_id;

  -- Gerar codigo sequencial único por empresa
  SELECT COALESCE(MAX(
    CASE WHEN codigo_projeto ~ '^PRJ-\d+$'
      THEN CAST(SUBSTRING(codigo_projeto FROM 5) AS INT)
      ELSE 0
    END
  ), 0) + 1
  INTO v_seq
  FROM projetos
  WHERE empresa_id = v_empresa_id;

  v_codigo := 'PRJ-' || LPAD(v_seq::TEXT, 4, '0');

  -- Montar JSON de disciplinas a partir de proposta_disciplinas
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nome', pd.disciplina,
    'horas_estimadas', pd.horas_estimadas,
    'custo_hora', pd.custo_hora,
    'valor_venda', pd.valor_venda
  )), '[]'::JSONB)
  INTO v_disciplinas_json
  FROM proposta_disciplinas pd
  WHERE pd.proposta_id = p_proposta_id;

  -- Criar projeto
  INSERT INTO projetos (
    empresa_id, codigo_projeto, nome, cliente_id, valor_contrato,
    area_m2, localizacao, status, prioridade, disciplinas,
    data_inicio, data_previsao, observacao
  ) VALUES (
    v_empresa_id,
    v_codigo,
    v_proposta.titulo,
    v_proposta.cliente_id,
    COALESCE(v_proposta.valor_proposto, 0),
    v_proposta.area_m2,
    v_proposta.localizacao,
    'Planejamento',
    'Media',
    v_disciplinas_json,
    CURRENT_DATE,
    CASE WHEN v_proposta.prazo_estimado_dias IS NOT NULL
      THEN CURRENT_DATE + (v_proposta.prazo_estimado_dias || ' days')::INTERVAL
      ELSE NULL
    END,
    v_proposta.observacao
  )
  RETURNING id INTO v_projeto_id;

  -- Criar orcamento por fase/disciplina a partir de proposta_disciplinas
  FOR v_disc IN
    SELECT disciplina, horas_estimadas, custo_hora, valor_venda
    FROM proposta_disciplinas
    WHERE proposta_id = p_proposta_id
  LOOP
    INSERT INTO projeto_orcamento_fases (
      empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora, valor_venda, margem_alvo_pct
    ) VALUES (
      v_empresa_id, v_projeto_id, v_disc.disciplina,
      v_disc.horas_estimadas, v_disc.custo_hora, v_disc.valor_venda,
      CASE WHEN v_disc.custo_hora > 0 AND v_disc.horas_estimadas > 0 AND v_disc.valor_venda > 0
        THEN ROUND(((v_disc.valor_venda - (v_disc.horas_estimadas * v_disc.custo_hora)) / v_disc.valor_venda) * 100, 2)
        ELSE 20.0
      END
    );
  END LOOP;

  -- Atualizar proposta: vincular ao projeto e marcar como aceita
  UPDATE propostas
  SET projeto_id = v_projeto_id,
      status = 'aceita'
  WHERE id = p_proposta_id;

  RETURN v_projeto_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_faturar_marco(p_marco_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_marco RECORD;
  v_projeto RECORD;
  v_receita_id UUID;
BEGIN
  -- Buscar o marco
  SELECT * INTO v_marco FROM marcos_faturamento WHERE id = p_marco_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Marco não encontrado';
  END IF;

  IF v_marco.status != 'pendente' THEN
    RAISE EXCEPTION 'Apenas marcos pendentes podem ser faturados';
  END IF;

  -- Buscar dados do projeto
  SELECT id, cliente_id, empresa_id, nome FROM projetos
  WHERE id = v_marco.projeto_id AND deleted_at IS NULL
  INTO v_projeto;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  -- Criar receita
  INSERT INTO receitas (
    empresa_id, descricao, valor, data_vencimento, status,
    projeto_id, cliente_id
  ) VALUES (
    v_projeto.empresa_id,
    'Marco: ' || v_marco.nome || ' — ' || v_projeto.nome,
    v_marco.valor,
    CURRENT_DATE,
    'Pendente',
    v_marco.projeto_id,
    v_projeto.cliente_id
  )
  RETURNING id INTO v_receita_id;

  -- Atualizar o marco
  UPDATE marcos_faturamento
  SET status = 'faturado',
      data_faturada = CURRENT_DATE,
      receita_id = v_receita_id
  WHERE id = p_marco_id;

  RETURN v_receita_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_gerar_alertas()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  alert_count INTEGER := 0;
  r RECORD;
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();
  
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não associado a uma empresa';
  END IF;

  FOR r IN
    SELECT p.id, p.nome,
      COALESCE(SUM(t.horas), 0) AS horas_consumidas,
      COALESCE(SUM(o.horas_estimadas), 0) AS horas_orcadas,
      COALESCE((SELECT SUM(rv.valor) FROM receitas rv WHERE rv.projeto_id = p.id AND rv.deleted_at IS NULL AND rv.status = 'Recebido'), 0) AS recebido,
      COALESCE(p.valor_contrato, 0) AS valor_contrato
    FROM projetos p
    LEFT JOIN timesheets t ON t.projeto_id = p.id AND t.deleted_at IS NULL AND t.status = 'aprovado'
    LEFT JOIN projeto_orcamento_fases o ON o.projeto_id = p.id AND o.deleted_at IS NULL
    WHERE p.empresa_id = v_empresa_id AND p.deleted_at IS NULL AND p.status = 'Em andamento'
    GROUP BY p.id, p.nome, p.valor_contrato
    HAVING COALESCE(SUM(o.horas_estimadas), 0) > 0
  LOOP
    IF r.horas_orcadas > 0 AND (r.horas_consumidas / r.horas_orcadas) > 0.8
       AND r.valor_contrato > 0 AND (r.recebido / r.valor_contrato) < 0.5 THEN
      IF NOT EXISTS (
        SELECT 1 FROM alertas a
        WHERE a.empresa_id = v_empresa_id AND a.tipo = 'horas_excedidas'
          AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '7 days'
      ) THEN
        INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
        VALUES (v_empresa_id, 'horas_excedidas', 'high',
          'Horas excedidas: ' || r.nome,
          'Projeto consumiu ' || ROUND((r.horas_consumidas / r.horas_orcadas * 100)::numeric, 0) || '% das horas mas faturou apenas ' || ROUND((r.recebido / NULLIF(r.valor_contrato, 0) * 100)::numeric, 0) || '%',
          'projeto', r.id);
        alert_count := alert_count + 1;
      END IF;
    END IF;
  END LOOP;

  FOR r IN
    SELECT rv.id, rv.descricao, rv.data_vencimento, rv.valor,
      c.nome AS cliente_nome
    FROM receitas rv
    LEFT JOIN clientes c ON c.id = rv.cliente_id
    WHERE rv.empresa_id = v_empresa_id AND rv.deleted_at IS NULL
      AND rv.status = 'Pendente'
      AND rv.data_vencimento < CURRENT_DATE - INTERVAL '15 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM alertas a
      WHERE a.empresa_id = v_empresa_id AND a.tipo = 'pagamento_atrasado'
        AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '7 days'
    ) THEN
      INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
      VALUES (v_empresa_id, 'pagamento_atrasado', 'high',
        'Pagamento atrasado: ' || COALESCE(r.cliente_nome, r.descricao),
        'Receita de R$ ' || r.valor || ' vencida em ' || TO_CHAR(r.data_vencimento, 'DD/MM/YYYY'),
        'cliente', r.id);
      alert_count := alert_count + 1;
    END IF;
  END LOOP;

  RETURN alert_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_gerar_parcelas_projeto(p_projeto_id uuid, p_num_parcelas integer DEFAULT 1, p_intervalo_dias integer DEFAULT 30)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_projeto RECORD;
  v_valor_parcela NUMERIC;
  v_data_base DATE;
  i INTEGER;
  parcelas_criadas INTEGER := 0;
BEGIN
  -- Busca dados do projeto
  SELECT id, valor_contrato, cliente_id, empresa_id, data_inicio, nome, codigo_projeto
  INTO v_projeto
  FROM projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_projeto IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto.valor_contrato IS NULL OR v_projeto.valor_contrato <= 0 THEN
    RAISE EXCEPTION 'Projeto sem valor de contrato';
  END IF;

  IF p_num_parcelas < 1 OR p_num_parcelas > 60 THEN
    RAISE EXCEPTION 'Número de parcelas deve ser entre 1 e 60';
  END IF;

  v_valor_parcela := ROUND(v_projeto.valor_contrato / p_num_parcelas, 2);
  v_data_base := COALESCE(v_projeto.data_inicio, CURRENT_DATE);

  FOR i IN 1..p_num_parcelas LOOP
    INSERT INTO receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id)
    VALUES (
      v_projeto.empresa_id,
      v_projeto.codigo_projeto || ' - Parcela ' || i || '/' || p_num_parcelas,
      v_valor_parcela,
      v_data_base + ((i - 1) * p_intervalo_dias),
      'Pendente',
      p_projeto_id,
      v_projeto.cliente_id
    );
    parcelas_criadas := parcelas_criadas + 1;
  END LOOP;

  -- Ajusta última parcela para fechar o valor exato (evita centavos perdidos)
  IF p_num_parcelas > 1 THEN
    UPDATE receitas
    SET valor = v_projeto.valor_contrato - (v_valor_parcela * (p_num_parcelas - 1))
    WHERE projeto_id = p_projeto_id
      AND descricao LIKE '%Parcela ' || p_num_parcelas || '/' || p_num_parcelas
      AND deleted_at IS NULL;
  END IF;

  RETURN parcelas_criadas;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_projeto_completo(p_projeto_id uuid, p_codigo text, p_nome text, p_cliente_id uuid, p_data_inicio date DEFAULT NULL::date, p_data_previsao date DEFAULT NULL::date, p_data_final date DEFAULT NULL::date, p_valor_contrato numeric DEFAULT 0, p_observacao text DEFAULT ''::text, p_localizacao text DEFAULT ''::text, p_parcelas text DEFAULT NULL::text, p_area_m2 numeric DEFAULT 0, p_disciplinas jsonb DEFAULT '[]'::jsonb, p_status text DEFAULT 'Planejamento'::text, p_prioridade text DEFAULT 'Media'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  UPDATE public.projetos SET
    codigo_projeto = p_codigo,
    nome = p_nome,
    cliente_id = p_cliente_id,
    data_inicio = p_data_inicio,
    data_previsao = p_data_previsao,
    data_final = p_data_final,
    valor_contrato = p_valor_contrato,
    observacao = p_observacao,
    localizacao = p_localizacao,
    parcelas = p_parcelas,
    area_m2 = p_area_m2,
    disciplinas = p_disciplinas,
    status = p_status::status_projeto,
    prioridade = p_prioridade,
    updated_by = v_user_id,
    updated_at = now()
  WHERE id = p_projeto_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_portal_token(p_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'projeto_id', pt.projeto_id,
    'cliente_id', pt.cliente_id,
    'empresa_id', pt.empresa_id,
    'projeto_nome', p.nome,
    'projeto_status', p.status,
    'projeto_codigo', p.codigo_projeto,
    'cliente_nome', c.nome,
    'empresa_nome', e.nome
  ) INTO result
  FROM portal_tokens pt
  JOIN projetos p ON p.id = pt.projeto_id
  JOIN clientes c ON c.id = pt.cliente_id
  JOIN empresas e ON e.id = pt.empresa_id
  WHERE pt.token = p_token
    AND pt.ativo = true
    AND (pt.expira_em IS NULL OR pt.expira_em > NOW());

  IF result IS NULL THEN
    RAISE EXCEPTION 'Token inválido ou expirado';
  END IF;

  -- Atualiza último acesso
  UPDATE portal_tokens SET ultimo_acesso = NOW() WHERE token = p_token;

  RETURN result;
END;
$function$
;


  create policy "asaas_config_empresa_insert"
  on "public"."asaas_config"
  as permissive
  for insert
  to public
with check ((empresa_id IN ( SELECT profiles.empresa_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));



  create policy "asaas_config_empresa_select"
  on "public"."asaas_config"
  as permissive
  for select
  to public
using ((empresa_id IN ( SELECT profiles.empresa_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));



  create policy "asaas_config_empresa_update"
  on "public"."asaas_config"
  as permissive
  for update
  to public
using ((empresa_id IN ( SELECT profiles.empresa_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));



  create policy "asaas_webhook_logs_select"
  on "public"."asaas_webhook_logs"
  as permissive
  for select
  to public
using ((empresa_id IN ( SELECT profiles.empresa_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));



  create policy "Cartoes Read Only"
  on "public"."cartoes_credito"
  as permissive
  for select
  to public
using (((empresa_id = public.get_user_empresa_id()) AND (deleted_at IS NULL)));



  create policy "Contas Read Only"
  on "public"."contas"
  as permissive
  for select
  to public
using (((empresa_id = public.get_user_empresa_id()) AND (deleted_at IS NULL)));



  create policy "Despesas Read Only"
  on "public"."despesas"
  as permissive
  for select
  to public
using (((empresa_id = public.get_user_empresa_id()) AND (deleted_at IS NULL)));



  create policy "Fornecedores Read Only"
  on "public"."fornecedores"
  as permissive
  for select
  to public
using (((empresa_id = public.get_user_empresa_id()) AND (deleted_at IS NULL)));



  create policy "Receitas Read Only"
  on "public"."receitas"
  as permissive
  for select
  to public
using (((empresa_id = public.get_user_empresa_id()) AND (deleted_at IS NULL)));


CREATE TRIGGER tr_audit_clientes BEFORE INSERT OR UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

CREATE TRIGGER tr_audit_contas BEFORE INSERT OR UPDATE ON public.contas FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

CREATE TRIGGER tr_audit_despesas BEFORE INSERT OR UPDATE ON public.despesas FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

CREATE TRIGGER tr_audit_empresas BEFORE INSERT OR UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

CREATE TRIGGER tr_audit_fornecedores BEFORE INSERT OR UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

CREATE TRIGGER tr_audit_leads BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

CREATE TRIGGER tr_audit_profiles BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

CREATE TRIGGER tr_audit_projetos BEFORE INSERT OR UPDATE ON public.projetos FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

CREATE TRIGGER tr_audit_receitas BEFORE INSERT OR UPDATE ON public.receitas FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();



