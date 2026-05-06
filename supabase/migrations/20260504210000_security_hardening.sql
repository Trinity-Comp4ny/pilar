-- Hardening de segurança:
--   1. Rate limit em criação de convites (anti-spam por empresa).
--   2. MAX_TTL em portal tokens (impede admin criar token de longa duração).

-- =============================================
-- 1. Rate limit RPC para convites
-- =============================================

CREATE OR REPLACE FUNCTION public.check_convite_rate_limit(p_empresa_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count_minute INTEGER;
  v_count_hour INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count_minute
  FROM public.convites
  WHERE empresa_id = p_empresa_id
    AND created_at > NOW() - INTERVAL '1 minute';

  IF v_count_minute >= 5 THEN
    RAISE EXCEPTION 'Limite de convites por minuto excedido (5/min). Aguarde antes de tentar novamente.'
      USING ERRCODE = '54000';
  END IF;

  SELECT COUNT(*) INTO v_count_hour
  FROM public.convites
  WHERE empresa_id = p_empresa_id
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_count_hour >= 50 THEN
    RAISE EXCEPTION 'Limite de convites por hora excedido (50/hora). Aguarde antes de tentar novamente.'
      USING ERRCODE = '54000';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_convite_rate_limit(UUID) TO authenticated;

-- =============================================
-- 2. MAX_TTL em create_portal_token (90 dias)
-- =============================================
-- Reescreve a função existente clampando p_dias_validade.
-- Mantém assinatura idêntica para não quebrar callers.

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
  v_dias_clamped INTEGER;
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

  IF v_projeto_empresa <> v_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Clamp: 1 dia mínimo, 90 dias máximo (compliance/segurança).
  v_dias_clamped := GREATEST(1, LEAST(90, COALESCE(p_dias_validade, 30)));

  v_token_plain := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token_plain, 'sha256'), 'hex');

  INSERT INTO public.portal_tokens (
    projeto_id, cliente_id, empresa_id, email_cliente,
    token_hash, expira_em
  ) VALUES (
    p_projeto_id, p_cliente_id, v_empresa_id, p_email_cliente,
    v_token_hash, NOW() + (v_dias_clamped || ' days')::INTERVAL
  );

  RETURN v_token_plain;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_portal_token(UUID, UUID, TEXT, INTEGER) TO authenticated;
