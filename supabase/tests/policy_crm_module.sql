-- pgTAP: módulo CRM (leads + clientes + propostas) — feature-based.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(8);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES (
  '00000000-0000-0000-0000-000000000ccc',
  'Empresa CRM',
  NULL,
  TRUE,
  '{"leads": true, "clientes": true, "propostas": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('77777777-0000-0000-0000-000000000001', 'leads_editor@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('77777777-0000-0000-0000-000000000002', 'clientes_viewer@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('77777777-0000-0000-0000-000000000003', 'no_crm@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('77777777-0000-0000-0000-000000000004', 'props_editor@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('77777777-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000ccc', 'Leads', 'Editor', 'leads_editor@test.com', 'user', TRUE),
  ('77777777-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000ccc', 'Cli', 'Viewer', 'clientes_viewer@test.com', 'user', TRUE),
  ('77777777-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000ccc', 'No', 'CRM', 'no_crm@test.com', 'user', TRUE),
  ('77777777-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000ccc', 'Props', 'Editor', 'props_editor@test.com', 'user', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- Cliente base via service_role
RESET ROLE;
INSERT INTO public.clientes (id, empresa_id, nome, contato, email)
VALUES (
  'aaaaaaaa-cccc-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000ccc',
  'Cliente CRM', 'cli@crm.com', 'cli@crm.com'
);

-- =============================================
-- Teste 1: leads_editor INSERT lead funciona
-- =============================================
SELECT test_set_auth('77777777-0000-0000-0000-000000000001');

-- 'Novo' com maiúscula: leads_status_check aceita
-- ARRAY['Novo','Em contato','Proposta','Negociação','Ganho','Perdido'], e o teste usava
-- 'novo', então o INSERT batia no constraint e a falha parecia ser de policy.
SELECT lives_ok(
  $$ INSERT INTO public.leads (empresa_id, nome, email, status)
     VALUES ('00000000-0000-0000-0000-000000000ccc', 'Lead pgtap', 'lead@test.com', 'Novo') $$,
  'leads:editor INSERT lead funciona'
);

-- =============================================
-- Teste 2: membro da empresa lê clientes (ADR 0029: acesso é role + módulo da
-- empresa; não existe mais recorte por feature no usuário)
-- =============================================
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.clientes WHERE empresa_id = '00000000-0000-0000-0000-000000000ccc'),
  1,
  'membro da empresa lê clientes mesmo sem grant individual'
);

-- =============================================
-- Teste 3: clientes_viewer lê cliente mas NÃO insere
-- =============================================
SELECT test_set_auth('77777777-0000-0000-0000-000000000002');

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.clientes WHERE empresa_id = '00000000-0000-0000-0000-000000000ccc'),
  1,
  'clientes:viewer lê clientes'
);

SELECT lives_ok(
  $$ INSERT INTO public.clientes (empresa_id, nome, contato, email)
     VALUES ('00000000-0000-0000-0000-000000000ccc', 'Cli membro', 'a@a.com', 'a@a.com') $$,
  'membro da empresa insere cliente (todo membro é editor, ADR 0029)'
);

-- =============================================
-- Teste 4: user sem grant individual vê o CRM da própria empresa
-- =============================================
SELECT test_set_auth('77777777-0000-0000-0000-000000000003');

SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.leads WHERE empresa_id = '00000000-0000-0000-0000-000000000ccc'),
  '>=',
  1,
  'user sem grant: lê leads da própria empresa'
);

SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.clientes WHERE empresa_id = '00000000-0000-0000-0000-000000000ccc'),
  '>=',
  1,
  'user sem grant: lê clientes da própria empresa'
);

-- =============================================
-- Teste 5: props_editor INSERT proposta funciona
-- =============================================
SELECT test_set_auth('77777777-0000-0000-0000-000000000004');

SELECT lives_ok(
  $$ INSERT INTO public.propostas (empresa_id, codigo, cliente_id, titulo, status)
     VALUES ('00000000-0000-0000-0000-000000000ccc', 'PROP-001',
             'aaaaaaaa-cccc-0000-0000-000000000001', 'Proposta pgtap', 'rascunho') $$,
  'propostas:editor INSERT proposta funciona'
);

-- =============================================
-- Teste 6: quem trabalha em propostas também vê os leads da empresa
-- =============================================
SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.leads WHERE empresa_id = '00000000-0000-0000-0000-000000000ccc'),
  '>=',
  1,
  'membro da empresa lê leads (o recorte por feature no usuário não existe mais)'
);

SELECT * FROM finish();

ROLLBACK;
