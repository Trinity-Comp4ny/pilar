-- Vínculo pessoa ↔ conta de acesso (feedback de cliente, 09/11).
--
-- A pessoa da Equipe só era ligada ao login quando o e-mail das duas era idêntico
-- (maiúsculas inclusive). Quem entrou com e-mail corporativo e estava na Equipe com
-- o pessoal ficava "sem acesso" no menu de @ e nunca recebia aviso de menção.
--
-- 1. convites.pessoa_id: convite enviado a partir da Equipe carrega a pessoa; a conta
--    criada por ele é ligada a ela mesmo com e-mail diferente.
-- 2. O vínculo por e-mail ignora maiúsculas/espaços e não apaga um vínculo existente
--    quando o e-mail da pessoa muda.
-- 3. vincular_pessoa_conta(): admin liga (ou desliga) uma conta já existente.
-- 4. Menção vai por e-mail no ciclo imediato (5 min sem leitura), em qualquer
--    categoria, respeitando a preferência explícita da pessoa.

-- =============================================================================
-- 1. Convite com pessoa
-- =============================================================================
ALTER TABLE public.convites
  ADD COLUMN IF NOT EXISTS pessoa_id uuid REFERENCES public.pessoas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS convites_pessoa_id_idx ON public.convites (pessoa_id);

DROP FUNCTION IF EXISTS public.create_convite(text, text, text);

CREATE FUNCTION public.create_convite(
  p_email text,
  p_cargo text,
  p_nome text DEFAULT NULL::text,
  p_pessoa_id uuid DEFAULT NULL::uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_empresa_id UUID;
  v_cargo public.user_role;
  v_token_plain TEXT;
  v_token_hash TEXT;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem criar convites';
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  IF p_pessoa_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.pessoas
    WHERE id = p_pessoa_id AND empresa_id = v_empresa_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Pessoa não encontrada na empresa';
  END IF;

  BEGIN
    v_cargo := p_cargo::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    v_cargo := 'user';
  END;

  -- owner e ultra_admin não são concedidos via convite (escalada vertical):
  -- owner só via set_access_profile por owner/ultra_admin; ultra_admin só via SQL.
  IF v_cargo IN ('ultra_admin', 'owner') THEN
    RAISE EXCEPTION 'ultra_admin/owner não podem ser concedidos via convite';
  END IF;

  -- Invalida convites antigos não usados do mesmo e-mail.
  UPDATE public.convites
  SET usado_em = NOW()
  WHERE email = lower(trim(p_email))
    AND empresa_id = v_empresa_id
    AND usado_em IS NULL;

  v_token_plain := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token_plain, 'sha256'), 'hex');

  INSERT INTO public.convites (empresa_id, email, cargo, nome, criado_por, token, token_hash, pessoa_id)
  VALUES (v_empresa_id, lower(trim(p_email)), v_cargo, p_nome, auth.uid(), NULL, v_token_hash, p_pessoa_id);

  RETURN v_token_plain;
END;
$function$;
REVOKE ALL ON FUNCTION public.create_convite(text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_convite(text, text, text, uuid) TO authenticated;

-- =============================================================================
-- 2. Vínculo automático
-- =============================================================================
-- Pessoa nova (ou com e-mail trocado): procura a conta da mesma empresa pelo e-mail.
-- Sem conta com esse e-mail, mantém o vínculo que já existia (feito por convite ou à mão).
CREATE OR REPLACE FUNCTION public.link_pessoa_profile_before()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.email IS NOT NULL THEN
        NEW.profile_id := COALESCE(
          (
            SELECT pr.id FROM public.profiles pr
            WHERE lower(trim(pr.email)) = lower(trim(NEW.email))
              AND pr.empresa_id = NEW.empresa_id
              AND NOT EXISTS (
                SELECT 1 FROM public.pessoas x
                WHERE x.profile_id = pr.id AND x.id <> NEW.id AND x.deleted_at IS NULL
              )
            LIMIT 1
          ),
          NEW.profile_id
        );
    END IF;
    RETURN NEW;
END;
$function$;

-- Conta nova: liga à pessoa do convite que a criou e, sem ela, à pessoa ainda sem
-- conta que tem o mesmo e-mail na empresa.
CREATE OR REPLACE FUNCTION public.link_profile_pessoa_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_pessoa_id uuid;
BEGIN
    IF NEW.empresa_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Já ligada a alguém: nada a fazer.
    IF EXISTS (SELECT 1 FROM public.pessoas WHERE profile_id = NEW.id AND deleted_at IS NULL) THEN
        RETURN NULL;
    END IF;

    SELECT c.pessoa_id INTO v_pessoa_id
    FROM public.convites c
    JOIN public.pessoas pe ON pe.id = c.pessoa_id
    WHERE c.empresa_id = NEW.empresa_id
      AND c.email = lower(trim(NEW.email))
      AND c.pessoa_id IS NOT NULL
      AND pe.profile_id IS NULL
      AND pe.deleted_at IS NULL
    ORDER BY c.created_at DESC
    LIMIT 1;

    IF v_pessoa_id IS NULL THEN
        SELECT pe.id INTO v_pessoa_id
        FROM public.pessoas pe
        WHERE pe.empresa_id = NEW.empresa_id
          AND lower(trim(pe.email)) = lower(trim(NEW.email))
          AND pe.profile_id IS NULL
          AND pe.deleted_at IS NULL
        ORDER BY pe.created_at
        LIMIT 1;
    END IF;

    IF v_pessoa_id IS NOT NULL THEN
        UPDATE public.pessoas SET profile_id = NEW.id WHERE id = v_pessoa_id;
    END IF;

    RETURN NULL;
END;
$function$;

-- A conta pode ganhar a empresa depois de criada (convite para quem já tinha login):
-- o gatilho passa a olhar também a troca de empresa.
DROP TRIGGER IF EXISTS tr_link_profile_pessoa_after ON public.profiles;
CREATE TRIGGER tr_link_profile_pessoa_after
  AFTER INSERT OR UPDATE OF email, empresa_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.link_profile_pessoa_after();

-- =============================================================================
-- 3. Vínculo à mão
-- =============================================================================
-- Admin liga a pessoa a uma conta já existente da empresa (e-mails diferentes) ou
-- desliga (p_profile_id NULL). Uma conta serve a uma pessoa só.
CREATE OR REPLACE FUNCTION public.vincular_pessoa_conta(p_pessoa_id uuid, p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem vincular acesso';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pessoas
    WHERE id = p_pessoa_id AND empresa_id = v_empresa_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Pessoa não encontrada na empresa';
  END IF;

  IF p_profile_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = p_profile_id AND empresa_id = v_empresa_id AND desativado_em IS NULL
    ) THEN
      RAISE EXCEPTION 'Conta não encontrada na empresa';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.pessoas
      WHERE profile_id = p_profile_id AND id <> p_pessoa_id AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Essa conta já está ligada a outra pessoa da equipe';
    END IF;
  END IF;

  UPDATE public.pessoas
  SET profile_id = p_profile_id, updated_at = now(), updated_by = auth.uid()
  WHERE id = p_pessoa_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.vincular_pessoa_conta(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vincular_pessoa_conta(uuid, uuid) TO authenticated;

-- =============================================================================
-- 4. Menção por e-mail no ciclo imediato
-- =============================================================================
-- Menção é pedido direto a uma pessoa: vai por e-mail em ~5 min se não for lida no
-- sistema, mesmo com severidade medium e na categoria tarefa (sem e-mail por padrão).
-- Quem desligou o e-mail da categoria nas preferências continua sem receber.
CREATE OR REPLACE FUNCTION public.notificacoes_pendentes_email(p_modo text)
RETURNS TABLE (
  destinatario_id uuid,
  email           text,
  nome            text,
  empresa_id      uuid,
  notificacao_id  uuid,
  categoria       text,
  severidade      text,
  titulo          text,
  mensagem        text,
  link            text,
  created_at      timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_modo NOT IN ('imediato', 'semanal') THEN
    RAISE EXCEPTION 'modo inválido: % (use imediato ou semanal)', p_modo;
  END IF;

  RETURN QUERY
  SELECT
    n.destinatario_id,
    COALESCE(p.email, u.email)::text AS email,
    COALESCE(NULLIF(btrim(p.nome), ''), NULLIF(btrim(p.first_name), ''))::text AS nome,
    n.empresa_id,
    n.id AS notificacao_id,
    n.categoria,
    n.severidade,
    n.titulo,
    n.mensagem,
    n.link,
    n.created_at
  FROM public.notificacoes n
  JOIN public.profiles p ON p.id = n.destinatario_id
  LEFT JOIN auth.users u ON u.id = n.destinatario_id
  LEFT JOIN public.notificacao_preferencias np
         ON np.user_id = n.destinatario_id AND np.categoria = n.categoria
  WHERE n.email_enviado_em IS NULL
    AND n.lido_em IS NULL
    AND n.arquivada_em IS NULL
    AND (n.expires_at IS NULL OR n.expires_at > now())
    -- o destinatário ainda pertence à empresa da notificação
    AND p.empresa_id = n.empresa_id
    -- preferência explícita manda; sem linha, vale o padrão por categoria (menção sempre)
    AND COALESCE(np.email, public.notificacao_email_padrao(n.categoria) OR n.tipo = 'mencao_comentario')
    AND COALESCE(p.email, u.email) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.email_supressoes s
       WHERE s.email = lower(COALESCE(p.email, u.email))
    )
    AND CASE p_modo
      WHEN 'imediato' THEN
        (n.severidade IN ('high', 'critical') OR n.tipo = 'mencao_comentario')
        AND n.created_at <= now() - interval '5 minutes'
        -- SPEC 104: alerta com mais de 48h não é mais "imediato". Sem esse
        -- teto, religar o cron (ou um cron parado por dias) despeja de uma vez
        -- tudo o que acumulou na caixa das pessoas.
        AND n.created_at >= now() - interval '48 hours'
      ELSE
        n.created_at >= now() - interval '7 days'
    END
  ORDER BY n.destinatario_id, n.categoria, n.created_at DESC;
END;
$$;
