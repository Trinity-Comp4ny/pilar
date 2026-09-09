-- Spec 099: convite por link (o próprio dono da conta define a senha) em vez de
-- "gestor gera senha e entrega", para o Portal do Cliente e para o Pilar Campo
-- (quando há e-mail real; sem e-mail o Campo mantém o fallback de senha manual).
--
-- Também fecha duas lacunas de gestão de acesso:
--   - campo_listar_contas_obra / campo_revogar_acesso: hoje só existe "criar"
--     acesso de campo, nunca dava para ver quem tem acesso a uma obra nem tirar.
--   - campo_accounts.login_gerado: distingue conta cujo "e-mail" é login inventado
--     internamente (pedreiro sem e-mail real) de e-mail de contato de verdade —
--     necessário porque o campo email da tabela já servia de LOGIN mesmo sem ser
--     endereçável, e a spec precisa saber qual dos dois casos está na frente para
--     decidir convite-por-link vs. senha manual.

-- Assinaturas de uma iteração anterior desta mesma migration (token gerado no
-- banco). Trocadas por versões que recebem o hash pronto da edge — ver nota
-- acima de _portal_create_account_convite. DROP explícito porque o retorno
-- muda de text para void (CREATE OR REPLACE não troca o tipo de retorno).
DROP FUNCTION IF EXISTS public._portal_create_account_convite(uuid, uuid, text, text, uuid);
DROP FUNCTION IF EXISTS public._portal_reset_password_convite(uuid);
DROP FUNCTION IF EXISTS public._campo_create_account_convite(uuid, uuid, text, text, uuid);

-- ==============================================================================
-- 1. Colunas novas
-- ==============================================================================
ALTER TABLE public.cliente_portal_accounts
  ADD COLUMN IF NOT EXISTS convite_token_hash text,
  ADD COLUMN IF NOT EXISTS convite_expira_em timestamptz;

ALTER TABLE public.campo_accounts
  ADD COLUMN IF NOT EXISTS convite_token_hash text,
  ADD COLUMN IF NOT EXISTS convite_expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS login_gerado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.campo_accounts.login_gerado IS
  'true = o valor em "email" foi inventado internamente (pedreiro sem e-mail real, ex: joao-silva-a1b2@campo.local), serve só de login, nunca recebe e-mail. false = e-mail real de contato, usado para o convite por link.';

-- ==============================================================================
-- 2. Portal do Cliente: criação e reset por convite
-- ==============================================================================

-- Cria a conta SEM senha (fica pendente até o cliente completar o convite). O
-- HASH do token vem PRONTO da edge (gerado em Deno, ver _shared/convite-token.ts)
-- para preservar a mesma ordem de segurança que o fluxo legado já tinha: a edge
-- manda o e-mail com o token ANTES de chamar este RPC, então uma falha de envio
-- não deixa a conta num estado que ninguém consegue completar.
-- Assinatura própria (não overload de _portal_create_account) para não confundir
-- as duas formas de criação — ver feedback_supabase_function_overload da memória.
CREATE OR REPLACE FUNCTION public._portal_create_account_convite(
  p_cliente_id uuid,
  p_empresa_id uuid,
  p_nome text,
  p_email text,
  p_token_hash text,
  p_created_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO cliente_portal_accounts
    (cliente_id, empresa_id, nome, email, senha_hash, must_change_password,
     convite_token_hash, convite_expira_em, created_by)
  VALUES
    (p_cliente_id, p_empresa_id, p_nome, p_email, NULL, false,
     p_token_hash, now() + interval '72 hours', p_created_by);
END;
$$;

REVOKE ALL ON FUNCTION public._portal_create_account_convite(uuid, uuid, text, text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public._portal_create_account_convite(uuid, uuid, text, text, text, uuid) TO service_role;

-- Reset (self-service): invalida a senha e a sessão atuais na hora (mesma postura
-- do _portal_reset_password legado, que já trocava a senha de imediato) e emite
-- um novo convite. Reaproveitada também pela reativação de conta revogada.
CREATE OR REPLACE FUNCTION public._portal_reset_password_convite(p_account_id uuid, p_token_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE cliente_portal_accounts
  SET senha_hash = NULL,
      must_change_password = false,
      convite_token_hash = p_token_hash,
      convite_expira_em = now() + interval '72 hours',
      token_sessao = NULL,
      token_expira_em = NULL,
      updated_at = now()
  WHERE id = p_account_id;
END;
$$;

REVOKE ALL ON FUNCTION public._portal_reset_password_convite(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public._portal_reset_password_convite(uuid, text) TO service_role;

-- Cliente completa o convite: valida o token, aplica a política de senha (mesma
-- de portal_change_password), consome o convite e já devolve sessão pronta (não
-- exige login extra logo depois de definir a senha).
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

  IF length(p_senha) < 12
     OR p_senha !~ '[a-z]'
     OR p_senha !~ '[A-Z]'
     OR p_senha !~ '[0-9]'
     OR p_senha !~ '[^a-zA-Z0-9]' THEN
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

-- ==============================================================================
-- 3. Pilar Campo: criação/reativação por convite (só quando há e-mail real)
-- ==============================================================================

-- INSERT ... ON CONFLICT (email) cobre criar E reativar (requisito 12: reemitir
-- não duplica linha) num único caminho. O guard de empresa ANTES do INSERT evita
-- que uma empresa B "tome" a conta de e-mail já usado por uma empresa A — o
-- índice único de email é global, então sem esse guard o ON CONFLICT reatribuiria
-- a linha de outra empresa (achado do fork de investigação: hoje o invite-campo
-- já bloqueia esse cruzamento com um erro 409; aqui a checagem entra no banco).
CREATE OR REPLACE FUNCTION public._campo_create_account_convite(
  p_obra_id uuid,
  p_empresa_id uuid,
  p_nome text,
  p_email text,
  p_token_hash text,
  p_created_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_email text := lower(trim(p_email));
BEGIN
  -- Lock consultivo por e-mail (liberado sozinho no fim da transação): sem ele,
  -- duas chamadas concorrentes para o mesmo e-mail (empresas diferentes convidando
  -- a mesma pessoa quase ao mesmo tempo) passam as duas pelo EXISTS antes de
  -- qualquer INSERT confirmar, e o ON CONFLICT DO UPDATE de uma sobrescreve campos
  -- da outra sem nunca lançar erro — achado do rls-auditor, reproduzido com duas
  -- sessões reais (empresa_id de uma ficava misturado com obra_id/token da outra).
  PERFORM pg_advisory_xact_lock(hashtext('campo_accounts_email:' || v_email));

  IF EXISTS (
    SELECT 1 FROM campo_accounts
    WHERE email = v_email AND empresa_id <> p_empresa_id
  ) THEN
    RAISE EXCEPTION 'Já existe um acesso de campo com esse e-mail em outra empresa';
  END IF;

  INSERT INTO campo_accounts
    (empresa_id, obra_id, nome, email, senha_hash, must_change_senha, login_gerado,
     convite_token_hash, convite_expira_em, ativo, created_by)
  VALUES
    (p_empresa_id, p_obra_id, p_nome, v_email, NULL, false, false,
     p_token_hash, now() + interval '72 hours', true, p_created_by)
  ON CONFLICT (email) DO UPDATE SET
    obra_id = EXCLUDED.obra_id,
    nome = EXCLUDED.nome,
    senha_hash = NULL,
    must_change_senha = false,
    login_gerado = false,
    convite_token_hash = EXCLUDED.convite_token_hash,
    convite_expira_em = EXCLUDED.convite_expira_em,
    token_sessao = NULL,
    token_expira_em = NULL,
    ativo = true,
    created_by = EXCLUDED.created_by,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public._campo_create_account_convite(uuid, uuid, text, text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public._campo_create_account_convite(uuid, uuid, text, text, text, uuid) TO service_role;

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

  IF p_senha IS NULL OR length(p_senha) < 8 THEN
    RETURN json_build_object('ok', false, 'erro', 'A senha precisa de ao menos 8 caracteres');
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

-- ==============================================================================
-- 3.1 _campo_create_account (fallback sem e-mail real, migration 20260830000000):
-- passa a marcar login_gerado = true. É o único chamador (invite-campo), e depois
-- desta spec só é usado quando o gestor NÃO informa e-mail real (o "e-mail" vira
-- um login inventado pela edge, ex: joao-silva-a1b2@campo.local).
-- ==============================================================================
CREATE OR REPLACE FUNCTION public._campo_create_account(
  p_obra_id uuid, p_empresa_id uuid, p_nome text, p_email text, p_senha text, p_created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.campo_accounts
    (empresa_id, obra_id, nome, email, senha_hash, must_change_senha, login_gerado, created_by)
  VALUES
    (p_empresa_id, p_obra_id, p_nome, lower(trim(p_email)),
     crypt(p_senha, gen_salt('bf')), true, true, p_created_by)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public._campo_create_account(uuid, uuid, text, text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public._campo_create_account(uuid, uuid, text, text, text, uuid) TO service_role;

-- ==============================================================================
-- 4. Pilar Campo: gestão de acesso por obra (listar / revogar)
-- ==============================================================================
-- Mesmas roles de gestão que já criam acesso hoje (admin/ultra_admin/owner/
-- coordenador via has_role — o enum de campo_accounts não distingue owner de
-- admin no RLS existente, has_role('admin','coordenador') já cobre owner porque
-- owner é tratado como admin nesse helper em todo o resto do projeto).
CREATE OR REPLACE FUNCTION public.campo_listar_contas_obra(p_obra_id uuid)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.has_role('admin', 'coordenador') THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM obras o
    WHERE o.id = p_obra_id AND o.empresa_id = public.get_user_empresa_id()
  ) THEN
    RAISE EXCEPTION 'Obra não encontrada';
  END IF;

  RETURN QUERY
  SELECT json_build_object(
    'id', ca.id,
    'nome', ca.nome,
    'email', ca.email,
    'login_gerado', ca.login_gerado,
    'ativo', ca.ativo,
    'ultimo_acesso', ca.ultimo_acesso,
    'convite_pendente', ca.convite_token_hash IS NOT NULL AND ca.convite_expira_em > now()
  )
  FROM campo_accounts ca
  WHERE ca.obra_id = p_obra_id
    AND ca.empresa_id = public.get_user_empresa_id()
  ORDER BY ca.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.campo_listar_contas_obra(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.campo_listar_contas_obra(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.campo_revogar_acesso(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.has_role('admin', 'coordenador') THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE campo_accounts
  SET ativo = false,
      updated_at = now()
  WHERE id = p_account_id
    AND empresa_id = public.get_user_empresa_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acesso não encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.campo_revogar_acesso(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.campo_revogar_acesso(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
