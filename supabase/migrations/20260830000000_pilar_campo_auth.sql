-- Pilar Campo (spec 042): auth de campo com credencial gerada pelo gestor,
-- espelhando o portal do cliente na versão JÁ ENDURECIDA (migração
-- 20260713000000): senha em bcrypt (crypt/gen_salt), token de sessão GUARDADO
-- como sha256 e retornado em claro (o bug do portal foi comparar plaintext).
--
-- Diferença vs portal (read-only): a conta de campo vai ESCREVER (fase 2), sempre
-- escopada à sua obra. Esta migração é só a identidade: tabela + login + verificação
-- + troca de senha. As RPCs de escrita vêm na fase 2 e revalidam o token → obra_id.
--
-- Segurança: RLS só deixa o gestor da empresa gerenciar as contas. A conta de campo
-- NÃO acessa a tabela direto — entra pelas RPCs SECURITY DEFINER (concedidas a anon,
-- como portal_login), que rodam como owner e fazem a checagem.

-- 1. Tabela de contas de campo ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campo_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id           uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nome              text NOT NULL,
  email             text UNIQUE,
  senha_hash        text,
  must_change_senha boolean NOT NULL DEFAULT true,
  token_sessao      text,
  token_expira_em   timestamptz,
  ativo             boolean NOT NULL DEFAULT true,
  ultimo_acesso     timestamptz,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campo_accounts_email ON public.campo_accounts (email);
CREATE INDEX IF NOT EXISTS idx_campo_accounts_obra ON public.campo_accounts (obra_id);
CREATE INDEX IF NOT EXISTS idx_campo_accounts_empresa ON public.campo_accounts (empresa_id);
CREATE INDEX IF NOT EXISTS idx_campo_accounts_token ON public.campo_accounts (token_sessao);

CREATE TRIGGER trg_campo_accounts_updated_at
  BEFORE UPDATE ON public.campo_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

-- 2. RLS — só gestão (admin/owner/ultra_admin via has_role, + coordenador) da
--    empresa gerencia as credenciais (credencial é mais sensível que a linha da
--    obra; o enum não tem 'operacional' do portal antigo). anon/campo não tocam a
--    tabela direto (entram pelas RPCs). O UPDATE revalida obra_id para não
--    repontar a conta a uma obra de outra empresa (escrita cross-tenant na
--    fase 2, achado do rls-auditor).
ALTER TABLE public.campo_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY campo_accounts_select ON public.campo_accounts
  FOR SELECT USING (
    empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'coordenador')
  );

CREATE POLICY campo_accounts_insert ON public.campo_accounts
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'coordenador')
    AND EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()
    )
  );

CREATE POLICY campo_accounts_update ON public.campo_accounts
  FOR UPDATE USING (
    empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'coordenador')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'coordenador')
    AND EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()
    )
  );

CREATE POLICY campo_accounts_delete ON public.campo_accounts
  FOR DELETE USING (
    empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'coordenador')
  );

-- 3. Login: verifica bcrypt, emite sessão (token guardado como sha256) ---------
CREATE OR REPLACE FUNCTION public.campo_login(p_email text, p_senha text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc   public.campo_accounts;
  v_token text;
BEGIN
  SELECT * INTO v_acc
  FROM public.campo_accounts
  WHERE email = lower(trim(p_email)) AND ativo = true
  LIMIT 1;

  -- Email inexistente: roda um bcrypt dummy para o tempo de resposta não
  -- denunciar a existência do email (mitiga enumeração por timing). Mensagem
  -- genérica em ambos os casos.
  IF v_acc.id IS NULL OR v_acc.senha_hash IS NULL THEN
    PERFORM crypt(p_senha, gen_salt('bf'));
    RETURN json_build_object('ok', false, 'erro', 'Email ou senha inválidos');
  END IF;
  IF crypt(p_senha, v_acc.senha_hash) <> v_acc.senha_hash THEN
    RETURN json_build_object('ok', false, 'erro', 'Email ou senha inválidos');
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  UPDATE public.campo_accounts
  SET token_sessao    = encode(extensions.digest(v_token, 'sha256'), 'hex'),
      token_expira_em = now() + interval '30 days',
      ultimo_acesso   = now()
  WHERE id = v_acc.id;

  RETURN json_build_object(
    'ok', true,
    'token', v_token,
    'obra_id', v_acc.obra_id,
    'empresa_id', v_acc.empresa_id,
    'nome', v_acc.nome,
    'must_change_senha', v_acc.must_change_senha
  );
END;
$$;

-- 4. Verificar sessão (token entra em claro, compara sha256) -------------------
CREATE OR REPLACE FUNCTION public.campo_verify_session(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc public.campo_accounts;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN json_build_object('ok', false);
  END IF;

  SELECT * INTO v_acc
  FROM public.campo_accounts
  WHERE token_sessao = encode(extensions.digest(p_token, 'sha256'), 'hex')
    AND ativo = true
    AND token_expira_em > now()
  LIMIT 1;

  IF v_acc.id IS NULL THEN
    RETURN json_build_object('ok', false);
  END IF;

  RETURN json_build_object(
    'ok', true,
    'account_id', v_acc.id,
    'obra_id', v_acc.obra_id,
    'empresa_id', v_acc.empresa_id,
    'nome', v_acc.nome,
    'must_change_senha', v_acc.must_change_senha
  );
END;
$$;

-- 5. Trocar a senha (1º acesso ou a pedido) -----------------------------------
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
  IF p_nova_senha IS NULL OR length(p_nova_senha) < 8 THEN
    RETURN json_build_object('ok', false, 'erro', 'A senha precisa de ao menos 8 caracteres');
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

-- 6. Helper de criação chamado pela edge invite-campo (service_role) -----------
-- A edge não hasheia em Deno; delega o bcrypt para cá. Só service_role executa,
-- então um usuário autenticado não usa isto para furar o gate de papel do RLS.
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
    (empresa_id, obra_id, nome, email, senha_hash, must_change_senha, created_by)
  VALUES
    (p_empresa_id, p_obra_id, p_nome, lower(trim(p_email)),
     crypt(p_senha, gen_salt('bf')), true, p_created_by)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public._campo_create_account(uuid, uuid, text, text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public._campo_create_account(uuid, uuid, text, text, text, uuid) TO service_role;

-- 7. Concessões: anon chama as RPCs de login (público, como portal_login) ------
REVOKE ALL ON FUNCTION public.campo_login(text, text) FROM public;
REVOKE ALL ON FUNCTION public.campo_verify_session(text) FROM public;
REVOKE ALL ON FUNCTION public.campo_trocar_senha(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.campo_login(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campo_verify_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campo_trocar_senha(text, text) TO anon, authenticated;
