-- Migration 015: Portal — hash SHA256 do token, TTL 7 dias, rotação a cada verify
-- Antes: token_sessao era armazenado em plain text, TTL 30 dias, sem rotação.
-- Agora: hash SHA256, TTL 7 dias, novo token a cada portal_verify_session.
-- Impacto: invalida sessões ativas (força relogin) — aceitável.

-- =============================================
-- 0. Extensão pgcrypto (para digest)
-- =============================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- =============================================
-- 1. Invalida todas sessões ativas (força relogin pós-deploy)
-- =============================================
UPDATE public.cliente_portal_accounts
SET token_sessao = NULL, token_expira_em = NULL;

-- =============================================
-- 2. portal_login: guarda hash, retorna token plain text (única vez)
-- =============================================

CREATE OR REPLACE FUNCTION public.portal_login(p_email TEXT, p_senha TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_account RECORD;
  v_token_plain TEXT;
  v_token_hash TEXT;
BEGIN
  SELECT id, cliente_id, empresa_id, nome, email, senha_hash, ativo
  INTO v_account
  FROM cliente_portal_accounts
  WHERE email = lower(trim(p_email));

  IF v_account IS NULL THEN
    RAISE EXCEPTION 'Email ou senha inválidos';
  END IF;

  IF NOT v_account.ativo THEN
    RAISE EXCEPTION 'Acesso desativado';
  END IF;

  IF v_account.senha_hash IS NULL OR crypt(p_senha, v_account.senha_hash) != v_account.senha_hash THEN
    RAISE EXCEPTION 'Email ou senha inválidos';
  END IF;

  v_token_plain := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token_plain, 'sha256'), 'hex');

  UPDATE cliente_portal_accounts
  SET token_sessao = v_token_hash,
      token_expira_em = NOW() + INTERVAL '7 days',
      ultimo_acesso = NOW()
  WHERE id = v_account.id;

  RETURN json_build_object(
    'token', v_token_plain,
    'id', v_account.id,
    'cliente_id', v_account.cliente_id,
    'empresa_id', v_account.empresa_id,
    'nome', v_account.nome,
    'email', v_account.email
  );
END;
$$;

-- =============================================
-- 3. portal_verify_session: busca por hash, rotaciona token a cada chamada
-- =============================================

CREATE OR REPLACE FUNCTION public.portal_verify_session(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_account RECORD;
  v_token_hash TEXT;
  v_new_token_plain TEXT;
  v_new_token_hash TEXT;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN NULL;
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT id, cliente_id, empresa_id, nome, email
  INTO v_account
  FROM cliente_portal_accounts
  WHERE token_sessao = v_token_hash
    AND token_expira_em > NOW()
    AND ativo = true;

  IF v_account IS NULL THEN
    RETURN NULL;
  END IF;

  -- Rotação: gera novo token a cada verify bem-sucedido
  v_new_token_plain := encode(gen_random_bytes(32), 'hex');
  v_new_token_hash := encode(digest(v_new_token_plain, 'sha256'), 'hex');

  UPDATE cliente_portal_accounts
  SET token_sessao = v_new_token_hash,
      token_expira_em = NOW() + INTERVAL '7 days',
      ultimo_acesso = NOW()
  WHERE id = v_account.id;

  RETURN json_build_object(
    'id', v_account.id,
    'cliente_id', v_account.cliente_id,
    'empresa_id', v_account.empresa_id,
    'nome', v_account.nome,
    'email', v_account.email,
    'new_token', v_new_token_plain
  );
END;
$$;

-- =============================================
-- 4. get_cliente_projetos: aceita token, valida via hash (sem rotação aqui)
-- =============================================

CREATE OR REPLACE FUNCTION public.get_cliente_projetos(p_token TEXT DEFAULT NULL)
RETURNS SETOF JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cliente_id UUID;
  v_empresa_id UUID;
  v_token_hash TEXT;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT cpa.cliente_id, cpa.empresa_id
  INTO v_cliente_id, v_empresa_id
  FROM cliente_portal_accounts cpa
  WHERE cpa.token_sessao = v_token_hash
    AND cpa.token_expira_em > NOW()
    AND cpa.ativo = true;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  RETURN QUERY
  SELECT json_build_object(
    'projeto_id', p.id,
    'projeto_nome', p.nome,
    'projeto_codigo', p.codigo_projeto,
    'projeto_status', p.status,
    'data_inicio', p.data_inicio,
    'data_previsao', p.data_previsao,
    'valor_contrato', p.valor_contrato,
    'disciplinas', p.disciplinas,
    'empresa_nome', e.nome
  )
  FROM projetos p
  JOIN empresas e ON e.id = p.empresa_id
  WHERE p.cliente_id = v_cliente_id
    AND p.empresa_id = v_empresa_id
    AND p.deleted_at IS NULL
  ORDER BY
    CASE p.status
      WHEN 'Em andamento' THEN 1
      WHEN 'Revisão' THEN 2
      WHEN 'Planejamento' THEN 3
      WHEN 'Paralisado' THEN 4
      WHEN 'Concluído' THEN 5
      WHEN 'Cancelado' THEN 6
    END,
    p.created_at DESC;
END;
$$;

-- =============================================
-- 5. get_cliente_projeto_detail: mesma lógica
-- =============================================

CREATE OR REPLACE FUNCTION public.get_cliente_projeto_detail(p_projeto_id UUID, p_token TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cliente_id UUID;
  v_empresa_id UUID;
  v_token_hash TEXT;
  result JSON;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT cpa.cliente_id, cpa.empresa_id
  INTO v_cliente_id, v_empresa_id
  FROM cliente_portal_accounts cpa
  WHERE cpa.token_sessao = v_token_hash
    AND cpa.token_expira_em > NOW()
    AND cpa.ativo = true;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  SELECT json_build_object(
    'projeto_id', p.id,
    'cliente_id', p.cliente_id,
    'empresa_id', p.empresa_id,
    'projeto_nome', p.nome,
    'projeto_status', p.status,
    'projeto_codigo', p.codigo_projeto,
    'data_inicio', p.data_inicio,
    'data_previsao', p.data_previsao,
    'data_final', p.data_final,
    'valor_contrato', p.valor_contrato,
    'disciplinas', p.disciplinas,
    'cliente_nome', c.nome,
    'empresa_nome', e.nome
  ) INTO result
  FROM projetos p
  JOIN clientes c ON c.id = p.cliente_id
  JOIN empresas e ON e.id = p.empresa_id
  WHERE p.id = p_projeto_id
    AND p.cliente_id = v_cliente_id
    AND p.empresa_id = v_empresa_id
    AND p.deleted_at IS NULL;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  RETURN result;
END;
$$;

-- =============================================
-- 6. portal_logout: revoga sessão
-- =============================================

CREATE OR REPLACE FUNCTION public.portal_logout(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token_hash TEXT;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN;
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  UPDATE cliente_portal_accounts
  SET token_sessao = NULL,
      token_expira_em = NULL
  WHERE token_sessao = v_token_hash;
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_logout(TEXT) TO anon, authenticated;
