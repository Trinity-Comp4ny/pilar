-- Conversa entre escritório e cliente no portal (BEZ-575).
--
-- Uma mensagem pertence a um projeto OU a uma obra e, opcionalmente, a uma solicitação
-- (portal_entregas): o fio da solicitação é entrega_id preenchido; o painel geral do projeto
-- ou da obra é entrega_id nulo. `interna` é nota só da equipe: o cliente nunca a recebe.
--
-- Equipe: lê e escreve direto na tabela, com RLS pela feature portal_cliente (mesma regra de
-- portal_entregas). Cliente (sem usuário Supabase): só por RPC com o token do portal, que
-- confere se o projeto/obra/solicitação é dele e nunca devolve nota interna.

BEGIN;

CREATE TABLE public.portal_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE CASCADE,
  obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE,
  entrega_id uuid REFERENCES public.portal_entregas(id) ON DELETE CASCADE,
  autor_tipo text NOT NULL CHECK (autor_tipo IN ('escritorio', 'cliente')),
  autor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  autor_nome text NOT NULL,
  texto text NOT NULL CHECK (char_length(btrim(texto)) BETWEEN 1 AND 4000),
  interna boolean NOT NULL DEFAULT false,
  lida_pelo_cliente_em timestamptz,
  lida_pela_equipe_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_mensagens_projeto_ou_obra CHECK (num_nonnulls(projeto_id, obra_id) = 1),
  -- Nota interna só existe do lado do escritório.
  CONSTRAINT portal_mensagens_interna_so_equipe CHECK (NOT interna OR autor_tipo = 'escritorio')
);

CREATE INDEX idx_portal_mensagens_projeto ON public.portal_mensagens (projeto_id, created_at);
CREATE INDEX idx_portal_mensagens_obra ON public.portal_mensagens (obra_id, created_at);
CREATE INDEX idx_portal_mensagens_entrega ON public.portal_mensagens (entrega_id, created_at);
CREATE INDEX idx_portal_mensagens_empresa ON public.portal_mensagens (empresa_id);
CREATE INDEX idx_portal_mensagens_autor_profile ON public.portal_mensagens (autor_profile_id);

ALTER TABLE public.portal_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_mensagens_equipe_le" ON public.portal_mensagens
  FOR SELECT
  USING (empresa_id = public.get_user_empresa_id() AND public.user_has_feature('portal_cliente', 'editor'));

CREATE POLICY "portal_mensagens_equipe_escreve" ON public.portal_mensagens
  FOR INSERT
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('portal_cliente', 'editor')
    AND autor_tipo = 'escritorio'
    AND autor_profile_id = (SELECT auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Escopo do cliente: devolve projeto/obra/entrega já validados para o cliente do token.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._portal_msg_escopo(
  p_cliente_id uuid, p_empresa_id uuid,
  p_projeto_id uuid, p_obra_id uuid, p_entrega_id uuid
)
RETURNS TABLE (projeto_id uuid, obra_id uuid, entrega_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto uuid := p_projeto_id;
  v_obra uuid := p_obra_id;
BEGIN
  IF p_entrega_id IS NOT NULL THEN
    SELECT e.projeto_id, e.obra_id INTO v_projeto, v_obra
    FROM portal_entregas e
    WHERE e.id = p_entrega_id AND e.empresa_id = p_empresa_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conversa não encontrada';
    END IF;
  END IF;

  IF num_nonnulls(v_projeto, v_obra) <> 1 THEN
    RAISE EXCEPTION 'Informe um projeto ou uma obra';
  END IF;

  IF v_projeto IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM projetos p
      WHERE p.id = v_projeto AND p.cliente_id = p_cliente_id AND p.empresa_id = p_empresa_id
    ) THEN
      RAISE EXCEPTION 'Conversa não encontrada';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM obras o
      WHERE o.id = v_obra AND o.cliente_id = p_cliente_id AND o.empresa_id = p_empresa_id
        AND o.modelo_cobranca = 'administracao' AND o.visivel_portal = true AND o.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Conversa não encontrada';
    END IF;
  END IF;

  RETURN QUERY SELECT v_projeto, v_obra, p_entrega_id;
END;
$$;

REVOKE ALL ON FUNCTION public._portal_msg_escopo(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs do cliente (token do portal)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.portal_listar_mensagens(
  p_token text, p_projeto_id uuid DEFAULT NULL, p_obra_id uuid DEFAULT NULL, p_entrega_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid, autor_tipo text, autor_nome text, texto text, created_at timestamptz, lida_pelo_cliente_em timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session json;
  v_cliente uuid;
  v_empresa uuid;
  v_esc record;
BEGIN
  v_session := portal_verify_session_readonly(p_token);
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  v_cliente := (v_session ->> 'cliente_id')::uuid;
  v_empresa := (v_session ->> 'empresa_id')::uuid;

  SELECT * INTO v_esc FROM _portal_msg_escopo(v_cliente, v_empresa, p_projeto_id, p_obra_id, p_entrega_id);

  RETURN QUERY
  SELECT m.id, m.autor_tipo, m.autor_nome, m.texto, m.created_at, m.lida_pelo_cliente_em
  FROM (
    SELECT * FROM portal_mensagens pm
    WHERE pm.empresa_id = v_empresa
      AND pm.interna = false
      AND pm.projeto_id IS NOT DISTINCT FROM v_esc.projeto_id
      AND pm.obra_id IS NOT DISTINCT FROM v_esc.obra_id
      AND pm.entrega_id IS NOT DISTINCT FROM v_esc.entrega_id
    ORDER BY pm.created_at DESC
    LIMIT 200
  ) m
  ORDER BY m.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_enviar_mensagem(
  p_token text, p_texto text,
  p_projeto_id uuid DEFAULT NULL, p_obra_id uuid DEFAULT NULL, p_entrega_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session json;
  v_cliente uuid;
  v_empresa uuid;
  v_nome text;
  v_esc record;
  v_id uuid;
BEGIN
  IF p_texto IS NULL OR btrim(p_texto) = '' THEN
    RAISE EXCEPTION 'Escreva uma mensagem';
  END IF;
  IF char_length(btrim(p_texto)) > 4000 THEN
    RAISE EXCEPTION 'Mensagem muito longa';
  END IF;

  v_session := portal_verify_session_readonly(p_token);
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  v_cliente := (v_session ->> 'cliente_id')::uuid;
  v_empresa := (v_session ->> 'empresa_id')::uuid;
  v_nome := COALESCE(NULLIF(btrim(v_session ->> 'nome'), ''), 'Cliente');

  SELECT * INTO v_esc FROM _portal_msg_escopo(v_cliente, v_empresa, p_projeto_id, p_obra_id, p_entrega_id);

  -- Teto contra repetição: 30 mensagens por minuto por cliente.
  IF (
    SELECT count(*) FROM portal_mensagens pm
    WHERE pm.empresa_id = v_empresa AND pm.autor_tipo = 'cliente' AND pm.autor_nome = v_nome
      AND pm.created_at > now() - interval '1 minute'
  ) >= 30 THEN
    RAISE EXCEPTION 'Muitas mensagens em sequência. Aguarde um instante.';
  END IF;

  INSERT INTO portal_mensagens (empresa_id, projeto_id, obra_id, entrega_id, autor_tipo, autor_nome, texto)
  VALUES (v_empresa, v_esc.projeto_id, v_esc.obra_id, v_esc.entrega_id, 'cliente', v_nome, btrim(p_texto))
  RETURNING portal_mensagens.id INTO v_id;

  RETURN v_id;
END;
$$;

-- Marca como lidas pelo cliente as mensagens do escritório daquela conversa.
CREATE OR REPLACE FUNCTION public.portal_marcar_mensagens_lidas(
  p_token text, p_projeto_id uuid DEFAULT NULL, p_obra_id uuid DEFAULT NULL, p_entrega_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session json;
  v_cliente uuid;
  v_empresa uuid;
  v_esc record;
BEGIN
  v_session := portal_verify_session_readonly(p_token);
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  v_cliente := (v_session ->> 'cliente_id')::uuid;
  v_empresa := (v_session ->> 'empresa_id')::uuid;

  SELECT * INTO v_esc FROM _portal_msg_escopo(v_cliente, v_empresa, p_projeto_id, p_obra_id, p_entrega_id);

  UPDATE portal_mensagens pm
  SET lida_pelo_cliente_em = now()
  WHERE pm.empresa_id = v_empresa
    AND pm.autor_tipo = 'escritorio'
    AND pm.interna = false
    AND pm.lida_pelo_cliente_em IS NULL
    AND pm.projeto_id IS NOT DISTINCT FROM v_esc.projeto_id
    AND pm.obra_id IS NOT DISTINCT FROM v_esc.obra_id
    AND pm.entrega_id IS NOT DISTINCT FROM v_esc.entrega_id;
END;
$$;

-- Não lidas do cliente, por conversa: alimenta o ponto do botão e o contador de cada solicitação.
CREATE OR REPLACE FUNCTION public.portal_contar_mensagens_nao_lidas(p_token text)
RETURNS TABLE (projeto_id uuid, obra_id uuid, entrega_id uuid, total integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session json;
  v_cliente uuid;
  v_empresa uuid;
BEGIN
  v_session := portal_verify_session_readonly(p_token);
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  v_cliente := (v_session ->> 'cliente_id')::uuid;
  v_empresa := (v_session ->> 'empresa_id')::uuid;

  RETURN QUERY
  SELECT pm.projeto_id, pm.obra_id, pm.entrega_id, count(*)::integer
  FROM portal_mensagens pm
  WHERE pm.empresa_id = v_empresa
    AND pm.autor_tipo = 'escritorio'
    AND pm.interna = false
    AND pm.lida_pelo_cliente_em IS NULL
    AND (
      EXISTS (SELECT 1 FROM projetos p WHERE p.id = pm.projeto_id AND p.cliente_id = v_cliente)
      OR EXISTS (
        SELECT 1 FROM obras o
        WHERE o.id = pm.obra_id AND o.cliente_id = v_cliente
          AND o.modelo_cobranca = 'administracao' AND o.visivel_portal = true AND o.deleted_at IS NULL
      )
    )
  GROUP BY pm.projeto_id, pm.obra_id, pm.entrega_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Equipe: marcar como lidas as mensagens do cliente (a tabela não tem UPDATE por RLS).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marcar_mensagens_portal_lidas_equipe(
  p_projeto_id uuid DEFAULT NULL, p_obra_id uuid DEFAULT NULL, p_entrega_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
BEGIN
  IF v_empresa IS NULL OR NOT public.user_has_feature('portal_cliente', 'editor') THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE portal_mensagens pm
  SET lida_pela_equipe_em = now()
  WHERE pm.empresa_id = v_empresa
    AND pm.autor_tipo = 'cliente'
    AND pm.lida_pela_equipe_em IS NULL
    AND (
      -- Fio de uma solicitação: a própria solicitação define o projeto ou a obra.
      (p_entrega_id IS NOT NULL AND pm.entrega_id = p_entrega_id)
      -- Painel geral: só as mensagens soltas do projeto ou da obra.
      OR (
        p_entrega_id IS NULL AND pm.entrega_id IS NULL
        AND pm.projeto_id IS NOT DISTINCT FROM p_projeto_id
        AND pm.obra_id IS NOT DISTINCT FROM p_obra_id
      )
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- Aviso ao escritório: mensagem do cliente cai no sino (não empilha enquanto não lida).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_notificar_mensagem_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref uuid := COALESCE(NEW.entrega_id, NEW.obra_id, NEW.projeto_id);
  v_onde text;
  v_link text;
  v_categoria text;
BEGIN
  IF NEW.autor_tipo <> 'cliente' THEN
    RETURN NEW;
  END IF;

  IF NEW.obra_id IS NOT NULL THEN
    SELECT 'Obra ' || o.nome INTO v_onde FROM obras o WHERE o.id = NEW.obra_id;
    v_link := '/obras/' || NEW.obra_id || '?tab=cliente';
    v_categoria := 'obra';
  ELSE
    SELECT 'Projeto ' || p.nome INTO v_onde FROM projetos p WHERE p.id = NEW.projeto_id;
    v_link := '/projetos/' || NEW.projeto_id || '#cliente';
    v_categoria := 'projeto';
  END IF;

  PERFORM public.notificar(
    NEW.empresa_id,
    public._notif_gestao_operacional(NEW.empresa_id),
    'portal_mensagem_cliente', v_categoria, 'high',
    NEW.autor_nome || ' escreveu no portal',
    COALESCE(v_onde, 'Portal') || ': ' || left(NEW.texto, 140),
    'portal_conversa', v_ref, v_link);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notificar_mensagem_cliente
  AFTER INSERT ON public.portal_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.tg_notificar_mensagem_cliente();

REVOKE ALL ON FUNCTION public.tg_notificar_mensagem_cliente() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.portal_listar_mensagens(text, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_listar_mensagens(text, uuid, uuid, uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.portal_enviar_mensagem(text, text, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_enviar_mensagem(text, text, uuid, uuid, uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.portal_marcar_mensagens_lidas(text, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_marcar_mensagens_lidas(text, uuid, uuid, uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.portal_contar_mensagens_nao_lidas(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_contar_mensagens_nao_lidas(text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.marcar_mensagens_portal_lidas_equipe(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_mensagens_portal_lidas_equipe(uuid, uuid, uuid) TO authenticated, service_role;

COMMIT;
