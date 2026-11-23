-- pgTAP: policies permissivas do ultra_admin em obras, campo_accounts e
-- cliente_portal_accounts (migration 20261234970000). O ultra_admin com MFA vê e
-- escreve em qualquer empresa; sem MFA ou como admin comum de outra empresa, não.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(8);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('00000000-0000-0000-0000-00000000e0aa', 'Empresa Ultra RLS A', NULL, TRUE, '{"projetos": true}'::jsonb),
  ('00000000-0000-0000-0000-00000000e0bb', 'Empresa Ultra RLS B', NULL, TRUE, '{"projetos": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('88888888-0000-0000-0000-00000000e001', 'ultra_rls_admin_a@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('88888888-0000-0000-0000-00000000e002', 'ultra_rls_ultra@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('88888888-0000-0000-0000-00000000e003', 'ultra_rls_admin_b@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('88888888-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000e0aa', 'Admin', 'A', 'ultra_rls_admin_a@test.com', 'admin', TRUE),
  ('88888888-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000e0bb', 'Ultra', 'B', 'ultra_rls_ultra@test.com', 'ultra_admin', TRUE),
  ('88888888-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000e0bb', 'Admin', 'B', 'ultra_rls_admin_b@test.com', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID, p_aal TEXT DEFAULT 'aal2')
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', p_aal)::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

RESET ROLE;

INSERT INTO public.obras (id, empresa_id, nome, status, created_by)
VALUES ('00000000-0000-0000-0000-00000000e2aa', '00000000-0000-0000-0000-00000000e0aa', 'Obra Ultra RLS A', 'planejada', '88888888-0000-0000-0000-00000000e001');

INSERT INTO public.campo_accounts (id, empresa_id, obra_id, nome, email, senha_hash, must_change_senha, ativo)
VALUES ('00000000-0000-0000-0000-00000000e3aa', '00000000-0000-0000-0000-00000000e0aa',
        '00000000-0000-0000-0000-00000000e2aa', 'Campo Ultra RLS', 'campo.ultra.rls@test.com',
        crypt('senhaqualquer12', gen_salt('bf')), false, true);

INSERT INTO public.clientes (id, empresa_id, nome)
VALUES ('00000000-0000-0000-0000-00000000e4aa', '00000000-0000-0000-0000-00000000e0aa', 'Cliente Ultra RLS');

INSERT INTO public.cliente_portal_accounts (id, cliente_id, empresa_id, nome, email, ativo)
VALUES ('00000000-0000-0000-0000-00000000e5aa', '00000000-0000-0000-0000-00000000e4aa',
        '00000000-0000-0000-0000-00000000e0aa', 'Portal Ultra RLS', 'portal.ultra.rls@test.com', true);

-- Admin comum de OUTRA empresa continua sem ver nada.
SELECT test_set_auth('88888888-0000-0000-0000-00000000e003');
SELECT is(
  (SELECT count(*)::int FROM public.obras WHERE id = '00000000-0000-0000-0000-00000000e2aa')
  + (SELECT count(*)::int FROM public.campo_accounts WHERE id = '00000000-0000-0000-0000-00000000e3aa')
  + (SELECT count(*)::int FROM public.cliente_portal_accounts WHERE id = '00000000-0000-0000-0000-00000000e5aa'),
  0,
  'admin comum de outra empresa não vê obra, conta de campo nem conta de portal'
);

-- Ultra_admin SEM MFA (aal1) também não.
SELECT test_set_auth('88888888-0000-0000-0000-00000000e002', 'aal1');
SELECT is(
  (SELECT count(*)::int FROM public.obras WHERE id = '00000000-0000-0000-0000-00000000e2aa'),
  0,
  'ultra_admin sem MFA não vê obra de outra empresa'
);

-- Ultra_admin com MFA vê as três.
SELECT test_set_auth('88888888-0000-0000-0000-00000000e002');
SELECT is(
  (SELECT count(*)::int FROM public.obras WHERE id = '00000000-0000-0000-0000-00000000e2aa'),
  1, 'ultra_admin com MFA vê obra de outra empresa'
);
SELECT is(
  (SELECT count(*)::int FROM public.campo_accounts WHERE id = '00000000-0000-0000-0000-00000000e3aa'),
  1, 'ultra_admin com MFA vê conta de campo de outra empresa'
);
SELECT is(
  (SELECT count(*)::int FROM public.cliente_portal_accounts WHERE id = '00000000-0000-0000-0000-00000000e5aa'),
  1, 'ultra_admin com MFA vê conta de portal de outra empresa'
);

-- E escreve.
SELECT lives_ok(
  $$ UPDATE public.obras SET nome = 'Obra Ultra RLS A (editada)' WHERE id = '00000000-0000-0000-0000-00000000e2aa' $$,
  'ultra_admin com MFA edita obra de outra empresa'
);
SELECT lives_ok(
  $$ UPDATE public.campo_accounts SET ativo = false WHERE id = '00000000-0000-0000-0000-00000000e3aa' $$,
  'ultra_admin com MFA edita conta de campo de outra empresa'
);

RESET ROLE;
SELECT is(
  (SELECT nome FROM public.obras WHERE id = '00000000-0000-0000-0000-00000000e2aa'),
  'Obra Ultra RLS A (editada)',
  'a edição do ultra_admin foi gravada'
);

SELECT * FROM finish();

ROLLBACK;
