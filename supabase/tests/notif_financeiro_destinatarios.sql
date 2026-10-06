-- pgTAP: notificação financeira só chega a quem pode ver financeiro
-- (migration 20261008000000). Espelha can_view_financeiro(): admin/owner/
-- ultra_admin ou financeiro_delegado. O papel comum 'user' (ADR 0034) e o
-- coordenador sem delegação não recebem.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(6);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-00000000f801', 'Empresa Notif Financeiro', NULL, TRUE, '{"projetos": true, "financeiro": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
  ('88888888-0000-0000-0000-00000000f801', 'admin-nf@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('88888888-0000-0000-0000-00000000f802', 'user-nf@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('88888888-0000-0000-0000-00000000f803', 'coord-deleg-nf@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('88888888-0000-0000-0000-00000000f804', 'coord-nf@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, financeiro_delegado, onboarding_completed) VALUES
  ('88888888-0000-0000-0000-00000000f801', '00000000-0000-0000-0000-00000000f801', 'Admin', 'NF', 'admin-nf@test.com', 'admin', FALSE, TRUE),
  ('88888888-0000-0000-0000-00000000f802', '00000000-0000-0000-0000-00000000f801', 'Membro', 'NF', 'user-nf@test.com', 'user', FALSE, TRUE),
  ('88888888-0000-0000-0000-00000000f803', '00000000-0000-0000-0000-00000000f801', 'Coord', 'Delegado', 'coord-deleg-nf@test.com', 'coordenador', TRUE, TRUE),
  ('88888888-0000-0000-0000-00000000f804', '00000000-0000-0000-0000-00000000f801', 'Coord', 'NF', 'coord-nf@test.com', 'coordenador', FALSE, TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, financeiro_delegado = EXCLUDED.financeiro_delegado;

SET LOCAL session_replication_role = 'origin';

-- Parcela a receber vencendo em 3 dias: gera vencimento_proximo.
INSERT INTO public.receitas (id, empresa_id, descricao, valor, status, data_vencimento)
VALUES ('aaaaaaaa-0000-0000-0000-00000000f801', '00000000-0000-0000-0000-00000000f801', 'PRJ - Parcela 1/3', 5000, 'Pendente', current_date + 3);

SELECT set_eq(
  $$ SELECT unnest(public._notif_ve_financeiro('00000000-0000-0000-0000-00000000f801')) $$,
  $$ VALUES ('88888888-0000-0000-0000-00000000f801'::uuid), ('88888888-0000-0000-0000-00000000f803'::uuid) $$,
  '_notif_ve_financeiro devolve só admin e coordenador com financeiro delegado'
);

SELECT lives_ok(
  $$ SELECT public.gerar_notificacoes_ambient() $$,
  'gerar_notificacoes_ambient roda sem erro'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.notificacoes
   WHERE referencia_id = 'aaaaaaaa-0000-0000-0000-00000000f801'
     AND destinatario_id = '88888888-0000-0000-0000-00000000f801'),
  1, 'admin recebe a parcela a receber'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.notificacoes
   WHERE referencia_id = 'aaaaaaaa-0000-0000-0000-00000000f801'
     AND destinatario_id = '88888888-0000-0000-0000-00000000f803'),
  1, 'coordenador com financeiro delegado recebe'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.notificacoes
   WHERE referencia_id = 'aaaaaaaa-0000-0000-0000-00000000f801'
     AND destinatario_id = '88888888-0000-0000-0000-00000000f802'),
  0, 'membro comum (user) não recebe notificação financeira'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.notificacoes
   WHERE referencia_id = 'aaaaaaaa-0000-0000-0000-00000000f801'
     AND destinatario_id = '88888888-0000-0000-0000-00000000f804'),
  0, 'coordenador sem delegação não recebe'
);

SELECT * FROM finish();

ROLLBACK;
