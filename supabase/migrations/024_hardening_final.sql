-- Migration 024: Hardening final
-- 1. Fixes no bucket portal-entregas (file size limit + mime types + cliente portal read)
-- 2. Validação de range em rpc_calcular_wip
-- 3. pg_cron schedule para audit_log_cleanup
-- 4. RPC guard_login_attempt (rate limit para login admin)

-- =============================================
-- 1. Storage — limite e mime types em portal-entregas
-- =============================================

UPDATE storage.buckets
SET
  file_size_limit = 52428800,  -- 50 MB por arquivo
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream'
  ]::text[]
WHERE id = 'portal-entregas';

-- =============================================
-- 2. Storage — permitir cliente portal (auth via token) ler arquivos
-- RPC devolve URL assinada temporária; policy não muda (continua authenticated-only)
-- =============================================

CREATE OR REPLACE FUNCTION public.get_portal_entrega_download_url(
  p_entrega_id UUID,
  p_token TEXT,
  p_expires_in_seconds INTEGER DEFAULT 300
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_account RECORD;
  v_entrega RECORD;
  v_token_hash TEXT;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT cliente_id, empresa_id
  INTO v_account
  FROM cliente_portal_accounts
  WHERE token_sessao = v_token_hash
    AND token_expira_em > NOW()
    AND ativo = TRUE;

  IF v_account IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  SELECT pe.empresa_id, pe.projeto_id, pe.arquivo_path, p.cliente_id AS projeto_cliente_id
  INTO v_entrega
  FROM portal_entregas pe
  JOIN projetos p ON p.id = pe.projeto_id
  WHERE pe.id = p_entrega_id;

  IF v_entrega IS NULL OR v_entrega.arquivo_path IS NULL THEN
    RAISE EXCEPTION 'Entrega não encontrada';
  END IF;

  -- Cliente só pode baixar arquivos de projetos do próprio cliente_id
  IF v_entrega.projeto_cliente_id != v_account.cliente_id
     OR v_entrega.empresa_id != v_account.empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Retorna path; edge function gera signed URL via service_role
  RETURN v_entrega.arquivo_path;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_portal_entrega_download_url(UUID, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_entrega_download_url(UUID, TEXT, INTEGER) TO anon, authenticated;

-- =============================================
-- 3. rpc_calcular_wip — validar range de p_mes/p_ano
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_calcular_wip(p_mes INTEGER, p_ano INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_projeto RECORD;
  v_horas NUMERIC;
  v_custo NUMERIC;
  v_faturado NUMERIC;
  v_recebido NUMERIC;
  v_custo_hora_fallback NUMERIC;
  v_fim_mes DATE;
  v_count INTEGER := 0;
BEGIN
  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mês inválido (1-12)';
  END IF;

  IF p_ano < 2000 OR p_ano > 2100 THEN
    RAISE EXCEPTION 'Ano inválido (2000-2100)';
  END IF;

  v_empresa_id := public.get_user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  v_fim_mes := (make_date(p_ano, p_mes, 1) + INTERVAL '1 month - 1 day')::DATE;

  FOR v_projeto IN
    SELECT p.id, p.nome
    FROM projetos p
    WHERE p.empresa_id = v_empresa_id
      AND p.deleted_at IS NULL
      AND p.status IN ('Planejamento', 'Em andamento', 'Revisão', 'Concluído')
  LOOP
    SELECT COALESCE(
      CASE WHEN SUM(horas_estimadas) > 0
        THEN SUM(horas_estimadas * custo_hora) / SUM(horas_estimadas)
        ELSE 0
      END, 0)
    INTO v_custo_hora_fallback
    FROM projeto_orcamento_fases
    WHERE projeto_id = v_projeto.id AND deleted_at IS NULL;

    SELECT COALESCE(SUM(horas), 0) INTO v_horas
    FROM timesheets
    WHERE projeto_id = v_projeto.id
      AND status = 'aprovado'
      AND deleted_at IS NULL
      AND data <= v_fim_mes;

    SELECT COALESCE(SUM(
      t.horas * COALESCE(
        CASE
          WHEN p.salario_fixo IS NOT NULL
            AND p.salario_fixo > 0
            AND COALESCE(p.horas_semanais, 40) > 0
          THEN p.salario_fixo / (COALESCE(p.horas_semanais, 40) * 4.33)
          ELSE NULL
        END,
        v_custo_hora_fallback
      )
    ), 0) INTO v_custo
    FROM timesheets t
    LEFT JOIN pessoas p
      ON p.id = t.pessoa_id
      AND p.empresa_id = v_empresa_id
      AND p.deleted_at IS NULL
    WHERE t.projeto_id = v_projeto.id
      AND t.empresa_id = v_empresa_id
      AND t.status = 'aprovado'
      AND t.deleted_at IS NULL
      AND t.data <= v_fim_mes;

    SELECT COALESCE(SUM(valor), 0) INTO v_faturado
    FROM marcos_faturamento
    WHERE projeto_id = v_projeto.id
      AND status IN ('faturado', 'recebido')
      AND deleted_at IS NULL
      AND data_faturada <= v_fim_mes;

    SELECT COALESCE(SUM(valor), 0) INTO v_recebido
    FROM receitas
    WHERE projeto_id = v_projeto.id
      AND status = 'Recebido'
      AND deleted_at IS NULL
      AND data_recebimento <= v_fim_mes;

    IF v_horas = 0 AND v_faturado = 0 AND v_recebido = 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO wip_snapshots (empresa_id, projeto_id, mes, ano, horas_realizadas, custo_realizado, faturado, recebido)
    VALUES (v_empresa_id, v_projeto.id, p_mes, p_ano, v_horas, v_custo, v_faturado, v_recebido)
    ON CONFLICT (projeto_id, mes, ano) DO UPDATE SET
      horas_realizadas = EXCLUDED.horas_realizadas,
      custo_realizado = EXCLUDED.custo_realizado,
      faturado = EXCLUDED.faturado,
      recebido = EXCLUDED.recebido;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- =============================================
-- 4. pg_cron — schedule audit_log_cleanup semanal (domingo 03:00 UTC)
-- =============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove job anterior se existir
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'audit-log-cleanup';

    -- Agenda novo: domingo 03:00 UTC
    PERFORM cron.schedule(
      'audit-log-cleanup',
      '0 3 * * 0',
      $cron$ SELECT public.audit_log_cleanup() $cron$
    );

    -- Cleanup rate_limit_attempts também (diário 04:00)
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'rate-limit-cleanup';

    PERFORM cron.schedule(
      'rate-limit-cleanup',
      '0 4 * * *',
      $cron$ DELETE FROM public.rate_limit_attempts WHERE attempted_at < NOW() - INTERVAL '7 days' $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron indisponível — schedule manual via Supabase Dashboard → Database → Cron Jobs';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Falha ao agendar jobs via pg_cron: %', SQLERRM;
END $$;

-- =============================================
-- 5. guard_login_attempt — wrapper de rate limit pra login admin
-- Frontend chama RPC antes de signInWithPassword
-- =============================================

CREATE OR REPLACE FUNCTION public.guard_login_attempt(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_norm TEXT;
  v_allowed BOOLEAN;
BEGIN
  v_email_norm := lower(trim(p_email));

  IF v_email_norm = '' OR v_email_norm !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RETURN FALSE;
  END IF;

  -- 10 tentativas / 15 min por email
  v_allowed := public.check_rate_limit('login_attempt', v_email_norm, 10, 900);
  RETURN v_allowed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_login_attempt(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_login_attempt(TEXT) TO anon, authenticated;

-- =============================================
-- 6. view_security_status — visibilidade pro admin do que está ativo
-- =============================================

CREATE OR REPLACE FUNCTION public._count_cron_jobs()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cnt INT;
BEGIN
  EXECUTE 'SELECT COUNT(*)::INT FROM cron.job WHERE jobname IN (''audit-log-cleanup'', ''rate-limit-cleanup'')' INTO cnt;
  RETURN cnt;
EXCEPTION WHEN OTHERS THEN RETURN 0;
END;
$$;

CREATE OR REPLACE VIEW public.view_security_status AS
SELECT
  EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pgsodium') AS pgsodium_ativo,
  EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS pg_cron_ativo,
  EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') AS pgcrypto_ativo,
  public._count_cron_jobs() AS cron_jobs_ativos,
  (SELECT COUNT(*)::INT FROM auth.mfa_factors f
     JOIN public.profiles p ON p.id = f.user_id
     WHERE p.role = 'admin' AND f.status = 'verified'
       AND p.empresa_id = public.get_user_empresa_id()) AS admins_com_mfa,
  (SELECT COUNT(*)::INT FROM public.profiles
     WHERE role = 'admin' AND empresa_id = public.get_user_empresa_id()) AS total_admins;

GRANT SELECT ON public.view_security_status TO authenticated;
