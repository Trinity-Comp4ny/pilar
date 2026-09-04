-- pgTAP: painel configurável (SPEC 092, ADR 0038, migration 20260908000000).
--
-- O ponto sensível desta mudança é o ramo condicional que o ADR 0037 tinha
-- eliminado: o bloco `financeiro` da RPC. Aqui ele é testado pelos dois lados,
-- com dois usuários da MESMA empresa: admin vê, "user" não vê. Mais a validação
-- do layout, que é escrita livre vinda do cliente.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(12);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-0000000cf001'::uuid, 'Empresa Painel Config', NULL, TRUE,
        '{"projetos": true, "propostas": true, "leads": true, "financeiro": true, "obras": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('dddddddd-0000-0000-0000-0000000cf0ad'::uuid, 'admin_cf@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('dddddddd-0000-0000-0000-0000000cf0be'::uuid, 'user_cf@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('dddddddd-0000-0000-0000-0000000cf0ad'::uuid, '00000000-0000-0000-0000-0000000cf001'::uuid,
   'Socia', 'Admin', 'admin_cf@test.com', 'admin', TRUE),
  ('dddddddd-0000-0000-0000-0000000cf0be'::uuid, '00000000-0000-0000-0000-0000000cf001'::uuid,
   'Projetista', 'User', 'user_cf@test.com', 'user', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

-- Receita pendente e vencida: dinheiro que só o admin pode enxergar.
INSERT INTO public.receitas (empresa_id, descricao, valor, status, data_vencimento)
VALUES ('00000000-0000-0000-0000-0000000cf001'::uuid, 'Medicao 1', 15000, 'Pendente', current_date - 10);

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- ── 1 e 2. O ramo condicional do financeiro, pelos dois lados ───────────────
SELECT test_set_auth('dddddddd-0000-0000-0000-0000000cf0ad'::uuid);

SELECT isnt(
  (SELECT public.get_painel_gestao() -> 'financeiro'),
  'null'::jsonb,
  'admin recebe o bloco financeiro preenchido'
);

SELECT is(
  (SELECT (public.get_painel_gestao() #>> '{financeiro,mes,receberVencido}')::numeric),
  15000::numeric,
  'admin ve o valor vencido a receber'
);

SELECT test_set_auth('dddddddd-0000-0000-0000-0000000cf0be'::uuid);

SELECT is(
  (SELECT public.get_painel_gestao() -> 'financeiro'),
  'null'::jsonb,
  'usuario sem financeiro recebe o bloco NULO, nao um bloco zerado'
);

-- Zerado seria pior que nulo: o front acharia que a empresa não tem dinheiro.
SELECT is(
  (SELECT (public.get_painel_gestao() -> 'financeiro') IS NULL
       OR jsonb_typeof(public.get_painel_gestao() -> 'financeiro') = 'null'),
  true,
  'nenhum valor monetario chega a quem nao pode ver dinheiro'
);

-- Os blocos que não são de dinheiro continuam iguais para os dois papéis.
SELECT isnt(
  (SELECT public.get_painel_gestao() -> 'projetos' -> 'totais'),
  NULL,
  'usuario sem financeiro continua recebendo os blocos de gestao, projetos e obras'
);

-- ── 3. Layout: escrita validada ────────────────────────────────────────────
SELECT lives_ok(
  $$SELECT public.set_painel_layout('[{"w":"projetos_numeros","s":"inteira"},{"w":"gestao_funil","s":"meia"}]'::jsonb)$$,
  'layout valido e aceito'
);

SELECT is(
  (SELECT jsonb_array_length(painel_layout) FROM public.profiles WHERE id = 'dddddddd-0000-0000-0000-0000000cf0be'::uuid),
  2,
  'set_painel_layout grava no proprio perfil de quem chama'
);

-- throws_ok sem mensagem aceita qualquer erro (permission denied inclusive), e
-- foi assim que estes testes passaram por acidente antes. Agora cada um exige
-- o texto da validação.
SELECT throws_like(
  $$SELECT public.set_painel_layout('[{"w":"projetos_numeros","s":"gigante"}]'::jsonb)$$,
  '%tamanho inválido%',
  'tamanho fora da lista e rejeitado pela validacao, nao por permissao'
);

SELECT throws_like(
  $$SELECT public.set_painel_layout('{"w":"projetos_numeros"}'::jsonb)$$,
  '%deve ser uma lista%',
  'layout que nao e lista e rejeitado'
);

SELECT throws_like(
  $$SELECT public.set_painel_layout('[{"s":"meia"}]'::jsonb)$$,
  '%id do widget%',
  'item sem id de widget e rejeitado'
);

SELECT throws_like(
  $$SELECT public.set_painel_layout('[{"w":"  ","s":"meia"}]'::jsonb)$$,
  '%id do widget%',
  'id de widget em branco e rejeitado'
);

-- Lista vazia é válida e significa "usar o padrão do front".
SELECT lives_ok(
  $$SELECT public.set_painel_layout('[]'::jsonb)$$,
  'lista vazia e aceita, e significa voltar ao padrao'
);

SELECT set_config('role', 'postgres', true);
SELECT * FROM finish();
ROLLBACK;
