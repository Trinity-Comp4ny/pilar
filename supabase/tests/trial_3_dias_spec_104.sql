-- pgTAP: SPEC 104 (migration 20261010000000). Trial self-serve dura
-- platform_settings.trial_dias (padrão 3), cada cadastro avisa os ultra-admins
-- e o e-mail imediato ignora notificação com mais de 48h.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(9);

-- `supabase db reset --no-seed` (igual o CI) não carrega o seed: sem plano
-- ativo, handle_new_user não cria assinatura.
INSERT INTO public.pilar_subscription_plans
  (slug, nome, preco_mensal, max_usuarios, max_projetos, tokens_mensais, destaque, ativo, ordem)
VALUES ('starter', 'Essencial', 490.00, NULL, 15, 500000, FALSE, TRUE, 1)
ON CONFLICT (slug) DO UPDATE SET ativo = TRUE;

INSERT INTO public.platform_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- Ultra-admin que deve receber o aviso de cadastro. Empresa e profile criados
-- direto (replica), sem passar pelo handle_new_user.
INSERT INTO public.empresas (id, nome) VALUES ('104a0000-0000-0000-0000-0000000000aa', 'Plataforma 104');

SET LOCAL session_replication_role = replica;
INSERT INTO auth.users (id, email, aud, role, email_confirmed_at)
VALUES ('104a0000-0000-0000-0000-0000000000ad', 'ultra104@pilar.test', 'authenticated', 'authenticated', now());
INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES ('104a0000-0000-0000-0000-0000000000ad', '104a0000-0000-0000-0000-0000000000aa', 'Ultra', '104',
        'ultra104@pilar.test', 'ultra_admin', true);
SET LOCAL session_replication_role = origin;

-- =============================================
-- 1. Padrão: 3 dias
-- =============================================

SELECT is(
  (SELECT trial_dias FROM public.platform_settings WHERE id = 'default'),
  3,
  'trial_dias nasce em 3'
);

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES ('104b0000-0000-0000-0000-000000000001', 'spec104_a@empresareal.com.br',
        jsonb_build_object('company_name', 'Spec104 A', 'nome', 'Ana Teste'), 'authenticated', 'authenticated', now());

SELECT ok(
  (SELECT s.trial_ends_at BETWEEN now() + interval '3 days' - interval '1 minute'
                               AND now() + interval '3 days' + interval '1 minute'
     FROM public.pilar_subscriptions s
     JOIN public.profiles p ON p.empresa_id = s.empresa_id
    WHERE p.id = '104b0000-0000-0000-0000-000000000001'),
  'cadastro self-serve ganha 3 dias de trial'
);

SELECT is(
  (SELECT s.status FROM public.pilar_subscriptions s
     JOIN public.profiles p ON p.empresa_id = s.empresa_id
    WHERE p.id = '104b0000-0000-0000-0000-000000000001'),
  'trialing',
  'assinatura nasce em trialing'
);

-- =============================================
-- 2. Aviso ao ultra-admin
-- =============================================

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes n
     JOIN public.profiles p ON p.empresa_id = n.empresa_id
    WHERE p.id = '104b0000-0000-0000-0000-000000000001'
      AND n.destinatario_id = '104a0000-0000-0000-0000-0000000000ad'
      AND n.tipo = 'novo_cadastro'),
  1,
  'ultra-admin recebe 1 notificação novo_cadastro'
);

SELECT ok(
  (SELECT n.titulo LIKE '%Spec104 A%' AND n.mensagem LIKE '%spec104_a@empresareal.com.br%'
     FROM public.notificacoes n
    WHERE n.destinatario_id = '104a0000-0000-0000-0000-0000000000ad' AND n.tipo = 'novo_cadastro'
    ORDER BY n.created_at DESC LIMIT 1),
  'notificação traz empresa e e-mail de quem se cadastrou'
);

-- =============================================
-- 3. trial_dias editável sem deploy
-- =============================================

UPDATE public.platform_settings SET trial_dias = 5 WHERE id = 'default';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES ('104b0000-0000-0000-0000-000000000002', 'spec104_b@empresareal.com.br',
        jsonb_build_object('company_name', 'Spec104 B'), 'authenticated', 'authenticated', now());

SELECT ok(
  (SELECT s.trial_ends_at BETWEEN now() + interval '5 days' - interval '1 minute'
                               AND now() + interval '5 days' + interval '1 minute'
     FROM public.pilar_subscriptions s
     JOIN public.profiles p ON p.empresa_id = s.empresa_id
    WHERE p.id = '104b0000-0000-0000-0000-000000000002'),
  'trial_dias = 5 vale para o próximo cadastro'
);

SELECT throws_ok(
  $$UPDATE public.platform_settings SET trial_dias = 0 WHERE id = 'default'$$,
  '23514',
  NULL,
  'trial_dias fora de 1..90 é recusado'
);

-- =============================================
-- 4. E-mail imediato com teto de 48h
-- =============================================

SET LOCAL session_replication_role = replica;
INSERT INTO public.notificacoes
  (id, empresa_id, destinatario_id, tipo, categoria, severidade, titulo, mensagem, created_at)
SELECT '104c0000-0000-0000-0000-000000000001', p.empresa_id, p.id, 'teste', 'financeiro', 'high',
       'Antiga', 'Alerta de 3 dias atrás', now() - interval '3 days'
  FROM public.profiles p WHERE p.id = '104b0000-0000-0000-0000-000000000001';
INSERT INTO public.notificacoes
  (id, empresa_id, destinatario_id, tipo, categoria, severidade, titulo, mensagem, created_at)
SELECT '104c0000-0000-0000-0000-000000000002', p.empresa_id, p.id, 'teste', 'financeiro', 'high',
       'Recente', 'Alerta de 1 hora atrás', now() - interval '1 hour'
  FROM public.profiles p WHERE p.id = '104b0000-0000-0000-0000-000000000001';
SET LOCAL session_replication_role = origin;

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.notificacoes_pendentes_email('imediato')
               WHERE notificacao_id = '104c0000-0000-0000-0000-000000000001'),
  'notificação high de 3 dias atrás não vai no e-mail imediato'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.notificacoes_pendentes_email('imediato')
           WHERE notificacao_id = '104c0000-0000-0000-0000-000000000002'),
  'notificação high de 1 hora atrás continua indo'
);

SELECT * FROM finish();
ROLLBACK;
