-- pgTAP: convite por link do Portal do Cliente e do Pilar Campo (spec 099,
-- migration 20260915000000). Cobre convite válido, expirado, reutilizado e
-- política de senha para as duas RPCs públicas.
--
-- O token puro é gerado aqui em SQL só para simular o que a edge (Deno) faz de
-- verdade em produção (_shared/convite-token.ts): gera token + hash SHA256 e
-- passa só o HASH para o RPC de criação. O RPC nunca gera o token sozinho.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(13);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-00000000c0aa', 'Empresa Convite A', NULL, TRUE, '{"projetos": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('77777777-0000-0000-0000-00000000c001', 'convite_criador@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.clientes (id, empresa_id, nome)
VALUES
  ('00000000-0000-0000-0000-00000000c1aa', '00000000-0000-0000-0000-00000000c0aa', 'Cliente Convite A'),
  ('00000000-0000-0000-0000-00000000c1bb', '00000000-0000-0000-0000-00000000c0aa', 'Cliente Convite Expirado')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.obras (id, empresa_id, nome, status, created_by)
VALUES ('00000000-0000-0000-0000-00000000c2aa', '00000000-0000-0000-0000-00000000c0aa', 'Obra Convite A', 'planejada', '77777777-0000-0000-0000-00000000c001')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- Portal do Cliente
-- =============================================

DO $$
DECLARE
  v_token text := encode(gen_random_bytes(32), 'hex');
BEGIN
  PERFORM public._portal_create_account_convite(
    '00000000-0000-0000-0000-00000000c1aa'::uuid,
    '00000000-0000-0000-0000-00000000c0aa'::uuid,
    'Cliente Teste', 'cliente.convite@test.com',
    encode(digest(v_token, 'sha256'), 'hex'),
    NULL
  );
  PERFORM set_config('pgtap.portal_token_valido', v_token, false);
END $$;

SELECT is(
  (SELECT senha_hash FROM public.cliente_portal_accounts WHERE email = 'cliente.convite@test.com'),
  NULL,
  'conta criada por convite nasce sem senha'
);

SELECT ok(
  (SELECT convite_token_hash FROM public.cliente_portal_accounts WHERE email = 'cliente.convite@test.com') IS NOT NULL,
  'convite_token_hash é gravado'
);

-- Senha fraca é recusada, convite continua pendente
SELECT is(
  (public.portal_convite_definir_senha(current_setting('pgtap.portal_token_valido'), 'fraca')->>'ok')::boolean,
  false,
  'senha fraca é recusada'
);

-- Senha forte com token válido é aceita e devolve sessão
SELECT is(
  (public.portal_convite_definir_senha(current_setting('pgtap.portal_token_valido'), 'SenhaForte#2026')->>'ok')::boolean,
  true,
  'convite válido com senha forte é aceito'
);

SELECT ok(
  (SELECT senha_hash FROM public.cliente_portal_accounts WHERE email = 'cliente.convite@test.com') IS NOT NULL,
  'senha_hash é gravado após completar o convite'
);

SELECT ok(
  (SELECT convite_token_hash FROM public.cliente_portal_accounts WHERE email = 'cliente.convite@test.com') IS NULL,
  'convite é consumido (token limpo) após completar'
);

-- Token já usado não pode ser reutilizado
SELECT is(
  (public.portal_convite_definir_senha(current_setting('pgtap.portal_token_valido'), 'OutraSenhaForte#1')->>'ok')::boolean,
  false,
  'token de convite já usado é recusado'
);

-- Convite expirado
DO $$
DECLARE
  v_token text := encode(gen_random_bytes(32), 'hex');
BEGIN
  PERFORM public._portal_create_account_convite(
    '00000000-0000-0000-0000-00000000c1bb'::uuid,
    '00000000-0000-0000-0000-00000000c0aa'::uuid,
    'Cliente Expirado', 'cliente.expirado@test.com',
    encode(digest(v_token, 'sha256'), 'hex'),
    NULL
  );
  UPDATE public.cliente_portal_accounts
  SET convite_expira_em = now() - interval '1 hour'
  WHERE email = 'cliente.expirado@test.com';
  PERFORM set_config('pgtap.portal_token_expirado', v_token, false);
END $$;

SELECT is(
  (public.portal_convite_definir_senha(current_setting('pgtap.portal_token_expirado'), 'SenhaForte#2026')->>'ok')::boolean,
  false,
  'convite expirado é recusado'
);

-- Token inexistente/vazio
SELECT is(
  (public.portal_convite_definir_senha('token-que-nao-existe', 'SenhaForte#2026')->>'ok')::boolean,
  false,
  'token inexistente é recusado'
);

-- =============================================
-- Pilar Campo
-- =============================================

DO $$
DECLARE
  v_token text := encode(gen_random_bytes(32), 'hex');
BEGIN
  PERFORM public._campo_create_account_convite(
    '00000000-0000-0000-0000-00000000c2aa'::uuid,
    '00000000-0000-0000-0000-00000000c0aa'::uuid,
    'Encarregado Teste', 'encarregado.convite@test.com',
    encode(digest(v_token, 'sha256'), 'hex'),
    NULL
  );
  PERFORM set_config('pgtap.campo_token_valido', v_token, false);
END $$;

SELECT is(
  (public.campo_convite_definir_senha(current_setting('pgtap.campo_token_valido'), 'curta')->>'ok')::boolean,
  false,
  'campo: senha curta (menos de 8) é recusada'
);

SELECT is(
  (public.campo_convite_definir_senha(current_setting('pgtap.campo_token_valido'), 'senha12345')->>'ok')::boolean,
  true,
  'campo: convite válido com senha de 8+ é aceito'
);

-- Reemitir para o MESMO e-mail não duplica linha (requisito 12: upsert por email)
DO $$
DECLARE
  v_token text := encode(gen_random_bytes(32), 'hex');
BEGIN
  PERFORM public._campo_create_account_convite(
    '00000000-0000-0000-0000-00000000c2aa'::uuid,
    '00000000-0000-0000-0000-00000000c0aa'::uuid,
    'Encarregado Teste', 'encarregado.convite@test.com',
    encode(digest(v_token, 'sha256'), 'hex'),
    NULL
  );
END $$;

SELECT is(
  (SELECT count(*)::int FROM public.campo_accounts WHERE email = 'encarregado.convite@test.com'),
  1,
  'reemitir convite para o mesmo e-mail não duplica a linha (upsert)'
);

-- E-mail já usado por OUTRA empresa é bloqueado (não permite "tomar" a conta)
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-00000000c0bb', 'Empresa Convite B', NULL, TRUE, '{"projetos": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

INSERT INTO public.obras (id, empresa_id, nome, status, created_by)
VALUES ('00000000-0000-0000-0000-00000000c2bb', '00000000-0000-0000-0000-00000000c0bb', 'Obra Convite B', 'planejada', '77777777-0000-0000-0000-00000000c001')
ON CONFLICT (id) DO NOTHING;

SELECT throws_ok(
  $$ SELECT public._campo_create_account_convite(
       '00000000-0000-0000-0000-00000000c2bb'::uuid,
       '00000000-0000-0000-0000-00000000c0bb'::uuid,
       'Invasor', 'encarregado.convite@test.com',
       encode(digest('token-qualquer', 'sha256'), 'hex'), NULL
     ) $$,
  'Já existe um acesso de campo com esse e-mail em outra empresa',
  'e-mail de campo de outra empresa não pode ser tomado por upsert'
);

SELECT * FROM finish();

ROLLBACK;
