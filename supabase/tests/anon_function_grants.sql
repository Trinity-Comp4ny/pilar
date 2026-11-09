-- pgTAP: trava a causa raiz da migration 20260836000000 — nenhuma função SECURITY
-- DEFINER nova ou existente deve nascer/ficar executável por anon sem entrar
-- explicitamente na allowlist abaixo. Sem este teste, o histórico já provou (3 vezes:
-- 20260725000000, 20260810120000, 20260835000000) que o vetor volta a abrir sozinho
-- toda vez que alguém cria uma RPC e esquece de revogar.
--
-- Allowlist tem que ser mantida em sincronia com a de 20260836000000: um item
-- adicionado lá sem espelhar aqui falha o teste (funciona como lembrete), e um item
-- adicionado aqui sem revisão vira brecha silenciosa — então adicionar aqui exige o
-- mesmo cuidado de "por que essa função precisa ser pública" que a migration documenta.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(4);

WITH allowed(sig) AS (
  VALUES
    -- Helpers de RLS (USING/WITH CHECK precisam avaliar pra anon)
    ('get_user_empresa_id()'), ('get_user_empresa_id_text()'), ('get_user_role()'),
    ('has_role(user_role[])'), ('is_company_admin()'), ('is_ultra_admin()'),
    ('my_empresa_id()'), ('can_view_financeiro()'), ('can_view_folha()'),
    ('user_has_feature(text, text)'), ('is_feature_flag_enabled(text)'),
    ('current_effective_role()'), ('current_impersonation()'), ('current_pessoa_id()'),
    ('is_impersonating()'),
    -- Entrypoints pré-autenticação com caller anon real (portal/campo/cliente)
    ('portal_login(text, text)'), ('portal_verify_session(text)'),
    ('portal_verify_session_readonly(text)'), ('portal_change_password(text, text, text)'),
    ('portal_listar_entregas(text, uuid)'), ('portal_aprovar_entrega(text, uuid)'),
    ('portal_solicitar_revisao_entrega(text, uuid, text)'), ('campo_login(text, text)'),
    ('campo_verify_session(text)'), ('campo_trocar_senha(text, text)'),
    -- Spec 099: convite por link, cliente/funcionário ainda sem sessão nenhuma ao
    -- clicar no link e definir a própria senha (mesma categoria de portal_login acima).
    ('portal_convite_definir_senha(text, text)'), ('campo_convite_definir_senha(text, text)'),
    ('campo_listar_tarefas(text)'), ('campo_criar_tarefa(text, text)'),
    ('campo_listar_rdos(text, integer)'),
    ('campo_salvar_rdo(text, date, text, text, integer, text, text, text)'),
    ('campo_registrar_tarefa_rdo(text, uuid, uuid, text, text)'),
    ('campo_registrar_medicao(text, uuid, text, numeric, text)'),
    ('campo_listar_fornecedores(text)'),
    -- SPEC 135: o campo (sem usuário Supabase) lê os registros da própria obra e aceita o
    -- aviso do áudio guardado; as duas validam o token de sessão no corpo.
    ('campo_listar_registros(text, integer)'), ('campo_aceitar_audio(text)'),
    ('campo_responder_efetivo(text, uuid, integer)'),
    ('campo_registrar_efetivo(text, uuid, uuid, text, integer)'),
    ('campo_registrar_impedimento(text, uuid, text, text)'),
    ('campo_registrar_visita(text, uuid, uuid, text, text)'),
    ('get_cliente_projetos(text)'), ('get_cliente_projeto_detail(uuid, text)'),
    ('get_cliente_obras(text)'), ('get_cliente_obra_detail(text, uuid)'),
    ('guard_login_attempt(text)')
),
exposto AS (
  SELECT p.proname || '(' || oidvectortypes(p.proargtypes) || ')' AS sig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND pg_get_function_result(p.oid) <> 'trigger'
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND (p.proname || '(' || oidvectortypes(p.proargtypes) || ')') NOT IN (SELECT sig FROM allowed)
)
SELECT is(
  (SELECT COALESCE(array_agg(sig ORDER BY sig), '{}'::text[]) FROM exposto),
  '{}'::text[],
  'nenhuma função SECURITY DEFINER fora da allowlist é executável por anon'
);

-- Função de trigger SECURITY DEFINER não precisa de EXECUTE pra ninguém (o
-- Postgres só checa no CREATE TRIGGER). Trigger novo nasce com EXECUTE pra PUBLIC
-- pelo default; este teste obriga o REVOKE no mesmo PR (20261022000001).
SELECT is(
  (SELECT COALESCE(array_agg(p.proname::text ORDER BY p.proname), '{}'::text[])
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosecdef
     AND p.prorettype = 'trigger'::regtype
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
          OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))),
  '{}'::text[],
  'nenhuma função de trigger SECURITY DEFINER é executável por anon ou authenticated'
);

-- Prova de que o REVOKE acima é seguro: trigger dispara para quem não tem
-- EXECUTE na função.
CREATE TABLE public._pgtap_trigger_sem_execute (x int);
CREATE FUNCTION public._pgtap_trigger_sem_execute_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  NEW.x := 42;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public._pgtap_trigger_sem_execute_fn() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER _pgtap_trigger_sem_execute_trg
  BEFORE INSERT ON public._pgtap_trigger_sem_execute
  FOR EACH ROW EXECUTE FUNCTION public._pgtap_trigger_sem_execute_fn();
GRANT INSERT, SELECT ON public._pgtap_trigger_sem_execute TO authenticated;

SET LOCAL ROLE authenticated;
INSERT INTO public._pgtap_trigger_sem_execute VALUES (1);
RESET ROLE;

SELECT is(
  (SELECT x FROM public._pgtap_trigger_sem_execute),
  42,
  'trigger dispara mesmo sem EXECUTE na função'
);

-- View que roda como dona (sem security_invoker) executa a escrita com o
-- privilégio da dona, que ignora RLS. Então nenhuma pode aceitar escrita de
-- anon/authenticated, nem leitura de anon (20261022000000).
SELECT is(
  (SELECT COALESCE(array_agg(c.relname::text ORDER BY c.relname), '{}'::text[])
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'v'
     AND NOT COALESCE(
       (SELECT option_value::boolean FROM pg_options_to_table(c.reloptions)
        WHERE option_name = 'security_invoker'),
       false)
     AND (has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
          OR has_table_privilege('authenticated', c.oid, 'INSERT, UPDATE, DELETE'))),
  '{}'::text[],
  'view sem security_invoker não aceita escrita nem leitura anônima'
);

-- NÃO testamos "função nova nasce sem anon por padrão" aqui: verificado ao vivo
-- (2026-08-17) que uma função criada como `postgres` no schema `public` deste Postgres
-- local nasce com EXECUTE pra PUBLIC mesmo depois de
-- `ALTER DEFAULT PRIVILEGES FOR ROLE postgres ... REVOKE ... FROM PUBLIC` — há um
-- default por trás disso pertencente a `supabase_admin` (o superuser real aqui) que
-- `postgres` não pode alterar. Por isso a trava é este teste (roda no CI a cada PR,
-- pega a função nova sem depender de ALTER DEFAULT PRIVILEGES funcionar), não uma
-- asserção sobre o mecanismo de privilégio padrão do Postgres.

SELECT * FROM finish();

ROLLBACK;
