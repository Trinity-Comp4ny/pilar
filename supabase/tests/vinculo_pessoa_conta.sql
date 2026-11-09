-- pgTAP: vínculo pessoa ↔ conta (migration 20261207000000, feedback de cliente 09/11).
--
-- Pessoa da Equipe com e-mail diferente do login ficava sem vínculo: aparecia "sem acesso"
-- no @ e não recebia menção. Convite carrega a pessoa; admin liga à mão; troca de e-mail
-- não apaga vínculo; menção vai por e-mail no ciclo imediato.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(14);

CREATE OR REPLACE FUNCTION pg_temp.como(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- ── Fixture ──────────────────────────────────────────────────────────────────
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features) VALUES
  ('00000000-0000-0000-0000-0000000b3001', 'Empresa Vinculo', NULL, TRUE, '{"projetos": true}'::jsonb),
  ('00000000-0000-0000-0000-0000000b3002', 'Outra Empresa Vinculo', NULL, TRUE, '{"projetos": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
  ('b3000000-0000-0000-0000-00000000000a', 'admin-vc@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('b3000000-0000-0000-0000-00000000000b', 'membro-vc@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('b3000000-0000-0000-0000-00000000000c', 'amanda@escritorio-vc.test', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('b3000000-0000-0000-0000-00000000000d', 'bruno@escritorio-vc.test', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('b3000000-0000-0000-0000-00000000000e', 'fora-vc@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed) VALUES
  ('b3000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000b3001', 'Admin', 'VC', 'admin-vc@test.com', 'admin', TRUE),
  ('b3000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000b3001', 'Membro', 'VC', 'membro-vc@test.com', 'user', TRUE),
  ('b3000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-0000000b3002', 'Fora', 'VC', 'fora-vc@test.com', 'user', TRUE)
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

-- Projeto criado aqui, como postgres e antes de qualquer sessão simulada (o gatilho de
-- projetos exige e-mail confirmado de quem está na sessão authenticated).
INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('b3000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000b3001', '500 - Projeto Vinculo', 'Em andamento');

-- Pessoas com e-mail pessoal, diferente do login corporativo.
INSERT INTO public.pessoas (id, empresa_id, nome, primeiro_nome, sobrenome, email, cargo) VALUES
  ('b3000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000b3001', 'Amanda VC', 'Amanda', 'VC', 'amanda@pessoal-vc.test', 'Engenheira'),
  ('b3000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000b3001', 'Bruno VC', 'Bruno', 'VC', 'bruno@pessoal-vc.test', 'Engenheiro'),
  -- Mesmo e-mail do login, só que com maiúsculas: o vínculo automático tem que achar.
  ('b3000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000b3001', 'Membro VC', 'Membro', 'VC', 'Membro-VC@test.com', 'Projetista');

SELECT is(
  (SELECT profile_id FROM public.pessoas WHERE id = 'b3000000-0000-0000-0000-0000000000b1'),
  'b3000000-0000-0000-0000-00000000000b'::uuid,
  'vínculo por e-mail ignora maiúsculas'
);

-- ── Convite ligado à pessoa ──────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('b3000000-0000-0000-0000-00000000000a');
SELECT isnt(
  public.create_convite('amanda@escritorio-vc.test', 'user', 'Amanda VC', 'b3000000-0000-0000-0000-0000000000c1'),
  NULL,
  'admin cria convite ligado à pessoa'
);
SELECT throws_ok(
  $$ SELECT public.create_convite('x@vc.test', 'user', 'X', 'b3000000-0000-0000-0000-0000000000ff') $$,
  'P0001', 'Pessoa não encontrada na empresa',
  'convite não aceita pessoa de fora da empresa'
);
RESET ROLE;

SELECT is(
  (SELECT pessoa_id FROM public.convites WHERE email = 'amanda@escritorio-vc.test' AND usado_em IS NULL),
  'b3000000-0000-0000-0000-0000000000c1'::uuid,
  'convite guarda a pessoa'
);

-- A conta criada pelo convite (e-mail corporativo) liga na pessoa (e-mail pessoal).
INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES ('b3000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000b3001', 'Amanda', 'VC', 'amanda@escritorio-vc.test', 'user', FALSE);

SELECT is(
  (SELECT profile_id FROM public.pessoas WHERE id = 'b3000000-0000-0000-0000-0000000000c1'),
  'b3000000-0000-0000-0000-00000000000c'::uuid,
  'conta criada pelo convite liga na pessoa mesmo com e-mail diferente'
);

-- Trocar o e-mail da pessoa para um sem login não apaga o vínculo.
UPDATE public.pessoas SET email = 'amanda.nova@pessoal-vc.test' WHERE id = 'b3000000-0000-0000-0000-0000000000c1';
SELECT is(
  (SELECT profile_id FROM public.pessoas WHERE id = 'b3000000-0000-0000-0000-0000000000c1'),
  'b3000000-0000-0000-0000-00000000000c'::uuid,
  'troca de e-mail da pessoa mantém o vínculo'
);

-- ── Vínculo à mão ────────────────────────────────────────────────────────────
-- Login do Bruno existe (sem convite, e-mail corporativo), sem pessoa.
SET LOCAL session_replication_role = 'replica';
INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES ('b3000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-0000000b3001', 'Bruno', 'VC', 'bruno@escritorio-vc.test', 'user', TRUE);
SET LOCAL session_replication_role = 'origin';

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('b3000000-0000-0000-0000-00000000000b');
SELECT throws_ok(
  $$ SELECT public.vincular_pessoa_conta('b3000000-0000-0000-0000-0000000000d1', 'b3000000-0000-0000-0000-00000000000d') $$,
  'P0001', 'Apenas administradores podem vincular acesso',
  'quem não é admin não liga'
);

SELECT pg_temp.como('b3000000-0000-0000-0000-00000000000a');
SELECT lives_ok(
  $$ SELECT public.vincular_pessoa_conta('b3000000-0000-0000-0000-0000000000d1', 'b3000000-0000-0000-0000-00000000000d') $$,
  'admin liga a pessoa a um login existente'
);
SELECT throws_ok(
  $$ SELECT public.vincular_pessoa_conta('b3000000-0000-0000-0000-0000000000b1', 'b3000000-0000-0000-0000-00000000000d') $$,
  'P0001', 'Essa conta já está ligada a outra pessoa da equipe',
  'um login serve a uma pessoa só'
);
SELECT throws_ok(
  $$ SELECT public.vincular_pessoa_conta('b3000000-0000-0000-0000-0000000000b1', 'b3000000-0000-0000-0000-00000000000e') $$,
  'P0001', 'Conta não encontrada na empresa',
  'não liga login de outra empresa'
);
RESET ROLE;

SELECT is(
  (SELECT profile_id FROM public.pessoas WHERE id = 'b3000000-0000-0000-0000-0000000000d1'),
  'b3000000-0000-0000-0000-00000000000d'::uuid,
  'pessoa ficou ligada ao login'
);

-- ── Menção chega a quem foi ligado, e vai por e-mail no ciclo imediato ───────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('b3000000-0000-0000-0000-00000000000a');
SELECT is(
  public.rpc_notificar_mencao('projeto', 'b3000000-0000-0000-0000-0000000000f1',
    ARRAY['b3000000-0000-0000-0000-0000000000d1']::uuid[], 'Bruno, revisa a prancha?',
    'b3000000-0000-0000-0000-0000000004a1', false),
  1,
  'menção a pessoa ligada à mão gera notificação'
);
RESET ROLE;

-- Envelhece a notificação para entrar na janela do ciclo imediato (5 min).
UPDATE public.notificacoes SET created_at = now() - interval '10 minutes'
WHERE destinatario_id = 'b3000000-0000-0000-0000-00000000000d';

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes_pendentes_email('imediato')
   WHERE destinatario_id = 'b3000000-0000-0000-0000-00000000000d'),
  1,
  'menção (severidade medium) entra no e-mail imediato'
);

-- Preferência explícita de não receber e-mail da categoria continua valendo.
INSERT INTO public.notificacao_preferencias (user_id, empresa_id, categoria, email)
VALUES ('b3000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-0000000b3001', 'projeto', false)
ON CONFLICT (user_id, categoria) DO UPDATE SET email = false;

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes_pendentes_email('imediato')
   WHERE destinatario_id = 'b3000000-0000-0000-0000-00000000000d'),
  0,
  'quem desligou o e-mail da categoria não recebe a menção por e-mail'
);

SELECT * FROM finish();
ROLLBACK;
