-- pgTAP: SPEC 132 (@all nos comentários), migration 20261112000000.
--
-- @all avisa todo perfil ativo da empresa do autor, menos o autor; quem também foi
-- marcado pelo nome recebe uma só notificação; membro desativado e outra empresa ficam de fora.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(10);

CREATE OR REPLACE FUNCTION pg_temp.como(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

-- ── Fixture ──────────────────────────────────────────────────────────────────
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features) VALUES
  ('00000000-0000-0000-0000-0000000a2001', 'Empresa Mencao Todos', NULL, TRUE, '{"leads": true}'::jsonb),
  ('00000000-0000-0000-0000-0000000a2002', 'Outra Empresa Mencao', NULL, TRUE, '{"leads": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
  ('a2000000-0000-0000-0000-00000000000a', 'autor-mt@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('a2000000-0000-0000-0000-00000000000b', 'maria-mt@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('a2000000-0000-0000-0000-00000000000c', 'socio-mt@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('a2000000-0000-0000-0000-00000000000d', 'saiu-mt@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('a2000000-0000-0000-0000-00000000000e', 'fora-mt@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed, desativado_em) VALUES
  ('a2000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a2001', 'Autor', 'MT', 'autor-mt@test.com', 'admin', TRUE, NULL),
  ('a2000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000a2001', 'Maria', 'MT', 'maria-mt@test.com', 'user', TRUE, NULL),
  -- Sócio admin sem linha em pessoas: o @all alcança pelo perfil.
  ('a2000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000a2001', 'Socio', 'MT', 'socio-mt@test.com', 'admin', TRUE, NULL),
  ('a2000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-0000000a2001', 'Saiu', 'MT', 'saiu-mt@test.com', 'user', TRUE, now()),
  ('a2000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-0000000a2002', 'Fora', 'MT', 'fora-mt@test.com', 'user', TRUE, NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id, desativado_em = EXCLUDED.desativado_em;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.pessoas (id, empresa_id, nome, primeiro_nome, sobrenome, email, cargo, profile_id) VALUES
  ('a2000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000a2001', 'Autor MT', 'Autor', 'MT', 'autor-mt@test.com', 'Engenheiro', 'a2000000-0000-0000-0000-00000000000a'),
  ('a2000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000a2001', 'Maria MT', 'Maria', 'MT', 'maria-mt@test.com', 'Projetista', 'a2000000-0000-0000-0000-00000000000b');

INSERT INTO public.leads(id, empresa_id, nome, status) VALUES ('a2000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000a2001','Lead de teste','Novo');
SELECT pg_temp.como('a2000000-0000-0000-0000-00000000000a');
SET LOCAL ROLE authenticated;
INSERT INTO public.lead_atividades(id,empresa_id,lead_id,texto,mencionados) VALUES
('a2000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000a2001','a2000000-0000-0000-0000-0000000000f1','Retornar com @Maria MT',ARRAY['a2000000-0000-0000-0000-0000000000b1']::uuid[]);
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.notificacoes WHERE referencia_id='a2000000-0000-0000-0000-0000000000f2'),1,'menção persiste um aviso junto com a atividade');
SELECT is((SELECT destinatario_id::text FROM public.notificacoes WHERE referencia_id='a2000000-0000-0000-0000-0000000000f2'),'a2000000-0000-0000-0000-00000000000b','destino vem do perfil ligado à pessoa');
SELECT is((SELECT categoria FROM public.notificacoes WHERE referencia_id='a2000000-0000-0000-0000-0000000000f2'),'lead','categoria de leads');
SELECT is((SELECT link FROM public.notificacoes WHERE referencia_id='a2000000-0000-0000-0000-0000000000f2'),'/gestao/leads?lead=a2000000-0000-0000-0000-0000000000f1&comentario=a2000000-0000-0000-0000-0000000000f2','link abre lead e comentário');
SET LOCAL ROLE authenticated;
INSERT INTO public.lead_atividades(id,empresa_id,lead_id,texto,mencionados) VALUES
('a2000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000a2001','a2000000-0000-0000-0000-0000000000f1','@todos alinhar com @Maria MT',ARRAY['a2000000-0000-0000-0000-0000000000b1']::uuid[]);
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.notificacoes WHERE referencia_id='a2000000-0000-0000-0000-0000000000f3'),2,'@todos inclui sócio sem linha em pessoas, sem duplicar destinatário');
SELECT is((SELECT count(*)::int FROM public.notificacoes WHERE referencia_id='a2000000-0000-0000-0000-0000000000f3' AND destinatario_id='a2000000-0000-0000-0000-00000000000a'),0,'não avisa o autor');
SELECT is((SELECT count(*)::int FROM public.notificacoes WHERE referencia_id='a2000000-0000-0000-0000-0000000000f3' AND destinatario_id IN ('a2000000-0000-0000-0000-00000000000d','a2000000-0000-0000-0000-00000000000e')),0,'não avisa membro desativado nem outra empresa');
SET LOCAL ROLE authenticated;
DELETE FROM public.lead_atividades WHERE id='a2000000-0000-0000-0000-0000000000f2';
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.notificacoes WHERE referencia_id='a2000000-0000-0000-0000-0000000000f2'),0,'exclusão autorizada retira o aviso');
SET LOCAL ROLE authenticated;
INSERT INTO public.lead_atividades(id,empresa_id,lead_id,texto) VALUES
('a2000000-0000-0000-0000-0000000000f4','00000000-0000-0000-0000-0000000a2001','a2000000-0000-0000-0000-0000000000f1','Falar com @allan amanhã');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.notificacoes WHERE referencia_id='a2000000-0000-0000-0000-0000000000f4'),0,'@allan não menciona todos');
SET LOCAL ROLE authenticated;
INSERT INTO public.lead_atividades(id,empresa_id,lead_id,texto,mencionados) VALUES
('a2000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-0000000a2001','a2000000-0000-0000-0000-0000000000f1','Sem menção a Maria',ARRAY['a2000000-0000-0000-0000-0000000000b1']::uuid[]);
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.notificacoes WHERE referencia_id='a2000000-0000-0000-0000-0000000000f5'),0,'ids sem menção no texto não geram aviso');
SELECT * FROM finish();
ROLLBACK;
