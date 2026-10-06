-- pgTAP: view lancamentos expõe projeto_nome (migration 20261007000000_lancamentos_projeto_nome).
-- O financeiro mostrava o código gerado (PRJ-0023) como "projeto"; agora mostra o
-- nome digitado pelo usuário. Busca e ordenação por projeto usam o nome.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(5);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features, nivel_override, nivel_override_motivo)
VALUES ('00000000-0000-0000-0000-00000000fd1a', 'Empresa Nome Projeto', NULL, TRUE, '{"financeiro": true, "projetos": true}'::jsonb, 'ouro', 'fixture_pre_existente')
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('aaaaaaaa-fd10-0000-0000-000000000001', 'admin_nomeproj@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.projetos (id, empresa_id, nome, codigo_projeto, status)
VALUES ('cccccccc-fd10-0000-0000-000000000001', '00000000-0000-0000-0000-00000000fd1a', '409 - Neiva', 'PRJ-0023', 'Planejamento');
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES ('aaaaaaaa-fd10-0000-0000-000000000001', '00000000-0000-0000-0000-00000000fd1a', 'Admin', 'NP', 'admin_nomeproj@test.com', 'admin', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.despesas (id, empresa_id, descricao, valor, status, data_vencimento, projeto_id)
VALUES
  ('dd0000fd-fd10-0000-0000-000000000001', '00000000-0000-0000-0000-00000000fd1a', 'Material', 100, 'Pendente', '2026-10-01', 'cccccccc-fd10-0000-0000-000000000001'),
  ('dd0000fd-fd10-0000-0000-000000000002', '00000000-0000-0000-0000-00000000fd1a', 'Sem projeto', 50, 'Pendente', '2026-10-02', NULL);

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

SELECT test_set_auth('aaaaaaaa-fd10-0000-0000-000000000001');

SELECT is(
  (SELECT projeto_nome FROM public.lancamentos WHERE id = 'dd0000fd-fd10-0000-0000-000000000001'),
  '409 - Neiva',
  'view: projeto_nome traz o nome digitado pelo usuário'
);

SELECT is(
  (SELECT projeto_nome FROM public.lancamentos WHERE id = 'dd0000fd-fd10-0000-0000-000000000002'),
  NULL,
  'view: lançamento sem projeto tem projeto_nome NULL'
);

SELECT is(
  (SELECT projeto_codigo FROM public.lancamentos WHERE id = 'dd0000fd-fd10-0000-0000-000000000001'),
  'PRJ-0023',
  'view: projeto_codigo segue na view (legado), sem quebrar quem ainda lê'
);

SELECT is(
  (SELECT count(*)::int FROM public.get_lancamentos_pagina(p_search => 'Neiva')),
  1,
  'get_lancamentos_pagina: busca por nome do projeto acha o lançamento'
);

SELECT is(
  (SELECT count(*)::int FROM public.get_lancamentos_pagina(p_search => 'PRJ-0023')),
  0,
  'get_lancamentos_pagina: o código interno não é mais termo de busca'
);

SELECT * FROM finish();
ROLLBACK;
