-- Registro estruturado e interno. Links de anexos são referências, não uploads.
CREATE FUNCTION public.rpc_registrar_atividade_projeto(
  p_projeto uuid, p_tipo text, p_ocorrido timestamptz, p_resumo text, p_resultado text,
  p_responsavel uuid DEFAULT NULL, p_disciplina uuid DEFAULT NULL, p_fornecedor uuid DEFAULT NULL,
  p_local_canal text DEFAULT NULL, p_proximo_passo text DEFAULT NULL, p_anexo text DEFAULT NULL,
  p_duracao integer DEFAULT NULL, p_avaliar_cobranca boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
  v_id uuid;
  v_responsavel text;
  v_fornecedor text;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL OR NOT public.user_has_feature('projetos','editor') THEN
    RAISE EXCEPTION 'Sem acesso para registrar atividades' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projetos WHERE id = p_projeto AND empresa_id = v_empresa AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Projeto inválido';
  END IF;
  IF p_tipo IS NULL OR p_tipo NOT IN ('visita','suporte') OR p_ocorrido IS NULL
      OR nullif(btrim(p_resumo), '') IS NULL OR length(p_resumo) > 250
      OR nullif(btrim(p_resultado), '') IS NULL OR length(p_resultado) > 4000
      OR length(coalesce(p_local_canal, '')) > 250 OR length(coalesce(p_proximo_passo, '')) > 4000
      OR (p_duracao IS NOT NULL AND p_duracao NOT BETWEEN 1 AND 1440)
      OR (p_anexo IS NOT NULL AND (length(p_anexo) > 2000 OR p_anexo !~ '^https://[^[:space:]]+$')) THEN
    RAISE EXCEPTION 'Confira os dados da atividade';
  END IF;
  IF p_disciplina IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.projeto_disciplinas WHERE id = p_disciplina AND projeto_id = p_projeto
  ) THEN RAISE EXCEPTION 'Disciplina inválida'; END IF;
  IF p_responsavel IS NOT NULL THEN
    SELECT nome INTO v_responsavel FROM public.pessoas WHERE id = p_responsavel AND empresa_id = v_empresa AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Responsável inválido'; END IF;
  END IF;
  IF p_fornecedor IS NOT NULL THEN
    SELECT nome INTO v_fornecedor FROM public.fornecedores WHERE id = p_fornecedor AND empresa_id = v_empresa AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Fornecedor inválido'; END IF;
  END IF;
  INSERT INTO public.projeto_registros (empresa_id, projeto_id, disciplina_id, tipo, ocorrido_em, autor_nome, detalhe, dados)
  VALUES (v_empresa, p_projeto, p_disciplina, p_tipo, p_ocorrido, public.projeto_nome_ator(auth.uid()), btrim(p_resumo),
    jsonb_strip_nulls(jsonb_build_object('ator_id', auth.uid(), 'resultado', btrim(p_resultado),
      'responsavel', v_responsavel, 'fornecedor', v_fornecedor, 'local_canal', nullif(btrim(p_local_canal), ''),
      'proximo_passo', nullif(btrim(p_proximo_passo), ''), 'anexo', p_anexo, 'duracao', p_duracao,
      'avaliar_cobranca', coalesce(p_avaliar_cobranca, false))))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_registrar_atividade_projeto(uuid,text,timestamptz,text,text,uuid,uuid,uuid,text,text,text,integer,boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_atividade_projeto(uuid,text,timestamptz,text,text,uuid,uuid,uuid,text,text,text,integer,boolean)
  TO authenticated;

ALTER TABLE public.portal_entregas ADD COLUMN respondido_cliente_id uuid;

CREATE FUNCTION public.tg_proteger_ator_portal()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NEW.respondido_cliente_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' OR NEW.respondido_cliente_id IS DISTINCT FROM OLD.respondido_cliente_id THEN
      RAISE EXCEPTION 'A autoria é registrada pelo portal' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_proteger_ator_portal() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER proteger_ator_portal BEFORE INSERT OR UPDATE OF respondido_cliente_id ON public.portal_entregas
  FOR EACH ROW EXECUTE FUNCTION public.tg_proteger_ator_portal();
CREATE FUNCTION public.tg_projeto_entrega_registro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tipo text;
  v_cliente_nome text;
BEGIN
  IF NEW.projeto_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    v_tipo := 'portal_entrega_publicada';
  ELSIF OLD.status = 'pendente' AND NEW.status IN ('aprovado','revisao_solicitada') AND NEW.respondido_em IS NOT NULL THEN
    v_tipo := CASE NEW.status WHEN 'aprovado' THEN 'portal_entrega_aprovada' ELSE 'portal_entrega_revisao_solicitada' END;
    SELECT c.nome INTO v_cliente_nome FROM public.clientes c
      WHERE c.id = NEW.respondido_cliente_id AND c.empresa_id = NEW.empresa_id;
  ELSE
    RETURN NEW;
  END IF;
  INSERT INTO public.projeto_registros
    (empresa_id, projeto_id, disciplina_id, tipo, origem_id, ocorrido_em, autor_nome, detalhe, dados)
  VALUES (NEW.empresa_id, NEW.projeto_id, NEW.projeto_disciplina_id, v_tipo, NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN coalesce(NEW.created_at, now()) ELSE NEW.respondido_em END,
    CASE WHEN TG_OP = 'INSERT' THEN public.projeto_nome_ator(coalesce(auth.uid(), NEW.created_by)) ELSE v_cliente_nome END,
    NEW.titulo, jsonb_strip_nulls(jsonb_build_object(
      'versao', NEW.numero_revisao, 'entrega_id', NEW.id, 'versao_anterior', NEW.revisao_anterior_id,
      'descricao', NEW.descricao, 'drive_url', NEW.drive_url, 'resposta', NEW.resposta_cliente,
      'cliente_id', NEW.respondido_cliente_id
    )));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_projeto_entrega_registro() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER projeto_entrega_registro AFTER INSERT OR UPDATE OF status ON public.portal_entregas
  FOR EACH ROW EXECUTE FUNCTION public.tg_projeto_entrega_registro();

CREATE VIEW public.v_projeto_historico WITH (security_invoker = true) AS
SELECT r.id::text AS chave, r.projeto_id, r.disciplina_id, d.nome AS disciplina_nome, r.tipo,
  r.ocorrido_em, r.detalhe, r.autor_nome, r.origem_id, r.dados
FROM public.projeto_registros r
LEFT JOIN public.projeto_disciplinas d ON d.id = r.disciplina_id
UNION ALL
SELECT DISTINCT 'legado-' || md5(row_to_json(t)::text), t.projeto_id, t.disciplina_id, t.disciplina_nome,
  t.tipo, t.ocorrido_em, t.detalhe,
  CASE WHEN t.tipo IN ('portal_entrega_aprovada', 'portal_entrega_revisao_solicitada')
    THEN NULL ELSE t.autor_nome END,
  NULL::uuid, '{}'::jsonb
FROM public.v_projeto_timeline t
WHERE NOT EXISTS (
  SELECT 1 FROM public.projeto_registros r
  WHERE t.tipo IN ('portal_entrega_aprovada', 'portal_entrega_revisao_solicitada')
    AND r.projeto_id = t.projeto_id AND r.tipo = t.tipo AND r.ocorrido_em = t.ocorrido_em
    AND r.disciplina_id IS NOT DISTINCT FROM t.disciplina_id
    AND CASE WHEN t.tipo = 'portal_entrega_aprovada' THEN r.detalhe ELSE r.dados->>'resposta' END
      IS NOT DISTINCT FROM t.detalhe
);
REVOKE ALL ON public.v_projeto_historico FROM PUBLIC, anon;
GRANT SELECT ON public.v_projeto_historico TO authenticated;

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
      respondido_cliente_id = v_cliente_id,
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
      respondido_cliente_id = v_cliente_id,
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


-- O acesso por token recebe a versão e a autoria registrada. Metadados de rede ficam internos.
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
  created_at timestamptz,
  numero_revisao integer,
  revisao_anterior_id uuid,
  respondido_por text
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
    NULL::inet, NULL::text, e.created_at,
    e.numero_revisao, e.revisao_anterior_id, respondente.nome
  FROM portal_entregas e
  LEFT JOIN projetos p ON p.id = e.projeto_id
  LEFT JOIN obras o ON o.id = e.obra_id
  LEFT JOIN public.clientes respondente ON respondente.id = e.respondido_cliente_id AND respondente.empresa_id = e.empresa_id
  LEFT JOIN projeto_disciplinas pd ON pd.id = e.projeto_disciplina_id
  WHERE (
      (e.projeto_id IS NOT NULL AND p.cliente_id = v_cliente_id AND p.deleted_at IS NULL)
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

REVOKE ALL ON FUNCTION public.portal_listar_solicitacoes(text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_listar_solicitacoes(text,uuid,uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.portal_listar_entregas(p_token TEXT, p_projeto_id UUID)
RETURNS TABLE (
  id uuid,
  empresa_id uuid,
  projeto_id uuid,
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
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
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
    e.id, e.empresa_id, e.projeto_id, e.titulo, e.descricao, e.tipo, e.status, e.drive_url,
    e.projeto_disciplina_id, pd.nome AS disciplina_nome, e.resposta_cliente, e.respondido_em,
    NULL::inet, NULL::text, e.created_by, e.created_at, e.updated_at
  FROM portal_entregas e
  JOIN projetos p ON p.id = e.projeto_id
  LEFT JOIN projeto_disciplinas pd ON pd.id = e.projeto_disciplina_id
  WHERE e.projeto_id = p_projeto_id
    AND p.cliente_id = v_cliente_id
  ORDER BY e.created_at ASC;
END;
$$;

-- Uma revisão respondida continua como evidência ao publicar a versão seguinte.
CREATE OR REPLACE FUNCTION public.validar_portal_entrega_revisao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  anterior public.portal_entregas%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.numero_revisao IS DISTINCT FROM NEW.numero_revisao
      OR OLD.revisao_anterior_id IS DISTINCT FROM NEW.revisao_anterior_id
      OR (OLD.numero_revisao IS NOT NULL AND (
        OLD.drive_url IS DISTINCT FROM NEW.drive_url
        OR OLD.projeto_id IS DISTINCT FROM NEW.projeto_id
        OR OLD.empresa_id IS DISTINCT FROM NEW.empresa_id
      )) THEN
      RAISE EXCEPTION 'Publique uma nova revisão para alterar a entrega' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.revisao_anterior_id IS NOT NULL THEN
    SELECT * INTO anterior FROM public.portal_entregas WHERE id = NEW.revisao_anterior_id;
    IF NOT FOUND OR anterior.projeto_id IS DISTINCT FROM NEW.projeto_id
      OR anterior.empresa_id IS DISTINCT FROM NEW.empresa_id OR anterior.status IS NULL OR anterior.status NOT IN ('aprovado', 'revisao_solicitada')
      OR anterior.numero_revisao IS NULL OR anterior.drive_url IS NOT DISTINCT FROM NEW.drive_url
      OR anterior.projeto_disciplina_id IS DISTINCT FROM NEW.projeto_disciplina_id THEN
      RAISE EXCEPTION 'Selecione uma revisão respondida e use um novo link'
        USING ERRCODE = '23514';
    END IF;
    NEW.numero_revisao := anterior.numero_revisao + 1;
  END IF;

  IF NEW.numero_revisao IS NOT NULL AND (
    NEW.projeto_id IS NULL OR NEW.tipo IS DISTINCT FROM 'aprovacao' OR NEW.drive_url IS NULL
    OR NEW.status IS DISTINCT FROM 'pendente'
    OR (NEW.revisao_anterior_id IS NULL AND NEW.numero_revisao <> 0)
  ) THEN
    RAISE EXCEPTION 'A revisão precisa de um projeto, um arquivo e aguardar aprovação' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
