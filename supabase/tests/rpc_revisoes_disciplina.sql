-- pgTAP: rpc_registrar_revisao / rpc_concluir_revisao (migration 20260906000000).
-- Cobre o contrato da spec 093: motivo obrigatório, uma revisão em aberto por
-- disciplina, isolamento por empresa e conclusão idempotente.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(11);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('00000000-0000-0000-0000-00000000e0aa', 'Empresa Rev A', NULL, TRUE, '{"projetos": true}'::jsonb),
  ('00000000-0000-0000-0000-00000000e0bb', 'Empresa Rev B', NULL, TRUE, '{"projetos": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('77777777-0000-0000-0000-00000000e001', 'rev_membro@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('77777777-0000-0000-0000-00000000e002', 'rev_intruso@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('77777777-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000e0aa', 'Rev', 'Membro', 'rev_membro@test.com', 'user', TRUE),
  ('77777777-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000e0bb', 'Rev', 'Intruso', 'rev_intruso@test.com', 'user', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

RESET ROLE;

INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('eeeeeeee-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000e0aa', 'Projeto rev pgtap', 'Em andamento');

INSERT INTO public.projeto_disciplinas (id, projeto_id, nome, status)
VALUES ('ffffffff-0000-0000-0000-00000000e001', 'eeeeeeee-0000-0000-0000-00000000e001', 'Estrutural', 'Em Andamento');

-- =============================================
-- Teste 1 e 2: motivo obrigatório
-- =============================================
SELECT test_set_auth('77777777-0000-0000-0000-00000000e001');

SELECT throws_ok(
  $$ SELECT public.rpc_registrar_revisao('ffffffff-0000-0000-0000-00000000e001', '') $$,
  'Motivo da revisão é obrigatório',
  'motivo vazio é recusado'
);

SELECT throws_ok(
  $$ SELECT public.rpc_registrar_revisao('ffffffff-0000-0000-0000-00000000e001', '    ') $$,
  'Motivo da revisão é obrigatório',
  'motivo só com espaços é recusado'
);

-- =============================================
-- Teste 3: tenant errado não registra
-- =============================================
SELECT test_set_auth('77777777-0000-0000-0000-00000000e002');

SELECT throws_ok(
  $$ SELECT public.rpc_registrar_revisao('ffffffff-0000-0000-0000-00000000e001', 'quero mexer no alheio') $$,
  'Disciplina não encontrada ou sem permissão',
  'membro de outra empresa não registra revisão'
);

-- =============================================
-- Teste 4: registro válido grava a linha
-- =============================================
SELECT test_set_auth('77777777-0000-0000-0000-00000000e001');

SELECT lives_ok(
  $$ SELECT public.rpc_registrar_revisao('ffffffff-0000-0000-0000-00000000e001', '  cliente pediu mudar o pilar P12  ') $$,
  'registro válido é aceito'
);

SELECT is(
  (SELECT motivo FROM public.projeto_disciplina_revisoes
    WHERE projeto_disciplina_id = 'ffffffff-0000-0000-0000-00000000e001' AND concluida_em IS NULL),
  'cliente pediu mudar o pilar P12',
  'motivo é gravado sem espaço nas pontas'
);

-- =============================================
-- Teste 5: só uma revisão em aberto por disciplina
-- =============================================
SELECT throws_ok(
  $$ SELECT public.rpc_registrar_revisao('ffffffff-0000-0000-0000-00000000e001', 'segunda revisão') $$,
  'Já existe uma revisão em aberto nessa disciplina',
  'segunda revisão em aberto na mesma disciplina é recusada'
);

-- =============================================
-- Teste 6: conclusão anterior à solicitação é recusada
-- =============================================
SELECT throws_ok(
  format(
    $$ SELECT public.rpc_concluir_revisao(%L, %L) $$,
    (SELECT id FROM public.projeto_disciplina_revisoes WHERE concluida_em IS NULL),
    (current_date - 5)
  ),
  'Conclusão não pode ser anterior à data da solicitação',
  'conclusão retroativa antes da solicitação é recusada'
);

-- =============================================
-- Teste 7: conclusão válida preenche concluida_em
-- =============================================
SELECT lives_ok(
  format(
    $$ SELECT public.rpc_concluir_revisao(%L) $$,
    (SELECT id FROM public.projeto_disciplina_revisoes WHERE concluida_em IS NULL)
  ),
  'conclusão válida é aceita'
);

SELECT is(
  (SELECT count(*)::int FROM public.projeto_disciplina_revisoes
    WHERE projeto_disciplina_id = 'ffffffff-0000-0000-0000-00000000e001' AND concluida_em IS NULL),
  0,
  'não sobra revisão em aberto após concluir'
);

-- =============================================
-- Teste 8: concluir revisão já concluída é recusado
-- =============================================
SELECT throws_ok(
  format(
    $$ SELECT public.rpc_concluir_revisao(%L) $$,
    (SELECT id FROM public.projeto_disciplina_revisoes
      WHERE projeto_disciplina_id = 'ffffffff-0000-0000-0000-00000000e001' LIMIT 1)
  ),
  'Essa revisão já foi concluída',
  'concluir duas vezes é recusado'
);

-- =============================================
-- Teste 9: com a anterior fechada, nova revisão é aceita
-- =============================================
SELECT lives_ok(
  $$ SELECT public.rpc_registrar_revisao('ffffffff-0000-0000-0000-00000000e001', 'segunda rodada de ajuste') $$,
  'nova revisão é aceita depois da anterior concluída'
);

SELECT * FROM finish();

ROLLBACK;
