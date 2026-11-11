-- Alerta de acesso novo (SPEC 159). Cada navegador ganha um id aleatório guardado nele mesmo
-- (sem impressão digital do aparelho); ao entrar, o app registra o id. O primeiro navegador da
-- conta não gera alerta. A partir do segundo, um id que o banco nunca viu gera notificação
-- 'acesso_novo' (sino + e-mail): se não foi a pessoa, ela troca a senha e sai dos outros
-- dispositivos em Configurações → Segurança.
--
-- O e-mail desse tipo sai mesmo se a notificação já foi lida no app (quem invadiu a conta veria
-- o sino) e não depende da preferência de e-mail: por isso notificacoes_pendentes_email é
-- recriada aqui, idêntica à de 20261208000000 fora das três linhas marcadas com SPEC 159.

CREATE TABLE IF NOT EXISTS public.usuario_dispositivos (
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dispositivo_id uuid NOT NULL,
  descricao      text CHECK (descricao IS NULL OR length(descricao) <= 120),
  primeiro_em    timestamptz NOT NULL DEFAULT now(),
  ultimo_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dispositivo_id)
);

COMMENT ON TABLE public.usuario_dispositivos IS
  'Navegadores que já entraram na conta (id aleatório guardado no navegador), SPEC 159.';

ALTER TABLE public.usuario_dispositivos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.usuario_dispositivos FROM anon;
REVOKE INSERT, UPDATE ON public.usuario_dispositivos FROM authenticated;

-- A pessoa vê e esquece os próprios navegadores; registrar é só pela RPC.
DROP POLICY IF EXISTS "Dispositivos select own" ON public.usuario_dispositivos;
CREATE POLICY "Dispositivos select own" ON public.usuario_dispositivos
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Dispositivos delete own" ON public.usuario_dispositivos;
CREATE POLICY "Dispositivos delete own" ON public.usuario_dispositivos
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.registrar_dispositivo(p_dispositivo_id uuid, p_descricao text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_conhecido boolean;
  v_outros   boolean;
  v_empresa  uuid;
  v_desc     text := left(nullif(trim(coalesce(p_descricao, '')), ''), 120);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_dispositivo_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT true INTO v_conhecido FROM public.usuario_dispositivos
  WHERE user_id = v_uid AND dispositivo_id = p_dispositivo_id;

  IF v_conhecido THEN
    UPDATE public.usuario_dispositivos SET ultimo_em = now(), descricao = coalesce(v_desc, descricao)
    WHERE user_id = v_uid AND dispositivo_id = p_dispositivo_id;
    RETURN false;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.usuario_dispositivos WHERE user_id = v_uid) INTO v_outros;
  INSERT INTO public.usuario_dispositivos (user_id, dispositivo_id, descricao)
  VALUES (v_uid, p_dispositivo_id, v_desc)
  ON CONFLICT DO NOTHING;

  -- Primeiro navegador da conta: nada a avisar.
  IF NOT v_outros THEN
    RETURN false;
  END IF;

  SELECT p.empresa_id INTO v_empresa FROM public.profiles p WHERE p.id = v_uid;
  IF v_empresa IS NOT NULL THEN
    PERFORM public.notificar(
      v_empresa,
      ARRAY[v_uid],
      'acesso_novo',
      'sistema',
      'critical',
      'Novo acesso à sua conta',
      format(
        'Sua conta do Pilar foi acessada por %s em %s (horário de Brasília). Se foi você, ignore. Se não foi, troque a senha e use "Sair dos outros dispositivos" em Configurações → Segurança.',
        coalesce(v_desc, 'um navegador novo'),
        to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
      ),
      'usuario_dispositivo',
      p_dispositivo_id,
      '/seguranca'
    );
  END IF;
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.registrar_dispositivo(uuid, text) IS
  'Registra o navegador do usuário logado; navegador novo (a partir do segundo) gera alerta acesso_novo. SPEC 159.';
REVOKE ALL ON FUNCTION public.registrar_dispositivo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_dispositivo(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.notificacoes_pendentes_email(p_modo text, p_ids uuid[] DEFAULT NULL)
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
  IF p_modo NOT IN ('imediato', 'semanal', 'mencao') THEN
    RAISE EXCEPTION 'modo inválido: % (use imediato, semanal ou mencao)', p_modo;
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
    -- SPEC 159: alerta de acesso novo sai mesmo lido no app (quem invadiu poderia marcar como lida).
    AND (n.lido_em IS NULL OR n.tipo = 'acesso_novo')
    AND n.arquivada_em IS NULL
    AND (n.expires_at IS NULL OR n.expires_at > now())
    AND (p_ids IS NULL OR n.id = ANY(p_ids))
    -- o destinatário ainda pertence à empresa da notificação
    AND p.empresa_id = n.empresa_id
    -- preferência explícita manda; sem linha, menção sempre sai e o resto segue o padrão
    -- alerta de acesso novo ignora a preferência: é segurança da conta, não aviso de trabalho
    AND (n.tipo = 'acesso_novo' OR COALESCE(np.email, n.tipo = 'mencao_comentario' OR public.notificacao_email_padrao(n.categoria)))
    AND COALESCE(p.email, u.email) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.email_supressoes s
       WHERE s.email = lower(COALESCE(p.email, u.email))
    )
    AND CASE p_modo
      WHEN 'mencao' THEN
        n.tipo = 'mencao_comentario'
        AND n.created_at >= now() - interval '48 hours'
      WHEN 'imediato' THEN
        (n.severidade IN ('high', 'critical') OR n.tipo = 'mencao_comentario')
        AND (n.created_at <= now() - interval '5 minutes' OR n.tipo = 'acesso_novo')
        -- SPEC 104: alerta com mais de 48h não é mais "imediato".
        AND n.created_at >= now() - interval '48 hours'
      ELSE
        n.created_at >= now() - interval '7 days'
    END
  ORDER BY n.destinatario_id, n.categoria, n.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.notificacoes_pendentes_email(text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificacoes_pendentes_email(text, uuid[]) TO service_role;
