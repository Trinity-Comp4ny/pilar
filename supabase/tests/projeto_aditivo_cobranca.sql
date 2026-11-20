-- Aprovação do aditivo distribui centavos de forma atômica, preservando as baixas.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(11);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-0000000fb001'::uuid, 'Empresa Parcelas', NULL, TRUE,
        '{"projetos": true, "financeiro": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('dddddddd-0000-0000-0000-0000000fb001'::uuid, 'socio_parcelas@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES ('dddddddd-0000-0000-0000-0000000fb001'::uuid, '00000000-0000-0000-0000-0000000fb001'::uuid,
        'Socio', 'Parcelas', 'socio_parcelas@test.com', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION test_set_auth_aditivo(p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

INSERT INTO public.clientes (id, empresa_id, nome)
VALUES ('eeeeeeee-0000-0000-0000-0000000fb001'::uuid, '00000000-0000-0000-0000-0000000fb001'::uuid, 'Cliente Parcelas');

INSERT INTO public.projetos (id, empresa_id, nome, status, cliente_id, valor_contrato, data_inicio)
VALUES ('bbbbbbbb-0000-0000-0000-0000000fb001'::uuid, '00000000-0000-0000-0000-0000000fb001'::uuid,
        '512 - Edificio Aurora', 'Em andamento', 'eeeeeeee-0000-0000-0000-0000000fb001'::uuid, 9000, current_date + 35);

SELECT test_set_auth_aditivo('dddddddd-0000-0000-0000-0000000fb001'::uuid);

CREATE TEMP TABLE dados (aditivo uuid, grupo uuid, previa jsonb);

SELECT is(public.rpc_gerar_parcelas_projeto('bbbbbbbb-0000-0000-0000-0000000fb001', 3, 30), 3,
  'projeto gera um grupo com três parcelas');

UPDATE public.receitas SET status = 'Recebido', data_recebimento = current_date
  WHERE projeto_id = 'bbbbbbbb-0000-0000-0000-0000000fb001' AND parcela_numero = 1;

INSERT INTO dados (aditivo, grupo)
SELECT public.rpc_criar_aditivo_projeto('bbbbbbbb-0000-0000-0000-0000000fb001',
  'Ajustar fachada', 'Solicitação do cliente', 1500.01),
  grupo_parcela FROM public.receitas
  WHERE projeto_id = 'bbbbbbbb-0000-0000-0000-0000000fb001' AND parcela_numero = 2;

UPDATE dados SET previa = public.rpc_prever_cobranca_aditivo(aditivo, grupo);

SELECT is((SELECT jsonb_array_length(previa->'linhas') FROM dados), 2, 'só parcelas elegíveis entram na prévia');
SELECT is((SELECT (previa->'linhas'->1->>'novo')::numeric FROM dados), 3750.01::numeric,
  'a última parcela recebe o centavo residual');
SELECT throws_ok(
  $$SELECT public.rpc_confirmar_cobranca_aditivo(aditivo, '{}'::jsonb, grupo) FROM dados$$,
  'P0001', 'As parcelas mudaram. Confira uma nova prévia antes de aprovar.',
  'uma prévia desatualizada é recusada');

SELECT lives_ok($$SELECT public.rpc_confirmar_cobranca_aditivo(aditivo, previa, grupo) FROM dados$$,
  'confirma a cobrança e aprova o aditivo');
SELECT lives_ok($$SELECT public.rpc_confirmar_cobranca_aditivo(aditivo, previa, grupo) FROM dados$$,
  'repetir a confirmação devolve a mesma operação');
SELECT is((SELECT valor_contrato FROM public.projetos_safe WHERE id = 'bbbbbbbb-0000-0000-0000-0000000fb001'),
  10500.01::numeric, 'o contrato incorpora o aditivo uma única vez');
SELECT is((SELECT valor FROM public.receitas
  WHERE projeto_id = 'bbbbbbbb-0000-0000-0000-0000000fb001' AND parcela_numero = 1),
  3000::numeric, 'a parcela recebida mantém o valor original');
SELECT is(
  (SELECT count(*)::int FROM public.receitas
   WHERE projeto_id = 'bbbbbbbb-0000-0000-0000-0000000fb001' AND deleted_at IS NULL),
  3, 'a redistribuição não cria títulos duplicados');

SELECT is(
  (SELECT sum(valor) FROM public.receitas
   WHERE projeto_id = 'bbbbbbbb-0000-0000-0000-0000000fb001' AND deleted_at IS NULL),
  10500.01::numeric, 'a soma das parcelas após o aditivo bate centavo a centavo com o contrato');

SELECT is(
  (SELECT count(*)::int FROM public.projeto_registros
   WHERE tipo = 'aditivo_cobranca' AND origem_id = (SELECT aditivo FROM dados LIMIT 1)),
  1, 'a aprovação repetida mantém apenas um registro de cobrança auditável');

SELECT set_config('role', 'postgres', true);
SELECT * FROM finish();
ROLLBACK;
