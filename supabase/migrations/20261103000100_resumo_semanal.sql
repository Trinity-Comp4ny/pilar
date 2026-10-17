-- SPEC 121 / ADR 0058: resumo semanal por IA no /inicio.
--
-- Três peças:
--   1. resumos_semanais: o texto pronto, guardado por semana e escopo. Só a edge function
--      (service role) escreve; a leitura é por RLS.
--   2. get_resumo_semanal_fatos(): o que o código calcula e o modelo só redige. SECURITY
--      INVOKER, então roda sob o RLS de quem abre o Início. O escopo sai de
--      can_view_financeiro() aqui no banco, nunca do front nem do prompt.
--   3. get_resumo_semanal(): leitura do resumo da semana, no escopo que cabe a quem chama.
--
-- Escopo `empresa` (quem passa em can_view_financeiro): projetos, comercial, financeiro,
-- obras e tarefas da empresa. Escopo `pessoa` (todos os outros): só o que tem a pessoa como
-- responsável. Tarefas são visíveis à empresa inteira (SPEC 118), então o RLS sozinho NÃO
-- restringe: o filtro por responsável é explícito.
--
-- Semana: segunda a domingo, fuso de São Paulo. `semana_inicio` é a segunda da semana
-- corrente; o texto conta a semana que passou e olha para a que está em curso.

-- 1. Tabela -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resumos_semanais (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  escopo         text NOT NULL CHECK (escopo IN ('empresa', 'pessoa')),
  user_id        uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  semana_inicio  date NOT NULL,
  conteudo       jsonb NOT NULL,
  fatos          jsonb NOT NULL,
  modelo         text,
  tokens_entrada integer NOT NULL DEFAULT 0,
  tokens_saida   integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- escopo pessoa tem dono; escopo empresa não tem.
  CONSTRAINT resumos_semanais_dono CHECK (
    (escopo = 'pessoa' AND user_id IS NOT NULL) OR (escopo = 'empresa' AND user_id IS NULL)
  ),
  -- Uma linha por empresa, escopo, pessoa e semana. NULLS NOT DISTINCT faz o escopo empresa
  -- (user_id nulo) também ser único; é o que deixa dois admins abrirem juntos sem duplicar.
  CONSTRAINT resumos_semanais_unico UNIQUE NULLS NOT DISTINCT (empresa_id, escopo, user_id, semana_inicio)
);

CREATE INDEX IF NOT EXISTS idx_resumos_semanais_user ON public.resumos_semanais (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.resumos_semanais ENABLE ROW LEVEL SECURITY;

-- Pessoa lê só o próprio; empresa só quem pode ver dinheiro (o texto cita valores).
DROP POLICY IF EXISTS resumos_semanais_select ON public.resumos_semanais;
CREATE POLICY resumos_semanais_select ON public.resumos_semanais
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    AND (
      (escopo = 'pessoa' AND user_id = (SELECT auth.uid()))
      OR (escopo = 'empresa' AND public.can_view_financeiro())
    )
  );

-- Sem policy de INSERT/UPDATE/DELETE: só a edge function, com service role.
REVOKE ALL ON public.resumos_semanais FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.resumos_semanais TO authenticated;

COMMENT ON TABLE public.resumos_semanais IS
  'SPEC 121: resumo semanal do Início gerado por IA, por empresa/pessoa e semana. `fatos` guarda o que o código calculou (auditoria). Escrita só pela edge function resumo-semanal.';

-- 2. Fatos da semana ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_resumo_semanal_fatos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid       uuid := auth.uid();
  v_hoje      date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_semana    date := date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo')::date)::date;
  v_ant_ini   date := v_semana - 7;
  v_ant_fim   date := v_semana - 1;
  v_domingo   date := v_semana + 6;
  v_empresa   boolean := public.can_view_financeiro();
  v_pessoa    uuid;
  v_nome      text;
  v_result    jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado' USING ERRCODE = '28000';
  END IF;

  IF v_empresa THEN
    SELECT jsonb_build_object(
      'escopo', 'empresa',
      'semana_inicio', v_semana,
      'hoje', v_hoje,
      'semana_passada', jsonb_build_object('inicio', v_ant_ini, 'fim', v_ant_fim),
      'projetos', jsonb_build_object(
        'ativos', (SELECT COUNT(*)::int FROM public.projetos p
                    WHERE p.deleted_at IS NULL AND p.status::text NOT IN ('Concluído', 'Cancelado')),
        'atrasados', (SELECT COUNT(*)::int FROM public.projetos p
                       WHERE p.deleted_at IS NULL AND p.status::text NOT IN ('Concluído', 'Cancelado')
                         AND p.data_previsao IS NOT NULL AND p.data_previsao < v_hoje),
        'novos_semana_passada', (SELECT COUNT(*)::int FROM public.projetos p
                                  WHERE p.deleted_at IS NULL
                                    AND (p.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_ant_ini AND v_ant_fim),
        'concluidos_semana_passada', (SELECT COUNT(*)::int FROM public.projetos p
                                       WHERE p.deleted_at IS NULL AND p.data_final BETWEEN v_ant_ini AND v_ant_fim),
        'maiores_atrasos', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('projeto', x.nome, 'dias', x.dias) ORDER BY x.dias DESC)
          FROM (
            SELECT p.nome, (v_hoje - p.data_previsao)::int AS dias
            FROM public.projetos p
            WHERE p.deleted_at IS NULL AND p.status::text NOT IN ('Concluído', 'Cancelado')
              AND p.data_previsao IS NOT NULL AND p.data_previsao < v_hoje
            ORDER BY p.data_previsao ASC LIMIT 5
          ) x
        ), '[]'::jsonb)
      ),
      'disciplinas', jsonb_build_object(
        'atrasadas', (SELECT COUNT(*)::int
                        FROM public.projeto_disciplinas d
                        JOIN public.projetos p ON p.id = d.projeto_id
                       WHERE p.deleted_at IS NULL AND p.status::text NOT IN ('Concluído', 'Cancelado')
                         AND COALESCE(d.status, 'pendente') <> 'concluida'
                         AND d.data_fim IS NOT NULL AND d.data_fim < v_hoje),
        'concluidas_semana_passada', (SELECT COUNT(*)::int
                                        FROM public.projeto_disciplinas d
                                        JOIN public.projetos p ON p.id = d.projeto_id
                                       WHERE p.deleted_at IS NULL AND d.data_fim_real BETWEEN v_ant_ini AND v_ant_fim),
        'prazos_na_semana', (SELECT COUNT(*)::int
                               FROM public.projeto_disciplinas d
                               JOIN public.projetos p ON p.id = d.projeto_id
                              WHERE p.deleted_at IS NULL AND p.status::text NOT IN ('Concluído', 'Cancelado')
                                AND COALESCE(d.status, 'pendente') <> 'concluida'
                                AND d.data_fim BETWEEN v_hoje AND v_domingo),
        'proximos_prazos', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('projeto', x.projeto, 'disciplina', x.disciplina, 'data', x.data_fim)
                           ORDER BY x.data_fim)
          FROM (
            SELECT p.nome AS projeto, COALESCE(NULLIF(btrim(d.nome), ''), 'Sem nome') AS disciplina, d.data_fim
            FROM public.projeto_disciplinas d
            JOIN public.projetos p ON p.id = d.projeto_id
            WHERE p.deleted_at IS NULL AND p.status::text NOT IN ('Concluído', 'Cancelado')
              AND COALESCE(d.status, 'pendente') <> 'concluida'
              AND d.data_fim BETWEEN v_hoje AND v_domingo
            ORDER BY d.data_fim ASC LIMIT 5
          ) x
        ), '[]'::jsonb)
      ),
      'tarefas', jsonb_build_object(
        'abertas', (SELECT COUNT(*)::int FROM public.tarefas t WHERE t.status <> 'concluida'),
        'atrasadas', (SELECT COUNT(*)::int FROM public.tarefas t
                       WHERE t.status <> 'concluida' AND t.prazo IS NOT NULL AND t.prazo < v_hoje)
      ),
      'comercial', jsonb_build_object(
        'leads_novos', (SELECT COUNT(*)::int FROM public.leads l
                         WHERE l.deleted_at IS NULL
                           AND (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_ant_ini AND v_ant_fim),
        'leads_convertidos', (SELECT COUNT(*)::int FROM public.leads l
                               WHERE l.deleted_at IS NULL
                                 AND (l.convertido_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_ant_ini AND v_ant_fim),
        'propostas_criadas', (SELECT COUNT(*)::int FROM public.propostas pr
                               WHERE pr.deleted_at IS NULL
                                 AND (pr.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_ant_ini AND v_ant_fim),
        'propostas_aguardando', (SELECT COUNT(*)::int FROM public.propostas pr
                                  WHERE pr.deleted_at IS NULL AND pr.status = 'enviada'
                                    AND (pr.validade IS NULL OR pr.validade >= v_hoje)),
        'propostas_vencem_na_semana', (SELECT COUNT(*)::int FROM public.propostas pr
                                        WHERE pr.deleted_at IS NULL AND pr.status = 'enviada'
                                          AND pr.validade BETWEEN v_hoje AND v_domingo)
      ),
      'financeiro', jsonb_build_object(
        'recebido_semana_passada', (SELECT COALESCE(ROUND(SUM(r.valor), 2), 0)::float8 FROM public.receitas r
                                     WHERE r.deleted_at IS NULL AND r.status = 'Recebido'
                                       AND COALESCE(r.data_recebimento, r.data_vencimento) BETWEEN v_ant_ini AND v_ant_fim),
        'pago_semana_passada', (SELECT COALESCE(ROUND(SUM(d.valor), 2), 0)::float8 FROM public.despesas d
                                 WHERE d.deleted_at IS NULL AND d.status = 'Pago'
                                   AND COALESCE(d.data_pagamento, d.data_vencimento) BETWEEN v_ant_ini AND v_ant_fim),
        'receber_vencido', jsonb_build_object(
          'quantidade', (SELECT COUNT(*)::int FROM public.receitas r
                          WHERE r.deleted_at IS NULL AND r.status IN ('Pendente', 'Atrasado') AND r.data_vencimento < v_hoje),
          'total', (SELECT COALESCE(ROUND(SUM(r.valor), 2), 0)::float8 FROM public.receitas r
                     WHERE r.deleted_at IS NULL AND r.status IN ('Pendente', 'Atrasado') AND r.data_vencimento < v_hoje)
        ),
        'receber_na_semana', (SELECT COALESCE(ROUND(SUM(r.valor), 2), 0)::float8 FROM public.receitas r
                               WHERE r.deleted_at IS NULL AND r.status = 'Pendente'
                                 AND r.data_vencimento BETWEEN v_hoje AND v_domingo),
        'pagar_vencido', jsonb_build_object(
          'quantidade', (SELECT COUNT(*)::int FROM public.despesas d
                          WHERE d.deleted_at IS NULL AND d.status IN ('Pendente', 'Atrasado') AND d.data_vencimento < v_hoje),
          'total', (SELECT COALESCE(ROUND(SUM(d.valor), 2), 0)::float8 FROM public.despesas d
                     WHERE d.deleted_at IS NULL AND d.status IN ('Pendente', 'Atrasado') AND d.data_vencimento < v_hoje)
        ),
        'pagar_na_semana', (SELECT COALESCE(ROUND(SUM(d.valor), 2), 0)::float8 FROM public.despesas d
                             WHERE d.deleted_at IS NULL AND d.status = 'Pendente'
                               AND d.data_vencimento BETWEEN v_hoje AND v_domingo)
      ),
      'obras', jsonb_build_object(
        'em_andamento', (SELECT COUNT(*)::int FROM public.obras o WHERE o.deleted_at IS NULL AND o.status = 'em_andamento'),
        'atrasadas', (SELECT COUNT(*)::int FROM public.obras o
                       WHERE o.deleted_at IS NULL AND o.status <> 'concluida'
                         AND o.data_fim_prevista IS NOT NULL AND o.data_fim_prevista < v_hoje)
      )
    ) INTO v_result;

    RETURN v_result;
  END IF;

  -- Escopo pessoa: tudo filtrado pelo vínculo da pessoa com o trabalho.
  SELECT ps.id INTO v_pessoa
    FROM public.pessoas ps
   WHERE ps.profile_id = v_uid AND ps.deleted_at IS NULL
   LIMIT 1;
  SELECT NULLIF(btrim(pf.first_name), '') INTO v_nome FROM public.profiles pf WHERE pf.id = v_uid;

  SELECT jsonb_build_object(
    'escopo', 'pessoa',
    'semana_inicio', v_semana,
    'hoje', v_hoje,
    'semana_passada', jsonb_build_object('inicio', v_ant_ini, 'fim', v_ant_fim),
    'nome', v_nome,
    'sem_vinculo', v_pessoa IS NULL,
    'tarefas', jsonb_build_object(
      'abertas', (SELECT COUNT(*)::int FROM public.tarefas t
                   WHERE v_pessoa IS NOT NULL AND t.status <> 'concluida'
                     AND (t.responsavel_id = v_pessoa
                          OR EXISTS (SELECT 1 FROM public.tarefa_responsaveis tr
                                      WHERE tr.tarefa_id = t.id AND tr.pessoa_id = v_pessoa))),
      'atrasadas', (SELECT COUNT(*)::int FROM public.tarefas t
                     WHERE v_pessoa IS NOT NULL AND t.status <> 'concluida'
                       AND t.prazo IS NOT NULL AND t.prazo < v_hoje
                       AND (t.responsavel_id = v_pessoa
                            OR EXISTS (SELECT 1 FROM public.tarefa_responsaveis tr
                                        WHERE tr.tarefa_id = t.id AND tr.pessoa_id = v_pessoa))),
      'na_semana', (SELECT COUNT(*)::int FROM public.tarefas t
                     WHERE v_pessoa IS NOT NULL AND t.status <> 'concluida'
                       AND t.prazo BETWEEN v_hoje AND v_domingo
                       AND (t.responsavel_id = v_pessoa
                            OR EXISTS (SELECT 1 FROM public.tarefa_responsaveis tr
                                        WHERE tr.tarefa_id = t.id AND tr.pessoa_id = v_pessoa))),
      'lista', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('titulo', x.titulo, 'projeto', x.projeto, 'prazo', x.prazo) ORDER BY x.prazo)
        FROM (
          SELECT t.titulo, pj.nome AS projeto, t.prazo
          FROM public.tarefas t
          LEFT JOIN public.projetos pj ON pj.id = t.projeto_id
          WHERE v_pessoa IS NOT NULL AND t.status <> 'concluida'
            AND t.prazo IS NOT NULL AND t.prazo <= v_domingo
            AND (t.responsavel_id = v_pessoa
                 OR EXISTS (SELECT 1 FROM public.tarefa_responsaveis tr
                             WHERE tr.tarefa_id = t.id AND tr.pessoa_id = v_pessoa))
          ORDER BY t.prazo ASC LIMIT 5
        ) x
      ), '[]'::jsonb)
    ),
    'disciplinas', jsonb_build_object(
      'abertas', (SELECT COUNT(*)::int
                    FROM public.projeto_disciplinas d
                    JOIN public.projeto_disciplina_responsaveis r ON r.projeto_disciplina_id = d.id AND r.pessoa_id = v_pessoa
                    JOIN public.projetos p ON p.id = d.projeto_id
                   WHERE v_pessoa IS NOT NULL AND p.deleted_at IS NULL AND p.status::text NOT IN ('Concluído', 'Cancelado')
                     AND COALESCE(d.status, 'pendente') <> 'concluida'),
      'atrasadas', (SELECT COUNT(*)::int
                      FROM public.projeto_disciplinas d
                      JOIN public.projeto_disciplina_responsaveis r ON r.projeto_disciplina_id = d.id AND r.pessoa_id = v_pessoa
                      JOIN public.projetos p ON p.id = d.projeto_id
                     WHERE v_pessoa IS NOT NULL AND p.deleted_at IS NULL AND p.status::text NOT IN ('Concluído', 'Cancelado')
                       AND COALESCE(d.status, 'pendente') <> 'concluida'
                       AND d.data_fim IS NOT NULL AND d.data_fim < v_hoje),
      'na_semana', (SELECT COUNT(*)::int
                      FROM public.projeto_disciplinas d
                      JOIN public.projeto_disciplina_responsaveis r ON r.projeto_disciplina_id = d.id AND r.pessoa_id = v_pessoa
                      JOIN public.projetos p ON p.id = d.projeto_id
                     WHERE v_pessoa IS NOT NULL AND p.deleted_at IS NULL AND p.status::text NOT IN ('Concluído', 'Cancelado')
                       AND COALESCE(d.status, 'pendente') <> 'concluida'
                       AND d.data_fim BETWEEN v_hoje AND v_domingo),
      'concluidas_semana_passada', (SELECT COUNT(*)::int
                                      FROM public.projeto_disciplinas d
                                      JOIN public.projeto_disciplina_responsaveis r ON r.projeto_disciplina_id = d.id AND r.pessoa_id = v_pessoa
                                      JOIN public.projetos p ON p.id = d.projeto_id
                                     WHERE v_pessoa IS NOT NULL AND p.deleted_at IS NULL
                                       AND d.data_fim_real BETWEEN v_ant_ini AND v_ant_fim),
      'lista', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('disciplina', x.disciplina, 'projeto', x.projeto, 'prazo', x.data_fim) ORDER BY x.data_fim)
        FROM (
          SELECT COALESCE(NULLIF(btrim(d.nome), ''), 'Sem nome') AS disciplina, p.nome AS projeto, d.data_fim
          FROM public.projeto_disciplinas d
          JOIN public.projeto_disciplina_responsaveis r ON r.projeto_disciplina_id = d.id AND r.pessoa_id = v_pessoa
          JOIN public.projetos p ON p.id = d.projeto_id
          WHERE v_pessoa IS NOT NULL AND p.deleted_at IS NULL AND p.status::text NOT IN ('Concluído', 'Cancelado')
            AND COALESCE(d.status, 'pendente') <> 'concluida'
            AND d.data_fim IS NOT NULL AND d.data_fim <= v_domingo
          ORDER BY d.data_fim ASC LIMIT 5
        ) x
      ), '[]'::jsonb)
    ),
    'projetos', jsonb_build_object(
      'envolvido_em', (SELECT COUNT(DISTINCT p.id)::int
                         FROM public.projeto_disciplinas d
                         JOIN public.projeto_disciplina_responsaveis r ON r.projeto_disciplina_id = d.id AND r.pessoa_id = v_pessoa
                         JOIN public.projetos p ON p.id = d.projeto_id
                        WHERE v_pessoa IS NOT NULL AND p.deleted_at IS NULL AND p.status::text NOT IN ('Concluído', 'Cancelado'))
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

COMMENT ON FUNCTION public.get_resumo_semanal_fatos() IS
  'SPEC 121: fatos da semana para o resumo do Início. SECURITY INVOKER (RLS de quem chama). Escopo empresa só para can_view_financeiro(); os demais recebem só o que têm como responsável (filtro explícito, porque tarefas são visíveis à empresa inteira).';

REVOKE ALL ON FUNCTION public.get_resumo_semanal_fatos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_resumo_semanal_fatos() TO authenticated;

-- 3. Leitura do resumo da semana ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_resumo_semanal()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid     uuid := auth.uid();
  v_semana  date := date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo')::date)::date;
  v_escopo  text := CASE WHEN public.can_view_financeiro() THEN 'empresa' ELSE 'pessoa' END;
  v_row     public.resumos_semanais%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado' USING ERRCODE = '28000';
  END IF;

  -- O RLS já limita ao escopo permitido; o filtro explícito só escolhe a linha certa.
  SELECT * INTO v_row
    FROM public.resumos_semanais r
   WHERE r.empresa_id = public.get_user_empresa_id()
     AND r.escopo = v_escopo
     AND r.semana_inicio = v_semana
     AND (v_escopo = 'empresa' OR r.user_id = v_uid)
   LIMIT 1;

  RETURN jsonb_build_object(
    'escopo', v_escopo,
    'semana_inicio', v_semana,
    'resumo', CASE WHEN v_row.id IS NULL THEN NULL ELSE jsonb_build_object(
      'conteudo', v_row.conteudo,
      'gerado_em', v_row.updated_at
    ) END
  );
END;
$fn$;

COMMENT ON FUNCTION public.get_resumo_semanal() IS
  'SPEC 121: resumo da semana corrente no escopo que cabe a quem chama (empresa para can_view_financeiro, pessoa para os demais). resumo nulo = ainda não gerado.';

REVOKE ALL ON FUNCTION public.get_resumo_semanal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_resumo_semanal() TO authenticated;
