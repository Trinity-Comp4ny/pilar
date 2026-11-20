-- Menções em atividades do lead: persistência, sino/e-mail e limpeza atômicos.
BEGIN;
ALTER TABLE public.lead_atividades ADD COLUMN mencionados uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.notificacoes DROP CONSTRAINT notificacoes_categoria_check;
ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_categoria_check
  CHECK (categoria IN ('tarefa','projeto','disciplina','financeiro','obra','sistema','agenda','lead'));
ALTER TABLE public.notificacao_preferencias DROP CONSTRAINT notificacao_preferencias_categoria_check;
ALTER TABLE public.notificacao_preferencias ADD CONSTRAINT notificacao_preferencias_categoria_check
  CHECK (categoria IN ('tarefa','projeto','disciplina','financeiro','obra','sistema','agenda','lead'));

CREATE FUNCTION public.notificar_atividade_lead() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_destinatarios uuid[]; v_ids uuid[]; v_total integer; v_lead text; v_todos boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notificacoes WHERE empresa_id = OLD.empresa_id AND tipo = 'mencao_comentario'
      AND referencia_tipo = 'comentario' AND referencia_id = OLD.id;
    RETURN OLD;
  END IF;
  v_todos := NEW.texto ~* '(^|[[:space:]])@(all|todos)([^[:alnum:]_]|$)';
  SELECT array_agg(DISTINCT pr.id) INTO v_destinatarios FROM public.profiles pr
    WHERE pr.empresa_id = NEW.empresa_id AND pr.desativado_em IS NULL AND pr.id <> NEW.autor_id
      AND (v_todos OR EXISTS (SELECT 1 FROM public.pessoas pe
        WHERE pe.id = ANY(NEW.mencionados) AND pe.empresa_id = NEW.empresa_id
          AND pe.profile_id = pr.id AND pe.deleted_at IS NULL AND strpos(NEW.texto, '@' || pe.nome) > 0));
  IF v_destinatarios IS NULL THEN RETURN NEW; END IF;
  SELECT concat_ws(' ', nome, sobrenome) INTO v_lead FROM public.leads WHERE id = NEW.lead_id;
  v_total := public.notificar(NEW.empresa_id, v_destinatarios, 'mencao_comentario', 'lead', 'medium',
    NEW.autor_nome || CASE WHEN v_todos THEN ' marcou todos no lead "' ELSE ' marcou você no lead "' END || v_lead || '"',
    left(NEW.texto, 200), 'comentario', NEW.id, '/gestao/leads?lead=' || NEW.lead_id || '&comentario=' || NEW.id);
  IF v_total > 0 THEN
    SELECT array_agg(id) INTO v_ids FROM public.notificacoes WHERE empresa_id = NEW.empresa_id
      AND referencia_tipo = 'comentario' AND referencia_id = NEW.id AND tipo = 'mencao_comentario';
    BEGIN
      PERFORM public.notificacoes_email_mencao_disparar(v_ids);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'E-mail da menção no lead fica para a varredura: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notificar_atividade_lead() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER notificar_atividade_lead AFTER INSERT OR DELETE ON public.lead_atividades
  FOR EACH ROW EXECUTE FUNCTION public.notificar_atividade_lead();
NOTIFY pgrst, 'reload schema';
COMMIT;
