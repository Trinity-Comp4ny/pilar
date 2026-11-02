-- SPEC 148: cobrança por e-mail com escada e rascunho pronto para aprovar.
--
-- O agente de acompanhamento (SPEC 146) deixa de só avisar "parcela vencida": para cada parcela
-- a receber ele prepara o e-mail da etapa devida e coloca na fila de pendências. O usuário
-- revisa, edita e aprova; nada sai sem o clique (função cobranca-enviar).
--
-- Escada por parcela (dias em relação ao vencimento):
--   etapa 1 lembrete  (3 dias antes)   etapa 2 aviso   (1 dia depois)
--   etapa 3 direta    (7 dias depois)  etapa 4 firme   (15 dias depois)
--   30 dias depois: sem e-mail, o agente sugere ligar ou negociar (pendência cobranca_ligar)
-- Parcela muito atrasada sem nenhum contato recebe só a etapa devida hoje, nunca quatro e-mails.
-- Intervalo mínimo de 5 dias entre cobranças da mesma parcela.
--
-- O texto é montado por regra: os fatos (valor, datas, parcela, histórico de pagamento do cliente)
-- vêm do banco e o usuário edita a abertura antes de enviar (ADR 0065).

-- ---------------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------------
CREATE TABLE public.cobrancas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  receita_id         uuid NOT NULL REFERENCES public.receitas(id) ON DELETE CASCADE,
  etapa              smallint NOT NULL CHECK (etapa BETWEEN 1 AND 4),
  status             text NOT NULL DEFAULT 'rascunho'
                       CHECK (status IN ('rascunho', 'enviada', 'recusada', 'externa', 'cancelada')),
  destinatario_email text NOT NULL,
  assunto            text NOT NULL,
  abertura           text NOT NULL,
  fatos              jsonb NOT NULL DEFAULT '{}'::jsonb,
  criada_em          timestamptz NOT NULL DEFAULT now(),
  decidida_em        timestamptz,
  decidida_por       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (receita_id, etapa)
);

COMMENT ON TABLE public.cobrancas IS
  'SPEC 148. Uma linha por (parcela, etapa da escada). rascunho = preparada pelo agente; enviada = aprovada e enviada; externa = "já cobrei por fora"; recusada = o usuário não quer essa etapa; cancelada = parcela paga ou etapa superada.';
COMMENT ON COLUMN public.cobrancas.fatos IS
  'Snapshot dos fatos usados no texto (valor, vencimento, dias, parcela, projeto, cliente, histórico). Nada daqui vem de modelo.';

CREATE INDEX idx_cobrancas_receita ON public.cobrancas (receita_id, status);
CREATE INDEX idx_cobrancas_empresa_status ON public.cobrancas (empresa_id, status);
CREATE INDEX idx_cobrancas_decidida_por ON public.cobrancas (decidida_por);

ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY cobrancas_select ON public.cobrancas
  FOR SELECT TO authenticated USING (
    empresa_id = public.get_user_empresa_id()
    AND public.can_view_financeiro()
    AND public.user_has_feature('financeiro', 'viewer')
  );

-- Escrita só por função SECURITY DEFINER (cobranca_decidir) e pela edge function de envio.
REVOKE ALL ON public.cobrancas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cobrancas TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Texto da abertura, por etapa
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cobranca_montar_abertura(
  p_etapa        integer,
  p_cliente      text,
  p_ref          text,
  p_venc         date,
  p_dias         integer,
  p_media_atraso integer,
  p_contatos     text
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_venc  text := to_char(p_venc, 'DD/MM/YYYY');
  v_hist  text := '';
  v_prazo text := to_char(current_date + 3, 'DD/MM/YYYY');
BEGIN
  IF p_media_atraso IS NOT NULL AND p_media_atraso >= 1 AND p_etapa IN (2, 3) THEN
    v_hist := format('Nas parcelas anteriores, o pagamento chegou em média %s dia(s) após o vencimento. ', p_media_atraso);
  END IF;

  RETURN CASE p_etapa
    WHEN 1 THEN format(
      'Olá, %s. Passando para lembrar que %s vence em %s. Os dados para pagamento estão abaixo. Se o pagamento já está programado, desconsidere esta mensagem.',
      p_cliente, p_ref, v_venc)
    WHEN 2 THEN format(
      'Olá, %s. %s, com vencimento em %s, ainda não consta como paga. %sSe o pagamento já foi feito, envie o comprovante para conferirmos.',
      p_cliente, initcap(left(p_ref, 1)) || substr(p_ref, 2), v_venc, v_hist)
    WHEN 3 THEN format(
      'Olá, %s. %s venceu em %s e está há %s dia(s) em aberto. %sPedimos a confirmação da data de pagamento. Se houver algum impedimento, podemos combinar uma nova data.',
      p_cliente, initcap(left(p_ref, 1)) || substr(p_ref, 2), v_venc, p_dias, v_hist)
    ELSE format(
      'Olá, %s. Retomamos a cobrança de %s, vencida em %s e em aberto há %s dia(s)%s. Precisamos da confirmação da data de pagamento até %s. Se houver dificuldade, responda este e-mail para negociarmos.',
      p_cliente, p_ref, v_venc, p_dias,
      CASE WHEN coalesce(p_contatos, '') <> '' THEN ', mesmo após nossos contatos de ' || p_contatos ELSE '' END,
      v_prazo)
  END;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Gera (e cancela) rascunhos. Roda dentro da varredura de pendências.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cobranca_gerar_rascunhos(p_empresa uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec         record;
  v_criadas   integer := 0;
  v_linhas    integer;
  v_media     integer;
  v_n         integer;
  v_contatos  text;
  v_ref       text;
  v_ref_curto text;
  v_assunto   text;
BEGIN
  -- Parcela paga ou excluída: rascunho aberto perde o sentido.
  UPDATE public.cobrancas c
     SET status = 'cancelada', decidida_em = now()
    FROM public.receitas r
   WHERE r.id = c.receita_id AND c.status = 'rascunho'
     AND (r.deleted_at IS NOT NULL OR r.status NOT IN ('Pendente', 'Atrasado'))
     AND (p_empresa IS NULL OR c.empresa_id = p_empresa);

  -- Rascunho de etapa já superada pela data (parcela envelheceu): cancela, o novo entra abaixo.
  UPDATE public.cobrancas c
     SET status = 'cancelada', decidida_em = now()
    FROM public.receitas r
   WHERE r.id = c.receita_id AND c.status = 'rascunho'
     AND c.etapa < CASE
           WHEN current_date - r.data_vencimento >= 15 THEN 4
           WHEN current_date - r.data_vencimento >= 7 THEN 3
           WHEN current_date - r.data_vencimento >= 1 THEN 2
           ELSE 1 END
     AND (p_empresa IS NULL OR c.empresa_id = p_empresa);

  FOR rec IN
    SELECT r.id AS receita_id, r.empresa_id, r.descricao, r.valor, r.data_vencimento,
           r.parcela_numero, r.parcela_total, r.cliente_id,
           c.nome AS cliente_nome, c.email AS cliente_email, pr.nome AS projeto_nome,
           (current_date - r.data_vencimento) AS dias,
           CASE
             WHEN current_date - r.data_vencimento >= 15 THEN 4
             WHEN current_date - r.data_vencimento >= 7 THEN 3
             WHEN current_date - r.data_vencimento >= 1 THEN 2
             WHEN current_date - r.data_vencimento >= -3 THEN 1
           END AS etapa
    FROM public.receitas r
    JOIN public.clientes c ON c.id = r.cliente_id
    JOIN public.empresas e ON e.id = r.empresa_id
    LEFT JOIN public.projetos pr ON pr.id = r.projeto_id
    WHERE r.deleted_at IS NULL AND r.status IN ('Pendente', 'Atrasado') AND r.data_vencimento IS NOT NULL
      AND (p_empresa IS NULL OR r.empresa_id = p_empresa)
      AND c.email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      AND coalesce(e.email, '') <> ''
      AND current_date - r.data_vencimento >= -3
      -- etapa 1 só antes (ou no dia) do vencimento e com a parcela ainda pendente
      AND NOT (current_date - r.data_vencimento <= 0 AND r.status <> 'Pendente')
      AND NOT EXISTS (
        SELECT 1 FROM public.cobrancas x
        WHERE x.receita_id = r.id
          AND (
            (x.status IN ('enviada', 'externa', 'recusada') AND x.etapa >= CASE
               WHEN current_date - r.data_vencimento >= 15 THEN 4
               WHEN current_date - r.data_vencimento >= 7 THEN 3
               WHEN current_date - r.data_vencimento >= 1 THEN 2
               ELSE 1 END)
            OR (x.status IN ('enviada', 'externa') AND x.decidida_em > now() - interval '5 days')
          )
      )
  LOOP
    SELECT round(avg(h.atraso))::integer, count(*)::integer INTO v_media, v_n
    FROM (
      SELECT (x.data_recebimento - x.data_vencimento) AS atraso
      FROM public.receitas x
      WHERE x.cliente_id = rec.cliente_id AND x.empresa_id = rec.empresa_id AND x.deleted_at IS NULL
        AND x.status = 'Recebido' AND x.data_recebimento IS NOT NULL AND x.data_vencimento IS NOT NULL
      ORDER BY x.data_recebimento DESC LIMIT 3
    ) h;
    IF coalesce(v_n, 0) < 2 THEN v_media := NULL; END IF;

    SELECT string_agg(to_char(x.decidida_em, 'DD/MM'), ' e ' ORDER BY x.decidida_em) INTO v_contatos
    FROM public.cobrancas x WHERE x.receita_id = rec.receita_id AND x.status IN ('enviada', 'externa');

    v_ref := CASE WHEN rec.parcela_total IS NOT NULL
                  THEN 'a parcela ' || rec.parcela_numero || ' de ' || rec.parcela_total
                  ELSE 'o pagamento "' || rec.descricao || '"' END
             || coalesce(' do projeto ' || rec.projeto_nome, '');
    v_ref_curto := CASE WHEN rec.parcela_total IS NOT NULL
                        THEN 'Parcela ' || rec.parcela_numero || ' de ' || rec.parcela_total
                             || coalesce(', ' || rec.projeto_nome, '')
                        ELSE rec.descricao END;
    v_assunto := CASE WHEN rec.etapa = 1
                      THEN 'Lembrete: ' || v_ref_curto || ' vence em ' || to_char(rec.data_vencimento, 'DD/MM')
                      ELSE v_ref_curto || ', vencida em ' || to_char(rec.data_vencimento, 'DD/MM') END;

    INSERT INTO public.cobrancas (empresa_id, receita_id, etapa, destinatario_email, assunto, abertura, fatos)
    VALUES (
      rec.empresa_id, rec.receita_id, rec.etapa, lower(trim(rec.cliente_email)), v_assunto,
      public.cobranca_montar_abertura(rec.etapa, rec.cliente_nome, v_ref, rec.data_vencimento, rec.dias, v_media, v_contatos),
      jsonb_build_object(
        'valor', rec.valor, 'vencimento', rec.data_vencimento, 'dias', rec.dias,
        'parcela_numero', rec.parcela_numero, 'parcela_total', rec.parcela_total,
        'projeto_nome', rec.projeto_nome, 'cliente_nome', rec.cliente_nome,
        'media_atraso_historico', v_media, 'contatos_anteriores', v_contatos)
    )
    ON CONFLICT (receita_id, etapa) DO NOTHING;
    GET DIAGNOSTICS v_linhas = ROW_COUNT;
    v_criadas := v_criadas + v_linhas;
  END LOOP;

  RETURN v_criadas;
END;
$$;

REVOKE ALL ON FUNCTION public.cobranca_gerar_rascunhos(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cobranca_gerar_rascunhos(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Pendências que nascem da cobrança
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agente_pendencias_detectar_cobranca(p_empresa uuid DEFAULT NULL)
RETURNS TABLE (
  empresa_id      uuid,
  tipo            text,
  area            text,
  severidade      text,
  chave           text,
  referencia_tipo text,
  referencia_id   uuid,
  projeto_id      uuid,
  titulo          text,
  detalhe         text,
  dados           jsonb,
  link            text,
  acao_sugerida   text,
  vence_em        date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Rascunho pronto para aprovar
  SELECT c.empresa_id, 'cobranca_pronta'::text, 'financeiro'::text,
    CASE WHEN c.etapa >= 3 THEN 'high' ELSE 'medium' END,
    'cobranca_pronta:' || c.receita_id::text, 'receita'::text, c.receita_id, r.projeto_id,
    'Cobrança pronta: ' || r.descricao,
    CASE WHEN current_date > r.data_vencimento
         THEN 'Venceu em ' || to_char(r.data_vencimento, 'DD/MM/YYYY') || ', há ' || (current_date - r.data_vencimento) || ' dia(s)'
         ELSE 'Vence em ' || to_char(r.data_vencimento, 'DD/MM/YYYY') END
      || coalesce(' · ' || (c.fatos->>'cliente_nome'), '') || ' · etapa ' || c.etapa || ' de 4',
    jsonb_build_object(
      'cobranca_id', c.id, 'etapa', c.etapa, 'etapa_total', 4,
      'destinatario', c.destinatario_email, 'assunto', c.assunto,
      'valor', r.valor, 'vencimento', r.data_vencimento, 'dias', current_date - r.data_vencimento,
      'parcela_numero', r.parcela_numero, 'parcela_total', r.parcela_total,
      'projeto_nome', c.fatos->>'projeto_nome', 'cliente_nome', c.fatos->>'cliente_nome'),
    '/gestao/financeiro'::text, 'enviar_cobranca'::text, r.data_vencimento
  FROM public.cobrancas c
  JOIN public.receitas r ON r.id = c.receita_id AND r.deleted_at IS NULL AND r.status IN ('Pendente', 'Atrasado')
  WHERE c.status = 'rascunho' AND (p_empresa IS NULL OR c.empresa_id = p_empresa)

  UNION ALL
  -- Cliente sem e-mail válido: o agente não consegue cobrar
  SELECT r.empresa_id, 'cobranca_sem_email', 'financeiro', 'medium',
    'cobranca_sem_email:' || cl.id::text, 'cliente', cl.id, NULL::uuid,
    'Cadastre o e-mail de ' || cl.nome || ' para o agente cobrar',
    count(*) || ' parcela(s) vencida(s) ou a vencer em 3 dias, sem e-mail válido do cliente',
    jsonb_build_object('cliente_nome', cl.nome, 'parcelas', count(*), 'valor_total', sum(r.valor)),
    '/gestao/clientes', NULL, min(r.data_vencimento)
  FROM public.receitas r
  JOIN public.clientes cl ON cl.id = r.cliente_id
  WHERE r.deleted_at IS NULL AND r.status IN ('Pendente', 'Atrasado') AND r.data_vencimento IS NOT NULL
    AND current_date - r.data_vencimento >= -3
    AND (cl.email IS NULL OR cl.email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
    AND (p_empresa IS NULL OR r.empresa_id = p_empresa)
  GROUP BY r.empresa_id, cl.id, cl.nome

  UNION ALL
  -- Escritório sem e-mail cadastrado: nenhuma cobrança sai
  SELECT e.id, 'cobranca_sem_email_empresa', 'financeiro', 'high',
    'cobranca_sem_email_empresa:' || e.id::text, 'empresa', e.id, NULL::uuid,
    'Cadastre o e-mail do escritório para enviar cobranças',
    'As respostas dos clientes voltam para esse e-mail; sem ele o agente não prepara cobranças',
    jsonb_build_object('parcelas', count(*)),
    '/company', NULL, min(r.data_vencimento)
  FROM public.empresas e
  JOIN public.receitas r ON r.empresa_id = e.id
  JOIN public.clientes cl ON cl.id = r.cliente_id
  WHERE coalesce(e.email, '') = ''
    AND r.deleted_at IS NULL AND r.status IN ('Pendente', 'Atrasado') AND r.data_vencimento IS NOT NULL
    AND current_date - r.data_vencimento >= -3
    AND cl.email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND (p_empresa IS NULL OR e.id = p_empresa)
  GROUP BY e.id

  UNION ALL
  -- 30 dias depois: e-mail já não resolve, sugere ligar ou negociar
  SELECT r.empresa_id, 'cobranca_ligar', 'financeiro', 'high',
    'cobranca_ligar:' || r.id::text, 'receita', r.id, r.projeto_id,
    'Ligue ou negocie: ' || r.descricao,
    'Em aberto há ' || (current_date - r.data_vencimento) || ' dia(s) mesmo após cobrança. Combine uma data de pagamento por telefone.',
    jsonb_build_object('valor', r.valor, 'vencimento', r.data_vencimento, 'dias', current_date - r.data_vencimento,
      'parcela_numero', r.parcela_numero, 'parcela_total', r.parcela_total, 'cliente_nome', cl.nome,
      'cliente_contato', cl.contato),
    '/gestao/financeiro', NULL, r.data_vencimento
  FROM public.receitas r
  LEFT JOIN public.clientes cl ON cl.id = r.cliente_id
  WHERE r.deleted_at IS NULL AND r.status IN ('Pendente', 'Atrasado') AND r.data_vencimento IS NOT NULL
    AND current_date - r.data_vencimento >= 30
    AND EXISTS (SELECT 1 FROM public.cobrancas x WHERE x.receita_id = r.id AND x.status IN ('enviada', 'externa'))
    AND (p_empresa IS NULL OR r.empresa_id = p_empresa);
$$;

REVOKE ALL ON FUNCTION public.agente_pendencias_detectar_cobranca(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agente_pendencias_detectar_cobranca(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Varredura passa a gerar rascunhos, juntar as regras de cobrança e anotar o histórico
--    (substitui a versão da SPEC 146)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agente_pendencias_varrer(p_empresa uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inicio    timestamptz := clock_timestamp();
  v_achadas   integer;
  v_fechadas  integer;
  v_reabertas integer;
  v_rascunhos integer;
BEGIN
  v_rascunhos := public.cobranca_gerar_rascunhos(p_empresa);

  INSERT INTO public.agente_pendencias AS ap (
    empresa_id, tipo, area, severidade, chave, referencia_tipo, referencia_id, projeto_id,
    titulo, detalhe, dados, link, acao_sugerida, vence_em, primeira_deteccao, ultima_deteccao
  )
  SELECT d.empresa_id, d.tipo, d.area, d.severidade, d.chave, d.referencia_tipo, d.referencia_id, d.projeto_id,
         d.titulo, d.detalhe, d.dados, d.link, d.acao_sugerida, d.vence_em, v_inicio, v_inicio
  FROM (
    -- Parcela com cobrança pronta aparece como "cobrança pronta", não também como atrasada.
    SELECT g.* FROM public.agente_pendencias_detectar(p_empresa) g
    WHERE NOT (
      g.tipo IN ('recebimento_atrasado', 'a_receber_proximo')
      AND EXISTS (SELECT 1 FROM public.cobrancas c WHERE c.receita_id = g.referencia_id AND c.status = 'rascunho')
    )
    UNION ALL
    SELECT k.* FROM public.agente_pendencias_detectar_cobranca(p_empresa) k
  ) d
  ON CONFLICT (empresa_id, chave) DO UPDATE SET
    area = EXCLUDED.area,
    severidade = EXCLUDED.severidade,
    projeto_id = EXCLUDED.projeto_id,
    titulo = EXCLUDED.titulo,
    detalhe = EXCLUDED.detalhe,
    dados = EXCLUDED.dados,
    link = EXCLUDED.link,
    acao_sugerida = EXCLUDED.acao_sugerida,
    vence_em = EXCLUDED.vence_em,
    ultima_deteccao = v_inicio,
    status = CASE WHEN ap.status = 'resolvida' THEN 'aberta' ELSE ap.status END,
    primeira_deteccao = CASE WHEN ap.status = 'resolvida' THEN v_inicio ELSE ap.primeira_deteccao END,
    adiada_ate = CASE WHEN ap.status = 'resolvida' THEN NULL ELSE ap.adiada_ate END,
    resolvida_em = NULL,
    resolvida_motivo = NULL;
  GET DIAGNOSTICS v_achadas = ROW_COUNT;

  -- Parcela atrasada que já foi cobrada diz quando e em que etapa.
  UPDATE public.agente_pendencias ap
     SET detalhe = ap.detalhe || ' · Cobrada em ' || to_char(l.decidida_em, 'DD/MM') || ' (etapa ' || l.etapa || ' de 4)',
         dados = ap.dados || jsonb_build_object(
           'ultima_cobranca_em', l.decidida_em, 'ultima_cobranca_etapa', l.etapa, 'ultima_cobranca_status', l.status)
    FROM (
      SELECT DISTINCT ON (receita_id) receita_id, etapa, status, decidida_em
      FROM public.cobrancas WHERE status IN ('enviada', 'externa') AND decidida_em IS NOT NULL
      ORDER BY receita_id, decidida_em DESC
    ) l
   WHERE ap.tipo = 'recebimento_atrasado' AND ap.referencia_id = l.receita_id
     AND ap.ultima_deteccao = v_inicio
     AND (p_empresa IS NULL OR ap.empresa_id = p_empresa);

  UPDATE public.agente_pendencias
     SET status = 'aberta', adiada_ate = NULL
   WHERE status = 'adiada' AND adiada_ate <= current_date
     AND (p_empresa IS NULL OR empresa_id = p_empresa);
  GET DIAGNOSTICS v_reabertas = ROW_COUNT;

  UPDATE public.agente_pendencias
     SET status = 'resolvida', resolvida_em = now(), resolvida_motivo = 'condicao_sumiu'
   WHERE status IN ('aberta', 'adiada', 'dispensada') AND ultima_deteccao < v_inicio
     AND (p_empresa IS NULL OR empresa_id = p_empresa);
  GET DIAGNOSTICS v_fechadas = ROW_COUNT;

  RETURN jsonb_build_object('achadas', v_achadas, 'fechadas', v_fechadas, 'reabertas', v_reabertas,
                            'rascunhos_de_cobranca', v_rascunhos);
END;
$$;

REVOKE ALL ON FUNCTION public.agente_pendencias_varrer(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agente_pendencias_varrer(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Recusar ou marcar "já cobrei por fora" (o envio é a edge function cobranca-enviar)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cobranca_decidir(p_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa uuid;
BEGIN
  IF p_status NOT IN ('recusada', 'externa') THEN
    RAISE EXCEPTION 'status deve ser recusada ou externa' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.can_view_financeiro() AND public.user_has_feature('financeiro', 'editor')) THEN
    RAISE EXCEPTION 'sem permissão para decidir cobrança' USING ERRCODE = '42501';
  END IF;

  UPDATE public.cobrancas
     SET status = p_status, decidida_em = now(), decidida_por = auth.uid()
   WHERE id = p_id AND status = 'rascunho' AND empresa_id = public.get_user_empresa_id()
  RETURNING empresa_id INTO v_empresa;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cobrança não encontrada ou já decidida' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.agente_pendencias_varrer(v_empresa);
END;
$$;

REVOKE ALL ON FUNCTION public.cobranca_decidir(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cobranca_decidir(uuid, text) TO authenticated;
