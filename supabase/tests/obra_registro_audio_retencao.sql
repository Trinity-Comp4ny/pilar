-- pgTAP: retenção do áudio do registro de obra (BEZ-33, ADR 0062, migration 20261115000000).
-- Cobre: o que a função lista para apagar (vencido, conta removida, órfão, e o que NÃO lista),
-- função fechada para anon e authenticated, e a restrição que deixa o registro de áudio
-- existir sem o arquivo.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(12);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-0000000e4aaa', 'Empresa Retenção Áudio', NULL, TRUE, '{"obras": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('77777777-0000-0000-0000-0000000e4a01', 'retencao_audio@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.obras (id, empresa_id, nome, status, created_by)
VALUES ('00000000-0000-0000-0000-0000000e4b01', '00000000-0000-0000-0000-0000000e4aaa', 'Obra Retenção', 'planejada',
        '77777777-0000-0000-0000-0000000e4a01')
ON CONFLICT (id) DO NOTHING;

-- Quatro registros de áudio: vencido, recente de gestor, recente de conta removida, recente de conta ativa.
INSERT INTO public.obra_registro
  (id, empresa_id, obra_id, client_id, autor_user_id, autor_nome, data_registro, tipo, audio_path)
VALUES
  ('00000000-0000-0000-0000-0000000e4c01', '00000000-0000-0000-0000-0000000e4aaa', '00000000-0000-0000-0000-0000000e4b01',
   gen_random_uuid(), '77777777-0000-0000-0000-0000000e4a01', 'Gestor', current_date - 400, 'audio', 'ret/vencido.webm'),
  ('00000000-0000-0000-0000-0000000e4c02', '00000000-0000-0000-0000-0000000e4aaa', '00000000-0000-0000-0000-0000000e4b01',
   gen_random_uuid(), '77777777-0000-0000-0000-0000000e4a01', 'Gestor', current_date - 5, 'audio', 'ret/recente.webm'),
  ('00000000-0000-0000-0000-0000000e4c03', '00000000-0000-0000-0000-0000000e4aaa', '00000000-0000-0000-0000-0000000e4b01',
   gen_random_uuid(), NULL, 'Conta removida', current_date - 5, 'audio', 'ret/conta-removida.webm');

-- Objetos no Storage: um órfão antigo, um órfão novo (upload ainda sem registro) e os três referenciados.
INSERT INTO storage.objects (bucket_id, name, created_at)
VALUES
  ('obra-registro-audio', 'ret/orfao-antigo.webm', now() - interval '2 days'),
  ('obra-registro-audio', 'ret/orfao-novo.webm', now()),
  ('obra-registro-audio', 'ret/recente.webm', now() - interval '2 days'),
  ('obra-registro-audio', 'ret/vencido.webm', now() - interval '2 days'),
  ('obra-registro-audio', 'ret/conta-removida.webm', now() - interval '2 days');

CREATE TEMP TABLE t_lista AS
SELECT x->>'path' AS path, x->>'motivo' AS motivo, x->>'registro_id' AS registro_id
FROM jsonb_array_elements(public.registro_audio_para_apagar(500)) x;

SELECT is((SELECT motivo FROM t_lista WHERE path = 'ret/vencido.webm'), 'vencido', 'registro com mais de 12 meses é listado como vencido');
SELECT is((SELECT motivo FROM t_lista WHERE path = 'ret/conta-removida.webm'), 'conta_removida', 'registro sem autor (conta de campo excluída) é listado');
SELECT is((SELECT motivo FROM t_lista WHERE path = 'ret/orfao-antigo.webm'), 'orfao', 'arquivo sem registro, com mais de 1 dia, é listado como órfão');
SELECT is((SELECT registro_id FROM t_lista WHERE path = 'ret/orfao-antigo.webm'), NULL, 'órfão não tem registro para marcar');
SELECT is((SELECT count(*)::int FROM t_lista WHERE path = 'ret/recente.webm'), 0, 'registro recente de autor existente não é listado');
SELECT is((SELECT count(*)::int FROM t_lista WHERE path = 'ret/orfao-novo.webm'), 0, 'upload de menos de 1 dia sem registro ainda não é órfão');

SELECT is(
  has_function_privilege('authenticated', 'public.registro_audio_para_apagar(integer)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.registro_audio_para_apagar(integer)', 'EXECUTE'),
  false,
  'registro_audio_para_apagar fechada para anon e authenticated'
);
SELECT is(
  has_function_privilege('service_role', 'public.registro_audio_para_apagar(integer)', 'EXECUTE'),
  true,
  'registro_audio_para_apagar liberada para o service_role (edge)'
);

SELECT is((SELECT count(*)::int FROM jsonb_array_elements(public.registro_audio_para_apagar(1))), 1, 'o limite do lote vale');

-- Depois de apagar o arquivo, o registro de áudio continua existindo.
SELECT lives_ok(
  $$UPDATE public.obra_registro SET audio_path = NULL, audio_apagado_em = now() WHERE id = '00000000-0000-0000-0000-0000000e4c01'$$,
  'registro de áudio pode perder o arquivo quando audio_apagado_em está marcado'
);
SELECT throws_ok(
  $$UPDATE public.obra_registro SET audio_path = NULL WHERE id = '00000000-0000-0000-0000-0000000e4c02'$$,
  '23514',
  NULL,
  'registro de áudio sem arquivo e sem marca de apagado continua inválido'
);
-- Marcado o registro, o arquivo que ainda sobrar no Storage vira órfão e sai na próxima rodada.
SELECT is(
  (SELECT x->>'motivo' FROM jsonb_array_elements(public.registro_audio_para_apagar(500)) x WHERE x->>'path' = 'ret/vencido.webm'),
  'orfao',
  'registro marcado como apagado não é mais vencido; o arquivo restante cai como órfão'
);

SELECT * FROM finish();
ROLLBACK;
