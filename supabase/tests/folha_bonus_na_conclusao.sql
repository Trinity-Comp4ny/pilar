-- pgTAP: bônus da folha entra na conclusão (migration 20261221000000).
--
--   1. projeto que começou no mês mas não terminou não paga bônus
--   2. o projeto conta no mês em que a pessoa conclui a ÚLTIMA disciplina dela
--   3. projeto cancelado não paga
--   4. disciplina concluída pela troca de status ganha data_fim_real; reaberta perde

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(7);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-0000000f0101'::uuid, 'Empresa Folha', NULL, TRUE,
        '{"projetos": true, "financeiro": true, "pessoas": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('dddddddd-0000-0000-0000-0000000f0101'::uuid, 'socio_folha@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES ('dddddddd-0000-0000-0000-0000000f0101'::uuid, '00000000-0000-0000-0000-0000000f0101'::uuid,
        'Socio', 'Folha', 'socio_folha@test.com', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

INSERT INTO public.pessoas (id, empresa_id, nome, primeiro_nome, sobrenome, email, salario_fixo, valor_m2, percentual_producao)
VALUES ('aaaaaaaa-0000-0000-0000-0000000f0101'::uuid, '00000000-0000-0000-0000-0000000f0101'::uuid,
        'Iago Folha', 'Iago', 'Folha', 'iago-folha@test.com', 2000, 1, 10);

-- Chayanne: começou em novembro, nada concluído. Casa: começou em agosto, Iago
-- conclui uma disciplina em outubro e a outra em novembro. Galpão: cancelado.
INSERT INTO public.projetos (id, empresa_id, nome, status, data_inicio, area_m2, valor_contrato)
VALUES ('bbbbbbbb-0000-0000-0000-0000000f0101'::uuid, '00000000-0000-0000-0000-0000000f0101'::uuid,
        'Chayanne', 'Em andamento', '2026-11-03', 100, 10000),
       ('bbbbbbbb-0000-0000-0000-0000000f0102'::uuid, '00000000-0000-0000-0000-0000000f0101'::uuid,
        'Casa', 'Em andamento', '2026-08-01', 200, 20000),
       ('bbbbbbbb-0000-0000-0000-0000000f0103'::uuid, '00000000-0000-0000-0000-0000000f0101'::uuid,
        'Galpão', 'Cancelado', '2026-08-01', 300, 30000);

INSERT INTO public.projeto_disciplinas (id, projeto_id, nome, status, data_fim_real)
VALUES ('cccccccc-0000-0000-0000-0000000f0101'::uuid, 'bbbbbbbb-0000-0000-0000-0000000f0101'::uuid, 'Estrutural', 'Em andamento', NULL),
       ('cccccccc-0000-0000-0000-0000000f0102'::uuid, 'bbbbbbbb-0000-0000-0000-0000000f0102'::uuid, 'Hidráulica', 'Concluído', '2026-10-20'),
       ('cccccccc-0000-0000-0000-0000000f0103'::uuid, 'bbbbbbbb-0000-0000-0000-0000000f0102'::uuid, 'Elétrica', 'Concluído', '2026-11-05'),
       ('cccccccc-0000-0000-0000-0000000f0104'::uuid, 'bbbbbbbb-0000-0000-0000-0000000f0103'::uuid, 'Estrutural', 'Concluído', '2026-11-02');

INSERT INTO public.projeto_disciplina_responsaveis (projeto_disciplina_id, pessoa_id)
SELECT d, 'aaaaaaaa-0000-0000-0000-0000000f0101'::uuid
FROM unnest(ARRAY[
  'cccccccc-0000-0000-0000-0000000f0101', 'cccccccc-0000-0000-0000-0000000f0102',
  'cccccccc-0000-0000-0000-0000000f0103', 'cccccccc-0000-0000-0000-0000000f0104'
]::uuid[]) AS d;

SELECT test_set_auth('dddddddd-0000-0000-0000-0000000f0101'::uuid);

SELECT is(
  (SELECT projetos_nomes FROM public.get_folha_preview(11, 2026) WHERE pessoa_id = 'aaaaaaaa-0000-0000-0000-0000000f0101'),
  ARRAY['Casa']::text[],
  'novembro: só a Casa, onde a última disciplina do Iago concluiu; nem Chayanne nem o cancelado'
);

SELECT is(
  (SELECT total_variavel FROM public.get_folha_preview(11, 2026) WHERE pessoa_id = 'aaaaaaaa-0000-0000-0000-0000000f0101'),
  2200.00::numeric,
  'variável = 200 m² × 1 + 20.000 × 10%'
);

SELECT is(
  (SELECT cardinality(projetos_nomes) FROM public.get_folha_preview(10, 2026) WHERE pessoa_id = 'aaaaaaaa-0000-0000-0000-0000000f0101'),
  0,
  'outubro: a Casa ainda tinha disciplina dele aberta, não paga'
);

SELECT is(
  (SELECT detalhe_projetos -> 0 ->> 'concluido_em' FROM public.get_folha_preview(11, 2026) WHERE pessoa_id = 'aaaaaaaa-0000-0000-0000-0000000f0101'),
  '2026-11-05',
  'o detalhe diz quando a parte da pessoa concluiu'
);

RESET role;

UPDATE public.projeto_disciplinas SET status = 'Concluído' WHERE id = 'cccccccc-0000-0000-0000-0000000f0101';
SELECT is(
  (SELECT data_fim_real FROM public.projeto_disciplinas WHERE id = 'cccccccc-0000-0000-0000-0000000f0101'),
  current_date,
  'concluir pelo status grava a data de conclusão'
);

UPDATE public.projeto_disciplinas SET status = 'Em andamento' WHERE id = 'cccccccc-0000-0000-0000-0000000f0103';
SELECT is(
  (SELECT data_fim_real FROM public.projeto_disciplinas WHERE id = 'cccccccc-0000-0000-0000-0000000f0103'),
  NULL::date,
  'reabrir apaga a data de conclusão'
);

UPDATE public.projeto_disciplinas SET nome = 'Hidráulica rev' WHERE id = 'cccccccc-0000-0000-0000-0000000f0102';
SELECT is(
  (SELECT data_fim_real FROM public.projeto_disciplinas WHERE id = 'cccccccc-0000-0000-0000-0000000f0102'),
  '2026-10-20'::date,
  'editar outra coisa mantém a data de conclusão'
);

SELECT * FROM finish();
ROLLBACK;
