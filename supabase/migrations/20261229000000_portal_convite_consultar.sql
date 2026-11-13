-- Tela de convite do Portal do Cliente: antes de o cliente criar a senha, a tela
-- mostra qual escritório o convidou e o e-mail do acesso (fixo, não editável).
-- Leitura pública pelo token (mesma postura de portal_convite_definir_senha):
-- só devolve dados se o token é válido, não expirou e a conta está ativa.
-- Não consome o convite e não expõe nada além de nome, e-mail e escritório.

CREATE OR REPLACE FUNCTION public.portal_convite_consultar(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_ip text;
  v_token_hash text;
  v_nome text;
  v_email text;
  v_empresa text;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN json_build_object('ok', false, 'erro', 'Convite inválido');
  END IF;

  v_ip := trim(split_part(
    COALESCE(
      current_setting('request.headers', true)::json->>'x-real-ip',
      current_setting('request.headers', true)::json->>'x-forwarded-for'
    ),
    ',', 1
  ));
  IF NOT public.check_rate_limit(
    'portal_convite_consultar_ip',
    COALESCE(NULLIF(v_ip, ''), 'sem_ip_conhecido'),
    CASE WHEN v_ip IS NOT NULL AND v_ip <> '' THEN 30 ELSE 60 END,
    900
  ) THEN
    RETURN json_build_object('ok', false, 'erro', 'Muitas tentativas. Aguarde 15 minutos e tente novamente.');
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT a.nome, a.email, e.nome
    INTO v_nome, v_email, v_empresa
  FROM cliente_portal_accounts a
  LEFT JOIN empresas e ON e.id = a.empresa_id
  WHERE a.convite_token_hash = v_token_hash
    AND a.convite_expira_em > now()
    AND a.ativo = true;

  IF v_email IS NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Convite inválido ou expirado');
  END IF;

  RETURN json_build_object('ok', true, 'nome', v_nome, 'email', v_email, 'empresa', v_empresa);
END;
$$;

REVOKE ALL ON FUNCTION public.portal_convite_consultar(text) FROM public;
GRANT EXECUTE ON FUNCTION public.portal_convite_consultar(text) TO anon, authenticated;
