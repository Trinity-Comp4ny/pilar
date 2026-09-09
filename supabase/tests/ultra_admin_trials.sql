-- pgTAP: ultra_admin_listar_trials / ultra_admin_definir_nivel_override
-- (SPEC 098, migration 20260923000000). Só ultra_admin lista/altera; legado
-- (override) some da lista pois não é mais status trialing puro de trial
-- novo... na verdade legado AINDA é status trialing/active mas com override:
-- a view lista por STATUS trialing (inclui legado se por acaso ainda estiver
-- trialing), então o teste cobre isso explicitamente.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(16);

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

CREATE OR REPLACE FUNCTION test_set_service()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM set_config('role', 'service_role', true);
END; $$;

SELECT test_set_postgres();

INSERT INTO public.pilar_subscription_plans
  (slug, nome, preco_mensal, max_usuarios, max_projetos, tokens_mensais, destaque, ativo, ordem)
VALUES ('starter', 'Essencial', 490.00, NULL, 15, 500000, FALSE, TRUE, 1)
ON CONFLICT (slug) DO UPDATE SET ativo = TRUE;

-- Empresas via signup real: uma trial nova (bronze) e uma admin comum.
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('fad01111-0000-0000-0000-00000000000a', 'uad_trial@empresareal.com.br', jsonb_build_object('company_name', 'UAD Trial'), 'authenticated', 'authenticated', now()),
  ('fad01111-0000-0000-0000-00000000000b', 'uad_comum@empresareal.com.br', jsonb_build_object('company_name', 'UAD Comum'), 'authenticated', 'authenticated', now());

-- =============================================
-- 1. Sem ultra_admin: recusa nos dois.
-- =============================================
SELECT test_set_auth('fad01111-0000-0000-0000-00000000000b');
SELECT throws_ok(
  $$SELECT * FROM public.ultra_admin_listar_trials()$$,
  '42501', NULL,
  'admin comum não pode listar trials'
);
SELECT throws_ok(
  $$SELECT public.ultra_admin_definir_nivel_override(
    (SELECT id FROM public.empresas WHERE owner_id = 'fad01111-0000-0000-0000-00000000000a'),
    'ouro', 'teste'
  )$$,
  '42501', NULL,
  'admin comum não pode alterar nível de outra empresa'
);

SELECT test_set_service();
UPDATE public.profiles SET role = 'ultra_admin' WHERE id = 'fad01111-0000-0000-0000-00000000000b';
SELECT test_set_auth('fad01111-0000-0000-0000-00000000000b');

-- =============================================
-- 2. ultra_admin lista a empresa trial (Bronze) com os dados certos.
-- =============================================
SELECT is(
  (SELECT nivel FROM public.ultra_admin_listar_trials()
     WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fad01111-0000-0000-0000-00000000000a')),
  'bronze',
  'lista mostra a empresa trial nova como bronze'
);
SELECT is(
  (SELECT max_projetos FROM public.ultra_admin_listar_trials()
     WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fad01111-0000-0000-0000-00000000000a')),
  2,
  'max_projetos da linha bate com trial_niveis (bronze=2)'
);
SELECT is(
  (SELECT dias_restantes FROM public.ultra_admin_listar_trials()
     WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fad01111-0000-0000-0000-00000000000a')),
  14,
  'dias_restantes calculado a partir de trial_ends_at (recém-criada: 14)'
);
SELECT is(
  (SELECT razao_social_divergente FROM public.ultra_admin_listar_trials()
     WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fad01111-0000-0000-0000-00000000000a')),
  FALSE,
  'sem razão social ainda, alerta de divergência é falso'
);

-- Empresa promovida a ultra_admin não conta mais como "trial comum" na
-- listagem por si (ela é status trialing igual, mas isso não afeta o teste:
-- a listagem é por status, não por role do usuário).
SELECT ok(
  (SELECT count(*)::int FROM public.ultra_admin_listar_trials()) >= 2,
  'lista traz pelo menos as 2 empresas trialing criadas neste teste'
);

-- =============================================
-- 3. Override de nível com motivo, auditado.
-- =============================================
SELECT lives_ok(
  $$SELECT public.ultra_admin_definir_nivel_override(
    (SELECT id FROM public.empresas WHERE owner_id = 'fad01111-0000-0000-0000-00000000000a'),
    'ouro', 'design partner, liberar antes do CNPJ'
  )$$,
  'ultra_admin libera ouro com motivo'
);
SELECT is(
  (SELECT nivel_override FROM public.empresas WHERE owner_id = 'fad01111-0000-0000-0000-00000000000a'),
  'ouro',
  'override gravado'
);
SELECT is(
  (SELECT nivel_override_motivo FROM public.empresas WHERE owner_id = 'fad01111-0000-0000-0000-00000000000a'),
  'design partner, liberar antes do CNPJ',
  'motivo gravado'
);
SELECT is(
  (SELECT nivel_override_por FROM public.empresas WHERE owner_id = 'fad01111-0000-0000-0000-00000000000a'),
  'fad01111-0000-0000-0000-00000000000b'::uuid,
  'quem fez o override fica registrado'
);
SELECT is(
  (SELECT nivel FROM public.ultra_admin_listar_trials()
     WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fad01111-0000-0000-0000-00000000000a')),
  'ouro',
  'lista reflete o override na mesma hora'
);

-- Override sem motivo é recusado.
SELECT throws_ok(
  $$SELECT public.ultra_admin_definir_nivel_override(
    (SELECT id FROM public.empresas WHERE owner_id = 'fad01111-0000-0000-0000-00000000000a'),
    'prata', NULL
  )$$,
  '22023', 'Informe o motivo do override',
  'override sem motivo é recusado'
);

-- Nível inválido é recusado.
SELECT throws_ok(
  $$SELECT public.ultra_admin_definir_nivel_override(
    (SELECT id FROM public.empresas WHERE owner_id = 'fad01111-0000-0000-0000-00000000000a'),
    'platina', 'teste'
  )$$,
  '22023', 'Nível inválido',
  'nível fora de bronze/prata/ouro é recusado'
);

-- Limpar override (NULL) volta a derivar de fato.
SELECT lives_ok(
  $$SELECT public.ultra_admin_definir_nivel_override(
    (SELECT id FROM public.empresas WHERE owner_id = 'fad01111-0000-0000-0000-00000000000a'),
    NULL, NULL
  )$$,
  'limpar o override (NULL) é permitido sem motivo'
);
SELECT is(
  (SELECT nivel FROM public.ultra_admin_listar_trials()
     WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fad01111-0000-0000-0000-00000000000a')),
  'bronze',
  'sem override, volta a derivar bronze (sem documento)'
);

SELECT * FROM finish();
ROLLBACK;
