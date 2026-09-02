-- Spec 091: rpc_notificar_proxima_etapa (20260848000000) só avisava responsáveis da próxima
-- disciplina — admin/owner/coordenador só sabiam que uma etapa liberou se por acaso fossem
-- responsáveis diretos, o que normalmente não são. Passa a somar
-- _notif_gestao_operacional(empresa) (criado em 20260901000000) aos responsáveis, sempre
-- excluindo quem disparou o evento (auth.uid()).
--
-- NÃO mexe em rpc_notificar_projeto_status/projeto_status_alterado: essa RPC foi removida em
-- 20260894000000_remove_notificacoes_baixo_engajamento.sql (0% de leitura medido em produção,
-- "remoção completa, não é meio-termo"). Uma versão anterior desta migration recriava essa
-- função sem checar esse DROP antes — achado revisando o histórico completo de migrations, não
-- só o "estado mais recente" de cada função (grep por CREATE OR REPLACE FUNCTION não mostra
-- DROP FUNCTION subsequente). Corrigido antes de aplicar: ressuscitar notificação já matada por
-- dado real de engajamento seria regressão, não melhoria.

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_notificar_proxima_etapa(
  p_disciplina_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id     uuid;
  v_disc           RECORD;
  v_etapa_completa boolean;
  v_gestao         uuid[];
  v_destinatarios  uuid[];
  v_count          integer := 0;
  v_proxima        RECORD;
BEGIN
  v_empresa_id := public.get_user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  SELECT pd.id, pd.nome, pd.ordem_etapa, pd.projeto_id, p.nome AS projeto_nome, p.empresa_id
  INTO v_disc
  FROM public.projeto_disciplinas pd
  JOIN public.projetos p ON p.id = pd.projeto_id
  WHERE pd.id = p_disciplina_id;

  IF v_disc IS NULL OR v_disc.empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'Disciplina não encontrada ou fora da empresa';
  END IF;

  IF v_disc.ordem_etapa IS NULL THEN
    RETURN 0;
  END IF;

  SELECT bool_and(status = 'Concluído') INTO v_etapa_completa
  FROM public.projeto_disciplinas
  WHERE projeto_id = v_disc.projeto_id AND ordem_etapa = v_disc.ordem_etapa;

  IF NOT COALESCE(v_etapa_completa, false) THEN
    RETURN 0;
  END IF;

  v_gestao := public._notif_gestao_operacional(v_empresa_id);

  FOR v_proxima IN
    SELECT id, nome FROM public.projeto_disciplinas
    WHERE projeto_id = v_disc.projeto_id AND ordem_etapa = v_disc.ordem_etapa + 1
  LOOP
    SELECT ARRAY_AGG(DISTINCT pe.profile_id) INTO v_destinatarios
    FROM public.projeto_disciplina_responsaveis r
    JOIN public.pessoas pe ON pe.id = r.pessoa_id
    WHERE r.projeto_disciplina_id = v_proxima.id
      AND pe.profile_id IS NOT NULL;

    v_destinatarios := ARRAY(
      SELECT DISTINCT x FROM unnest(COALESCE(v_destinatarios, '{}') || v_gestao) x
      WHERE x <> auth.uid()
    );

    v_count := v_count + COALESCE(public.notificar(
      v_empresa_id,
      v_destinatarios,
      'proxima_etapa_liberada',
      'disciplina',
      'medium',
      'Próxima etapa liberada: ' || v_proxima.nome,
      'A etapa anterior de "' || v_disc.projeto_nome || '" foi concluída.',
      'disciplina',
      v_proxima.id,
      '/projetos/' || v_disc.projeto_id
    ), 0);
  END LOOP;

  RETURN v_count;
END;
$$;

COMMIT;
