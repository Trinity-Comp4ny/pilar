-- pgTAP: diário de obra em registros (SPEC 135, migration 20261114000000).
-- Cobre: criar registro por token (idempotência, aceite do áudio, validações), listagem só
-- da própria obra, RLS por empresa, funções internas fechadas para anon e authenticated, e
-- a organização atômica.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(23);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('00000000-0000-0000-0000-0000000e0aaa', 'Empresa Registro A', NULL, TRUE, '{"obras": true}'::jsonb),
  ('00000000-0000-0000-0000-0000000e0bbb', 'Empresa Registro B', NULL, TRUE, '{"obras": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('77777777-0000-0000-0000-0000000e0a01', 'registro_a@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('77777777-0000-0000-0000-0000000e0b01', 'registro_b@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('77777777-0000-0000-0000-0000000e0a01', '00000000-0000-0000-0000-0000000e0aaa', 'Registro', 'A', 'registro_a@test.com', 'admin', TRUE),
  ('77777777-0000-0000-0000-0000000e0b01', '00000000-0000-0000-0000-0000000e0bbb', 'Registro', 'B', 'registro_b@test.com', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

RESET ROLE;

INSERT INTO public.obras (id, empresa_id, nome, status, created_by)
VALUES
  ('00000000-0000-0000-0000-0000000e2aaa', '00000000-0000-0000-0000-0000000e0aaa', 'Obra Registro A', 'planejada', '77777777-0000-0000-0000-0000000e0a01'),
  ('00000000-0000-0000-0000-0000000e2bbb', '00000000-0000-0000-0000-0000000e0bbb', 'Obra Registro B', 'planejada', '77777777-0000-0000-0000-0000000e0b01')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
BEGIN
  INSERT INTO public.campo_accounts
    (id, empresa_id, obra_id, nome, email, senha_hash, must_change_senha, ativo, token_sessao, token_expira_em)
  VALUES
    ('00000000-0000-0000-0000-0000000e3aaa', '00000000-0000-0000-0000-0000000e0aaa',
     '00000000-0000-0000-0000-0000000e2aaa', 'Zé Pedreiro', 'ze.registro@test.com',
     crypt('senhaqualquer12', gen_salt('bf')), false, true,
     encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '30 days');
  PERFORM set_config('pgtap.registro_token', v_token, false);
END $$;

-- Registro de OUTRA empresa, gravado direto (bypass de RLS): não pode vazar na listagem.
INSERT INTO public.obra_registro (empresa_id, obra_id, client_id, autor_nome, data_registro, tipo, texto_bruto)
VALUES ('00000000-0000-0000-0000-0000000e0bbb', '00000000-0000-0000-0000-0000000e2bbb',
        gen_random_uuid(), 'Alheio', current_date, 'texto', 'Registro da empresa B');

-- 1. Áudio sem o aviso aceito é recusado
SELECT is(
  public._campo_criar_registro(
    current_setting('pgtap.registro_token'), '11111111-0000-0000-0000-0000000e0001', current_date,
    NULL, 'e/o/c1.webm', 30, '{}'::text[])->>'erro',
  'aceite_audio',
  'áudio sem aceite do aviso é recusado'
);

-- 2. Aceitar o aviso
SELECT is(
  (public.campo_aceitar_audio(current_setting('pgtap.registro_token'))->>'ok')::boolean,
  true,
  'campo_aceitar_audio grava o aceite'
);

-- As chamadas que inserem ficam em comandos próprios: dentro do mesmo SELECT que lê a
-- tabela, o snapshot do comando não enxerga a linha que a função acabou de criar.
CREATE TEMP TABLE t_res (k text PRIMARY KEY, v json);
INSERT INTO t_res SELECT 'audio', public._campo_criar_registro(
  current_setting('pgtap.registro_token'), '11111111-0000-0000-0000-0000000e0001', current_date,
  NULL, 'e/o/c1.webm', 30, '{}'::text[]);
INSERT INTO t_res SELECT 'audio_repetido', public._campo_criar_registro(
  current_setting('pgtap.registro_token'), '11111111-0000-0000-0000-0000000e0001', current_date,
  NULL, 'e/o/c1.webm', 30, '{}'::text[]);
INSERT INTO t_res SELECT 'foto', public._campo_criar_registro(
  current_setting('pgtap.registro_token'), '11111111-0000-0000-0000-0000000e0002', current_date,
  NULL, NULL, NULL, ARRAY['e/o/registros/x/0.jpg']);
INSERT INTO t_res SELECT 'texto', public._campo_criar_registro(
  current_setting('pgtap.registro_token'), '11111111-0000-0000-0000-0000000e0003', current_date,
  'Cimento acaba amanhã', NULL, NULL, '{}'::text[]);

-- 3. Áudio depois do aceite entra como enviado
SELECT is(
  (SELECT status FROM public.obra_registro WHERE client_id = '11111111-0000-0000-0000-0000000e0001'),
  'enviado',
  'registro de áudio nasce enviado'
);

-- 4. Reenvio do mesmo client_id não duplica
SELECT is(
  (SELECT (v->>'existente')::boolean FROM t_res WHERE k = 'audio_repetido'),
  true,
  'reenvio com o mesmo client_id devolve o registro existente'
);

SELECT is(
  (SELECT count(*)::int FROM public.obra_registro WHERE client_id = '11111111-0000-0000-0000-0000000e0001'),
  1,
  'e não cria uma segunda linha'
);

-- 5. Registro nasce interno (cliente não vê) e com o nome do autor
SELECT is(
  (SELECT visivel_cliente::text || '/' || autor_nome FROM public.obra_registro WHERE client_id = '11111111-0000-0000-0000-0000000e0001'),
  'false/Zé Pedreiro',
  'nasce interno, com o nome da conta de campo'
);

-- 6. Só foto vira pronto; texto vira enviado
SELECT is(
  (SELECT status FROM public.obra_registro WHERE client_id = '11111111-0000-0000-0000-0000000e0002'),
  'pronto',
  'só foto não tem o que organizar: nasce pronto'
);

SELECT is(
  (SELECT tipo || '/' || status FROM public.obra_registro WHERE client_id = '11111111-0000-0000-0000-0000000e0003'),
  'texto/enviado',
  'texto digitado nasce enviado para a IA'
);

-- 7. Validações
SELECT is(
  public._campo_criar_registro(
    current_setting('pgtap.registro_token'), '11111111-0000-0000-0000-0000000e0004', current_date,
    '   ', NULL, NULL, '{}'::text[])->>'erro',
  'Registro vazio',
  'registro sem texto, áudio nem foto é recusado'
);

SELECT is(
  public._campo_criar_registro(
    current_setting('pgtap.registro_token'), '11111111-0000-0000-0000-0000000e0005', current_date - 60,
    'antigo', NULL, NULL, '{}'::text[])->>'erro',
  'Data inválida',
  'data fora da janela de 30 dias é recusada'
);

SELECT is(
  public._campo_criar_registro('token-que-nao-existe', gen_random_uuid(), current_date,
    'oi', NULL, NULL, '{}'::text[])->>'erro',
  'Sessão inválida',
  'sessão inválida é recusada'
);

-- 8. A listagem do campo traz só a obra da conta
SELECT is(
  (SELECT json_array_length(public.campo_listar_registros(current_setting('pgtap.registro_token'))->'registros')),
  3,
  'o campo lista os 3 registros da própria obra e nenhum da empresa B'
);

SELECT is(
  (public.campo_listar_registros('token-que-nao-existe')->>'ok')::boolean,
  false,
  'listar com sessão inválida falha'
);

-- 8b. Resposta à pergunta do efetivo: só o autor, só em registro pronto
UPDATE public.obra_registro SET status = 'pronto', extraido = '{"efetivo_total": null, "pergunta": "Quantas pessoas trabalharam hoje?"}'::jsonb
 WHERE client_id = '11111111-0000-0000-0000-0000000e0003';

SELECT is(
  (public.campo_responder_efetivo(
    current_setting('pgtap.registro_token'),
    (SELECT id FROM public.obra_registro WHERE client_id = '11111111-0000-0000-0000-0000000e0003'), 8)->>'ok')::boolean,
  true,
  'o autor responde quantas pessoas trabalharam'
);

SELECT is(
  (SELECT (extraido->>'efetivo_total') || '/' || COALESCE(extraido->>'pergunta', 'sem pergunta')
     FROM public.obra_registro WHERE client_id = '11111111-0000-0000-0000-0000000e0003'),
  '8/sem pergunta',
  'a resposta grava o efetivo e some com a pergunta'
);

SELECT is(
  public.campo_responder_efetivo(
    current_setting('pgtap.registro_token'),
    (SELECT id FROM public.obra_registro WHERE obra_id = '00000000-0000-0000-0000-0000000e2bbb' LIMIT 1), 5)->>'erro',
  'Registro não encontrado',
  'não responde registro de outra obra'
);

-- 9. RLS por empresa
SELECT test_set_auth('77777777-0000-0000-0000-0000000e0a01');
SELECT is(
  (SELECT count(*)::int FROM public.obra_registro),
  3,
  'o escritório da empresa A vê só os 3 registros dela'
);

SELECT test_set_auth('77777777-0000-0000-0000-0000000e0b01');
SELECT is(
  (SELECT count(*)::int FROM public.obra_registro WHERE obra_id = '00000000-0000-0000-0000-0000000e2aaa'),
  0,
  'a empresa B não vê registro da obra da empresa A'
);

WITH alterados AS (
  UPDATE public.obra_registro SET visivel_cliente = true
   WHERE obra_id = '00000000-0000-0000-0000-0000000e2aaa' RETURNING 1
)
SELECT is((SELECT count(*)::int FROM alterados), 0, 'a empresa B não altera registro da empresa A');

RESET ROLE;

-- 10. Funções internas fechadas para anon e authenticated
SELECT is(
  (SELECT bool_or(has_function_privilege(r, 'public._campo_criar_registro(text, uuid, date, text, text, integer, text[])', 'EXECUTE'))
     FROM unnest(ARRAY['anon', 'authenticated']) AS r),
  false,
  '_campo_criar_registro não é executável por anon nem authenticated'
);

SELECT is(
  has_function_privilege('service_role', 'public._campo_criar_registro(text, uuid, date, text, text, integer, text[])', 'EXECUTE'),
  true,
  '_campo_criar_registro é executável pela edge (service_role)'
);

-- 11. Organização atômica: o primeiro pega, o segundo não
SELECT is(
  (SELECT (public._registro_iniciar_organizacao(id)).id IS NOT NULL
     FROM public.obra_registro WHERE client_id = '11111111-0000-0000-0000-0000000e0001'),
  true,
  'o primeiro disparo pega o registro para organizar'
);

SELECT is(
  (SELECT (public._registro_iniciar_organizacao(id)).id IS NULL
     FROM public.obra_registro WHERE client_id = '11111111-0000-0000-0000-0000000e0001'),
  true,
  'o segundo disparo não pega (já está organizando)'
);

SELECT * FROM finish();
ROLLBACK;
