-- SPEC 098 Fase 3 (ADR 0043): lista empresas em modo somente leitura pós-trial
-- pro ultra-admin, separado de ultra_admin_listar_trials() (que só cobre
-- status='trialing') -- retenção é um estágio de vida diferente do trial.
-- Mitigação de risco do ADR 0043: ultra-admin dispara a exclusão
-- manualmente numa empresa isolada antes do primeiro disparo automático do
-- cron valer.

CREATE FUNCTION public.ultra_admin_listar_retencao()
RETURNS TABLE (
  empresa_id       uuid,
  empresa_nome     text,
  leitura_desde    timestamptz,
  dias_em_leitura  integer,
  preservar_dados  boolean,
  aviso_60d_enviado boolean,
  aviso_85d_enviado boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Só ultra_admin pode listar retenção' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.nome,
    e.leitura_desde,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - e.leitura_desde)) / 86400))::integer,
    e.preservar_dados,
    (e.retencao_aviso_60d_sent_at IS NOT NULL),
    (e.retencao_aviso_85d_sent_at IS NOT NULL)
  FROM public.empresas e
  WHERE e.leitura_desde IS NOT NULL
    AND e.deleted_at IS NULL
  ORDER BY e.leitura_desde ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.ultra_admin_listar_retencao() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ultra_admin_listar_retencao() TO authenticated;

COMMENT ON FUNCTION public.ultra_admin_listar_retencao() IS
  'SPEC 098 Fase 3 (ADR 0043): lista empresas em modo somente leitura pós-trial pro ultra-admin (dias em leitura, preservar_dados, avisos já enviados). Só ultra_admin executa.';
