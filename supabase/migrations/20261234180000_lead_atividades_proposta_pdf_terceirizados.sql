-- Histórico comercial por registro (sem sobrescrever notas ou atividades concorrentes),
-- revisões de PDF privado e execução terceirizada no fluxo de disciplinas.
BEGIN;

CREATE TABLE public.lead_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  texto text NOT NULL CHECK (length(btrim(texto)) BETWEEN 1 AND 10000),
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  autor_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  autor_nome text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_atividades_lead_data ON public.lead_atividades(lead_id, ocorrido_em, created_at);
ALTER TABLE public.lead_atividades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lead_atividades FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.lead_atividades TO authenticated;
GRANT ALL ON public.lead_atividades TO service_role;

CREATE FUNCTION public.preparar_lead_atividade() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = NEW.lead_id
    AND l.empresa_id = NEW.empresa_id AND l.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Lead não encontrado' USING ERRCODE = '42501';
  END IF;
  NEW.autor_id := auth.uid();
  SELECT coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Usuário')
    INTO NEW.autor_nome FROM public.profiles p WHERE p.id = NEW.autor_id;
  NEW.created_at := now();
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.preparar_lead_atividade() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER preparar_lead_atividade BEFORE INSERT ON public.lead_atividades
  FOR EACH ROW EXECUTE FUNCTION public.preparar_lead_atividade();
CREATE TRIGGER trg_enforce_empresa_nao_leitura BEFORE INSERT OR UPDATE OR DELETE ON public.lead_atividades
  FOR EACH ROW EXECUTE FUNCTION public.enforce_empresa_nao_leitura();
CREATE POLICY lead_atividades_select ON public.lead_atividades FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.user_has_feature('leads', 'viewer')
    AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.empresa_id = lead_atividades.empresa_id AND l.deleted_at IS NULL));
CREATE POLICY lead_atividades_insert ON public.lead_atividades FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND autor_id = auth.uid()
    AND public.user_has_feature('leads', 'editor'));
CREATE POLICY lead_atividades_delete ON public.lead_atividades FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.user_has_feature('leads', 'editor')
    AND (autor_id = auth.uid() OR public.current_effective_role() IN ('admin', 'coordenador', 'ultra_admin')));

CREATE TABLE public.proposta_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  proposta_id uuid NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  numero integer NOT NULL DEFAULT 1,
  arquivo_path text NOT NULL UNIQUE,
  nome_arquivo text NOT NULL CHECK (length(nome_arquivo) BETWEEN 1 AND 200),
  tamanho integer NOT NULL CHECK (tamanho > 0 AND tamanho <= 15728640),
  valor_proposto numeric NOT NULL CHECK (valor_proposto >= 0),
  validade date,
  condicoes_pagamento text NOT NULL DEFAULT '' CHECK (length(condicoes_pagamento) <= 10000),
  motivo_revisao text NOT NULL DEFAULT '' CHECK (length(motivo_revisao) <= 2000),
  enviado_em timestamptz,
  criado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposta_id, numero)
);
CREATE INDEX proposta_versoes_proposta ON public.proposta_versoes(proposta_id, numero DESC);
ALTER TABLE public.proposta_versoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.proposta_versoes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.proposta_versoes TO authenticated;
GRANT UPDATE (enviado_em) ON public.proposta_versoes TO authenticated;
GRANT ALL ON public.proposta_versoes TO service_role;
CREATE TRIGGER trg_enforce_empresa_nao_leitura BEFORE INSERT OR UPDATE OR DELETE ON public.proposta_versoes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_empresa_nao_leitura();
CREATE POLICY proposta_versoes_select ON public.proposta_versoes FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.user_has_feature('propostas', 'viewer')
    AND public.can_view_financeiro()
    AND EXISTS (SELECT 1 FROM public.propostas p WHERE p.id = proposta_id AND p.empresa_id = proposta_versoes.empresa_id AND p.deleted_at IS NULL));
CREATE POLICY proposta_versoes_insert ON public.proposta_versoes FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND criado_por = auth.uid()
    AND public.user_has_feature('propostas', 'editor') AND public.can_view_financeiro());
CREATE POLICY proposta_versoes_update ON public.proposta_versoes FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.user_has_feature('propostas', 'editor') AND public.can_view_financeiro())
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.user_has_feature('propostas', 'editor') AND public.can_view_financeiro());

CREATE FUNCTION public.preparar_proposta_versao() RETURNS trigger
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
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.preparar_proposta_versao() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER preparar_proposta_versao BEFORE INSERT ON public.proposta_versoes
  FOR EACH ROW EXECUTE FUNCTION public.preparar_proposta_versao();

CREATE FUNCTION public.registrar_envio_proposta_pdf() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.enviado_em IS NOT NULL THEN
    RAISE EXCEPTION 'O envio desta versão já foi registrado' USING ERRCODE = '22023';
  END IF;
  NEW.enviado_em := now();
  UPDATE public.propostas SET status = 'enviada'
    WHERE id = NEW.proposta_id AND empresa_id = NEW.empresa_id AND status = 'rascunho';
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.registrar_envio_proposta_pdf() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER registrar_envio_proposta_pdf BEFORE UPDATE OF enviado_em ON public.proposta_versoes
  FOR EACH ROW EXECUTE FUNCTION public.registrar_envio_proposta_pdf();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('proposta-pdfs', 'proposta-pdfs', false, 15728640, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- O UUID é comparado como texto: caminhos malformados não provocam cast de UUID.
CREATE FUNCTION public.pode_acessar_proposta_pdf(p_path text, p_escrita boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.can_view_financeiro()
    AND public.user_has_feature('propostas', CASE WHEN p_escrita THEN 'editor' ELSE 'viewer' END)
    AND EXISTS (SELECT 1 FROM public.propostas p JOIN public.empresas e ON e.id = p.empresa_id
      WHERE p.empresa_id = public.get_user_empresa_id() AND p.deleted_at IS NULL
        AND split_part(p_path, '/', 1) = p.empresa_id::text
        AND split_part(p_path, '/', 2) = p.id::text
        AND p_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'
        AND (NOT p_escrita OR (e.leitura_desde IS NULL AND NOT public.empresa_assinatura_suspensa(e.id))));
$$;
REVOKE ALL ON FUNCTION public.pode_acessar_proposta_pdf(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_acessar_proposta_pdf(text, boolean) TO authenticated;
CREATE POLICY proposta_pdf_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'proposta-pdfs' AND public.pode_acessar_proposta_pdf(name));
CREATE POLICY proposta_pdf_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proposta-pdfs' AND public.pode_acessar_proposta_pdf(name, true));
-- Revisão gravada é imutável: só upload órfão pode ser removido pelo navegador.
CREATE POLICY proposta_pdf_delete_orfao ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'proposta-pdfs' AND public.pode_acessar_proposta_pdf(name, true)
    AND NOT EXISTS (SELECT 1 FROM public.proposta_versoes v WHERE v.arquivo_path = name));

ALTER TABLE public.projeto_disciplinas
  ADD COLUMN tipo_execucao text NOT NULL DEFAULT 'interna' CHECK (tipo_execucao IN ('interna', 'terceirizada')),
  ADD COLUMN prestador_nome text;
ALTER TABLE public.projeto_disciplinas ADD CONSTRAINT disciplina_prestador_nome
  CHECK (tipo_execucao <> 'terceirizada' OR length(btrim(prestador_nome)) BETWEEN 1 AND 200 AND prestador_nome IS NOT NULL);

CREATE FUNCTION public.conferir_dependencia_terceirizada() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.data_fim_real IS NOT DISTINCT FROM OLD.data_fim_real THEN RETURN NEW; END IF;
  IF (NEW.status NOT IN ('Em Andamento', 'Concluído') AND NEW.data_fim_real IS NULL) OR NEW.ordem_etapa IS NULL THEN RETURN NEW; END IF;
  -- Não muda datas ou inicia trabalho automaticamente. A conclusão do serviço
  -- externo libera o avanço manual das próximas colunas do mesmo projeto.
  PERFORM 1 FROM public.projetos WHERE id = NEW.projeto_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.projeto_disciplinas d WHERE d.projeto_id = NEW.projeto_id
    AND d.id <> NEW.id AND d.ordem_etapa < NEW.ordem_etapa AND d.tipo_execucao = 'terceirizada'
    AND d.status <> 'Concluído' AND d.data_fim_real IS NULL) THEN
    RAISE EXCEPTION 'Conclua o serviço terceirizado anterior antes de avançar esta disciplina' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.conferir_dependencia_terceirizada() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER conferir_dependencia_terceirizada BEFORE INSERT OR UPDATE ON public.projeto_disciplinas
  FOR EACH ROW EXECUTE FUNCTION public.conferir_dependencia_terceirizada();

NOTIFY pgrst, 'reload schema';
COMMIT;
