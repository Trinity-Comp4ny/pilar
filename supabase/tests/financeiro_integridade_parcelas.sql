-- pgTAP: integridade de parcelas (SPEC 149, fase 1; migration 20261202100000).
-- B1: parcela inserida com grupo_parcela sem linha em grupos_parcela ganha o grupo.
-- B2: rpc_lancamentos_criar grava linhas + rateio numa transação só.
-- B7: quitação antecipada grava a conta do pagamento.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(12);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features, nivel_override, nivel_override_motivo)
VALUES ('00000000-0000-0000-0000-0000000f1490', 'Empresa Parcelas', NULL, TRUE, '{"financeiro": true}'::jsonb, 'ouro', 'fixture_pre_existente')
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('aaaaaaaa-f149-0000-0000-000000000001', 'admin_parcelas@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES ('aaaaaaaa-f149-0000-0000-000000000001', '00000000-0000-0000-0000-0000000f1490', 'Admin', 'Parcelas', 'admin_parcelas@test.com', 'admin', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.contas (id, empresa_id, nome, banco, saldo_inicial)
VALUES ('c0c0c0c0-f149-0000-0000-000000000001', '00000000-0000-0000-0000-0000000f1490', 'Conta teste', 'Banco', 0);

INSERT INTO public.centros_custo (id, empresa_id, nome)
VALUES
  ('cccc0000-f149-0000-0000-000000000001', '00000000-0000-0000-0000-0000000f1490', 'Estrutural'),
  ('cccc0000-f149-0000-0000-000000000002', '00000000-0000-0000-0000-0000000f1490', 'MEP');

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

SELECT test_set_auth('aaaaaaaa-f149-0000-0000-000000000001');

-- ---------------------------------------------------------------------
-- B1: insert direto (caminho antigo do form e da proposta) cria o grupo
-- ---------------------------------------------------------------------
INSERT INTO public.despesas (empresa_id, descricao, valor, status, data_vencimento, grupo_parcela, parcela_numero, parcela_total)
VALUES
  ('00000000-0000-0000-0000-0000000f1490', 'Software (1/3)', 100, 'Pendente', CURRENT_DATE + 10, 'ab000000-f149-0000-0000-000000000001', 1, 3),
  ('00000000-0000-0000-0000-0000000f1490', 'Software (2/3)', 100, 'Pendente', CURRENT_DATE + 40, 'ab000000-f149-0000-0000-000000000001', 2, 3),
  ('00000000-0000-0000-0000-0000000f1490', 'Software (3/3)', 100, 'Pendente', CURRENT_DATE + 70, 'ab000000-f149-0000-0000-000000000001', 3, 3);

SELECT is(
  (SELECT count(*)::int FROM public.grupos_parcela WHERE id = 'ab000000-f149-0000-0000-000000000001'),
  1,
  'B1: parcelas inseridas sem grupo ganham a linha em grupos_parcela'
);

SELECT is(
  (SELECT total_original FROM public.grupos_parcela WHERE id = 'ab000000-f149-0000-0000-000000000001'),
  300.00::numeric(12,2),
  'B1: total_original é a soma das parcelas inseridas'
);

SELECT is(
  (SELECT descricao FROM public.grupos_parcela WHERE id = 'ab000000-f149-0000-0000-000000000001'),
  'Software',
  'B1: descrição do grupo sem o sufixo (1/3)'
);

SELECT is(
  (SELECT grupo_status FROM public.lancamentos WHERE grupo_parcela = 'ab000000-f149-0000-0000-000000000001' AND parcela_numero = 1),
  'aberto',
  'B1: a view passa a trazer o status do grupo'
);

-- As operações de grupo funcionam no grupo que antes era órfão.
SELECT is(
  public.rpc_grupo_parcela_quitar_antecipado(
    'ab000000-f149-0000-0000-000000000001', CURRENT_DATE, 1, 0, 'c0c0c0c0-f149-0000-0000-000000000001'
  ),
  1,
  'B1/B7: quitar antecipado encontra o grupo e baixa 1 parcela'
);

SELECT is(
  (SELECT conta_id FROM public.despesas WHERE grupo_parcela = 'ab000000-f149-0000-0000-000000000001' AND parcela_numero = 1),
  'c0c0c0c0-f149-0000-0000-000000000001'::uuid,
  'B7: a parcela quitada guarda a conta do pagamento'
);

SELECT is(
  (SELECT status_agregado FROM public.grupos_parcela WHERE id = 'ab000000-f149-0000-0000-000000000001'),
  'parcial',
  'B1: status do grupo recalculado após a quitação'
);

-- Grupo criado pela RPC antiga não é duplicado nem tem o total somado de novo.
SELECT lives_ok(
  $$ SELECT public.rpc_grupo_parcela_criar('receita', 'Honorários', 900, 3, CURRENT_DATE) $$,
  'rpc_grupo_parcela_criar continua funcionando com o trigger novo'
);

SELECT is(
  (SELECT total_original FROM public.grupos_parcela WHERE descricao = 'Honorários' AND empresa_id = '00000000-0000-0000-0000-0000000f1490'),
  900.00::numeric(12,2),
  'grupo criado pela RPC mantém o total (trigger não soma de novo)'
);

-- ---------------------------------------------------------------------
-- B2: rpc_lancamentos_criar é tudo-ou-nada
-- ---------------------------------------------------------------------
SELECT is(
  array_length(public.rpc_lancamentos_criar(
    'despesa',
    jsonb_build_array(
      jsonb_build_object('descricao', 'Consultoria', 'valor', 50, 'data_vencimento', CURRENT_DATE + 5, 'status', 'Pendente',
                         'grupo_parcela', 'ab000000-f149-0000-0000-000000000002', 'parcela_numero', 1, 'parcela_total', 2),
      jsonb_build_object('descricao', 'Consultoria', 'valor', 50, 'data_vencimento', CURRENT_DATE + 35, 'status', 'Pendente',
                         'grupo_parcela', 'ab000000-f149-0000-0000-000000000002', 'parcela_numero', 2, 'parcela_total', 2)
    ),
    jsonb_build_array(
      jsonb_build_object('centro_custo_id', 'cccc0000-f149-0000-0000-000000000001', 'percentual', 60),
      jsonb_build_object('centro_custo_id', 'cccc0000-f149-0000-0000-000000000002', 'percentual', 40)
    )
  ), 1),
  2,
  'B2: cria as duas parcelas'
);

SELECT is(
  (SELECT count(*)::int FROM public.lancamento_rateios lr
     JOIN public.despesas d ON d.id = lr.lancamento_id
    WHERE d.grupo_parcela = 'ab000000-f149-0000-0000-000000000002'),
  4,
  'B2: rateio gravado nas duas parcelas (2 centros cada)'
);

-- Rateio inválido (soma 90%) desfaz tudo: nenhuma parcela fica gravada.
SELECT throws_ok(
  $$ SELECT public.rpc_lancamentos_criar(
       'despesa',
       jsonb_build_array(jsonb_build_object('descricao', 'Rateio quebrado', 'valor', 10, 'data_vencimento', CURRENT_DATE, 'status', 'Pendente')),
       jsonb_build_array(jsonb_build_object('centro_custo_id', 'cccc0000-f149-0000-0000-000000000001', 'percentual', 90))
     ) $$,
  NULL,
  'B2: rateio que não fecha 100% aborta a criação inteira'
);

SELECT * FROM finish();
ROLLBACK;
