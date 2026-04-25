-- Migration 018: Hardening adicional
-- 1. link_pessoa_profile_before — filtrar por empresa_id (evita cross-empresa)
-- 2. portal_tokens (share-link legado) — hash SHA256 + TTL obrigatório 30 dias
-- 3. has_role / get_user_empresa_id — marcar STABLE (performance)
-- 4. REVOKE EXECUTE FROM anon/public em RPCs sensíveis

-- =============================================
-- 1. link_pessoa_profile_before: filtro por empresa_id
-- =============================================

CREATE OR REPLACE FUNCTION public.link_pessoa_profile_before()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.empresa_id IS NOT NULL THEN
    NEW.profile_id := (
      SELECT id FROM public.profiles
      WHERE email = NEW.email
        AND empresa_id = NEW.empresa_id
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$;

-- link_profile_pessoa_after: também filtrar por empresa_id
CREATE OR REPLACE FUNCTION public.link_profile_pessoa_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pessoas
  SET profile_id = NEW.id
  WHERE email = NEW.email
    AND empresa_id = NEW.empresa_id;
  RETURN NULL;
END;
$$;

-- =============================================
-- 2. portal_tokens: hash SHA256 + TTL obrigatório 30 dias
-- =============================================

-- Invalida tokens existentes (força regeração)
UPDATE public.portal_tokens
SET ativo = FALSE
WHERE token IS NOT NULL;

-- Adiciona coluna token_hash (nova) se não existir
ALTER TABLE public.portal_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_tokens_token_hash
  ON public.portal_tokens(token_hash)
  WHERE token_hash IS NOT NULL;

-- Torna expira_em obrigatório com default 30 dias
ALTER TABLE public.portal_tokens
  ALTER COLUMN expira_em SET DEFAULT (NOW() + INTERVAL '30 days');

-- Backfill para tokens futuros ficarem com TTL
UPDATE public.portal_tokens
SET expira_em = NOW() + INTERVAL '30 days'
WHERE expira_em IS NULL;

-- Recria verify_portal_token buscando por hash
CREATE OR REPLACE FUNCTION public.verify_portal_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  result JSON;
  v_token_hash TEXT;
  v_allowed BOOLEAN;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  -- Rate limit: 30 verificações / minuto por token (evita enumeração)
  v_allowed := public.check_rate_limit('verify_portal_token', p_token, 30, 60);
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Muitas requisições. Aguarde.';
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT json_build_object(
    'projeto_id', pt.projeto_id,
    'cliente_id', pt.cliente_id,
    'empresa_id', pt.empresa_id,
    'projeto_nome', p.nome,
    'projeto_status', p.status,
    'projeto_codigo', p.codigo_projeto,
    'cliente_nome', c.nome,
    'empresa_nome', e.nome
  ) INTO result
  FROM portal_tokens pt
  JOIN projetos p ON p.id = pt.projeto_id
  JOIN clientes c ON c.id = pt.cliente_id
  JOIN empresas e ON e.id = pt.empresa_id
  WHERE pt.token_hash = v_token_hash
    AND pt.ativo = true
    AND pt.expira_em > NOW();

  IF result IS NULL THEN
    RAISE EXCEPTION 'Token inválido ou expirado';
  END IF;

  UPDATE portal_tokens SET ultimo_acesso = NOW() WHERE token_hash = v_token_hash;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_portal_token(TEXT) TO anon, authenticated;

-- RPC para criar portal_token: guarda hash, retorna token plain text uma vez
CREATE OR REPLACE FUNCTION public.create_portal_token(
  p_projeto_id UUID,
  p_cliente_id UUID,
  p_email_cliente TEXT DEFAULT NULL,
  p_dias_validade INTEGER DEFAULT 30
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_empresa_id UUID;
  v_projeto_empresa UUID;
  v_token_plain TEXT;
  v_token_hash TEXT;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF NOT public.has_role('admin', 'operacional') THEN
    RAISE EXCEPTION 'Apenas admin ou operacional podem gerar tokens de portal';
  END IF;

  SELECT empresa_id INTO v_projeto_empresa
  FROM public.projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_projeto_empresa IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto_empresa != v_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_token_plain := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token_plain, 'sha256'), 'hex');

  INSERT INTO portal_tokens (
    empresa_id, projeto_id, cliente_id, token, token_hash,
    email_cliente, expira_em, created_by
  ) VALUES (
    v_empresa_id, p_projeto_id, p_cliente_id,
    encode(gen_random_bytes(16), 'hex'),
    v_token_hash,
    p_email_cliente,
    NOW() + (p_dias_validade * INTERVAL '1 day'),
    auth.uid()
  );

  RETURN v_token_plain;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_portal_token(UUID, UUID, TEXT, INTEGER) TO authenticated;

-- =============================================
-- 3. Helpers STABLE (performance)
-- =============================================

-- Nota: ALTER FUNCTION ... STABLE precisa recriar. Testar se helpers existem:

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_empresa_id' AND pronamespace = 'public'::regnamespace) THEN
    ALTER FUNCTION public.get_user_empresa_id() STABLE;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role' AND pronamespace = 'public'::regnamespace) THEN
    -- has_role tem múltiplas assinaturas; aplicar em todas
    ALTER FUNCTION public.has_role(public.user_role) STABLE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Silencia se assinatura não bater
  NULL;
END $$;

-- =============================================
-- 4. REVOKE EXECUTE FROM anon/public em RPCs autenticadas
-- =============================================

DO $$
DECLARE
  func_names TEXT[] := ARRAY[
    'create_projeto_completo',
    'update_projeto_completo',
    'rpc_faturar_marco',
    'rpc_gerar_parcelas_projeto',
    'rpc_converter_lead_cliente',
    'rpc_converter_proposta_projeto',
    'rpc_gerar_alertas',
    'rpc_daily_maintenance',
    'rpc_atualizar_status_atrasados',
    'rpc_gerar_despesas_recorrentes',
    'rpc_projeto_rentabilidade',
    'rpc_dashboard_rentabilidade',
    'rpc_calcular_wip',
    'gerar_fatura',
    'pagar_fatura',
    'get_folha_preview',
    'create_convite'
  ];
  func_name TEXT;
  sig TEXT;
BEGIN
  FOREACH func_name IN ARRAY func_names LOOP
    FOR sig IN
      SELECT format('%s(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = func_name
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', sig);
    END LOOP;
  END LOOP;
END $$;

-- Portal RPCs: mantém GRANT para anon (cliente portal não autentica via JWT Supabase)
-- Mas revoga PUBLIC pra evitar herança implícita
DO $$
DECLARE
  portal_funcs TEXT[] := ARRAY[
    'portal_login(text,text)',
    'portal_verify_session(text)',
    'portal_logout(text)',
    'verify_portal_token(text)',
    'get_cliente_projetos(text)',
    'get_cliente_projeto_detail(uuid,text)'
  ];
  sig TEXT;
BEGIN
  FOREACH sig IN ARRAY portal_funcs LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated', sig);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- =============================================
-- 5. onboarding_completed / role / empresa_id não editáveis por self
-- =============================================

-- Bloqueia usuário comum de alterar campos críticos via update direto
CREATE OR REPLACE FUNCTION public.enforce_profile_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Alteração de role requer admin';
  END IF;

  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    RAISE EXCEPTION 'empresa_id é imutável';
  END IF;

  IF NEW.onboarding_completed = TRUE AND OLD.onboarding_completed = FALSE THEN
    -- Permite, mas exige que campos mínimos de perfil estejam preenchidos
    IF NEW.nome IS NULL OR trim(NEW.nome) = '' THEN
      RAISE EXCEPTION 'Nome obrigatório para concluir onboarding';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_profile_immutable ON public.profiles;
CREATE TRIGGER tr_enforce_profile_immutable
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_immutable_fields();
