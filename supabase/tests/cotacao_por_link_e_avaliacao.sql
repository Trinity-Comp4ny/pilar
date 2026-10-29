-- pgTAP: cotação por link e nota do fornecedor (SPEC 144, BEZ-351).
--
-- O escritório (authenticated, RLS ligada) gera e revoga o link e avalia o fornecedor. O fornecedor
-- (sem login) só fala com a edge, que usa o service_role: aqui simulamos esse papel. Token
-- inexistente, expirado, revogado ou de cotação encerrada têm de responder igual (sem enumeração).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(40);

-- =====================================================================
-- Fixture: empresa A (admin) e empresa B (admin de fora)
-- =====================================================================
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('00000000-0000-0000-0000-0000000144a1', 'Empresa A cotacao pgtap', NULL, TRUE, '{"projetos": true, "obras": true}'::jsonb),
  ('00000000-0000-0000-0000-0000000144b1', 'Empresa B cotacao pgtap', NULL, TRUE, '{"projetos": true, "obras": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('66666666-0000-0000-0000-000000144001', 'cot_a_admin@pgtap.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('66666666-0000-0000-0000-000000144002', 'cot_b_admin@pgtap.test', '{}'::jsonb, 'authenticated', 'authenticated', now())
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('66666666-0000-0000-0000-000000144001', '00000000-0000-0000-0000-0000000144a1', 'A', 'Admin', 'cot_a_admin@pgtap.test', 'admin', TRUE),
  ('66666666-0000-0000-0000-000000144002', '00000000-0000-0000-0000-0000000144b1', 'B', 'Admin', 'cot_b_admin@pgtap.test', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

INSERT INTO public.obras (id, empresa_id, nome, status, created_by)
VALUES ('77777777-0000-0000-0000-000000144001', '00000000-0000-0000-0000-0000000144a1', 'Obra A cotacao pgtap', 'planejada',
        '66666666-0000-0000-0000-000000144001');

INSERT INTO public.obra_cotacao (id, empresa_id, obra_id, descricao, quantidade, unidade, prazo_necessidade, tipo, created_by)
VALUES
  ('88888888-0000-0000-0000-000000144001', '00000000-0000-0000-0000-0000000144a1', '77777777-0000-0000-0000-000000144001',
   'Cimento CP-II 50 kg', 400, 'saco', CURRENT_DATE + 9, 'item', '66666666-0000-0000-0000-000000144001'),
  ('88888888-0000-0000-0000-000000144002', '00000000-0000-0000-0000-0000000144a1', '77777777-0000-0000-0000-000000144001',
   'Cesta de hidráulica', NULL, NULL, NULL, 'cesta', '66666666-0000-0000-0000-000000144001');

INSERT INTO public.fornecedores (id, empresa_id, nome)
VALUES
  ('99999999-0000-0000-0000-000000144001', '00000000-0000-0000-0000-0000000144a1', 'Casa do Construtor pgtap'),
  ('99999999-0000-0000-0000-000000144009', '00000000-0000-0000-0000-0000000144b1', 'Fornecedor da B pgtap');

CREATE OR REPLACE FUNCTION pg_temp.como(p_user uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

CREATE OR REPLACE FUNCTION pg_temp.como_servico()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM set_config('role', 'service_role', true);
END; $$;

CREATE TEMP TABLE t_tokens (chave text PRIMARY KEY, token text, convite_id uuid);
GRANT ALL ON t_tokens TO PUBLIC;

-- =====================================================================
-- A. Escritório gera o link
-- =====================================================================
SELECT pg_temp.como('66666666-0000-0000-0000-000000144001');

INSERT INTO t_tokens
SELECT 'casa', r->>'token', (r->>'convite_id')::uuid
FROM (SELECT public.rpc_criar_convite_cotacao('88888888-0000-0000-0000-000000144001',
        '99999999-0000-0000-0000-000000144001', NULL, 7) AS r) x;

SELECT ok((SELECT length(token) FROM t_tokens WHERE chave = 'casa') >= 43, 'o token tem 32 bytes em base64url');

RESET ROLE;
SELECT is((SELECT token_hash FROM public.obra_cotacao_convite WHERE id = (SELECT convite_id FROM t_tokens WHERE chave = 'casa')),
  encode(digest((SELECT token FROM t_tokens WHERE chave = 'casa'), 'sha256'), 'hex'),
  'no banco só existe o hash SHA-256 do token');
SELECT isnt((SELECT token_hash FROM public.obra_cotacao_convite WHERE id = (SELECT convite_id FROM t_tokens WHERE chave = 'casa')),
  (SELECT token FROM t_tokens WHERE chave = 'casa'), 'o token em si não é guardado');

SELECT pg_temp.como('66666666-0000-0000-0000-000000144001');

SELECT lives_ok(
  $$SELECT public.rpc_criar_convite_cotacao('88888888-0000-0000-0000-000000144001', NULL, 'Ferragens Norte pgtap', 3)$$,
  'fornecedor novo entra pelo nome digitado');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.fornecedores
           WHERE empresa_id = '00000000-0000-0000-0000-0000000144a1' AND nome = 'Ferragens Norte pgtap'), 1,
  'o fornecedor digitado foi cadastrado');

SELECT pg_temp.como('66666666-0000-0000-0000-000000144001');
SELECT throws_ok(
  $$SELECT public.rpc_criar_convite_cotacao('88888888-0000-0000-0000-000000144002',
      '99999999-0000-0000-0000-000000144001', NULL, 7)$$,
  'P0001', 'O link vale para cotação de item único', 'cotação em cesta não gera link');
SELECT throws_ok(
  $$SELECT public.rpc_criar_convite_cotacao('88888888-0000-0000-0000-000000144001',
      '99999999-0000-0000-0000-000000144001', NULL, 31)$$,
  'P0001', 'A validade do link vai de 1 a 30 dias', 'validade acima de 30 dias é recusada');
SELECT throws_ok(
  $$SELECT public.rpc_criar_convite_cotacao('88888888-0000-0000-0000-000000144001',
      '99999999-0000-0000-0000-000000144009', NULL, 7)$$,
  'P0001', 'Fornecedor não encontrado', 'fornecedor de outra empresa é recusado');

-- escritório lê os convites, mas não o hash, e não escreve direto
SELECT is((SELECT count(*)::int FROM public.obra_cotacao_convite), 2, 'o escritório lê os convites da própria empresa');
SELECT throws_ok($$SELECT token_hash FROM public.obra_cotacao_convite$$, '42501', NULL,
  'o authenticated não lê o hash do token');
SELECT throws_ok(
  $$INSERT INTO public.obra_cotacao_convite (empresa_id, cotacao_id, fornecedor_id, fornecedor_nome, token_hash, expira_em)
    VALUES ('00000000-0000-0000-0000-0000000144a1', '88888888-0000-0000-0000-000000144001',
            '99999999-0000-0000-0000-000000144001', 'X pgtap', repeat('a', 64), now() + interval '1 day')$$,
  '42501', NULL, 'o authenticated não insere convite direto');

-- empresa B não vê nem cria convite na cotação da A
SELECT pg_temp.como('66666666-0000-0000-0000-000000144002');
SELECT is((SELECT count(*)::int FROM public.obra_cotacao_convite), 0, 'a empresa B não vê convites da A');
SELECT throws_ok(
  $$SELECT public.rpc_criar_convite_cotacao('88888888-0000-0000-0000-000000144001', NULL, 'Intruso pgtap', 7)$$,
  'P0001', 'Cotação não encontrada ou sem permissão', 'a empresa B não gera link na cotação da A');

-- =====================================================================
-- B. Grants: a parte pública só existe para o service_role
-- =====================================================================
RESET ROLE;
SELECT is(has_function_privilege('anon', 'public.cotacao_link_consultar(text)', 'EXECUTE'), FALSE, 'anon não consulta');
SELECT is(has_function_privilege('authenticated', 'public.cotacao_link_responder(text, numeric, numeric, text, numeric, integer, text)', 'EXECUTE'), FALSE,
  'authenticated não responde pelo hash');
SELECT is(has_function_privilege('service_role', 'public.cotacao_link_responder(text, numeric, numeric, text, numeric, integer, text)', 'EXECUTE'), TRUE,
  'service_role responde');

-- =====================================================================
-- C. Fornecedor consulta e responde (pela edge, como service_role)
-- =====================================================================
SELECT pg_temp.como_servico();

SELECT is((SELECT public.cotacao_link_consultar(encode(digest((SELECT token FROM t_tokens WHERE chave = 'casa'), 'sha256'), 'hex'))->>'descricao'),
  'Cimento CP-II 50 kg', 'o fornecedor vê a descrição da cotação');
SELECT is((SELECT public.cotacao_link_consultar(encode(digest((SELECT token FROM t_tokens WHERE chave = 'casa'), 'sha256'), 'hex')) ?| ARRAY['obra_id', 'obra_nome', 'propostas', 'valor_total']),
  FALSE, 'a consulta não expõe obra nem propostas');

SELECT is(public.cotacao_link_consultar(repeat('0', 64)), '{"ok": false}'::jsonb, 'token inexistente responde só ok=false');

SELECT is((SELECT public.cotacao_link_responder(encode(digest((SELECT token FROM t_tokens WHERE chave = 'casa'), 'sha256'), 'hex'),
    20900, 21500, '30 dias', 3, 5, 'frete incluso')->>'ok'), 'true', 'o fornecedor envia a proposta');

RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.obra_cotacao_proposta
           WHERE cotacao_id = '88888888-0000-0000-0000-000000144001' AND origem = 'link'), 1,
  'a proposta nasce com origem link');
SELECT is((SELECT desconto_pct FROM public.obra_cotacao_proposta WHERE cotacao_id = '88888888-0000-0000-0000-000000144001'), 3.00,
  'o desconto foi guardado');
SELECT isnt((SELECT respondido_em FROM public.obra_cotacao_convite WHERE id = (SELECT convite_id FROM t_tokens WHERE chave = 'casa')), NULL,
  'o convite vira respondido');
SELECT is((SELECT count(*)::int FROM public.notificacoes WHERE tipo = 'cotacao_respondida'
           AND destinatario_id = '66666666-0000-0000-0000-000000144001'), 1, 'quem criou o link é avisado');

SELECT pg_temp.como_servico();
SELECT public.cotacao_link_responder(encode(digest((SELECT token FROM t_tokens WHERE chave = 'casa'), 'sha256'), 'hex'),
  19800, NULL, '28 dias', NULL, 4, NULL);
RESET ROLE;
SELECT is((SELECT count(*)::int || '/' || max(valor)::text FROM public.obra_cotacao_proposta
           WHERE cotacao_id = '88888888-0000-0000-0000-000000144001'), '1/19800.00',
  'reenviar sobrescreve a mesma proposta, sem criar outra');

SELECT pg_temp.como_servico();
SELECT is((SELECT public.cotacao_link_responder(encode(digest((SELECT token FROM t_tokens WHERE chave = 'casa'), 'sha256'), 'hex'),
    -5, NULL, '28 dias', NULL, 4, NULL)), '{"ok": false, "erro": "dados_invalidos"}'::jsonb, 'valor negativo é recusado');
SELECT is((SELECT public.cotacao_link_responder(encode(digest((SELECT token FROM t_tokens WHERE chave = 'casa'), 'sha256'), 'hex'),
    1000, NULL, '28 dias', 120, 4, NULL)), '{"ok": false, "erro": "dados_invalidos"}'::jsonb, 'desconto acima de 100% é recusado');

-- =====================================================================
-- D. Link revogado, expirado ou de cotação encerrada: mesma resposta que token inexistente
-- =====================================================================
RESET ROLE;
SELECT pg_temp.como('66666666-0000-0000-0000-000000144001');
SELECT lives_ok($$SELECT public.rpc_revogar_convite_cotacao((SELECT convite_id FROM t_tokens WHERE chave = 'casa'))$$,
  'o escritório revoga o link');
SELECT pg_temp.como_servico();
SELECT is(public.cotacao_link_consultar(encode(digest((SELECT token FROM t_tokens WHERE chave = 'casa'), 'sha256'), 'hex')),
  '{"ok": false}'::jsonb, 'link revogado responde igual a token inexistente');
SELECT is((SELECT public.cotacao_link_responder(encode(digest((SELECT token FROM t_tokens WHERE chave = 'casa'), 'sha256'), 'hex'),
    1000, NULL, '28 dias', NULL, 4, NULL)), '{"ok": false}'::jsonb, 'link revogado não aceita resposta');

RESET ROLE;
INSERT INTO t_tokens SELECT 'exp', 'exp-token', c.id FROM (SELECT id FROM public.obra_cotacao_convite
  WHERE fornecedor_nome = 'Ferragens Norte pgtap') c;
UPDATE public.obra_cotacao_convite SET expira_em = now() - interval '1 minute' WHERE id = (SELECT convite_id FROM t_tokens WHERE chave = 'exp');
SELECT pg_temp.como_servico();
SELECT is(public.cotacao_link_consultar((SELECT token_hash FROM public.obra_cotacao_convite WHERE id = (SELECT convite_id FROM t_tokens WHERE chave = 'exp'))),
  '{"ok": false}'::jsonb, 'link expirado responde igual a token inexistente');

-- =====================================================================
-- E. Avaliar o fornecedor da proposta vencedora
-- =====================================================================
RESET ROLE;
UPDATE public.obra_cotacao
SET proposta_vencedora_id = (SELECT id FROM public.obra_cotacao_proposta WHERE cotacao_id = '88888888-0000-0000-0000-000000144001'),
    status = 'decidida'
WHERE id = '88888888-0000-0000-0000-000000144001';

SELECT pg_temp.como_servico();
SELECT is(public.cotacao_link_consultar(repeat('1', 64)), '{"ok": false}'::jsonb, 'cotação decidida: nenhum link responde');
RESET ROLE;

INSERT INTO public.obra_cotacao_proposta (id, empresa_id, cotacao_id, fornecedor_nome, valor, created_by)
VALUES ('aaaaaaaa-0000-0000-0000-000000144001', '00000000-0000-0000-0000-0000000144a1',
        '88888888-0000-0000-0000-000000144001', 'Perdedora pgtap', 25000, '66666666-0000-0000-0000-000000144001');

SELECT pg_temp.como('66666666-0000-0000-0000-000000144001');

SELECT is((SELECT public.rpc_avaliar_fornecedor(
    (SELECT proposta_vencedora_id FROM public.obra_cotacao WHERE id = '88888888-0000-0000-0000-000000144001'),
    5::smallint, 4::smallint, 3::smallint, 4::smallint, 'entregou antes do combinado')), 4.0,
  'nota geral é a média dos critérios (5, 4, 3, 4 = 4,0)');
SELECT is((SELECT public.rpc_avaliar_fornecedor(
    (SELECT proposta_vencedora_id FROM public.obra_cotacao WHERE id = '88888888-0000-0000-0000-000000144001'),
    3::smallint, NULL, NULL, NULL, NULL)), 3.0, 'critérios em branco ficam fora da média; reenviar edita a mesma avaliação');
SELECT is((SELECT count(*)::int FROM public.fornecedor_avaliacao), 1, 'uma avaliação por proposta');
SELECT throws_ok(
  $$SELECT public.rpc_avaliar_fornecedor((SELECT proposta_vencedora_id FROM public.obra_cotacao
      WHERE id = '88888888-0000-0000-0000-000000144001'), NULL, NULL, NULL, NULL, 'só comentário')$$,
  'P0001', 'Preencha ao menos um critério', 'sem nenhum critério não salva');
SELECT throws_ok(
  $$SELECT public.rpc_avaliar_fornecedor('aaaaaaaa-0000-0000-0000-000000144001', 5::smallint, NULL, NULL, NULL, NULL)$$,
  'P0001', 'Só a proposta vencedora pode ser avaliada', 'proposta que não venceu não é avaliada');
SELECT throws_ok(
  $$INSERT INTO public.fornecedor_avaliacao (empresa_id, fornecedor_id, cotacao_id, proposta_id, nota_preco)
    VALUES ('00000000-0000-0000-0000-0000000144a1', '99999999-0000-0000-0000-000000144001',
            '88888888-0000-0000-0000-000000144001', 'aaaaaaaa-0000-0000-0000-000000144001', 5)$$,
  '42501', NULL, 'o authenticated não grava avaliação direto');

SELECT pg_temp.como('66666666-0000-0000-0000-000000144002');
SELECT is((SELECT count(*)::int FROM public.fornecedor_avaliacao), 0, 'a empresa B não vê avaliações da A');
SELECT throws_ok(
  $$SELECT public.rpc_avaliar_fornecedor((SELECT proposta_vencedora_id FROM public.obra_cotacao
      WHERE id = '88888888-0000-0000-0000-000000144001'), 5::smallint, NULL, NULL, NULL, NULL)$$,
  'P0001', 'Só a proposta vencedora pode ser avaliada', 'a empresa B não avalia proposta da A');

SELECT * FROM finish();
ROLLBACK;
