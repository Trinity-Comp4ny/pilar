-- pgTAP: SPEC 133 (migration 20261113100000). Cadastro por convite: conta nova
-- sem invite_token vinda do GoTrue (supabase_auth_admin) é recusada enquanto
-- platform_settings.cadastro_aberto = false. O pgTAP roda como postgres e não
-- consegue virar o login do GoTrue, então a regra é provada pela função que o
-- handle_new_user consulta com session_user.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(7);

INSERT INTO public.platform_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

SELECT is(
  (SELECT cadastro_aberto FROM public.platform_settings WHERE id = 'default'),
  false,
  'cadastro nasce fechado'
);

SELECT is(
  public.cadastro_sem_convite_permitido('supabase_auth_admin'),
  false,
  'fechado: cadastro sem convite pelo GoTrue é recusado'
);

SELECT is(
  public.cadastro_sem_convite_permitido('postgres'),
  true,
  'insert direto do banco (testes, manutenção) segue liberado'
);

SELECT matches(
  pg_get_functiondef('public.handle_new_user()'::regprocedure),
  'cadastro_sem_convite_permitido\(session_user\)',
  'handle_new_user consulta a regra com o login da sessão'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.cadastro_sem_convite_permitido(name)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.cadastro_sem_convite_permitido(name)', 'EXECUTE'),
  'anon e authenticated não executam a regra'
);

UPDATE public.platform_settings SET cadastro_aberto = true WHERE id = 'default';

SELECT is(
  public.cadastro_sem_convite_permitido('supabase_auth_admin'),
  true,
  'reaberto: cadastro sem convite pelo GoTrue volta a passar'
);

-- O caminho do insert direto continua criando empresa e admin (o mesmo que os
-- outros testes do banco usam).
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('133a0000-0000-0000-0000-000000000001', 'direto133@pilar.test',
        '{"company_name": "Escritório 133"}'::jsonb, 'authenticated', 'authenticated');

SELECT is(
  (SELECT e.nome FROM public.profiles p JOIN public.empresas e ON e.id = p.empresa_id
    WHERE p.id = '133a0000-0000-0000-0000-000000000001'),
  'Escritório 133',
  'insert direto cria a empresa com o nome informado'
);

SELECT * FROM finish();
ROLLBACK;
