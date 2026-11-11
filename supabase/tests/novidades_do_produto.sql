-- pgTAP: novidades do produto (SPEC 152, migration 20261214000000).
-- Cobre: rascunho invisível para o usuário, publicação só pelo ultra admin e só pela RPC,
-- aviso de "você pediu" uma vez por feedback, selo e marca de visto por usuário, conta nova
-- sem histórico como novidade, e as tabelas fechadas para acesso direto.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(14);

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

CREATE OR REPLACE FUNCTION test_set_postgres()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'postgres', true);
END; $$;

SELECT test_set_postgres();

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('f1520000-0000-4000-8000-00000000000a', 'novidades_ultra@empresareal.com.br', jsonb_build_object('company_name', 'Novidades Ultra'), 'authenticated', 'authenticated', now()),
  ('f1520000-0000-4000-8000-00000000000b', 'novidades_autor@empresareal.com.br', jsonb_build_object('company_name', 'Novidades Autor'), 'authenticated', 'authenticated', now()),
  ('f1520000-0000-4000-8000-00000000000c', 'novidades_outro@empresareal.com.br', jsonb_build_object('company_name', 'Novidades Outro'), 'authenticated', 'authenticated', now());

UPDATE public.profiles SET role = 'ultra_admin' WHERE id = 'f1520000-0000-4000-8000-00000000000a';
-- As contas "já existiam" antes da release.
UPDATE public.profiles SET created_at = now() - interval '30 days'
WHERE id IN ('f1520000-0000-4000-8000-00000000000a', 'f1520000-0000-4000-8000-00000000000b',
             'f1520000-0000-4000-8000-00000000000c');

INSERT INTO public.feature_suggestions (id, tipo, titulo, descricao, created_by, empresa_id)
SELECT 'f1520000-0000-4000-8000-0000000000f1', 'sugestao', 'Fatura no projeto', 'Queria emitir a fatura de dentro do projeto',
       'f1520000-0000-4000-8000-00000000000b', p.empresa_id
FROM public.profiles p WHERE p.id = 'f1520000-0000-4000-8000-00000000000b';

-- Rascunho como a edge release-rascunho grava (service_role, fora do RLS).
INSERT INTO public.product_releases (id, sha, titulo)
VALUES ('f1520000-0000-4000-8000-0000000000d1', 'abc1234', 'Atualização de teste');
INSERT INTO public.product_release_itens (release_id, texto, impacto, feedback_ids, ordem) VALUES
  ('f1520000-0000-4000-8000-0000000000d1', 'A fatura agora sai de dentro do projeto', 'fluxo',
   ARRAY['f1520000-0000-4000-8000-0000000000f1']::uuid[], 0),
  ('f1520000-0000-4000-8000-0000000000d1', 'Fluxo de caixa exporta em Excel', 'melhoria', '{}', 1);

SELECT throws_ok(
  $$INSERT INTO public.product_releases (titulo, publicada_em) VALUES ('Atalho', now())$$,
  '42501', NULL,
  'release não nasce publicada fora da RPC'
);

-- =============================================
-- Usuário comum antes da publicação
-- =============================================
SELECT test_set_auth('f1520000-0000-4000-8000-00000000000b');

SELECT is((SELECT count(*)::int FROM public.product_releases), 0, 'usuário comum não lê a tabela de releases');
SELECT is(jsonb_array_length(public.novidades_publicadas() -> 'releases'), 0, 'rascunho não aparece em novidades');
SELECT throws_ok(
  $$SELECT public.publicar_release('f1520000-0000-4000-8000-0000000000d1')$$,
  '42501', NULL,
  'usuário comum não publica'
);
SELECT throws_ok(
  $$SELECT * FROM public.product_release_vistas$$,
  '42501', NULL,
  'tabela de vistas fechada para acesso direto'
);

-- =============================================
-- Ultra admin publica
-- =============================================
SELECT test_set_auth('f1520000-0000-4000-8000-00000000000a');

SELECT throws_ok(
  $$UPDATE public.product_releases SET publicada_em = now() WHERE id = 'f1520000-0000-4000-8000-0000000000d1'$$,
  '42501', NULL,
  'nem o ultra admin publica editando a coluna direto'
);
SELECT is(public.publicar_release('f1520000-0000-4000-8000-0000000000d1'), 1, 'publicar avisa o autor do feedback ligado');
SELECT is(public.publicar_release('f1520000-0000-4000-8000-0000000000d1'), 0, 'publicar de novo não avisa de novo');

SELECT test_set_postgres();
SELECT is(
  (SELECT count(*)::int FROM public.notificacoes
   WHERE tipo = 'feedback_entregue' AND destinatario_id = 'f1520000-0000-4000-8000-00000000000b'
     AND link = '/novidades'),
  1,
  'autor recebe uma notificação com link para Novidades'
);

-- =============================================
-- Leitura pelos usuários
-- =============================================
SELECT test_set_auth('f1520000-0000-4000-8000-00000000000b');
SELECT ok(
  (public.novidades_publicadas() -> 'releases' -> 0 ->> 'nova')::boolean
    AND (public.novidades_publicadas() -> 'releases' -> 0 -> 'itens' -> 0 ->> 'voce_pediu')::boolean,
  'autor vê a release como nova e o item com o selo "você pediu"'
);
SELECT ok(
  NOT (public.novidades_publicadas() -> 'releases' -> 0 -> 'itens' -> 0 ? 'feedback_ids'),
  'ids de feedback não saem para o usuário'
);
SELECT public.marcar_novidades_vistas();
SELECT ok(
  NOT (public.novidades_publicadas() -> 'releases' -> 0 ->> 'nova')::boolean,
  'depois de marcar como vista, a release deixa de ser nova'
);

SELECT test_set_auth('f1520000-0000-4000-8000-00000000000c');
SELECT ok(
  NOT (public.novidades_publicadas() -> 'releases' -> 0 -> 'itens' -> 0 ->> 'voce_pediu')::boolean,
  'quem não pediu não vê o selo'
);

-- Conta criada depois da publicação não recebe o histórico como novidade.
SELECT test_set_postgres();
UPDATE public.profiles SET created_at = now() + interval '1 minute' WHERE id = 'f1520000-0000-4000-8000-00000000000c';
SELECT test_set_auth('f1520000-0000-4000-8000-00000000000c');
SELECT ok(
  NOT (public.novidades_publicadas() -> 'releases' -> 0 ->> 'nova')::boolean,
  'conta nova não vê release antiga como novidade'
);

SELECT * FROM finish();
ROLLBACK;
