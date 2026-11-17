-- Bloqueio de escrita para empresa com assinatura suspensa (cancelada ou vencida).
--
-- Hoje só o front barra quem cancelou (PrivateRoute). Quem já estava logado ou
-- chama a API direto continuava gravando. Esta migration estende o trigger
-- generico do ADR 0042 (enforce_empresa_nao_leitura): alem de leitura_desde,
-- passa a recusar INSERT/UPDATE/DELETE de sessao authenticated quando a
-- assinatura esta suspensa. A regra espelha statusDeAcesso() em src/lib/cobranca.ts:
--   - 'expired'  -> suspensa
--   - 'canceled' -> suspensa so depois do fim do periodo pago (current_period_end)
--   - 'overdue'  -> NAO bloqueia (o front tambem nao bloqueia: so avisa)
--   - sem linha de assinatura -> nao bloqueia (empresa convidada antiga)

CREATE OR REPLACE FUNCTION public.empresa_assinatura_suspensa(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT s.status = 'expired'
            OR (s.status = 'canceled'
                AND (s.current_period_end IS NULL OR s.current_period_end <= now()))
       FROM public.pilar_subscriptions s
      WHERE s.empresa_id = p_empresa_id
      LIMIT 1),
    false
  );
$$;

COMMENT ON FUNCTION public.empresa_assinatura_suspensa(uuid) IS
  'true quando a assinatura da empresa esta expirada, ou cancelada com o periodo pago ja encerrado. Espelha statusDeAcesso() do front. Usada por enforce_empresa_nao_leitura.';

REVOKE ALL ON FUNCTION public.empresa_assinatura_suspensa(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_empresa_nao_leitura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := COALESCE(NEW.empresa_id, OLD.empresa_id);
  v_leitura    boolean;
BEGIN
  -- service_role/postgres passam direto (cron, ultra-admin, migration,
  -- reativacao, webhooks). A 2a condicao cobre excluir_empresa_retencao()
  -- chamada por ultra_admin (ver migration 20260936000000).
  IF auth.role() <> 'authenticated' OR current_setting('pilar.retencao_em_curso', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT (leitura_desde IS NOT NULL) INTO v_leitura
  FROM public.empresas WHERE id = v_empresa_id;

  IF v_leitura THEN
    RAISE EXCEPTION 'empresa_em_leitura' USING ERRCODE = 'P0001';
  END IF;

  IF public.empresa_assinatura_suspensa(v_empresa_id) THEN
    RAISE EXCEPTION 'empresa_assinatura_suspensa' USING ERRCODE = 'P0001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.enforce_empresa_nao_leitura() IS
  'ADR 0042: bloqueia INSERT/UPDATE/DELETE de sessao authenticated quando empresas.leitura_desde esta setado ou a assinatura esta suspensa (empresa_assinatura_suspensa). service_role/postgres passam direto.';

-- Fecha lacunas: tabelas com empresa_id criadas depois da migration 20260936000000
-- e que ficaram sem o trigger. Mesma allowlist de excecao; so cria onde falta.
DO $$
DECLARE
  v_tabela text;
BEGIN
  FOR v_tabela IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.column_name = 'empresa_id'
      AND c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN (
        'notificacoes', 'notificacao_preferencias', 'admin_audit_logs',
        'audit_logs', 'audit_logs_archive', 'data_deletion_requests',
        'data_export_requests', 'consentimentos_cobranca', 'terms_acceptances',
        'convites', 'email_envios', 'ai_token_ledger', 'ai_usage_logs',
        'ai_usage', 'pilar_subscriptions', 'empresas'
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_trigger g
        WHERE g.tgrelid = format('public.%I', c.table_name)::regclass
          AND g.tgname = 'trg_enforce_empresa_nao_leitura'
          AND NOT g.tgisinternal
      )
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_enforce_empresa_nao_leitura
         BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.enforce_empresa_nao_leitura()',
      v_tabela
    );
  END LOOP;
END $$;
