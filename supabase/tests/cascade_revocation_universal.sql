-- pgTAP: tg_cascade_feature_revocation não revoga feature universal do profile
-- quando ela é removida de empresas.features (ADR 0026, achado de auditoria
-- de RLS na migration 20260845000000: o bulk-feature do ultra-admin desliga
-- uma feature apagando a chave do JSONB da empresa; sem este fix, isso
-- revogava o grant de todo mundo em profiles.features mesmo pra feature
-- universal, que não deveria depender desse JSONB).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(3);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES (
  '00000000-0000-0000-0000-0000000000fa',
  'Empresa Cascata',
  NULL,
  TRUE,
  '{"financeiro": true, "templates": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('99999999-0000-0000-0000-000000000001', 'cascata@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed, features)
VALUES (
  '99999999-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-0000000000fa',
  'Cascata', 'Teste', 'cascata@test.com', 'user', TRUE,
  '{"financeiro": "viewer", "templates": "viewer"}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features, empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- Simula o bulk-feature desligando as duas features em massa (delete da chave
-- do JSONB da empresa, mesmo efeito de `delete f[feature]` na edge function).
UPDATE public.empresas SET features = features - 'financeiro' - 'templates'
WHERE id = '00000000-0000-0000-0000-0000000000fa';

-- Feature universal: o profile mantém o grant, cascade não deveria ter mexido.
SELECT is(
  (SELECT features ->> 'financeiro' FROM public.profiles WHERE id = '99999999-0000-0000-0000-000000000001'),
  'viewer',
  'financeiro (universal) NÃO é revogado do profile quando some do JSONB da empresa'
);

-- Feature não-universal: cascade continua revogando como antes (comportamento
-- correto, não deve regredir).
SELECT is(
  (SELECT features ->> 'templates' FROM public.profiles WHERE id = '99999999-0000-0000-0000-000000000001'),
  NULL,
  'templates (não-universal) continua revogado do profile quando some do JSONB da empresa'
);

SELECT test_set_auth('99999999-0000-0000-0000-000000000001');

SELECT ok(
  public.user_has_feature('financeiro', 'viewer'),
  'depois do cascade, user_has_feature(financeiro) ainda é TRUE (universal, ignora empresa)'
);

SELECT * FROM finish();

ROLLBACK;
