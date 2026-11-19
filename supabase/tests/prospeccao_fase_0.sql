-- pgTAP: prospecção outbound no Ultra (SPEC 172, fase 0).
--
-- Só ultra admin com MFA lê e opera; admin de empresa e anon não leem nem chamam as RPCs. A fila
-- põe ICP antes de segmento de teste, nunca traz número bloqueado, é idempotente e desconta o que
-- já foi enviado hoje. `parar` bloqueia o telefone para sempre. Dados 100% sintéticos.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(22);

SET LOCAL session_replication_role = 'replica';

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('a9720000-0000-0000-0000-0000000000a0', 'Pilar interna', NULL, TRUE, '{}'::jsonb),
  ('a9720000-0000-0000-0000-0000000000c0', 'Escritório Cliente', NULL, TRUE, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, last_sign_in_at)
VALUES
  ('a9720000-0000-0000-0000-00000000a001', 'ultra@prospec.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('a9720000-0000-0000-0000-00000000c001', 'dono@prospec.test', '{}'::jsonb, 'authenticated', 'authenticated', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('a9720000-0000-0000-0000-00000000a001', 'a9720000-0000-0000-0000-0000000000a0', 'Ultra', 'Admin',
   'ultra@prospec.test', 'ultra_admin', TRUE),
  ('a9720000-0000-0000-0000-00000000c001', 'a9720000-0000-0000-0000-0000000000c0', 'Dona', 'Cliente',
   'dono@prospec.test', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;

-- L1: ICP nota 90 | L2: teste nota 95 | L3: ICP nota 50 | L4: ICP nota 80, bloqueado | L5: só e-mail
INSERT INTO public.prospec_leads
  (id, nome, segmento, segmento_teste, telefone_e164, tipo_telefone, email, canal, nota_encaixe)
VALUES
  ('a9720000-0000-0000-0000-0000000000d1', 'Lead Um', 'arquitetura', FALSE, '5514999990001', 'celular', NULL, 'whatsapp', 90),
  ('a9720000-0000-0000-0000-0000000000d2', 'Lead Dois', 'marmorarias', TRUE, '5514999990002', 'celular', NULL, 'whatsapp', 95),
  ('a9720000-0000-0000-0000-0000000000d3', 'Lead Três', 'engenharia', FALSE, '5514999990003', 'celular', NULL, 'whatsapp', 50),
  ('a9720000-0000-0000-0000-0000000000d4', 'Lead Quatro', 'arquitetura', FALSE, '5514999990004', 'celular', NULL, 'whatsapp', 80),
  ('a9720000-0000-0000-0000-0000000000d5', 'Lead Cinco', 'engenharia', FALSE, NULL, 'sem', 'cinco@prospec.test', 'email', 70);

INSERT INTO public.prospec_bloqueios (telefone_e164, motivo) VALUES ('5514999990004', 'parar');

SET LOCAL session_replication_role = 'origin';

CREATE OR REPLACE FUNCTION test_prospec_auth(p_user_id uuid, p_aal text DEFAULT 'aal2')
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

SELECT is(
  (SELECT count(*)::integer FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace
     AND c.relname IN ('prospec_leads', 'prospec_envios', 'prospec_bloqueios')
     AND c.relrowsecurity),
  3, 'as três tabelas da prospecção têm RLS ligada');

SELECT ok(
  NOT has_table_privilege('anon', 'public.prospec_leads', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.prospec_leads', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.prospec_leads', 'DELETE')
  AND NOT has_table_privilege('authenticated', 'public.prospec_envios', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.prospec_bloqueios', 'INSERT'),
  'anon não lê e ninguém logado altera ou apaga lead, nem grava envio e bloqueio pela API');

-- Admin de empresa cliente
SELECT test_prospec_auth('a9720000-0000-0000-0000-00000000c001');
SELECT is((SELECT count(*)::integer FROM public.prospec_leads), 0, 'admin de empresa não vê leads');
SELECT throws_ok($$SELECT public.prospec_montar_fila(2)$$, '42501', NULL, 'admin de empresa não monta a fila');
SELECT throws_ok(
  $$SELECT public.prospec_registrar('a9720000-0000-0000-0000-0000000000d1', 'enviei')$$, '42501', NULL,
  'admin de empresa não registra envio');
RESET ROLE;

-- Ultra admin sem MFA
SELECT test_prospec_auth('a9720000-0000-0000-0000-00000000a001', 'aal1');
SELECT is((SELECT count(*)::integer FROM public.prospec_leads), 0, 'ultra admin sem MFA não vê leads');
RESET ROLE;

-- Ultra admin com MFA
SELECT test_prospec_auth('a9720000-0000-0000-0000-00000000a001');
SELECT is((SELECT count(*)::integer FROM public.prospec_leads), 5, 'ultra admin vê os leads');

SELECT is(public.prospec_montar_fila(2), 2, 'monta a fila com o limite pedido');
SELECT is(
  (SELECT count(*)::integer FROM public.prospec_leads
   WHERE status = 'fila' AND id IN ('a9720000-0000-0000-0000-0000000000d1', 'a9720000-0000-0000-0000-0000000000d3')),
  2, 'ICP entra antes de segmento de teste, mesmo com nota menor');
SELECT is(
  (SELECT status FROM public.prospec_leads WHERE id = 'a9720000-0000-0000-0000-0000000000d4'),
  'novo', 'número bloqueado nunca entra na fila');
SELECT is(public.prospec_montar_fila(2), 2, 'montar de novo é idempotente');

SELECT public.prospec_registrar('a9720000-0000-0000-0000-0000000000d1', 'enviei', 'whatsapp', 'texto enviado');
SELECT is(
  (SELECT status FROM public.prospec_leads WHERE id = 'a9720000-0000-0000-0000-0000000000d1'),
  'enviado', 'enviei move o lead para enviado');
SELECT is(public.prospec_montar_fila(2), 1, 'o enviado de hoje conta na meta e a fila não passa do limite');

SELECT public.prospec_registrar('a9720000-0000-0000-0000-0000000000d3', 'pulei');
SELECT ok(
  (SELECT status = 'novo' AND pulado_em IS NOT NULL AND fila_em IS NULL
   FROM public.prospec_leads WHERE id = 'a9720000-0000-0000-0000-0000000000d3'),
  'pulei devolve o lead para a lista e marca quando foi pulado');

SELECT public.prospec_registrar('a9720000-0000-0000-0000-0000000000d3', 'parar');
SELECT is(
  (SELECT status FROM public.prospec_leads WHERE id = 'a9720000-0000-0000-0000-0000000000d3'),
  'parar', 'parar tira o lead da prospecção');
RESET ROLE;
SELECT is(
  (SELECT count(*)::integer FROM public.prospec_bloqueios WHERE telefone_e164 = '5514999990003'),
  1, 'parar bloqueia o telefone para sempre');

SELECT test_prospec_auth('a9720000-0000-0000-0000-00000000a001');
SELECT public.prospec_registrar('a9720000-0000-0000-0000-0000000000d2', 'respondeu', 'whatsapp', NULL, 'Ana');
SELECT ok(
  (SELECT status = 'respondeu' AND contato_nome = 'Ana' AND confianca_contato = 'pessoa'
   FROM public.prospec_leads WHERE id = 'a9720000-0000-0000-0000-0000000000d2'),
  'nome informado promove o lead a pessoa');

SELECT throws_ok(
  $$SELECT public.prospec_registrar('a9720000-0000-0000-0000-0000000000d5', 'xpto')$$, '22023', NULL,
  'resultado inválido é recusado');
SELECT throws_ok(
  $$INSERT INTO public.prospec_envios (lead_id, resultado) VALUES ('a9720000-0000-0000-0000-0000000000d5', 'enviei')$$,
  '42501', NULL, 'ultra admin não grava envio direto, só pela RPC');
SELECT lives_ok(
  $$INSERT INTO public.prospec_leads (nome, segmento, telefone_e164, tipo_telefone, canal)
    VALUES ('Importado', 'arquitetura', '5514999990009', 'celular', 'whatsapp')$$,
  'ultra admin importa lead pela API');
SELECT throws_ok(
  $$INSERT INTO public.prospec_leads (nome, segmento, telefone_e164, tipo_telefone, canal)
    VALUES ('Duplicado', 'arquitetura', '5514999990009', 'celular', 'whatsapp')$$,
  '23505', NULL, 'mesmo telefone não entra duas vezes');
SELECT throws_ok(
  $$UPDATE public.prospec_leads SET nome = 'trocado'$$, '42501', NULL,
  'ultra admin não altera lead direto, só pelas RPCs');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
