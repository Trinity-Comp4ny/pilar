-- SPEC 098, requisito 18/19: ultra-admin estende o trial e marca "preservar
-- dados" (suspende o relógio de retenção pós-trial da Fase 3). "Liberar
-- trial completo" não ganha RPC própria: é exatamente
-- ultra_admin_definir_nivel_override(empresa_id, 'ouro', motivo), já
-- existente (20260923000000) — o front só adiciona um atalho pra ele.

BEGIN;

ALTER TABLE public.pilar_subscriptions
  ADD COLUMN trial_estendido_motivo text,
  ADD COLUMN trial_estendido_por    uuid REFERENCES auth.users(id),
  ADD COLUMN trial_estendido_em     timestamptz;

ALTER TABLE public.empresas
  ADD COLUMN preservar_dados         boolean NOT NULL DEFAULT false,
  ADD COLUMN preservar_dados_motivo  text,
  ADD COLUMN preservar_dados_por     uuid REFERENCES auth.users(id),
  ADD COLUMN preservar_dados_em      timestamptz;

CREATE OR REPLACE FUNCTION public.ultra_admin_estender_trial(
  p_empresa_id uuid,
  p_novo_trial_ends_at timestamptz,
  p_motivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Só ultra_admin pode estender o trial' USING ERRCODE = '42501';
  END IF;

  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Informe o motivo da extensão' USING ERRCODE = '22023';
  END IF;

  IF p_novo_trial_ends_at <= now() THEN
    RAISE EXCEPTION 'A nova data precisa ser no futuro' USING ERRCODE = '22023';
  END IF;

  UPDATE public.pilar_subscriptions
  SET trial_ends_at = p_novo_trial_ends_at,
      trial_estendido_motivo = p_motivo,
      trial_estendido_por = auth.uid(),
      trial_estendido_em = now()
  WHERE empresa_id = p_empresa_id
    AND status = 'trialing';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada ou não está em trial' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ultra_admin_estender_trial(uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ultra_admin_estender_trial(uuid, timestamptz, text) TO authenticated;

COMMENT ON FUNCTION public.ultra_admin_estender_trial(uuid, timestamptz, text) IS
  'SPEC 098: ultra-admin move trial_ends_at pra frente, com motivo auditado. Só empresa trialing, só ultra_admin executa.';

CREATE OR REPLACE FUNCTION public.ultra_admin_marcar_preservar_dados(
  p_empresa_id uuid,
  p_preservar boolean,
  p_motivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Só ultra_admin pode marcar preservar dados' USING ERRCODE = '42501';
  END IF;

  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Informe o motivo' USING ERRCODE = '22023';
  END IF;

  UPDATE public.empresas
  SET preservar_dados = p_preservar,
      preservar_dados_motivo = p_motivo,
      preservar_dados_por = auth.uid(),
      preservar_dados_em = now()
  WHERE id = p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ultra_admin_marcar_preservar_dados(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ultra_admin_marcar_preservar_dados(uuid, boolean, text) TO authenticated;

COMMENT ON FUNCTION public.ultra_admin_marcar_preservar_dados(uuid, boolean, text) IS
  'SPEC 098: liga/desliga preservar_dados (suspende o relógio de retenção pós-trial da Fase 3), com motivo auditado. Só ultra_admin executa.';

-- ultra_admin_listar_trials ganha preservar_dados e a data de extensão no
-- retorno (DROP + CREATE porque muda a assinatura de RETURNS TABLE).
DROP FUNCTION IF EXISTS public.ultra_admin_listar_trials();

CREATE FUNCTION public.ultra_admin_listar_trials()
RETURNS TABLE (
  empresa_id           uuid,
  empresa_nome         text,
  nivel                text,
  nivel_override       text,
  nivel_override_motivo text,
  documento_tipo       text,
  documento_verificacao text,
  razao_social         text,
  razao_social_divergente boolean,
  trial_ends_at        timestamptz,
  trial_estendido_motivo text,
  dias_restantes       integer,
  preservar_dados      boolean,
  projetos_ativos      integer,
  obras_ativas         integer,
  usuarios             integer,
  max_projetos         integer,
  max_obras            integer,
  max_usuarios         integer,
  tokens_gastos        bigint,
  tokens_total         bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Só ultra_admin pode listar trials' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.nome,
    public.nivel_confianca(e.id),
    e.nivel_override,
    e.nivel_override_motivo,
    e.documento_tipo,
    e.documento_verificacao,
    e.razao_social,
    (e.razao_social IS NOT NULL AND upper(trim(e.nome)) <> upper(trim(e.razao_social))),
    s.trial_ends_at,
    s.trial_estendido_motivo,
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (s.trial_ends_at - now())) / 86400))::integer,
    e.preservar_dados,
    (SELECT count(*)::integer FROM public.projetos p
       WHERE p.empresa_id = e.id AND p.deleted_at IS NULL AND p.exemplo = false
         AND p.status NOT IN ('Concluído', 'Cancelado')),
    (SELECT count(*)::integer FROM public.obras o
       WHERE o.empresa_id = e.id AND o.deleted_at IS NULL AND o.status <> 'concluida'),
    (SELECT count(*)::integer FROM public.profiles p WHERE p.empresa_id = e.id),
    l.max_projetos,
    l.max_obras,
    l.max_usuarios,
    GREATEST(0, COALESCE(l.tokens_total, 0) - COALESCE(sd.saldo_plano, 0)),
    l.tokens_total
  FROM public.empresas e
  JOIN public.pilar_subscriptions s ON s.empresa_id = e.id
  LEFT JOIN public.ai_token_saldo sd ON sd.empresa_id = e.id
  CROSS JOIN LATERAL public.limites_empresa(e.id) l
  WHERE s.status = 'trialing'
  ORDER BY s.trial_ends_at ASC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.ultra_admin_listar_trials() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ultra_admin_listar_trials() TO authenticated;

COMMENT ON FUNCTION public.ultra_admin_listar_trials() IS
  'SPEC 098: lista empresas trialing pro ultra-admin (nível, documento, uso, dias restantes, preservar_dados). Só ultra_admin executa.';

COMMIT;
