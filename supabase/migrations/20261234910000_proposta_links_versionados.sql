BEGIN;

ALTER TABLE public.proposta_versoes
  ADD COLUMN link_token uuid UNIQUE,
  ADD COLUMN link_snapshot text,
  ADD COLUMN primeira_abertura_em timestamptz,
  ADD COLUMN ultima_abertura_em timestamptz,
  ADD COLUMN aceita_em timestamptz;

-- A sessão de escritório insere os dados do PDF; o servidor grava publicação e aceite.
REVOKE INSERT ON public.proposta_versoes FROM authenticated;
GRANT INSERT (id, empresa_id, proposta_id, numero, arquivo_path, nome_arquivo, tamanho, valor_proposto,
  validade, condicoes_pagamento, motivo_revisao, enviado_em, criado_por, created_at)
  ON public.proposta_versoes TO authenticated;

-- A versão comercial é imutável. A impressão digital protege o aceite quando o
-- cadastro ou as disciplinas foram editados desde a publicação do PDF.
CREATE FUNCTION public.proposta_link_digest(p_proposta_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT md5(jsonb_build_array(
    to_jsonb(p) - ARRAY['updated_at','updated_by','status','contrato_assinado','contrato_enviado','contrato_recusado'],
    COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.id)
      FROM public.proposta_disciplinas d WHERE d.proposta_id = p.id), '[]'::jsonb)
  )::text)
  FROM public.propostas p WHERE p.id = p_proposta_id;
$$;
REVOKE ALL ON FUNCTION public.proposta_link_digest(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.preparar_proposta_versao() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  -- O lock serializa a numeração quando duas pessoas adicionam PDF ao mesmo tempo.
  SELECT p.status INTO v_status FROM public.propostas p WHERE p.id = NEW.proposta_id
    AND p.empresa_id = NEW.empresa_id AND p.deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada' USING ERRCODE = '42501'; END IF;
  IF v_status IN ('aceita', 'recusada') THEN
    RAISE EXCEPTION 'Crie outra proposta para renegociar uma proposta encerrada' USING ERRCODE = '22023';
  END IF;
  IF NEW.arquivo_path <> NEW.empresa_id::text || '/' || NEW.proposta_id::text || '/' || NEW.id::text || '.pdf'
    OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'proposta-pdfs' AND o.name = NEW.arquivo_path) THEN
    RAISE EXCEPTION 'Envie o PDF antes de registrar a versão' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(max(numero), 0) + 1 INTO NEW.numero FROM public.proposta_versoes WHERE proposta_id = NEW.proposta_id;
  NEW.criado_por := auth.uid();
  NEW.created_at := now();
  NEW.enviado_em := NULL;
  UPDATE public.propostas SET valor_proposto = NEW.valor_proposto, validade = NEW.validade WHERE id = NEW.proposta_id;
  NEW.link_snapshot := public.proposta_link_digest(NEW.proposta_id);
  RETURN NEW;
END; $$;

CREATE FUNCTION public.publicar_link_proposta(p_versao_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v proposta_versoes%ROWTYPE;
  p propostas%ROWTYPE;
  v_token uuid;
  v_snapshot text;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(user_has_feature('propostas', 'editor'), false)
     OR NOT coalesce(can_view_financeiro(), false) THEN
    RAISE EXCEPTION 'Sem permissão para publicar propostas' USING ERRCODE = '42501';
  END IF;

  SELECT p0.* INTO p FROM propostas p0 JOIN proposta_versoes v0 ON v0.proposta_id = p0.id
    WHERE v0.id = p_versao_id AND v0.empresa_id = p0.empresa_id
      AND p0.empresa_id = get_user_empresa_id() AND p0.deleted_at IS NULL FOR UPDATE OF p0;
  IF NOT FOUND OR coalesce(p.status, '') NOT IN ('rascunho', 'enviada') THEN
    RAISE EXCEPTION 'Proposta indisponível para publicação' USING ERRCODE = '22023';
  END IF;
  IF empresa_assinatura_suspensa(p.empresa_id)
    OR EXISTS (SELECT 1 FROM empresas e WHERE e.id = p.empresa_id AND e.leitura_desde IS NOT NULL) THEN
    RAISE EXCEPTION 'Empresa indisponível para publicação' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v FROM proposta_versoes WHERE id = p_versao_id;
  IF EXISTS (SELECT 1 FROM proposta_versoes x WHERE x.proposta_id = p.id AND x.numero > v.numero)
    OR v.valor_proposto IS DISTINCT FROM p.valor_proposto OR v.validade IS DISTINCT FROM p.validade
    OR v.validade < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'Anexe a versão atual da proposta antes de publicar' USING ERRCODE = '22023';
  END IF;

  v_snapshot := proposta_link_digest(p.id);
  IF v.link_snapshot IS NOT NULL AND v.link_snapshot IS DISTINCT FROM v_snapshot THEN
    RAISE EXCEPTION 'A proposta mudou. Anexe uma nova versão para enviar.' USING ERRCODE = '22023';
  END IF;
  IF v.link_token IS NOT NULL THEN RETURN v.link_token; END IF;

  UPDATE proposta_versoes SET link_token = gen_random_uuid(), link_snapshot = v_snapshot
    WHERE id = v.id RETURNING link_token INTO v_token;
  IF v.enviado_em IS NULL THEN
    UPDATE proposta_versoes SET enviado_em = now() WHERE id = v.id;
  END IF;
  RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.publicar_link_proposta(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publicar_link_proposta(uuid) TO authenticated;

CREATE FUNCTION public.acessar_link_proposta(p_token uuid, p_acao text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v proposta_versoes%ROWTYPE;
  p propostas%ROWTYPE;
  v_estado text;
  v_empresa text;
BEGIN
  IF p_acao NOT IN ('abrir', 'aceitar') OR p_acao IS NULL THEN RETURN NULL; END IF;
  SELECT p0.* INTO p FROM propostas p0 JOIN proposta_versoes v0 ON v0.proposta_id = p0.id
    WHERE v0.link_token = p_token AND p0.deleted_at IS NULL AND v0.empresa_id = p0.empresa_id FOR UPDATE OF p0;
  IF NOT FOUND OR empresa_assinatura_suspensa(p.empresa_id) THEN RETURN NULL; END IF;
  SELECT * INTO v FROM proposta_versoes WHERE link_token = p_token;
  SELECT nome INTO v_empresa FROM empresas WHERE id = p.empresa_id;

  v_estado := CASE
    WHEN v.aceita_em IS NOT NULL THEN 'aceita'
    WHEN EXISTS (SELECT 1 FROM proposta_versoes x WHERE x.proposta_id = p.id AND x.numero > v.numero)
      THEN 'substituida'
    WHEN v.validade < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 'expirada'
    WHEN p.status IS DISTINCT FROM 'enviada' OR v.link_snapshot IS DISTINCT FROM proposta_link_digest(p.id)
      OR EXISTS (SELECT 1 FROM empresas e WHERE e.id = p.empresa_id AND e.leitura_desde IS NOT NULL)
      THEN 'encerrada'
    ELSE 'disponivel'
  END;

  IF p_acao = 'abrir' AND NOT EXISTS (SELECT 1 FROM empresas e WHERE e.id = p.empresa_id AND e.leitura_desde IS NOT NULL) THEN
    UPDATE proposta_versoes SET primeira_abertura_em = coalesce(primeira_abertura_em, now()),
      ultima_abertura_em = now() WHERE id = v.id;
  ELSIF v_estado = 'disponivel' THEN
    IF p.projeto_id IS NULL THEN
      UPDATE propostas SET status = 'aceita', updated_at = now() WHERE id = p.id;
    ELSE
      PERFORM portal_aprovar_proposta_atomica(p.id, p.projeto_id);
    END IF;
    UPDATE proposta_versoes SET aceita_em = now() WHERE id = v.id RETURNING aceita_em INTO v.aceita_em;
    v_estado := 'aceita';
  END IF;

  RETURN jsonb_build_object('empresa', v_empresa, 'numero', v.numero, 'estado', v_estado,
    'aceita_em', v.aceita_em, 'arquivo_path', v.arquivo_path);
END;
$$;
REVOKE ALL ON FUNCTION public.acessar_link_proposta(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acessar_link_proposta(uuid, text) TO service_role;

COMMIT;
