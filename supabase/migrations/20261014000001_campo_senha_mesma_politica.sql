-- Pilar Campo passa a usar a mesma política de senha do resto do produto.
--
-- Cadastro, redefinição de senha e portal do cliente exigem 12+ caracteres com
-- maiúscula, minúscula, número e caractere especial (src/lib/passwordPolicy.ts e
-- portal_change_password). O Campo aceitava 8 sem regra nenhuma, no front e
-- aqui. Decisão de 2026-10-08: uma regra só, em todas as telas, validada no
-- servidor.
--
-- senha_atende_politica centraliza a regra para as RPCs que gravam senha. Não
-- afeta quem já tem senha: só vale na próxima vez que ela for definida.
-- A senha provisória gerada pelo invite-campo continua curta porque o Campo
-- obriga a troca no primeiro acesso (must_change_senha), e a troca passa por aqui.
--
-- Mesmas assinaturas: CREATE OR REPLACE, sem risco de overload.

CREATE OR REPLACE FUNCTION public.senha_atende_politica(p_senha text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_senha IS NOT NULL
    AND length(p_senha) >= 12
    AND p_senha ~ '[a-z]'
    AND p_senha ~ '[A-Z]'
    AND p_senha ~ '[0-9]'
    AND p_senha ~ '[^a-zA-Z0-9]'
$$;

REVOKE ALL ON FUNCTION public.senha_atende_politica(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.campo_trocar_senha(p_token text, p_nova_senha text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc      public.campo_accounts;
  v_token    text;
BEGIN
  IF NOT public.senha_atende_politica(p_nova_senha) THEN
    RETURN json_build_object('ok', false, 'erro', 'A senha precisa de 12 caracteres, com maiúscula, minúscula, número e caractere especial');
  END IF;

  SELECT * INTO v_acc
  FROM public.campo_accounts
  WHERE token_sessao = encode(extensions.digest(p_token, 'sha256'), 'hex')
    AND ativo = true
    AND token_expira_em > now()
  LIMIT 1;

  IF v_acc.id IS NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Sessão inválida');
  END IF;

  -- Rotaciona o token no mesmo passo: trocar a senha invalida a sessão antiga
  -- (defesa se a senha provisória vazou junto de um token) e devolve um novo
  -- para o app continuar sem novo login.
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  UPDATE public.campo_accounts
  SET senha_hash        = crypt(p_nova_senha, gen_salt('bf')),
      must_change_senha = false,
      token_sessao      = encode(extensions.digest(v_token, 'sha256'), 'hex'),
      token_expira_em   = now() + interval '30 days'
  WHERE id = v_acc.id;

  RETURN json_build_object('ok', true, 'token', v_token);
END;
$$;

REVOKE ALL ON FUNCTION public.campo_trocar_senha(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.campo_trocar_senha(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.campo_convite_definir_senha(p_token text, p_senha text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc public.campo_accounts;
  v_token_hash text;
  v_ip text;
  v_session_token text;
  v_session_hash text;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN json_build_object('ok', false, 'erro', 'Convite inválido');
  END IF;

  -- Mesmo fallback de bucket global do portal quando o IP não vem (achado do
  -- rls-auditor): nunca fica sem trava nenhuma.
  v_ip := trim(split_part(
    COALESCE(
      current_setting('request.headers', true)::json->>'x-real-ip',
      current_setting('request.headers', true)::json->>'x-forwarded-for'
    ),
    ',', 1
  ));
  IF NOT public.check_rate_limit(
    'campo_convite_definir_senha_ip',
    COALESCE(NULLIF(v_ip, ''), 'sem_ip_conhecido'),
    CASE WHEN v_ip IS NOT NULL AND v_ip <> '' THEN 10 ELSE 30 END,
    900
  ) THEN
    RETURN json_build_object('ok', false, 'erro', 'Muitas tentativas. Aguarde 15 minutos e tente novamente.');
  END IF;

  IF NOT public.senha_atende_politica(p_senha) THEN
    RETURN json_build_object('ok', false, 'erro', 'A senha precisa de 12 caracteres, com maiúscula, minúscula, número e caractere especial');
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_acc
  FROM campo_accounts
  WHERE convite_token_hash = v_token_hash
    AND convite_expira_em > now()
    AND ativo = true;

  IF v_acc.id IS NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Convite inválido ou expirado');
  END IF;

  v_session_token := encode(gen_random_bytes(32), 'hex');
  v_session_hash := encode(digest(v_session_token, 'sha256'), 'hex');

  UPDATE campo_accounts
  SET senha_hash = crypt(p_senha, gen_salt('bf')),
      must_change_senha = false,
      convite_token_hash = NULL,
      convite_expira_em = NULL,
      token_sessao = v_session_hash,
      token_expira_em = now() + interval '30 days',
      ultimo_acesso = now(),
      updated_at = now()
  WHERE id = v_acc.id;

  RETURN json_build_object('ok', true, 'token', v_session_token, 'nome', v_acc.nome);
END;
$$;

REVOKE ALL ON FUNCTION public.campo_convite_definir_senha(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.campo_convite_definir_senha(text, text) TO anon, authenticated;
