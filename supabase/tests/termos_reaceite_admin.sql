BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;
SELECT plan(5);

INSERT INTO public.empresas (id, nome)
VALUES ('9c000000-0000-0000-0000-000000000001', 'Empresa Termos A'),
       ('9c000000-0000-0000-0000-000000000002', 'Empresa Termos B');
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('9c000000-0000-0000-0000-000000000003', 'admin-termos@test.invalid', '{}', 'authenticated', 'authenticated'),
       ('9c000000-0000-0000-0000-000000000004', 'membro-termos@test.invalid', '{}', 'authenticated', 'authenticated');
UPDATE public.profiles SET empresa_id = '9c000000-0000-0000-0000-000000000001', role = 'admin'
WHERE id = '9c000000-0000-0000-0000-000000000003';
UPDATE public.profiles SET empresa_id = '9c000000-0000-0000-0000-000000000002', role = 'colaborador'
WHERE id = '9c000000-0000-0000-0000-000000000004';

SELECT set_config('request.jwt.claims', '{"sub":"9c000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$
  INSERT INTO public.terms_acceptances (user_id, empresa_id, terms_version, privacy_version, source)
  VALUES ('9c000000-0000-0000-0000-000000000003', '9c000000-0000-0000-0000-000000000001', '2.0', '2.1', 'reaceite')
$$, 'admin registra reaceite para a própria empresa');
SELECT throws_ok($$
  INSERT INTO public.terms_acceptances (user_id, empresa_id, terms_version, privacy_version, source)
  VALUES ('9c000000-0000-0000-0000-000000000003', '9c000000-0000-0000-0000-000000000002', '2.0', '2.1', 'reaceite')
$$, '42501', NULL, 'admin não registra reaceite em nome de outra empresa');

SELECT set_config('request.jwt.claims', '{"sub":"9c000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
SELECT is((SELECT count(*)::int FROM public.terms_acceptances WHERE source = 'reaceite'), 0,
  'membro não lê o reaceite de outro usuário');
SELECT throws_ok($$
  INSERT INTO public.terms_acceptances (user_id, empresa_id, terms_version, privacy_version, source)
  VALUES ('9c000000-0000-0000-0000-000000000004', '9c000000-0000-0000-0000-000000000002', '2.0', '2.1', 'reaceite')
$$, '42501', NULL, 'membro não reaceita em nome da empresa');
SELECT lives_ok($$
  INSERT INTO public.terms_acceptances (user_id, empresa_id, terms_version, privacy_version, source)
  VALUES ('9c000000-0000-0000-0000-000000000004', '9c000000-0000-0000-0000-000000000002', '2.0', '2.1', 'profile_setup')
$$, 'membro ainda registra o próprio aceite na conclusão de perfil');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
