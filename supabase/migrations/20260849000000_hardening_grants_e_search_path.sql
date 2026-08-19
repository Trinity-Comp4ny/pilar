-- Higiene de privilégio e search_path, achada pela varredura ao vivo de 2026-08-19
-- (scripts/audit-security.mjs). Escopo deliberadamente pequeno: só o que é
-- PROVADAMENTE seguro. O que parecia óbvio e não é está documentado no fim,
-- com o motivo e o caminho correto.
--
-- Fecha dois itens da baseline:
--   rls_sem_policy_com_grant  6 -> 0
--   search_path_mutavel       9 -> 0

-- ---------------------------------------------------------------------------
-- 1. Tabelas com RLS ligada e ZERO policy: revogar o grant também
-- ---------------------------------------------------------------------------
-- Hoje essas 6 tabelas negam tudo, mas a proteção depende da AUSÊNCIA de regra:
-- no dia em que alguém adicionar uma policy permissiva por um motivo legítimo,
-- os grants abertos passam a valer de uma vez, sem ninguém perceber. Duas delas
-- são o coração do controle de segurança (mfa_backup_codes, rate_limit_attempts).
--
-- Seguro porque: quem realmente acessa essas tabelas são funções SECURITY
-- DEFINER (mfa_consume_backup_code, check_rate_limit, tg_tarefa_numero, o
-- webhook de checkout), que rodam como dona e não passam pelo grant do
-- chamador. service_role tem BYPASSRLS e também não depende destes grants.
REVOKE ALL ON TABLE
  public.empresa_owners_pending,
  public.mfa_backup_codes,
  public.pilar_checkout_webhook_logs,
  public.pilar_pending_signups,
  public.rate_limit_attempts,
  public.tarefa_contadores
FROM anon, authenticated;

-- Default privilege do Postgres re-concede em objeto novo criado pelo mesmo
-- dono. Sem isto, a próxima tabela nasce com o grant aberto outra vez e a
-- correção se desfaz em silêncio.
COMMENT ON TABLE public.mfa_backup_codes IS
  'Códigos de recuperação de MFA (bcrypt). Sem policy de propósito: acesso só via '
  'mfa_consume_backup_code() SECURITY DEFINER. Não conceder grant a anon/authenticated.';
COMMENT ON TABLE public.rate_limit_attempts IS
  'Contador de rate limit por bucket. Sem policy de propósito: acesso só via '
  'check_rate_limit() SECURITY DEFINER. Não conceder grant a anon/authenticated.';

-- ---------------------------------------------------------------------------
-- 2. search_path fixo nas 9 funções SECURITY DEFINER que estavam sem
-- ---------------------------------------------------------------------------
-- Função SECURITY DEFINER sem search_path fixo roda com o search_path de quem
-- chama, então um schema temporário com uma tabela de nome igual pode capturar
-- a referência e a função privilegiada passa a operar sobre dado do atacante.
--
-- `public` basta para todas as 9: nenhuma usa função de extensão (verificado em
-- prosrc), e as referências a auth.* já são qualificadas por schema, o que não
-- depende de search_path. `public` é também a convenção majoritária do repo
-- (124 funções já usam exatamente isso).
--
-- ALTER FUNCTION exige assinatura exata. create_projeto_completo tem 3
-- sobrecargas vivas em produção (é a mesma dívida que bloqueia o enforcement de
-- max_projetos, ver ADR 0026 e spec 052): todas as 3 precisam da mesma alteração.

ALTER FUNCTION public.create_projeto_completo(
  p_codigo text, p_nome text, p_cliente_id uuid, p_data_inicio date,
  p_data_previsao date, p_data_final date, p_valor_contrato numeric,
  p_observacao text, p_localizacao text, p_parcelas text, p_area_m2 numeric,
  p_disciplinas jsonb
) SET search_path = public;

ALTER FUNCTION public.create_projeto_completo(
  p_codigo text, p_nome text, p_cliente_id uuid, p_data_inicio date,
  p_data_previsao date, p_data_final date, p_valor_contrato numeric,
  p_observacao text, p_localizacao text, p_parcelas text, p_area_m2 numeric,
  p_disciplinas jsonb, p_prioridade text
) SET search_path = public;

ALTER FUNCTION public.create_projeto_completo(
  p_codigo text, p_nome text, p_cliente_id uuid, p_data_inicio date,
  p_data_previsao date, p_data_final date, p_valor_contrato numeric,
  p_observacao text, p_localizacao text, p_parcelas text, p_responsaveis jsonb
) SET search_path = public;

ALTER FUNCTION public.get_folha_preview(p_mes integer, p_ano integer)
  SET search_path = public;

ALTER FUNCTION public.link_pessoa_profile_before() SET search_path = public;
ALTER FUNCTION public.link_profile_pessoa_after() SET search_path = public;
ALTER FUNCTION public.tg_cascade_feature_revocation() SET search_path = public;
ALTER FUNCTION public.tg_validate_convite_features_subset() SET search_path = public;
ALTER FUNCTION public.tg_validate_features_subset() SET search_path = public;

-- ---------------------------------------------------------------------------
-- O QUE ESTA MIGRATION DELIBERADAMENTE NÃO FAZ
-- ---------------------------------------------------------------------------
--
-- (a) NÃO revoga EXECUTE dos 15 helpers de RLS (get_user_empresa_id,
--     user_has_feature, has_role, can_view_folha, is_ultra_admin, etc) de anon.
--
--     Parece higiene óbvia e é armadilha. TODAS as ~180 policies do schema são
--     `TO PUBLIC`, não `TO authenticated`, e expressão de policy é avaliada com
--     o privilégio de QUEM CONSULTA. Então quando anon consulta qualquer tabela,
--     a policy chama get_user_empresa_id() como anon. Hoje isso retorna NULL e a
--     comparação não casa nada, devolvendo zero linha (comportamento correto).
--     Revogar o EXECUTE trocaria "zero linha" por "permission denied for
--     function" em toda consulta anônima, o que vira erro 500 no PostgREST em
--     vez de resultado vazio, incluindo qualquer consulta que o front dispare na
--     janela antes da sessão estar pronta.
--
--     O grant, portanto, é load-bearing dado o desenho atual das policies. O fix
--     correto é outro e maior: mudar as policies para `TO authenticated`, o que
--     (1) faz anon nem avaliar a expressão, (2) tira a necessidade do grant, e
--     (3) melhora de graça os 22 casos de auth_rls_initplan. Isso merece spec
--     própria e passe isolado, não um bloco no fim de uma migration de higiene.
--
-- (b) NÃO revoga EXECUTE das 27 funções de trigger de anon.
--
--     São inertes (o Postgres recusa chamar função que retorna `trigger` fora de
--     contexto de trigger), então o ganho é só limpar ruído do advisor. Mas o
--     comportamento de checagem de privilégio no disparo de trigger não foi
--     verificado neste ambiente, e trocar risco zero por risco não medido em
--     produção para ganhar cosmética é troca ruim. Fica registrado na baseline
--     como dívida de prioridade baixa (anon_trigger_inerte), a ser fechado num
--     passe que teste o disparo em staging primeiro.
