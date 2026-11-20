-- Segurança de aditivos entre empresas: as RPCs SECURITY DEFINER
-- devem validar tenant no servidor, mesmo com IDs UUID conhecidos.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;
SELECT plan(2);

INSERT INTO public.empresas (id,nome,owner_id,onboarding_completed,features)
VALUES
 ('9a000000-0000-0000-0000-000000000001','Empresa A teste aditivo',NULL,true,
   '{"projetos":true,"financeiro":true}'::jsonb),
 ('9b000000-0000-0000-0000-000000000002','Empresa B teste aditivo',NULL,true,
   '{"projetos":true,"financeiro":true}'::jsonb);

INSERT INTO auth.users (id,email,raw_user_meta_data,aud,role)
VALUES ('9a000000-0000-0000-0000-000000000003','admin-a-tenant-test@test.invalid','{}'::jsonb,'authenticated','authenticated');

INSERT INTO public.profiles (id,empresa_id,first_name,last_name,email,role,onboarding_completed)
VALUES ('9a000000-0000-0000-0000-000000000003',
        '9a000000-0000-0000-0000-000000000001','Admin','A','admin-a-tenant-test@test.invalid','admin',true);

INSERT INTO public.projetos (id,empresa_id,nome,status)
VALUES ('9b000000-0000-0000-0000-000000000004',
        '9b000000-0000-0000-0000-000000000002','Projeto privado da B','Em andamento');

INSERT INTO public.escopos (id,empresa_id,projeto_id,descricao,tipo,status,valor_aditivo)
VALUES ('9b000000-0000-0000-0000-000000000005',
        '9b000000-0000-0000-0000-000000000002',
        '9b000000-0000-0000-0000-000000000004','Aditivo privado B','aditivo','rascunho',1500);

SELECT set_config('request.jwt.claims',
  json_build_object('sub','9a000000-0000-0000-0000-000000000003','role','authenticated')::text,true);
SELECT set_config('role','authenticated',true);

SELECT throws_ok(
  $$SELECT public.rpc_criar_aditivo_projeto(
    '9b000000-0000-0000-0000-000000000004','Escopo B','Tentativa de A',1500)$$,
  'P0001','Projeto inválido',
  'RPC criar aditivo recusa projeto de outra empresa mesmo com UUID conhecido');

SELECT throws_ok(
  $$SELECT public.rpc_prever_cobranca_aditivo('9b000000-0000-0000-0000-000000000005')$$,
  'P0001','Aditivo indisponível',
  'RPC de prévia recusa aditivo financeiro pertencente a outra empresa');

SELECT set_config('role','postgres',true);
SELECT * FROM finish();
ROLLBACK;
