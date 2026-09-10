-- pgTAP: avisar_admin_capacidade (SPEC 098, migration 20260922000000). User
-- comum bate um limite de capacidade e avisa os admins da própria empresa;
-- nunca vaza pra outra empresa; recusa recurso inválido; dedupe (mesmo
-- padrão de solicitar_mais_tokens: notificar() já dedupa não-lida).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(9);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('aac00000-0000-0000-0000-00000000000a', 'Empresa Aviso A', NULL, TRUE, '{}'::jsonb),
  ('aac00000-0000-0000-0000-00000000000b', 'Empresa Aviso B', NULL, TRUE, '{}'::jsonb);

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('aac01111-0000-0000-0000-00000000000a', 'aviso_admin@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('aac01111-0000-0000-0000-00000000000b', 'aviso_user@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('aac01111-0000-0000-0000-00000000000c', 'aviso_sem_empresa@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('aac01111-0000-0000-0000-00000000000a', 'aac00000-0000-0000-0000-00000000000a', 'Admin', 'Aviso', 'aviso_admin@test.com', 'admin', TRUE),
  ('aac01111-0000-0000-0000-00000000000b', 'aac00000-0000-0000-0000-00000000000a', 'User', 'Aviso', 'aviso_user@test.com', 'user', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

CREATE OR REPLACE FUNCTION test_set_postgres()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'postgres', true);
END; $$;

-- 1. Sem autenticação: recusa.
SELECT test_set_postgres();
SELECT throws_ok(
  $$SELECT public.avisar_admin_capacidade('projetos')$$,
  '42501', NULL,
  'sem sessão autenticada, avisar_admin_capacidade recusa'
);

-- 2. Recurso inválido: recusa.
SELECT test_set_auth('aac01111-0000-0000-0000-00000000000b');
SELECT throws_ok(
  $$SELECT public.avisar_admin_capacidade('financeiro')$$,
  '22023', NULL,
  'recurso fora de projetos/obras/usuarios é recusado'
);

-- 3. Usuário comum avisa admin da PRÓPRIA empresa.
SELECT is(
  public.avisar_admin_capacidade('projetos'),
  1,
  'user comum aciona avisar_admin_capacidade("projetos") e notifica 1 admin'
);

SELECT test_set_auth('aac01111-0000-0000-0000-00000000000a');
SELECT is(
  (SELECT count(*)::int FROM public.notificacoes
     WHERE destinatario_id = 'aac01111-0000-0000-0000-00000000000a'
       AND tipo = 'capacidade_avisar_admin:projetos'),
  1,
  'admin da mesma empresa recebe a notificação'
);
SELECT is(
  (SELECT titulo FROM public.notificacoes
     WHERE destinatario_id = 'aac01111-0000-0000-0000-00000000000a'
       AND tipo = 'capacidade_avisar_admin:projetos'),
  'Limite de projetos do período de teste atingido',
  'título da notificação é específico do recurso'
);
SELECT is(
  (SELECT categoria FROM public.notificacoes
     WHERE destinatario_id = 'aac01111-0000-0000-0000-00000000000a'
       AND tipo = 'capacidade_avisar_admin:projetos'),
  'sistema',
  'categoria é sistema (respeita preferência de notificação existente)'
);

-- 4. Dedupe: acionar de novo antes de ler não duplica (notificar() já dedupa
--    por destinatário+tipo+referência não lida).
SELECT test_set_auth('aac01111-0000-0000-0000-00000000000b');
SELECT is(
  public.avisar_admin_capacidade('projetos'),
  0,
  'segundo aviso do mesmo recurso antes do admin ler não gera notificação duplicada'
);

-- 5. Nunca vaza pra empresa diferente: admin da empresa B nunca recebe.
SELECT test_set_postgres();
SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('aac01111-0000-0000-0000-00000000000d', 'aviso_admin_b@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';
INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES ('aac01111-0000-0000-0000-00000000000d', 'aac00000-0000-0000-0000-00000000000b', 'Admin', 'B', 'aviso_admin_b@test.com', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

SELECT test_set_auth('aac01111-0000-0000-0000-00000000000d');
SELECT is(
  (SELECT count(*)::int FROM public.notificacoes WHERE destinatario_id = 'aac01111-0000-0000-0000-00000000000d'),
  0,
  'admin de empresa diferente nunca recebe o aviso'
);

-- 6. Usuário sem empresa: recusa.
SELECT test_set_auth('aac01111-0000-0000-0000-00000000000c');
SELECT throws_ok(
  $$SELECT public.avisar_admin_capacidade('obras')$$,
  '22023', NULL,
  'usuário sem perfil/empresa é recusado'
);

SELECT * FROM finish();
ROLLBACK;
