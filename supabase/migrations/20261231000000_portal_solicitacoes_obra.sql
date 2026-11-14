-- Solicitações do escritório ao cliente (portal_entregas) passam a valer também para OBRA,
-- e o cliente passa a vê-las todas juntas na tela de Pendências do portal.
--
-- 1. portal_entregas.obra_id: a solicitação é de um projeto OU de uma obra (exatamente um).
-- 2. portal_listar_solicitacoes: lista por token, do cliente inteiro ou filtrada por projeto/obra.
-- 3. Aprovar / pedir revisão aceitam solicitação de obra (obra do cliente, administração, visível).
-- 4. Notificação ao escritório quando o cliente responde a uma solicitação de obra
--    (a varredura gerar_notificacoes_ambient só enxerga solicitação de projeto).

BEGIN;

ALTER TABLE public.portal_entregas
  ALTER COLUMN projeto_id DROP NOT NULL,
  ADD COLUMN obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE;

ALTER TABLE public.portal_entregas
  ADD CONSTRAINT portal_entregas_projeto_ou_obra_check CHECK (num_nonnulls(projeto_id, obra_id) = 1);

CREATE INDEX IF NOT EXISTS idx_portal_entregas_obra ON public.portal_entregas (obra_id);

-- Lista as solicitações do cliente do token. Sem filtro: todas (projetos e obras liberados).
DROP FUNCTION IF EXISTS public.portal_listar_solicitacoes(TEXT, UUID, UUID);
CREATE FUNCTION public.portal_listar_solicitacoes(
  p_token TEXT,
  p_projeto_id UUID DEFAULT NULL,
  p_obra_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  projeto_id uuid,
  projeto_nome text,
  obra_id uuid,
  obra_nome text,
  titulo text,
  descricao text,
  tipo text,
  status text,
  drive_url text,
  projeto_disciplina_id uuid,
  disciplina_nome text,
  resposta_cliente text,
  respondido_em timestamptz,
  aprovado_ip inet,
  aprovado_user_agent text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session JSON;
  v_cliente_id UUID;
BEGIN
  v_session := portal_verify_session_readonly(p_token);
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  v_cliente_id := (v_session->>'cliente_id')::uuid;

  RETURN QUERY
  SELECT
    e.id, e.projeto_id, p.nome, e.obra_id, o.nome, e.titulo, e.descricao, e.tipo, e.status,
    e.drive_url, e.projeto_disciplina_id, pd.nome, e.resposta_cliente, e.respondido_em,
    e.aprovado_ip, e.aprovado_user_agent, e.created_at
  FROM portal_entregas e
  LEFT JOIN projetos p ON p.id = e.projeto_id
  LEFT JOIN obras o ON o.id = e.obra_id
  LEFT JOIN projeto_disciplinas pd ON pd.id = e.projeto_disciplina_id
  WHERE (
      (e.projeto_id IS NOT NULL AND p.cliente_id = v_cliente_id)
      OR (
        e.obra_id IS NOT NULL
        AND o.cliente_id = v_cliente_id
        AND o.modelo_cobranca = 'administracao'
        AND o.visivel_portal = true
        AND o.deleted_at IS NULL
      )
    )
    AND (p_projeto_id IS NULL OR e.projeto_id = p_projeto_id)
    AND (p_obra_id IS NULL OR e.obra_id = p_obra_id)
  ORDER BY e.created_at DESC;
END;
$$;

-- Responder: a solicitação precisa ser de projeto do cliente OU de obra do cliente visível no portal.
CREATE OR REPLACE FUNCTION public.portal_aprovar_entrega(p_token TEXT, p_entrega_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session JSON;
  v_cliente_id UUID;
  v_ok INTEGER;
  v_ip TEXT;
  v_ua TEXT;
BEGIN
  v_session := portal_verify_session_readonly(p_token);
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  v_cliente_id := (v_session->>'cliente_id')::uuid;

  BEGIN
    v_ip := current_setting('request.headers', true)::json->>'x-real-ip';
    v_ua := current_setting('request.headers', true)::json->>'user-agent';
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
    v_ua := NULL;
  END;

  UPDATE portal_entregas e
  SET status = 'aprovado',
      respondido_em = NOW(),
      aprovado_ip = v_ip::inet,
      aprovado_user_agent = v_ua
  WHERE e.id = p_entrega_id
    AND e.status = 'pendente'
    AND (
      EXISTS (SELECT 1 FROM projetos p WHERE p.id = e.projeto_id AND p.cliente_id = v_cliente_id)
      OR EXISTS (
        SELECT 1 FROM obras o
        WHERE o.id = e.obra_id AND o.cliente_id = v_cliente_id
          AND o.modelo_cobranca = 'administracao' AND o.visivel_portal = true AND o.deleted_at IS NULL
      )
    );

  GET DIAGNOSTICS v_ok = ROW_COUNT;
  IF v_ok = 0 THEN
    RAISE EXCEPTION 'Entregável não encontrado, já respondido, ou fora do seu acesso';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_solicitar_revisao_entrega(
  p_token TEXT, p_entrega_id UUID, p_resposta TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session JSON;
  v_cliente_id UUID;
  v_ok INTEGER;
BEGIN
  IF p_resposta IS NULL OR btrim(p_resposta) = '' THEN
    RAISE EXCEPTION 'Descreva o que precisa ser revisado';
  END IF;

  v_session := portal_verify_session_readonly(p_token);
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  v_cliente_id := (v_session->>'cliente_id')::uuid;

  UPDATE portal_entregas e
  SET status = 'revisao_solicitada',
      resposta_cliente = btrim(p_resposta),
      respondido_em = NOW()
  WHERE e.id = p_entrega_id
    AND e.status = 'pendente'
    AND (
      EXISTS (SELECT 1 FROM projetos p WHERE p.id = e.projeto_id AND p.cliente_id = v_cliente_id)
      OR EXISTS (
        SELECT 1 FROM obras o
        WHERE o.id = e.obra_id AND o.cliente_id = v_cliente_id
          AND o.modelo_cobranca = 'administracao' AND o.visivel_portal = true AND o.deleted_at IS NULL
      )
    );

  GET DIAGNOSTICS v_ok = ROW_COUNT;
  IF v_ok = 0 THEN
    RAISE EXCEPTION 'Entregável não encontrado, já respondido, ou fora do seu acesso';
  END IF;
END;
$$;

-- Aviso ao escritório quando o cliente responde uma solicitação de OBRA. Grava com o mesmo
-- tipo e referencia_id da varredura de projeto, então ela não duplica.
CREATE OR REPLACE FUNCTION public.tg_notificar_solicitacao_obra_respondida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.obra_id IS NULL OR OLD.status = NEW.status OR NEW.status = 'pendente' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'aprovado' THEN
    PERFORM public.notificar(
      NEW.empresa_id, public._notif_gestao_operacional(NEW.empresa_id),
      'portal_entrega_aprovada', 'obra', 'medium',
      'Solicitação aprovada pelo cliente: ' || NEW.titulo,
      'O cliente aprovou esta solicitação pelo portal.',
      'portal_entrega', NEW.id, '/obras/' || NEW.obra_id);
  ELSIF NEW.status = 'revisao_solicitada' THEN
    PERFORM public.notificar(
      NEW.empresa_id, public._notif_gestao_operacional(NEW.empresa_id),
      'portal_entrega_revisao_solicitada', 'obra', 'high',
      'Cliente pediu revisão: ' || NEW.titulo,
      COALESCE(NEW.resposta_cliente, 'O cliente pediu revisão desta solicitação pelo portal.'),
      'portal_entrega', NEW.id, '/obras/' || NEW.obra_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_solicitacao_obra_respondida ON public.portal_entregas;
CREATE TRIGGER trg_notificar_solicitacao_obra_respondida
  AFTER UPDATE OF status ON public.portal_entregas
  FOR EACH ROW EXECUTE FUNCTION public.tg_notificar_solicitacao_obra_respondida();

REVOKE ALL ON FUNCTION public.tg_notificar_solicitacao_obra_respondida() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.portal_listar_solicitacoes(TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_listar_solicitacoes(TEXT, UUID, UUID) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.portal_aprovar_entrega(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_aprovar_entrega(TEXT, UUID) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.portal_solicitar_revisao_entrega(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_solicitar_revisao_entrega(TEXT, UUID, TEXT) TO anon, authenticated, service_role;

COMMIT;
