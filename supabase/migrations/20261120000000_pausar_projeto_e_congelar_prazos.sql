-- SPEC 141: pausar projeto e disciplina congela os prazos (estende a SPEC 084).
--
-- 1. projeto_pausas: histórico de pausa do projeto (motivo, quem, quando).
-- 2. projeto_disciplina_pausas ganha status_anterior e projeto_pausa_id (quais
--    disciplinas a pausa do projeto pausou, para a retomada devolver só essas).
-- 3. RPCs: rpc_pausar_projeto, rpc_retomar_projeto; pausar/retomar disciplina
--    passam a exigir editor de projetos e a retomada empurra o prazo.
-- 4. Prazo anda pelos dias parados ao retomar (dia do calendário, America/Sao_Paulo).
-- 5. Trigger em projetos: mudar o status para/de Paralisado fora das RPCs
--    (formulário, agente, arraste) também abre/fecha a pausa, com motivo padrão.
-- 6. Início, resumo semanal e alertas ignoram pausa: disciplina Pausada e
--    projeto Paralisado não contam como atrasado nem como "vence em breve".
--
-- "Pausado" no projeto é o status Paralisado (sem ALTER TYPE).

-- ---------------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------------
CREATE TABLE public.projeto_pausas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id        uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  motivo            text NOT NULL CHECK (btrim(motivo) <> ''),
  status_anterior   text,
  etapa_anterior_id uuid REFERENCES public.projeto_etapas(id) ON DELETE SET NULL,
  pausado_em        timestamptz NOT NULL DEFAULT now(),
  pausado_por       uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  retomado_em       timestamptz,
  retomado_por      uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- só 1 pausa aberta por projeto por vez
CREATE UNIQUE INDEX projeto_pausas_aberta_uniq
  ON public.projeto_pausas (projeto_id)
  WHERE retomado_em IS NULL;

CREATE INDEX idx_projeto_pausas_projeto ON public.projeto_pausas (projeto_id);
CREATE INDEX idx_projeto_pausas_pausado_por ON public.projeto_pausas (pausado_por);
CREATE INDEX idx_projeto_pausas_retomado_por ON public.projeto_pausas (retomado_por);
CREATE INDEX idx_projeto_pausas_etapa_anterior ON public.projeto_pausas (etapa_anterior_id);

ALTER TABLE public.projeto_pausas ENABLE ROW LEVEL SECURITY;

CREATE POLICY projeto_pausas_empresa
  ON public.projeto_pausas
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = projeto_pausas.projeto_id
      AND p.empresa_id = public.get_user_empresa_id()
  ));

REVOKE ALL ON public.projeto_pausas FROM anon, PUBLIC;
GRANT SELECT ON public.projeto_pausas TO authenticated;
-- sem INSERT/UPDATE direto: só via as RPCs (e o trigger) abaixo.

ALTER TABLE public.projeto_disciplina_pausas
  ADD COLUMN status_anterior   text,
  ADD COLUMN projeto_pausa_id  uuid REFERENCES public.projeto_pausas(id) ON DELETE SET NULL;

CREATE INDEX idx_projeto_disciplina_pausas_projeto_pausa
  ON public.projeto_disciplina_pausas (projeto_pausa_id);

-- ---------------------------------------------------------------------------
-- 2. Helpers de leitura
-- ---------------------------------------------------------------------------
-- projeto_disciplinas.status é texto livre; "pausada" por substring, como o
-- front (DisciplinaStatusSelect). pilar_status_bucket não muda: Pausada segue
-- caindo em a_fazer para Meu trabalho, e os filtros de prazo usam este helper.
CREATE OR REPLACE FUNCTION public.pilar_disciplina_pausada(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(lower(p_status) LIKE '%pausad%', false);
$$;

-- tarefa com projeto_id nulo devolve false (não é de projeto pausado)
CREATE OR REPLACE FUNCTION public.pilar_projeto_pausado(p_projeto_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = p_projeto_id AND p.status::text = 'Paralisado'
  );
$$;

REVOKE ALL ON FUNCTION public.pilar_disciplina_pausada(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pilar_disciplina_pausada(text) TO authenticated;
REVOKE ALL ON FUNCTION public.pilar_projeto_pausado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pilar_projeto_pausado(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Núcleo: abrir e fechar a pausa do projeto (internas, sem EXECUTE de usuário)
-- ---------------------------------------------------------------------------
-- Não mexem em projetos.status: quem chama decide (RPC grava o status; o
-- trigger recebe o status já gravado).
CREATE OR REPLACE FUNCTION public._projeto_pausa_abrir(
  p_projeto_id      uuid,
  p_motivo          text,
  p_pessoa          uuid,
  p_pausado_em      timestamptz,
  p_status_anterior text,
  p_etapa_anterior  uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pausa uuid;
BEGIN
  INSERT INTO public.projeto_pausas (projeto_id, motivo, status_anterior, etapa_anterior_id, pausado_em, pausado_por)
  VALUES (p_projeto_id, btrim(p_motivo), p_status_anterior, p_etapa_anterior, p_pausado_em, p_pessoa)
  RETURNING id INTO v_pausa;

  -- disciplinas abertas e ainda não pausadas à parte: ficam Pausada junto
  WITH alvo AS (
    SELECT d.id, d.status
    FROM public.projeto_disciplinas d
    WHERE d.projeto_id = p_projeto_id
      AND public.pilar_status_bucket(d.status) <> 'concluida'
      AND NOT public.pilar_disciplina_pausada(d.status)
  ),
  pausas AS (
    INSERT INTO public.projeto_disciplina_pausas
      (projeto_disciplina_id, motivo, pausado_em, pausado_por, status_anterior, projeto_pausa_id)
    SELECT a.id, btrim(p_motivo), p_pausado_em, p_pessoa, a.status, v_pausa
    FROM alvo a
    RETURNING projeto_disciplina_id
  )
  UPDATE public.projeto_disciplinas d
     SET status = 'Pausada'
    FROM pausas
   WHERE d.id = pausas.projeto_disciplina_id;

  RETURN v_pausa;
END;
$$;

CREATE OR REPLACE FUNCTION public._projeto_pausa_fechar(
  p_projeto_id   uuid,
  p_pessoa       uuid,
  p_retomado_em  timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pausa public.projeto_pausas%ROWTYPE;
  v_dias  integer;
BEGIN
  SELECT * INTO v_pausa
  FROM public.projeto_pausas
  WHERE projeto_id = p_projeto_id AND retomado_em IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não há pausa em aberto para esse projeto';
  END IF;

  v_dias := GREATEST(0,
    (p_retomado_em AT TIME ZONE 'America/Sao_Paulo')::date
    - (v_pausa.pausado_em AT TIME ZONE 'America/Sao_Paulo')::date);

  UPDATE public.projeto_pausas
     SET retomado_em = p_retomado_em, retomado_por = p_pessoa
   WHERE id = v_pausa.id;

  -- só as disciplinas que ESTA pausa pausou: devolve o status e empurra o prazo.
  -- A que já estava pausada à parte continua pausada (e empurra na retomada dela).
  WITH fechadas AS (
    UPDATE public.projeto_disciplina_pausas dp
       SET retomado_em = p_retomado_em, retomado_por = p_pessoa
     WHERE dp.projeto_pausa_id = v_pausa.id AND dp.retomado_em IS NULL
    RETURNING dp.projeto_disciplina_id, dp.status_anterior, dp.pausado_em
  )
  UPDATE public.projeto_disciplinas d
     SET status = CASE
                    WHEN f.status_anterior IS NULL OR public.pilar_disciplina_pausada(f.status_anterior)
                      THEN 'Em Andamento'
                    ELSE f.status_anterior
                  END,
         data_fim = d.data_fim + v_dias,
         -- quem ainda não tinha começado empurra o início; quem já tinha, não
         data_inicio = CASE
                         WHEN d.data_inicio > (f.pausado_em AT TIME ZONE 'America/Sao_Paulo')::date
                           THEN d.data_inicio + v_dias
                         ELSE d.data_inicio
                       END
    FROM fechadas f
   WHERE d.id = f.projeto_disciplina_id;

  IF v_dias > 0 THEN
    UPDATE public.projetos
       SET data_previsao = data_previsao + v_dias
     WHERE id = p_projeto_id AND data_previsao IS NOT NULL;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._projeto_pausa_abrir(uuid, text, uuid, timestamptz, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._projeto_pausa_fechar(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. RPCs do projeto
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_pausar_projeto(p_projeto_id uuid, p_motivo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proj  public.projetos%ROWTYPE;
  v_pausa uuid;
BEGIN
  SELECT * INTO v_proj
  FROM public.projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND
     OR v_proj.empresa_id IS DISTINCT FROM public.get_user_empresa_id()
     OR NOT public.user_has_feature('projetos', 'editor') THEN
    RAISE EXCEPTION 'Projeto não encontrado ou sem permissão';
  END IF;

  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Motivo da pausa é obrigatório';
  END IF;

  IF v_proj.status::text IN ('Concluído', 'Cancelado') THEN
    RAISE EXCEPTION 'Projeto concluído ou cancelado não pode ser pausado';
  END IF;

  IF v_proj.status::text = 'Paralisado' THEN
    RAISE EXCEPTION 'Projeto já está pausado';
  END IF;

  -- avisa o trigger de status que esta mudança já é tratada aqui
  PERFORM set_config('pilar.pausa_rpc', 'on', true);

  v_pausa := public._projeto_pausa_abrir(
    p_projeto_id, p_motivo,
    (SELECT ps.id FROM public.pessoas ps WHERE ps.profile_id = auth.uid() AND ps.deleted_at IS NULL LIMIT 1),
    now(), v_proj.status::text, v_proj.etapa_id);

  UPDATE public.projetos SET status = 'Paralisado' WHERE id = p_projeto_id;

  PERFORM set_config('pilar.pausa_rpc', 'off', true);
  RETURN v_pausa;
END;
$$;

-- p_etapa_id: coluna de destino (arraste no Kanban); sem ela volta para a
-- coluna de antes da pausa, ou para a primeira do status anterior.
CREATE OR REPLACE FUNCTION public.rpc_retomar_projeto(p_projeto_id uuid, p_etapa_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proj  public.projetos%ROWTYPE;
  v_pausa public.projeto_pausas%ROWTYPE;
  v_etapa uuid;
BEGIN
  SELECT * INTO v_proj
  FROM public.projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND
     OR v_proj.empresa_id IS DISTINCT FROM public.get_user_empresa_id()
     OR NOT public.user_has_feature('projetos', 'editor') THEN
    RAISE EXCEPTION 'Projeto não encontrado ou sem permissão';
  END IF;

  SELECT * INTO v_pausa
  FROM public.projeto_pausas
  WHERE projeto_id = p_projeto_id AND retomado_em IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não há pausa em aberto para esse projeto';
  END IF;

  PERFORM set_config('pilar.pausa_rpc', 'on', true);

  PERFORM public._projeto_pausa_fechar(
    p_projeto_id,
    (SELECT ps.id FROM public.pessoas ps WHERE ps.profile_id = auth.uid() AND ps.deleted_at IS NULL LIMIT 1));

  -- destino: coluna pedida, senão a de antes da pausa; nunca uma coluna Paralisado
  SELECT pe.id INTO v_etapa
  FROM public.projeto_etapas pe
  WHERE pe.id IN (p_etapa_id, v_pausa.etapa_anterior_id)
    AND pe.empresa_id = v_proj.empresa_id
    AND pe.bucket <> 'Paralisado'
  ORDER BY (pe.id = p_etapa_id) DESC NULLS LAST
  LIMIT 1;

  IF v_etapa IS NOT NULL THEN
    UPDATE public.projetos SET etapa_id = v_etapa WHERE id = p_projeto_id;
  ELSE
    UPDATE public.projetos
       SET status = COALESCE(NULLIF(v_pausa.status_anterior, 'Paralisado'), 'Em andamento')::public.status_projeto
     WHERE id = p_projeto_id;
  END IF;

  PERFORM set_config('pilar.pausa_rpc', 'off', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. RPCs da disciplina (084): editor de projetos, status anterior, prazo anda
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_pausar_disciplina(p_disciplina_id uuid, p_motivo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_status     text;
  v_pausa_id   uuid;
BEGIN
  SELECT p.empresa_id, pd.status INTO v_empresa_id, v_status
  FROM public.projeto_disciplinas pd
  JOIN public.projetos p ON p.id = pd.projeto_id
  WHERE pd.id = p_disciplina_id;

  IF v_empresa_id IS NULL
     OR v_empresa_id <> public.get_user_empresa_id()
     OR NOT public.user_has_feature('projetos', 'editor') THEN
    RAISE EXCEPTION 'Disciplina não encontrada ou sem permissão';
  END IF;

  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Motivo da pausa é obrigatório';
  END IF;

  IF public.pilar_status_bucket(v_status) = 'concluida' THEN
    RAISE EXCEPTION 'Disciplina concluída não pode ser pausada';
  END IF;

  IF public.pilar_disciplina_pausada(v_status) THEN
    RAISE EXCEPTION 'Disciplina já está pausada';
  END IF;

  INSERT INTO public.projeto_disciplina_pausas (projeto_disciplina_id, motivo, pausado_por, status_anterior)
  VALUES (
    p_disciplina_id,
    btrim(p_motivo),
    (SELECT ps.id FROM public.pessoas ps WHERE ps.profile_id = auth.uid() AND ps.deleted_at IS NULL LIMIT 1),
    v_status
  )
  RETURNING id INTO v_pausa_id;

  UPDATE public.projeto_disciplinas SET status = 'Pausada' WHERE id = p_disciplina_id;

  RETURN v_pausa_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_retomar_disciplina(p_disciplina_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_projeto_id uuid;
  v_pausa      public.projeto_disciplina_pausas%ROWTYPE;
  v_agora      timestamptz := now();
  v_dias       integer;
BEGIN
  SELECT p.empresa_id, p.id INTO v_empresa_id, v_projeto_id
  FROM public.projeto_disciplinas pd
  JOIN public.projetos p ON p.id = pd.projeto_id
  WHERE pd.id = p_disciplina_id;

  IF v_empresa_id IS NULL
     OR v_empresa_id <> public.get_user_empresa_id()
     OR NOT public.user_has_feature('projetos', 'editor') THEN
    RAISE EXCEPTION 'Disciplina não encontrada ou sem permissão';
  END IF;

  SELECT * INTO v_pausa
  FROM public.projeto_disciplina_pausas
  WHERE projeto_disciplina_id = p_disciplina_id AND retomado_em IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não há pausa em aberto pra essa disciplina';
  END IF;

  -- pausada junto com o projeto: quem retoma é o projeto (prazo anda uma vez só)
  IF v_pausa.projeto_pausa_id IS NOT NULL AND public.pilar_projeto_pausado(v_projeto_id) THEN
    RAISE EXCEPTION 'Disciplina pausada junto com o projeto. Retome o projeto.';
  END IF;

  v_dias := GREATEST(0,
    (v_agora AT TIME ZONE 'America/Sao_Paulo')::date
    - (v_pausa.pausado_em AT TIME ZONE 'America/Sao_Paulo')::date);

  UPDATE public.projeto_disciplina_pausas
     SET retomado_em = v_agora,
         retomado_por = (SELECT ps.id FROM public.pessoas ps WHERE ps.profile_id = auth.uid() AND ps.deleted_at IS NULL LIMIT 1)
   WHERE id = v_pausa.id;

  UPDATE public.projeto_disciplinas d
     SET status = CASE
                    WHEN v_pausa.status_anterior IS NULL OR public.pilar_disciplina_pausada(v_pausa.status_anterior)
                      THEN 'Em Andamento'
                    ELSE v_pausa.status_anterior
                  END,
         data_fim = d.data_fim + v_dias,
         data_inicio = CASE
                         WHEN d.data_inicio > (v_pausa.pausado_em AT TIME ZONE 'America/Sao_Paulo')::date
                           THEN d.data_inicio + v_dias
                         ELSE d.data_inicio
                       END
   WHERE d.id = p_disciplina_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_pausar_projeto(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_pausar_projeto(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_retomar_projeto(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_retomar_projeto(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_pausar_disciplina(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_pausar_disciplina(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_retomar_disciplina(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_retomar_disciplina(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Mudança de status fora das RPCs (formulário, agente, arraste sem diálogo)
-- ---------------------------------------------------------------------------
-- AFTER (não BEFORE): o trigger a_sync_projeto_status_etapa pode derivar o
-- status da coluna, então só o valor final de NEW.status vale.
CREATE OR REPLACE FUNCTION public.trg_projeto_pausa_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pessoa uuid := (SELECT ps.id FROM public.pessoas ps WHERE ps.profile_id = auth.uid() AND ps.deleted_at IS NULL LIMIT 1);
BEGIN
  IF current_setting('pilar.pausa_rpc', true) = 'on' THEN
    RETURN NULL;
  END IF;

  IF NEW.status::text = 'Paralisado' AND OLD.status::text <> 'Paralisado' THEN
    IF NOT EXISTS (SELECT 1 FROM public.projeto_pausas WHERE projeto_id = NEW.id AND retomado_em IS NULL) THEN
      PERFORM public._projeto_pausa_abrir(
        NEW.id, 'Status alterado para Paralisado, sem motivo registrado', v_pessoa,
        now(), OLD.status::text, OLD.etapa_id);
    END IF;
  ELSIF OLD.status::text = 'Paralisado' AND NEW.status::text <> 'Paralisado' THEN
    IF EXISTS (SELECT 1 FROM public.projeto_pausas WHERE projeto_id = NEW.id AND retomado_em IS NULL) THEN
      PERFORM public._projeto_pausa_fechar(NEW.id, v_pessoa);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_projeto_pausa_sync() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER z_projeto_pausa_sync
  AFTER UPDATE ON public.projetos
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trg_projeto_pausa_sync();

-- status_data guardado: projeto pausado não é "em atraso"
CREATE OR REPLACE FUNCTION public.calculate_status_data()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'Concluído' AND NEW.data_final IS NOT NULL AND NEW.data_previsao IS NOT NULL THEN
    IF NEW.data_final <= NEW.data_previsao THEN
      NEW.status_data := 'concluido_no_prazo';
    ELSE
      NEW.status_data := 'concluido_com_atraso';
    END IF;
  ELSIF NEW.status = 'Cancelado' THEN
    NEW.status_data := 'cancelado';
  ELSIF NEW.status = 'Paralisado' THEN
    NEW.status_data := 'pausado';
  ELSIF NEW.data_previsao IS NOT NULL THEN
    DECLARE
      dias_diferenca INTEGER;
    BEGIN
      dias_diferenca := NEW.data_previsao - CURRENT_DATE;

      IF dias_diferenca < 0 THEN
        NEW.status_data := 'em_atraso';
      ELSIF dias_diferenca <= 7 THEN
        NEW.status_data := 'atencao';
      ELSE
        NEW.status_data := 'no_prazo';
      END IF;
    END;
  ELSE
    NEW.status_data := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Backfill: projetos já Paralisado ganham uma pausa aberta
-- ---------------------------------------------------------------------------
-- Sem isso a retomada falharia ("não há pausa em aberto") e as disciplinas
-- ficariam fora do congelamento. pausado_em = última alteração conhecida do
-- projeto (a data real de início da pausa só o dono sabe: confirmar caso a caso).
DO $backfill$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.id, p.updated_at
    FROM public.projetos p
    WHERE p.deleted_at IS NULL
      AND p.status::text = 'Paralisado'
      AND NOT EXISTS (SELECT 1 FROM public.projeto_pausas pp WHERE pp.projeto_id = p.id AND pp.retomado_em IS NULL)
  LOOP
    PERFORM public._projeto_pausa_abrir(
      r.id, 'Paralisado antes do registro de pausas', NULL, r.updated_at, NULL, NULL);
  END LOOP;
END;
$backfill$;

-- ---------------------------------------------------------------------------
-- 8. Início, resumo semanal e alertas ignoram pausa
-- ---------------------------------------------------------------------------
-- As três funções são grandes e já redefinidas em várias migrations. Em vez de
-- copiar o corpo inteiro, lê a definição em vigor e troca trechos exatos; cada
-- troca confere quantas vezes o trecho aparece e aborta se divergir (corpo
-- mudou desde que esta migration foi escrita).
CREATE FUNCTION pg_temp.sub(p_def text, p_de text, p_para text, p_esperado integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_achou integer := (length(p_def) - length(replace(p_def, p_de, ''))) / length(p_de);
BEGIN
  IF v_achou <> p_esperado THEN
    RAISE EXCEPTION 'SPEC 141: esperava % ocorrência(s) de [%], achei %', p_esperado, p_de, v_achou;
  END IF;
  RETURN replace(p_def, p_de, p_para);
END;
$$;

DO $congela$
DECLARE
  v_def text;
  c_disc constant text := $x$public.pilar_status_bucket(d.status) <> 'concluida'$x$;
  c_disc_novo constant text := c_disc
    || $x$ AND NOT public.pilar_disciplina_pausada(d.status) AND p.status::text <> 'Paralisado'$x$;
  c_tarefa_pausa constant text := $x$ AND NOT public.pilar_projeto_pausado(t.projeto_id)$x$;
BEGIN
  -- painel de gestão (/inicio): vence em 15 dias, carga da equipe, projetos atrasados e em risco
  v_def := pg_get_functiondef('public.get_painel_gestao()'::regprocedure);
  v_def := pg_temp.sub(v_def, c_disc, c_disc_novo, 2);
  v_def := pg_temp.sub(v_def,
    $x$FROM ativos WHERE data_previsao IS NOT NULL AND data_previsao < v_hoje$x$,
    $x$FROM ativos WHERE data_previsao IS NOT NULL AND data_previsao < v_hoje AND status <> 'Paralisado'$x$, 1);
  v_def := pg_temp.sub(v_def,
    $x$FROM ativos WHERE data_previsao IS NOT NULL AND data_previsao BETWEEN v_hoje AND v_hoje + 15$x$,
    $x$FROM ativos WHERE data_previsao IS NOT NULL AND data_previsao BETWEEN v_hoje AND v_hoje + 15 AND status <> 'Paralisado'$x$, 1);
  EXECUTE v_def;

  -- resumo semanal
  v_def := pg_get_functiondef('public.get_resumo_semanal_fatos()'::regprocedure);
  v_def := pg_temp.sub(v_def, c_disc, c_disc_novo, 7);
  v_def := pg_temp.sub(v_def, $x$p.data_previsao < v_hoje$x$, $x$p.data_previsao < v_hoje AND p.status::text <> 'Paralisado'$x$, 2);
  v_def := pg_temp.sub(v_def, $x$t.prazo < v_hoje$x$, $x$t.prazo < v_hoje$x$ || c_tarefa_pausa, 2);
  v_def := pg_temp.sub(v_def, $x$t.prazo BETWEEN v_hoje AND v_domingo$x$, $x$t.prazo BETWEEN v_hoje AND v_domingo$x$ || c_tarefa_pausa, 1);
  v_def := pg_temp.sub(v_def, $x$t.prazo <= v_domingo$x$, $x$t.prazo <= v_domingo$x$ || c_tarefa_pausa, 1);
  EXECUTE v_def;

  -- alertas ambient: projeto e disciplina (atrasado e a vencer em 7 dias)
  v_def := pg_get_functiondef('public.gerar_notificacoes_ambient()'::regprocedure);
  v_def := pg_temp.sub(v_def, $x$AND p.data_previsao < v_hoje$x$, $x$AND p.data_previsao < v_hoje AND p.status::text <> 'Paralisado'$x$, 1);
  v_def := pg_temp.sub(v_def,
    $x$AND p.data_previsao >= v_hoje AND p.data_previsao <= v_em7$x$,
    $x$AND p.data_previsao >= v_hoje AND p.data_previsao <= v_em7 AND p.status::text <> 'Paralisado'$x$, 1);
  v_def := pg_temp.sub(v_def, $x$AND d.data_fim < v_hoje$x$,
    $x$AND d.data_fim < v_hoje AND NOT public.pilar_disciplina_pausada(d.status) AND p.status::text <> 'Paralisado'$x$, 1);
  v_def := pg_temp.sub(v_def,
    $x$AND d.data_fim >= v_hoje AND d.data_fim <= v_em7$x$,
    $x$AND d.data_fim >= v_hoje AND d.data_fim <= v_em7 AND NOT public.pilar_disciplina_pausada(d.status) AND p.status::text <> 'Paralisado'$x$, 1);
  EXECUTE v_def;
END;
$congela$;
