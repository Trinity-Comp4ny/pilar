-- pgTAP: rpc_buscar_duplicatas (SPEC 150, fase 2; migration 20261206000000).
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(10);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features, nivel_override, nivel_override_motivo)
VALUES
  ('00000000-0000-0000-0000-0000000f1493', 'Empresa Duplicatas', NULL, TRUE, '{"financeiro": true}'::jsonb, 'ouro', 'fixture_pre_existente'),
  ('00000000-0000-0000-0000-0000000f1494', 'Empresa Vizinha Dup', NULL, TRUE, '{"financeiro": true}'::jsonb, 'ouro', 'fixture_pre_existente')
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('aaaaaaaa-f149-0000-0000-000000000021', 'admin_dup@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES ('aaaaaaaa-f149-0000-0000-000000000021', '00000000-0000-0000-0000-0000000f1493', 'Admin', 'Dup', 'admin_dup@test.com', 'admin', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.fornecedores (id, empresa_id, nome)
VALUES
  ('f0f0f0f0-f149-0000-0000-000000000001', '00000000-0000-0000-0000-0000000f1493', 'Papelaria Central'),
  ('f0f0f0f0-f149-0000-0000-000000000002', '00000000-0000-0000-0000-0000000f1493', 'Gráfica Modelo');

INSERT INTO public.despesas (id, empresa_id, descricao, valor, status, data_vencimento, fornecedor_id, nota_fiscal, grupo_parcela)
VALUES
  ('d0d0d0d0-f149-0000-0000-000000000001', '00000000-0000-0000-0000-0000000f1493', 'Aluguel do escritório', 6200, 'Pendente', '2026-11-10', NULL, NULL, NULL),
  ('d0d0d0d0-f149-0000-0000-000000000002', '00000000-0000-0000-0000-0000000f1493', 'Material de escritório', 480, 'Pendente', '2026-11-10', 'f0f0f0f0-f149-0000-0000-000000000001', 'NF 1234', NULL),
  ('d0d0d0d0-f149-0000-0000-000000000003', '00000000-0000-0000-0000-0000000f1493', 'Plotter (1/3)', 900, 'Pendente', '2026-11-10', 'f0f0f0f0-f149-0000-0000-000000000002', NULL, 'ab000000-f149-0000-0000-000000000009'),
  ('d0d0d0d0-f149-0000-0000-000000000004', '00000000-0000-0000-0000-0000000f1493', 'Licença cancelada', 300, 'Cancelado', '2026-11-10', NULL, NULL, NULL);

INSERT INTO public.despesas (empresa_id, descricao, valor, status, data_vencimento)
VALUES ('00000000-0000-0000-0000-0000000f1494', 'Aluguel do escritório', 6200, 'Pendente', '2026-11-10');

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

SELECT test_set_auth('aaaaaaaa-f149-0000-0000-000000000021');

-- Descrição parecida (não idêntica) agora é pega.
SELECT is(
  (SELECT confianca FROM public.rpc_buscar_duplicatas('despesa', 6200, '2026-11-12', 'Aluguel escritório')),
  'media',
  'descrição parecida + mesmo valor + data próxima = média'
);

SELECT is(
  (SELECT count(*)::int FROM public.rpc_buscar_duplicatas('despesa', 6200, '2026-11-12', 'Aluguel escritório')),
  1,
  'só a própria empresa (a vizinha com o mesmo lançamento não aparece)'
);

-- Mesma NF + mesmo fornecedor = certeza, mesmo com descrição e data diferentes.
SELECT is(
  (SELECT confianca FROM public.rpc_buscar_duplicatas('despesa', 999, '2027-03-01', 'Outra coisa',
     'f0f0f0f0-f149-0000-0000-000000000001', ' nf 1234 ')),
  'certeza',
  'mesma nota fiscal e mesmo fornecedor = certeza'
);

SELECT is(
  (SELECT count(*)::int FROM public.rpc_buscar_duplicatas('despesa', 999, '2027-03-01', 'Outra coisa',
     'f0f0f0f0-f149-0000-0000-000000000002', 'NF 1234')),
  0,
  'mesma NF de outro fornecedor não é duplicata'
);

-- Mesmo fornecedor + mesmo valor + data a 2 dias = alta, mesmo com descrição diferente.
SELECT is(
  (SELECT confianca FROM public.rpc_buscar_duplicatas('despesa', 480, '2026-11-12', 'Compra papelaria',
     'f0f0f0f0-f149-0000-0000-000000000001')),
  'alta',
  'mesmo fornecedor, mesmo valor e data próxima = alta'
);

-- Parcelas do mesmo grupo não são duplicata entre si.
SELECT is(
  (SELECT count(*)::int FROM public.rpc_buscar_duplicatas('despesa', 900, '2026-11-11', 'Plotter (2/3)',
     'f0f0f0f0-f149-0000-0000-000000000002', NULL, NULL, 'ab000000-f149-0000-0000-000000000009')),
  0,
  'parcela do mesmo grupo não acusa'
);

-- Edição: o próprio lançamento não é duplicata dele mesmo.
SELECT is(
  (SELECT count(*)::int FROM public.rpc_buscar_duplicatas('despesa', 6200, '2026-11-10', 'Aluguel do escritório',
     NULL, NULL, 'd0d0d0d0-f149-0000-0000-000000000001')),
  0,
  'excluir_id tira o próprio lançamento'
);

SELECT is(
  (SELECT count(*)::int FROM public.rpc_buscar_duplicatas('despesa', 300, '2026-11-10', 'Licença cancelada')),
  0,
  'cancelado não conta'
);

SELECT is(
  (SELECT count(*)::int FROM public.rpc_buscar_duplicatas('receita', 6200, '2026-11-10', 'Aluguel do escritório')),
  0,
  'tipo diferente não conta'
);

-- Valor antigo "Sim" (o campo já foi Sim/Não) não identifica nota nenhuma.
UPDATE public.despesas SET nota_fiscal = 'Sim' WHERE id = 'd0d0d0d0-f149-0000-0000-000000000001';
SELECT is(
  (SELECT count(*)::int FROM public.rpc_buscar_duplicatas('despesa', 10, '2027-05-01', 'Qualquer', NULL, 'Sim')),
  0,
  'NF "Sim" não casa com outro "Sim"'
);

SELECT * FROM finish();
ROLLBACK;
