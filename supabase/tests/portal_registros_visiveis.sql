-- pgTAP: registros liberados no portal do cliente (SPEC 135, fase C, migration 20261116000000).
-- Cobre: só aparece o que o gestor liberou e a IA organizou, só da obra do cliente da sessão,
-- só os últimos 30 dias, e o JSON nunca carrega áudio, autor, extraído nem caminho de foto.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(9);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-0000000e5aaa', 'Empresa Portal Registros', NULL, TRUE, '{"obras": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clientes (id, empresa_id, nome)
VALUES
  ('00000000-0000-0000-0000-0000000e5c01', '00000000-0000-0000-0000-0000000e5aaa', 'Cliente Um'),
  ('00000000-0000-0000-0000-0000000e5c02', '00000000-0000-0000-0000-0000000e5aaa', 'Cliente Dois')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('77777777-0000-0000-0000-0000000e5a01', 'portal_registros@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

-- A obra concluída entra primeiro: o limite de obras abertas da empresa conta só as não concluídas,
-- e o gatilho olha as linhas já inseridas no mesmo comando.
INSERT INTO public.obras (id, empresa_id, nome, status, created_by, cliente_id, modelo_cobranca, visivel_portal, taxa_administracao_pct)
VALUES ('00000000-0000-0000-0000-0000000e5b02', '00000000-0000-0000-0000-0000000e5aaa', 'Obra do Cliente Dois', 'concluida',
        '77777777-0000-0000-0000-0000000e5a01', '00000000-0000-0000-0000-0000000e5c02', 'administracao', true, 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.obras (id, empresa_id, nome, status, created_by, cliente_id, modelo_cobranca, visivel_portal, taxa_administracao_pct)
VALUES ('00000000-0000-0000-0000-0000000e5b01', '00000000-0000-0000-0000-0000000e5aaa', 'Obra do Cliente Um', 'planejada',
        '77777777-0000-0000-0000-0000000e5a01', '00000000-0000-0000-0000-0000000e5c01', 'administracao', true, 10)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
BEGIN
  INSERT INTO public.cliente_portal_accounts
    (cliente_id, empresa_id, nome, email, senha_hash, ativo, token_sessao, token_expira_em)
  VALUES
    ('00000000-0000-0000-0000-0000000e5c01', '00000000-0000-0000-0000-0000000e5aaa', 'Portal Um', 'portal.um@test.com',
     crypt('senhaqualquer12', gen_salt('bf')), true,
     encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '7 days');
  PERFORM set_config('pgtap.portal_token', v_token, false);
END $$;

-- Registros: liberado e pronto (aparece), interno (não), liberado mas ainda organizando (não),
-- liberado e pronto há 45 dias (não), liberado e pronto de outra obra (não aparece nesta).
INSERT INTO public.obra_registro
  (id, empresa_id, obra_id, client_id, autor_nome, data_registro, tipo, texto_bruto, texto_organizado, extraido, audio_path, fotos, status, visivel_cliente)
VALUES
  ('00000000-0000-0000-0000-0000000e5d01', '00000000-0000-0000-0000-0000000e5aaa', '00000000-0000-0000-0000-0000000e5b01',
   gen_random_uuid(), 'Zé Pedreiro', current_date, 'audio', 'bruto', 'Laje do 2º andar concretada.',
   '{"efetivo_total": 9, "pendencias": ["segredo interno"]}'::jsonb, 'x/y/z.webm', ARRAY['e/o/registros/a/0.jpg', 'e/o/registros/a/1.jpg'], 'pronto', true),
  ('00000000-0000-0000-0000-0000000e5d02', '00000000-0000-0000-0000-0000000e5aaa', '00000000-0000-0000-0000-0000000e5b01',
   gen_random_uuid(), 'Marcos', current_date, 'texto', 'Cimento acaba amanhã', 'Cimento acaba amanhã.', '{}'::jsonb, NULL, '{}', 'pronto', false),
  ('00000000-0000-0000-0000-0000000e5d03', '00000000-0000-0000-0000-0000000e5aaa', '00000000-0000-0000-0000-0000000e5b01',
   gen_random_uuid(), 'Marcos', current_date, 'texto', 'Ainda organizando', NULL, '{}'::jsonb, NULL, '{}', 'organizando', true),
  ('00000000-0000-0000-0000-0000000e5d04', '00000000-0000-0000-0000-0000000e5aaa', '00000000-0000-0000-0000-0000000e5b01',
   gen_random_uuid(), 'Marcos', current_date - 45, 'texto', 'Muito antigo', 'Muito antigo.', '{}'::jsonb, NULL, '{}', 'pronto', true),
  ('00000000-0000-0000-0000-0000000e5d05', '00000000-0000-0000-0000-0000000e5aaa', '00000000-0000-0000-0000-0000000e5b02',
   gen_random_uuid(), 'Marcos', current_date, 'texto', 'De outra obra', 'De outra obra.', '{}'::jsonb, NULL, '{}', 'pronto', true);

CREATE TEMP TABLE t_portal AS
SELECT public.get_cliente_obra_detail(current_setting('pgtap.portal_token'), '00000000-0000-0000-0000-0000000e5b01')::jsonb AS j;

SELECT is(
  (SELECT jsonb_array_length(j->'registros') FROM t_portal),
  1,
  'só o registro liberado, pronto e recente aparece'
);
SELECT is(
  (SELECT j->'registros'->0->>'texto' FROM t_portal),
  'Laje do 2º andar concretada.',
  'mostra o texto organizado'
);
SELECT is(
  (SELECT (j->'registros'->0->>'num_fotos')::int FROM t_portal),
  2,
  'devolve só a quantidade de fotos'
);
SELECT is(
  (SELECT j->'registros'->0 ?| ARRAY['audio_path', 'extraido', 'autor_nome', 'fotos', 'texto_bruto', 'visivel_cliente'] FROM t_portal),
  false,
  'o registro não carrega áudio, extraído, autor, caminho de foto nem texto bruto'
);
SELECT is(
  (SELECT position('segredo interno' IN j::text) FROM t_portal),
  0,
  'pendência interna não vaza em lugar nenhum do JSON'
);
SELECT is(
  (SELECT position('x/y/z.webm' IN j::text) FROM t_portal),
  0,
  'caminho do áudio não vaza'
);

-- Obra de outro cliente da mesma empresa: a sessão do cliente 1 não abre.
SELECT throws_ok(
  $$SELECT public.get_cliente_obra_detail(current_setting('pgtap.portal_token'), '00000000-0000-0000-0000-0000000e5b02')$$,
  NULL,
  'Obra não encontrada',
  'sessão do cliente 1 não abre a obra do cliente 2'
);
SELECT throws_ok(
  $$SELECT public.get_cliente_obra_detail('token-invalido', '00000000-0000-0000-0000-0000000e5b01')$$,
  NULL,
  'Sessão inválida',
  'token inválido é recusado'
);

-- Gestor desliga a liberação: some do portal.
UPDATE public.obra_registro SET visivel_cliente = false WHERE id = '00000000-0000-0000-0000-0000000e5d01';
SELECT is(
  (SELECT jsonb_array_length(public.get_cliente_obra_detail(current_setting('pgtap.portal_token'), '00000000-0000-0000-0000-0000000e5b01')::jsonb->'registros')),
  0,
  'registro deixa de aparecer quando o gestor desliga "Mostrar ao cliente"'
);

SELECT * FROM finish();
ROLLBACK;
