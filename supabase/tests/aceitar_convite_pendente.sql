-- As chamadas da RPC rodam como authenticated, com claims de sessão reais.
-- Fixtures são criadas como postgres; a transação inteira é revertida.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;
SELECT plan(40);
SET LOCAL session_replication_role = replica;
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, aud, role) VALUES
('a0600000-0000-0000-0000-000000000001', 'orphan1@recovery.test', now(), '{}', '{}', 'authenticated', 'authenticated'),
('a0600000-0000-0000-0000-000000000002', 'orphan2@recovery.test', now(), '{}', '{}', 'authenticated', 'authenticated'),
('a0600000-0000-0000-0000-000000000003', 'orphan3@recovery.test', now(), '{}', '{}', 'authenticated', 'authenticated'),
('a0600000-0000-0000-0000-000000000004', 'orphan4@recovery.test', now(), '{}', '{}', 'authenticated', 'authenticated'),
('a0600000-0000-0000-0000-000000000005', 'orphan5@recovery.test', now(), '{}', '{}', 'authenticated', 'authenticated'),
('a0600000-0000-0000-0000-000000000006', 'orphan6@recovery.test', NULL, '{}', '{}', 'authenticated', 'authenticated'),
('a0600000-0000-0000-0000-000000000007', 'orphan7@recovery.test', now(), '{}', '{}', 'authenticated', 'authenticated'),
('a0600000-0000-0000-0000-000000000008', 'orphan8@recovery.test', now(), '{}', '{}', 'authenticated', 'authenticated'),
('a0600000-0000-0000-0000-000000000009', 'orphan9@recovery.test', now(), '{}', '{}', 'authenticated', 'authenticated'),
('a0600000-0000-0000-0000-000000000010', 'orphan10@recovery.test', now(), '{}', '{}', 'authenticated', 'authenticated'),
('a0600000-0000-0000-0000-000000000011', 'orphan11@recovery.test', now(), '{}', '{}', 'authenticated', 'authenticated'),
('a0600000-0000-0000-0000-000000000012', 'orphan12@recovery.test', now(), '{}', '{}', 'authenticated', 'authenticated'),
('a0600000-0000-0000-0000-000000000013', 'orphan13@recovery.test', now(), '{}', '{}', 'authenticated', 'authenticated'),
('a0600000-0000-0000-0000-000000000014', 'orphan14@recovery.test', now(), '{}', '{}', 'authenticated', 'authenticated');
SET LOCAL session_replication_role = origin;
INSERT INTO public.empresas (id, nome, onboarding_completed, leitura_desde) VALUES
('b0600000-0000-0000-0000-000000000001', 'Recovery company 1', true, NULL),
('b0600000-0000-0000-0000-000000000002', 'Recovery company 2', true, NULL),
('b0600000-0000-0000-0000-000000000003', 'Recovery company 3', true, NULL);
UPDATE public.empresas SET leitura_desde = now() WHERE id = 'b0600000-0000-0000-0000-000000000003';
INSERT INTO public.profiles (id, email, empresa_id, role, first_name, onboarding_completed)
VALUES ('a0600000-0000-0000-0000-000000000007', 'orphan7@recovery.test', 'b0600000-0000-0000-0000-000000000001', 'user', 'Existing', true);
INSERT INTO public.convites (id, empresa_id, email, cargo, nome, created_at, expira_em, usado_em) VALUES
('c0600000-0000-0000-0000-000000000001', 'b0600000-0000-0000-0000-000000000001', 'ORPHAN1@recovery.test', 'user', 'Beatriz Zavattin', now(), now() + interval '1 day', NULL),
('c0600000-0000-0000-0000-000000000002', 'b0600000-0000-0000-0000-000000000001', 'orphan3@recovery.test', 'user', 'Beatriz Zavattin', now(), now() - interval '1 day', NULL),
('c0600000-0000-0000-0000-000000000003', 'b0600000-0000-0000-0000-000000000001', 'orphan4@recovery.test', 'user', 'Beatriz Zavattin', now(), now() + interval '1 day', now()),
('c0600000-0000-0000-0000-000000000004', 'b0600000-0000-0000-0000-000000000001', 'another@recovery.test', 'user', 'Beatriz Zavattin', now(), now() + interval '1 day', NULL),
('c0600000-0000-0000-0000-000000000005', 'b0600000-0000-0000-0000-000000000001', 'orphan6@recovery.test', 'user', 'Beatriz Zavattin', now(), now() + interval '1 day', NULL),
('c0600000-0000-0000-0000-000000000006', 'b0600000-0000-0000-0000-000000000002', 'orphan7@recovery.test', 'admin', 'Beatriz Zavattin', now(), now() + interval '1 day', NULL),
('c0600000-0000-0000-0000-000000000007', 'b0600000-0000-0000-0000-000000000001', 'orphan8@recovery.test', 'user', 'Beatriz Zavattin', now() - interval '1 hour', now() + interval '1 day', NULL),
('c0600000-0000-0000-0000-000000000008', 'b0600000-0000-0000-0000-000000000002', 'orphan8@recovery.test', 'coordenador', 'Beatriz Zavattin', now(), now() + interval '1 day', NULL),
('c0600000-0000-0000-0000-000000000009', 'b0600000-0000-0000-0000-000000000001', 'orphan9@recovery.test', 'owner', 'Beatriz Zavattin', now(), now() + interval '1 day', NULL),
('c0600000-0000-0000-0000-000000000010', 'b0600000-0000-0000-0000-000000000001', 'orphan10@recovery.test', 'ultra_admin', 'Beatriz Zavattin', now(), now() + interval '1 day', NULL),
('c0600000-0000-0000-0000-000000000011', 'b0600000-0000-0000-0000-000000000001', 'orphan11@recovery.test', 'colaborador', 'Beatriz Zavattin', now(), now() + interval '1 day', NULL),
('c0600000-0000-0000-0000-000000000012', 'b0600000-0000-0000-0000-000000000003', 'orphan12@recovery.test', 'user', 'Beatriz Zavattin', now(), now() + interval '1 day', NULL),
('c0600000-0000-0000-0000-000000000013', 'b0600000-0000-0000-0000-000000000001', 'orphan13@recovery.test', 'user', 'Beatriz Zavattin', now(), now() + interval '1 day', NULL),
('c0600000-0000-0000-0000-000000000014', 'b0600000-0000-0000-0000-000000000002', 'orphan13@recovery.test', 'admin', 'Beatriz Zavattin', now(), now() + interval '1 day', NULL);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0600000-0000-0000-0000-000000000001","email":"forged@invalid.test","role":"authenticated"}', true);
SELECT is(public.aceitar_convite_pendente(), 'a0600000-0000-0000-0000-000000000001'::uuid, 'convite válido recupera a própria conta por email confirmado');
SELECT is(public.aceitar_convite_pendente(), 'a0600000-0000-0000-0000-000000000001'::uuid, 'segunda chamada é idempotente');
RESET ROLE;
SELECT is((SELECT empresa_id FROM public.profiles WHERE id='a0600000-0000-0000-0000-000000000001'), 'b0600000-0000-0000-0000-000000000001'::uuid, 'profile pertence à empresa do convite');
SELECT is((SELECT role::text FROM public.profiles WHERE id='a0600000-0000-0000-0000-000000000001'), 'user', 'cargo do convite é preservado');
SELECT is((SELECT first_name || ' ' || last_name FROM public.profiles WHERE id='a0600000-0000-0000-0000-000000000001'), 'Beatriz Zavattin', 'nome é separado corretamente');
SELECT is((SELECT onboarding_completed FROM public.profiles WHERE id='a0600000-0000-0000-0000-000000000001'), false, 'recuperação passa pelo onboarding');
SELECT ok((SELECT usado_em IS NOT NULL FROM public.convites WHERE id='c0600000-0000-0000-0000-000000000001'), 'convite consumido');
SELECT is((SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id='a0600000-0000-0000-0000-000000000001'), 'user', 'trigger sincroniza metadata');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0600000-0000-0000-0000-000000000002","email":"forged@invalid.test","role":"authenticated"}', true);
SELECT is(public.aceitar_convite_pendente(), NULL::uuid, 'sem convite não recupera');
RESET ROLE;
SELECT ok(NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='a0600000-0000-0000-0000-000000000002'), 'sem convite não cria profile');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0600000-0000-0000-0000-000000000003","email":"forged@invalid.test","role":"authenticated"}', true);
SELECT is(public.aceitar_convite_pendente(), NULL::uuid, 'convite expirado não recupera');
RESET ROLE;
SELECT ok(NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='a0600000-0000-0000-0000-000000000003'), 'convite expirado não cria profile');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0600000-0000-0000-0000-000000000004","email":"forged@invalid.test","role":"authenticated"}', true);
SELECT is(public.aceitar_convite_pendente(), NULL::uuid, 'convite já usado não recupera');
RESET ROLE;
SELECT ok(NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='a0600000-0000-0000-0000-000000000004'), 'convite já usado não cria profile');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0600000-0000-0000-0000-000000000005","email":"forged@invalid.test","role":"authenticated"}', true);
SELECT is(public.aceitar_convite_pendente(), NULL::uuid, 'convite de outro email não recupera');
RESET ROLE;
SELECT ok(NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='a0600000-0000-0000-0000-000000000005'), 'convite de outro email não cria profile');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0600000-0000-0000-0000-000000000006","email":"forged@invalid.test","role":"authenticated"}', true);
SELECT throws_ok('SELECT public.aceitar_convite_pendente()', '42501', 'Confirme seu email pelo link de acesso enviado pelo administrador', 'email não confirmado é recusado');
RESET ROLE;
SELECT ok((SELECT usado_em IS NULL FROM public.convites WHERE id='c0600000-0000-0000-0000-000000000005'), 'email não confirmado não consome convite');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0600000-0000-0000-0000-000000000007","email":"forged@invalid.test","role":"authenticated"}', true);
SELECT is(public.aceitar_convite_pendente(), 'a0600000-0000-0000-0000-000000000007'::uuid, 'profile existente retorna seu ID');
RESET ROLE;
SELECT is((SELECT empresa_id FROM public.profiles WHERE id='a0600000-0000-0000-0000-000000000007'), 'b0600000-0000-0000-0000-000000000001'::uuid, 'profile existente não troca de empresa');
SELECT ok((SELECT usado_em IS NULL FROM public.convites WHERE id='c0600000-0000-0000-0000-000000000006'), 'profile existente não consome novo convite');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0600000-0000-0000-0000-000000000008","email":"forged@invalid.test","role":"authenticated"}', true);
SELECT is(public.aceitar_convite_pendente(), 'a0600000-0000-0000-0000-000000000008'::uuid, 'convite mais recente recupera');
RESET ROLE;
SELECT is((SELECT empresa_id FROM public.profiles WHERE id='a0600000-0000-0000-0000-000000000008'), 'b0600000-0000-0000-0000-000000000002'::uuid, 'convite mais recente escolhe a empresa correta');
SELECT is((SELECT role::text FROM public.profiles WHERE id='a0600000-0000-0000-0000-000000000008'), 'coordenador', 'cargo coordenador preservado');
SELECT ok((SELECT usado_em IS NULL FROM public.convites WHERE id='c0600000-0000-0000-0000-000000000007'), 'convite antigo permanece intacto');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0600000-0000-0000-0000-000000000009","email":"forged@invalid.test","role":"authenticated"}', true);
SELECT throws_ok('SELECT public.aceitar_convite_pendente()', '42501', 'Cargo não permitido no convite', 'cargo privilegiado é recusado');
RESET ROLE;
SELECT ok(NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='a0600000-0000-0000-0000-000000000009'), 'cargo privilegiado não cria profile');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0600000-0000-0000-0000-000000000010","email":"forged@invalid.test","role":"authenticated"}', true);
SELECT throws_ok('SELECT public.aceitar_convite_pendente()', '42501', 'Cargo não permitido no convite', 'cargo privilegiado é recusado');
RESET ROLE;
SELECT ok(NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='a0600000-0000-0000-0000-000000000010'), 'cargo privilegiado não cria profile');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0600000-0000-0000-0000-000000000011","email":"forged@invalid.test","role":"authenticated"}', true);
SELECT is(public.aceitar_convite_pendente(), 'a0600000-0000-0000-0000-000000000011'::uuid, 'convite legado recupera');
RESET ROLE;
SELECT is((SELECT role::text FROM public.profiles WHERE id='a0600000-0000-0000-0000-000000000011'), 'user', 'cargo legado vira user');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0600000-0000-0000-0000-000000000012","email":"forged@invalid.test","role":"authenticated"}', true);
SELECT throws_ok('SELECT public.aceitar_convite_pendente()', 'P0001', 'empresa_em_leitura', 'triggers existentes continuam ativos');
RESET ROLE;
SELECT ok(NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='a0600000-0000-0000-0000-000000000012'), 'falha de trigger desfaz profile');
SELECT ok((SELECT usado_em IS NULL FROM public.convites WHERE id='c0600000-0000-0000-0000-000000000012'), 'falha de trigger conserva convite');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0600000-0000-0000-0000-000000000013","email":"forged@invalid.test","role":"authenticated"}', true);
SELECT is(public.aceitar_convite_pendente(), 'a0600000-0000-0000-0000-000000000013'::uuid, 'empate de data recupera');
RESET ROLE;
SELECT is((SELECT empresa_id FROM public.profiles WHERE id='a0600000-0000-0000-0000-000000000013'), 'b0600000-0000-0000-0000-000000000002'::uuid, 'ID maior desempata convites');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', true);
SELECT throws_ok('SELECT public.aceitar_convite_pendente()', '42501', 'Autenticação necessária', 'sessão sem uid é recusada');
RESET ROLE;
SELECT ok(NOT has_function_privilege('anon', 'public.aceitar_convite_pendente()', 'EXECUTE'), 'anon não executa');
SELECT ok(NOT has_function_privilege('service_role', 'public.aceitar_convite_pendente()', 'EXECUTE'), 'service_role não executa');
SET LOCAL ROLE anon;
SELECT throws_ok('SELECT public.aceitar_convite_pendente()', '42501', 'permission denied for function aceitar_convite_pendente', 'chamada anon é negada');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
