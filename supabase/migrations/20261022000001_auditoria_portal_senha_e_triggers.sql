-- Higiene apontada pela auditoria de segurança do banco (scripts/audit-security.mjs).
--
-- 1. portal_convite_definir_senha passa a usar senha_atende_politica(), a mesma
--    regra do Campo (20261014000001). A checagem inline antiga não tratava senha
--    NULL: toda comparação virava NULL, o IF não disparava e o convite era
--    consumido gravando senha_hash = NULL. O helper exige p_senha IS NOT NULL.
--    Assinatura e mensagens não mudam.
--
-- 2. Função de trigger SECURITY DEFINER não precisa de EXECUTE para ninguém: o
--    Postgres só checa esse privilégio no CREATE TRIGGER, nunca quando o trigger
--    dispara, e recusa chamar função que retorna trigger fora de um trigger. O
--    grant vinha do default de PUBLIC. Revogado em todas as de public; o teste
--    supabase/tests/anon_function_grants.sql trava a volta e prova que o trigger
--    continua disparando.

CREATE OR REPLACE FUNCTION public.portal_convite_definir_senha(p_token text, p_senha text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc public.cliente_portal_accounts;
  v_token_hash text;
  v_ip text;
  v_session_token text;
  v_session_hash text;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN json_build_object('ok', false, 'erro', 'Convite inválido');
  END IF;

  -- Rate limit por IP (a rota é pública). O token já tem 32 bytes de entropia;
  -- este limite é contra automação abusiva da rota, não contra adivinhar o token.
  -- Quando o cabeçalho de IP não vem (achado do rls-auditor: nesse caso a trava
  -- inteira caía), cai num bucket global mais apertado em vez de ficar sem limite
  -- nenhum — pior para quem tem IP desconhecido, nunca pior que "sem trava".
  v_ip := trim(split_part(
    COALESCE(
      current_setting('request.headers', true)::json->>'x-real-ip',
      current_setting('request.headers', true)::json->>'x-forwarded-for'
    ),
    ',', 1
  ));
  IF NOT public.check_rate_limit(
    'portal_convite_definir_senha_ip',
    COALESCE(NULLIF(v_ip, ''), 'sem_ip_conhecido'),
    CASE WHEN v_ip IS NOT NULL AND v_ip <> '' THEN 10 ELSE 30 END,
    900
  ) THEN
    RETURN json_build_object('ok', false, 'erro', 'Muitas tentativas. Aguarde 15 minutos e tente novamente.');
  END IF;

  IF NOT public.senha_atende_politica(p_senha) THEN
    RETURN json_build_object('ok', false, 'erro', 'A senha não atende à política de segurança.');
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_acc
  FROM cliente_portal_accounts
  WHERE convite_token_hash = v_token_hash
    AND convite_expira_em > now()
    AND ativo = true;

  IF v_acc.id IS NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Convite inválido ou expirado');
  END IF;

  v_session_token := encode(gen_random_bytes(32), 'hex');
  v_session_hash := encode(digest(v_session_token, 'sha256'), 'hex');

  UPDATE cliente_portal_accounts
  SET senha_hash = crypt(p_senha, gen_salt('bf')),
      must_change_password = false,
      convite_token_hash = NULL,
      convite_expira_em = NULL,
      token_sessao = v_session_hash,
      token_expira_em = now() + interval '7 days',
      ultimo_acesso = now(),
      updated_at = now()
  WHERE id = v_acc.id;

  RETURN json_build_object('ok', true, 'token', v_session_token, 'nome', v_acc.nome);
END;
$$;

REVOKE ALL ON FUNCTION public.portal_convite_definir_senha(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.portal_convite_definir_senha(text, text) TO anon, authenticated;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.fn);
  END LOOP;
END;
$$;
