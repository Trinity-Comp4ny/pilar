-- pgTAP: colunas editáveis do funil de leads (SPEC 120). Migration 20261102000000.
-- Roda como `authenticated` onde importa (superuser ignora RLS).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(22);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features) VALUES
  ('00000000-0000-0000-0000-0000000e1001', 'Empresa Funil A', NULL, TRUE, '{"leads": true}'::jsonb),
  ('00000000-0000-0000-0000-0000000e1002', 'Empresa Funil B', NULL, TRUE, '{"leads": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'funil_a@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('e1000000-0000-0000-0000-000000000002', 'funil_b@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed) VALUES
  ('e1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000e1001', 'Funil', 'A', 'funil_a@test.com', 'user', TRUE),
  ('e1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000e1002', 'Funil', 'B', 'funil_b@test.com', 'user', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- Atalho: id da primeira coluna da empresa A com o bucket dado.
CREATE OR REPLACE FUNCTION test_etapa_a(p_bucket text)
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM public.lead_etapas
  WHERE empresa_id = '00000000-0000-0000-0000-0000000e1001' AND bucket = p_bucket
  ORDER BY ordem, created_at LIMIT 1
$$;

-- ── Semente ────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT count(*)::int FROM public.lead_etapas WHERE empresa_id = '00000000-0000-0000-0000-0000000e1001'),
  6,
  'empresa nova recebe as 6 colunas padrão'
);

SELECT is(
  (SELECT string_agg(nome, ',' ORDER BY ordem) FROM public.lead_etapas
   WHERE empresa_id = '00000000-0000-0000-0000-0000000e1001'),
  'Novo,Em Contato,Proposta Enviada,Em Negociação,Ganho,Perdido',
  'colunas padrão na ordem de hoje'
);

-- ── Status derivado (coluna → status) ─────────────────────────────────────────────
SELECT test_set_auth('e1000000-0000-0000-0000-000000000001');

INSERT INTO public.leads (id, empresa_id, nome, status)
VALUES ('e1000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000e1001', 'Lead legado', 'Novo');

SELECT is(
  (SELECT etapa_id FROM public.leads WHERE id = 'e1000000-0000-0000-0000-0000000000a1'),
  test_etapa_a('Novo'),
  'insert só com status cai na primeira coluna do bucket'
);

INSERT INTO public.leads (id, empresa_id, nome, etapa_id)
VALUES ('e1000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000e1001', 'Lead na coluna', test_etapa_a('Proposta'));

SELECT is(
  (SELECT status FROM public.leads WHERE id = 'e1000000-0000-0000-0000-0000000000a2'),
  'Proposta',
  'insert com coluna deriva o status do bucket'
);

UPDATE public.leads SET etapa_id = test_etapa_a('Ganho') WHERE id = 'e1000000-0000-0000-0000-0000000000a1';

SELECT is(
  (SELECT status FROM public.leads WHERE id = 'e1000000-0000-0000-0000-0000000000a1'),
  'Ganho',
  'mover para coluna Ganho deriva status Ganho'
);

-- ── Status → coluna (RPC legada que só grava status) ───────────────────────────────
UPDATE public.leads SET status = 'Perdido' WHERE id = 'e1000000-0000-0000-0000-0000000000a2';

SELECT is(
  (SELECT etapa_id FROM public.leads WHERE id = 'e1000000-0000-0000-0000-0000000000a2'),
  test_etapa_a('Perdido'),
  'gravar só o status leva o lead para a primeira coluna do bucket'
);

-- ── Coluna criada pelo usuário ─────────────────────────────────────────────────────
SELECT lives_ok(
  $$ INSERT INTO public.lead_etapas (id, empresa_id, nome, ordem, cor, bucket)
     VALUES ('e1000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000e1001',
             'Visita técnica', 10, '#14b8a6', 'Em contato') $$,
  'membro cria coluna que conta como Em contato'
);

UPDATE public.leads SET etapa_id = 'e1000000-0000-0000-0000-0000000000b1'
WHERE id = 'e1000000-0000-0000-0000-0000000000a2';

SELECT is(
  (SELECT status FROM public.leads WHERE id = 'e1000000-0000-0000-0000-0000000000a2'),
  'Em contato',
  'coluna do usuário com bucket Em contato deriva status Em contato'
);

SELECT lives_ok(
  $$ UPDATE public.lead_etapas SET nome = 'Visita', cor = '#0ea5e9'
     WHERE id = 'e1000000-0000-0000-0000-0000000000b1' $$,
  'membro renomeia e recolore a coluna'
);

SELECT throws_ok(
  $$ UPDATE public.lead_etapas SET bucket = 'Ganho' WHERE id = 'e1000000-0000-0000-0000-0000000000b1' $$,
  'P0001',
  NULL,
  'o bucket da coluna não muda'
);

-- ── leads_safe expõe a coluna ──────────────────────────────────────────────────────
SELECT is(
  (SELECT etapa_id FROM public.leads_safe WHERE id = 'e1000000-0000-0000-0000-0000000000a2'),
  'e1000000-0000-0000-0000-0000000000b1'::uuid,
  'leads_safe devolve etapa_id'
);

-- ── Exclusão ────────────────────────────────────────────────────────────────────────
SELECT throws_ok(
  $$ DELETE FROM public.lead_etapas WHERE id = 'e1000000-0000-0000-0000-0000000000b1' $$,
  '23503',
  'Mova os leads desta coluna para outra antes de excluí-la.',
  'coluna com lead ativo não exclui'
);

SELECT throws_ok(
  $$ DELETE FROM public.lead_etapas
     WHERE empresa_id = '00000000-0000-0000-0000-0000000e1001' AND bucket = 'Perdido' $$,
  'P0001',
  NULL,
  'a última coluna de Perdido não exclui'
);

-- Segunda coluna de Ganho vazia: a original passa a poder sair e a nova é a última.
INSERT INTO public.lead_etapas (id, empresa_id, nome, ordem, bucket)
VALUES ('e1000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000e1001', 'Contrato assinado', 11, 'Ganho');

UPDATE public.leads SET etapa_id = 'e1000000-0000-0000-0000-0000000000b2'
WHERE id = 'e1000000-0000-0000-0000-0000000000a1';

SELECT lives_ok(
  $$ DELETE FROM public.lead_etapas WHERE id = test_etapa_a('Ganho') $$,
  'coluna Ganho vazia exclui quando existe outra de Ganho'
);

SELECT throws_ok(
  $$ DELETE FROM public.lead_etapas WHERE id = 'e1000000-0000-0000-0000-0000000000b2' $$,
  '23503',
  NULL,
  'coluna de Ganho com lead não exclui'
);

-- ── Lead excluído (soft delete) não trava a exclusão da coluna ─────────────────────
INSERT INTO public.lead_etapas (id, empresa_id, nome, ordem, bucket)
VALUES ('e1000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000e1001', 'Descartável', 12, 'Proposta');

INSERT INTO public.leads (id, empresa_id, nome, etapa_id, deleted_at)
VALUES ('e1000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000e1001', 'Lead excluído',
        'e1000000-0000-0000-0000-0000000000b3', now());

SELECT lives_ok(
  $$ DELETE FROM public.lead_etapas WHERE id = 'e1000000-0000-0000-0000-0000000000b3' $$,
  'lead excluído na coluna não impede apagá-la'
);

SELECT is(
  (SELECT etapa_id FROM public.leads WHERE id = 'e1000000-0000-0000-0000-0000000000a3'),
  NULL::uuid,
  'o lead excluído fica sem coluna'
);

-- ── Sem coluna do bucket pedido ──────────────────────────────────────────────────────
DELETE FROM public.lead_etapas
WHERE empresa_id = '00000000-0000-0000-0000-0000000e1001' AND bucket = 'Novo'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.etapa_id = lead_etapas.id AND l.deleted_at IS NULL);

INSERT INTO public.leads (id, empresa_id, nome, status)
VALUES ('e1000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000e1001', 'Sem coluna Novo', 'Novo');

SELECT is(
  (SELECT status FROM public.leads WHERE id = 'e1000000-0000-0000-0000-0000000000a4'),
  'Em contato',
  'sem coluna Novo, o lead cai na primeira coluna aberta e o status acompanha'
);

-- ── Multi-tenant ──────────────────────────────────────────────────────────────────────
RESET ROLE;
SELECT test_set_auth('e1000000-0000-0000-0000-000000000002');

SELECT is(
  (SELECT count(*)::int FROM public.lead_etapas WHERE empresa_id = '00000000-0000-0000-0000-0000000e1001'),
  0,
  'outra empresa não lê as colunas'
);

SELECT lives_ok(
  $$ INSERT INTO public.lead_etapas (empresa_id, nome, ordem, bucket)
     VALUES ('00000000-0000-0000-0000-0000000e1002', 'Minha coluna', 20, 'Novo') $$,
  'a outra empresa cria coluna na própria empresa'
);

SELECT throws_ok(
  $$ INSERT INTO public.lead_etapas (empresa_id, nome, ordem, bucket)
     VALUES ('00000000-0000-0000-0000-0000000e1001', 'Invasora', 20, 'Novo') $$,
  '42501',
  NULL,
  'não cria coluna em empresa alheia (RLS)'
);

RESET ROLE;

-- Etapa de outra empresa num lead: o trigger recusa (superuser, sem RLS no caminho).
SELECT throws_ok(
  $$ INSERT INTO public.leads (empresa_id, nome, etapa_id)
     SELECT '00000000-0000-0000-0000-0000000e1001', 'Lead cruzado', id
     FROM public.lead_etapas
     WHERE empresa_id = '00000000-0000-0000-0000-0000000e1002' AND bucket = 'Ganho' LIMIT 1 $$,
  '23503',
  'A coluna do funil não pertence à empresa do lead.',
  'lead não aponta para coluna de outra empresa'
);

SELECT * FROM finish();
ROLLBACK;
