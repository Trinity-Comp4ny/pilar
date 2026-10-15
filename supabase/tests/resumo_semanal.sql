-- pgTAP: resumo semanal do Início (SPEC 121, ADR 0058, migration 20261103000000).
--
-- Três coisas que NÃO podem falhar:
--   1. escopo: admin recebe `empresa`, os demais `pessoa`, decidido no banco;
--   2. vazamento: o escopo pessoa não traz nada de outra pessoa nem da empresa, e o
--      escopo empresa não traz nada da empresa vizinha;
--   3. RLS de resumos_semanais: cada um lê só o que lhe cabe. O teste troca para o role
--      `authenticated` (como superuser o RLS não se aplica e o teste passaria sem provar nada).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(20);

-- ── Duas empresas: A (a que testamos) e B (a vizinha, com atraso para vazar) ──────────
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('00000000-0000-0000-0000-0000000d1a01'::uuid, 'Empresa Resumo A', NULL, TRUE,
   '{"projetos": true, "propostas": true, "leads": true, "financeiro": true, "obras": true}'::jsonb),
  ('00000000-0000-0000-0000-0000000d1b01'::uuid, 'Empresa Resumo B', NULL, TRUE,
   '{"projetos": true, "propostas": true, "leads": true, "financeiro": true, "obras": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('dddddddd-0000-0000-0000-0000000d1a0a'::uuid, 'admin_rs@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('dddddddd-0000-0000-0000-0000000d1a0b'::uuid, 'ana_rs@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('dddddddd-0000-0000-0000-0000000d1a0c'::uuid, 'beto_rs@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('dddddddd-0000-0000-0000-0000000d1a0d'::uuid, 'coord_rs@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('dddddddd-0000-0000-0000-0000000d1b0a'::uuid, 'admin_b_rs@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('dddddddd-0000-0000-0000-0000000d1a0a'::uuid, '00000000-0000-0000-0000-0000000d1a01'::uuid, 'Socia', 'Admin', 'admin_rs@test.com', 'admin', TRUE),
  ('dddddddd-0000-0000-0000-0000000d1a0b'::uuid, '00000000-0000-0000-0000-0000000d1a01'::uuid, 'Ana', 'Projetista', 'ana_rs@test.com', 'user', TRUE),
  ('dddddddd-0000-0000-0000-0000000d1a0c'::uuid, '00000000-0000-0000-0000-0000000d1a01'::uuid, 'Beto', 'Projetista', 'beto_rs@test.com', 'user', TRUE),
  ('dddddddd-0000-0000-0000-0000000d1a0d'::uuid, '00000000-0000-0000-0000-0000000d1a01'::uuid, 'Carla', 'Coordenadora', 'coord_rs@test.com', 'coordenador', TRUE),
  ('dddddddd-0000-0000-0000-0000000d1b0a'::uuid, '00000000-0000-0000-0000-0000000d1b01'::uuid, 'Outra', 'Admin', 'admin_b_rs@test.com', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role, first_name = EXCLUDED.first_name;

INSERT INTO public.pessoas (id, empresa_id, nome, email, primeiro_nome, sobrenome, profile_id)
VALUES
  ('eeeeeeee-0000-0000-0000-0000000d1a0b'::uuid, '00000000-0000-0000-0000-0000000d1a01'::uuid, 'Ana Projetista', 'ana_rs@test.com', 'Ana', 'Projetista', 'dddddddd-0000-0000-0000-0000000d1a0b'::uuid),
  ('eeeeeeee-0000-0000-0000-0000000d1a0c'::uuid, '00000000-0000-0000-0000-0000000d1a01'::uuid, 'Beto Projetista', 'beto_rs@test.com', 'Beto', 'Projetista', 'dddddddd-0000-0000-0000-0000000d1a0c'::uuid);

-- Empresa A: um projeto atrasado, uma tarefa atrasada da Ana, uma do Beto, e dinheiro.
INSERT INTO public.projetos (id, empresa_id, nome, status, data_previsao)
VALUES
  ('ffffffff-0000-0000-0000-0000000d1a01'::uuid, '00000000-0000-0000-0000-0000000d1a01'::uuid, 'Edificio A', 'Em andamento', current_date - 20),
  ('ffffffff-0000-0000-0000-0000000d1b01'::uuid, '00000000-0000-0000-0000-0000000d1b01'::uuid, 'Galpao da vizinha', 'Em andamento', current_date - 90);

INSERT INTO public.tarefas (empresa_id, titulo, status, prazo, responsavel_id, projeto_id)
VALUES
  ('00000000-0000-0000-0000-0000000d1a01'::uuid, 'Tarefa da Ana', 'a_fazer', current_date - 3, 'eeeeeeee-0000-0000-0000-0000000d1a0b'::uuid, 'ffffffff-0000-0000-0000-0000000d1a01'::uuid),
  ('00000000-0000-0000-0000-0000000d1a01'::uuid, 'Tarefa do Beto 1', 'a_fazer', current_date - 5, 'eeeeeeee-0000-0000-0000-0000000d1a0c'::uuid, 'ffffffff-0000-0000-0000-0000000d1a01'::uuid),
  ('00000000-0000-0000-0000-0000000d1a01'::uuid, 'Tarefa do Beto 2', 'a_fazer', current_date - 6, 'eeeeeeee-0000-0000-0000-0000000d1a0c'::uuid, NULL);

INSERT INTO public.receitas (empresa_id, descricao, valor, status, data_vencimento)
VALUES
  ('00000000-0000-0000-0000-0000000d1a01'::uuid, 'Medicao A', 15000, 'Pendente', current_date - 10),
  ('00000000-0000-0000-0000-0000000d1b01'::uuid, 'Medicao da vizinha', 99000, 'Pendente', current_date - 10);

-- Resumos já gravados (como service role, antes de trocar de papel).
INSERT INTO public.resumos_semanais (empresa_id, escopo, user_id, semana_inicio, conteudo, fatos)
VALUES
  ('00000000-0000-0000-0000-0000000d1a01'::uuid, 'empresa', NULL, date_trunc('week', current_date)::date, '{"manchete":"empresa A"}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000d1a01'::uuid, 'pessoa', 'dddddddd-0000-0000-0000-0000000d1a0b'::uuid, date_trunc('week', current_date)::date, '{"manchete":"da Ana"}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000d1a01'::uuid, 'pessoa', 'dddddddd-0000-0000-0000-0000000d1a0c'::uuid, date_trunc('week', current_date)::date, '{"manchete":"do Beto"}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000d1b01'::uuid, 'empresa', NULL, date_trunc('week', current_date)::date, '{"manchete":"empresa B"}'::jsonb, '{}'::jsonb);

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- ── 1. Admin: escopo empresa, com dinheiro e sem nada da vizinha ────────────────────
SELECT test_set_auth('dddddddd-0000-0000-0000-0000000d1a0a'::uuid);

SELECT is((public.get_resumo_semanal_fatos() ->> 'escopo'), 'empresa', 'admin recebe o escopo empresa');

SELECT is(
  (public.get_resumo_semanal_fatos() #>> '{financeiro,receber_vencido,total}')::numeric,
  15000::numeric,
  'admin ve o vencido a receber da PROPRIA empresa (nao soma os 99000 da vizinha)'
);

SELECT is(
  (public.get_resumo_semanal_fatos() #>> '{projetos,atrasados}')::int,
  1,
  'admin conta so o projeto atrasado da propria empresa'
);

SELECT is(
  (SELECT string_agg(x ->> 'projeto', ',') FROM jsonb_array_elements(public.get_resumo_semanal_fatos() #> '{projetos,maiores_atrasos}') x),
  'Edificio A',
  'a lista de atrasos nao cita projeto da vizinha'
);

SELECT is(
  (public.get_resumo_semanal_fatos() #>> '{tarefas,atrasadas}')::int,
  3,
  'admin ve as 3 tarefas atrasadas da empresa'
);

-- ── 2. Usuário comum: escopo pessoa, sem dinheiro e só o que é dele ─────────────────
SELECT test_set_auth('dddddddd-0000-0000-0000-0000000d1a0b'::uuid);

SELECT is((public.get_resumo_semanal_fatos() ->> 'escopo'), 'pessoa', 'usuario comum recebe o escopo pessoa');

SELECT is(
  (public.get_resumo_semanal_fatos() #>> '{tarefas,atrasadas}')::int,
  1,
  'Ana ve so a tarefa dela (as do Beto, visiveis a empresa, nao entram)'
);

SELECT ok(
  NOT (public.get_resumo_semanal_fatos() ? 'financeiro')
  AND NOT (public.get_resumo_semanal_fatos() ? 'comercial')
  AND NOT (public.get_resumo_semanal_fatos() ? 'obras'),
  'escopo pessoa nao carrega financeiro, comercial nem obras'
);

SELECT ok(
  position('Tarefa do Beto' IN public.get_resumo_semanal_fatos()::text) = 0
  AND position('15000' IN public.get_resumo_semanal_fatos()::text) = 0
  AND position('vizinha' IN public.get_resumo_semanal_fatos()::text) = 0,
  'o JSON da Ana nao cita tarefa do Beto, valor da empresa nem a vizinha'
);

SELECT is((public.get_resumo_semanal_fatos() ->> 'nome'), 'Ana', 'o escopo pessoa traz o primeiro nome');

-- ── 3. Coordenador sem financeiro delegado cai em pessoa, e sem vínculo não quebra ────
SELECT test_set_auth('dddddddd-0000-0000-0000-0000000d1a0d'::uuid);

SELECT is((public.get_resumo_semanal_fatos() ->> 'escopo'), 'pessoa', 'coordenador sem financeiro delegado recebe pessoa');

SELECT is(
  (public.get_resumo_semanal_fatos() ->> 'sem_vinculo')::boolean,
  TRUE,
  'quem nao tem registro em pessoas vem marcado sem_vinculo'
);

SELECT is(
  (public.get_resumo_semanal_fatos() #>> '{tarefas,abertas}')::int,
  0,
  'sem vinculo, zero tarefas (nao erro, nao as da empresa)'
);

-- ── 4. RLS de resumos_semanais ──────────────────────────────────────────────────────
SELECT test_set_auth('dddddddd-0000-0000-0000-0000000d1a0a'::uuid);

SELECT is(
  (SELECT string_agg(conteudo ->> 'manchete', ',' ORDER BY conteudo ->> 'manchete') FROM public.resumos_semanais),
  'empresa A',
  'admin le o resumo da empresa e nenhum pessoal nem o da vizinha'
);

SELECT test_set_auth('dddddddd-0000-0000-0000-0000000d1a0b'::uuid);

SELECT is(
  (SELECT string_agg(conteudo ->> 'manchete', ',' ORDER BY conteudo ->> 'manchete') FROM public.resumos_semanais),
  'da Ana',
  'Ana le so o proprio: nao ve o da empresa, o do Beto nem o da vizinha'
);

SELECT throws_like(
  $$INSERT INTO public.resumos_semanais (empresa_id, escopo, user_id, semana_inicio, conteudo, fatos)
    VALUES ('00000000-0000-0000-0000-0000000d1a01', 'pessoa', 'dddddddd-0000-0000-0000-0000000d1a0b', '2020-01-06', '{}', '{}')$$,
  '%permission denied%',
  'authenticated nao escreve em resumos_semanais (so a edge function)'
);

-- ── 5. get_resumo_semanal devolve o escopo e a linha certos ─────────────────────────
SELECT is(
  (public.get_resumo_semanal() #>> '{resumo,conteudo,manchete}'),
  'da Ana',
  'get_resumo_semanal devolve o resumo da propria pessoa'
);

SELECT test_set_auth('dddddddd-0000-0000-0000-0000000d1a0a'::uuid);

SELECT is(
  (public.get_resumo_semanal() ->> 'escopo') || ':' || (public.get_resumo_semanal() #>> '{resumo,conteudo,manchete}'),
  'empresa:empresa A',
  'get_resumo_semanal do admin devolve o da empresa'
);

SELECT test_set_auth('dddddddd-0000-0000-0000-0000000d1a0d'::uuid);

SELECT is(
  (public.get_resumo_semanal() -> 'resumo'),
  'null'::jsonb,
  'sem resumo gravado, resumo vem nulo (o front pede a geracao)'
);

-- ── 6. Anônimo não executa ────────────────────────────────────────────────────────────
SELECT set_config('role', 'anon', true);

SELECT throws_like(
  $$SELECT public.get_resumo_semanal_fatos()$$,
  '%permission denied%',
  'anon nao executa get_resumo_semanal_fatos'
);

SELECT * FROM finish();
ROLLBACK;
