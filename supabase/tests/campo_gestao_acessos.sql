-- pgTAP: campo_listar_contas_obra / campo_revogar_acesso (spec 099,
-- migration 20260915000000). Cobre tenant check e que revogar invalida a
-- sessão corrente.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(7);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('00000000-0000-0000-0000-00000000d0aa', 'Empresa Gestao Campo A', NULL, TRUE, '{"projetos": true}'::jsonb),
  ('00000000-0000-0000-0000-00000000d0bb', 'Empresa Gestao Campo B', NULL, TRUE, '{"projetos": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('77777777-0000-0000-0000-00000000d001', 'gestao_campo_admin@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('77777777-0000-0000-0000-00000000d002', 'gestao_campo_intruso@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('77777777-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d0aa', 'Gestao', 'Admin', 'gestao_campo_admin@test.com', 'admin', TRUE),
  ('77777777-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000d0bb', 'Gestao', 'Intruso', 'gestao_campo_intruso@test.com', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

RESET ROLE;

INSERT INTO public.obras (id, empresa_id, nome, status, created_by)
VALUES ('00000000-0000-0000-0000-00000000d2aa', '00000000-0000-0000-0000-00000000d0aa', 'Obra Gestao A', 'planejada', '77777777-0000-0000-0000-00000000d001')
ON CONFLICT (id) DO NOTHING;

-- Conta de campo ativa na obra, com sessão válida.
DO $$
DECLARE
  v_token text;
  v_hash text;
BEGIN
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.campo_accounts
    (id, empresa_id, obra_id, nome, email, senha_hash, must_change_senha, ativo, token_sessao, token_expira_em)
  VALUES
    ('00000000-0000-0000-0000-00000000d3aa', '00000000-0000-0000-0000-00000000d0aa',
     '00000000-0000-0000-0000-00000000d2aa', 'Encarregado Gestão',
     'encarregado.gestao@test.com', crypt('senhaqualquer12', gen_salt('bf')), false, true,
     v_hash, now() + interval '30 days');

  PERFORM set_config('pgtap.campo_gestao_token', v_token, false);
END $$;

-- Sessão viva ANTES de revogar
SELECT is(
  (public.campo_verify_session(current_setting('pgtap.campo_gestao_token'))->>'ok')::boolean,
  true,
  'sessão de campo válida antes da revogação'
);

-- Gestor de OUTRA empresa não enxerga a lista da obra (tenant check)
SELECT test_set_auth('77777777-0000-0000-0000-00000000d002');

SELECT throws_ok(
  $$ SELECT public.campo_listar_contas_obra('00000000-0000-0000-0000-00000000d2aa') $$,
  'Obra não encontrada',
  'gestor de outra empresa não lista contas de obra alheia'
);

SELECT throws_ok(
  $$ SELECT public.campo_revogar_acesso('00000000-0000-0000-0000-00000000d3aa') $$,
  'Acesso não encontrado',
  'gestor de outra empresa não revoga acesso de obra alheia'
);

-- Gestor da empresa dona lista corretamente
SELECT test_set_auth('77777777-0000-0000-0000-00000000d001');

SELECT is(
  (SELECT count(*)::int FROM public.campo_listar_contas_obra('00000000-0000-0000-0000-00000000d2aa')),
  1,
  'gestor da empresa dona vê 1 conta de campo na obra'
);

SELECT lives_ok(
  $$ SELECT public.campo_revogar_acesso('00000000-0000-0000-0000-00000000d3aa') $$,
  'gestor da empresa dona revoga o acesso sem erro'
);

SELECT is(
  (SELECT ativo FROM public.campo_accounts WHERE id = '00000000-0000-0000-0000-00000000d3aa'),
  false,
  'conta fica inativa após revogar'
);

-- Sessão corrente cai mesmo com token ainda não expirado
SELECT is(
  (public.campo_verify_session(current_setting('pgtap.campo_gestao_token'))->>'ok')::boolean,
  false,
  'revogar invalida a sessão corrente, mesmo com token não expirado'
);

SELECT * FROM finish();

ROLLBACK;
