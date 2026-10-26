-- pgTAP: rpc_gerar_parcelas_projeto (intervalo em dias) escreve o nome do projeto na
-- descrição da parcela, nunca o código gerado pelo sistema (PRJ-0034).
--
-- Feedback da VRZ (16/10): a migration 20261111000000 corrigiu só a rpc_gerar_parcelas_dia_fixo.
-- A irmã continuava gravando `codigo_projeto || ' - Parcela'`.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(4);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-0000000fa001'::uuid, 'Empresa Parcelas', NULL, TRUE,
        '{"projetos": true, "financeiro": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('dddddddd-0000-0000-0000-0000000fa001'::uuid, 'socio_parcelas@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES ('dddddddd-0000-0000-0000-0000000fa001'::uuid, '00000000-0000-0000-0000-0000000fa001'::uuid,
        'Socio', 'Parcelas', 'socio_parcelas@test.com', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

INSERT INTO public.clientes (id, empresa_id, nome)
VALUES ('eeeeeeee-0000-0000-0000-0000000fa001'::uuid, '00000000-0000-0000-0000-0000000fa001'::uuid, 'Cliente Parcelas');

INSERT INTO public.projetos (id, empresa_id, nome, status, cliente_id, valor_contrato, data_inicio)
VALUES ('bbbbbbbb-0000-0000-0000-0000000fa001'::uuid, '00000000-0000-0000-0000-0000000fa001'::uuid,
        '512 - Edificio Aurora', 'Em andamento', 'eeeeeeee-0000-0000-0000-0000000fa001'::uuid, 9000, current_date);

SELECT test_set_auth('dddddddd-0000-0000-0000-0000000fa001'::uuid);

SELECT is(
  public.rpc_gerar_parcelas_projeto('bbbbbbbb-0000-0000-0000-0000000fa001'::uuid, 3, 30),
  3,
  'rpc_gerar_parcelas_projeto cria as 3 parcelas'
);

SELECT is(
  (SELECT count(*)::int FROM public.receitas
    WHERE projeto_id = 'bbbbbbbb-0000-0000-0000-0000000fa001'::uuid
      AND descricao IN ('512 - Edificio Aurora - Parcela 1/3',
                        '512 - Edificio Aurora - Parcela 2/3',
                        '512 - Edificio Aurora - Parcela 3/3')),
  3,
  'a descrição da parcela usa o nome do projeto, nunca o código gerado'
);

SELECT is(
  (SELECT count(*)::int FROM public.receitas
    WHERE projeto_id = 'bbbbbbbb-0000-0000-0000-0000000fa001'::uuid
      AND cliente_id = 'eeeeeeee-0000-0000-0000-0000000fa001'::uuid),
  3,
  'as parcelas herdam o cliente do projeto'
);

SELECT is(
  (SELECT sum(valor) FROM public.receitas WHERE projeto_id = 'bbbbbbbb-0000-0000-0000-0000000fa001'::uuid),
  9000::numeric,
  'a última parcela absorve o arredondamento: o total fecha no valor do contrato'
);

-- Volta ao superuser antes do rollback, senão o DROP da função de teste falha.
SELECT set_config('role', 'postgres', true);

SELECT * FROM finish();
ROLLBACK;
