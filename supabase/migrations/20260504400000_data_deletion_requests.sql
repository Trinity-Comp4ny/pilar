-- LGPD: data deletion requests (Art. 18, IV — direito de eliminação)
--
-- Tabela e RPC para usuários autenticados solicitarem exclusão dos próprios dados.
-- Admin processa manualmente; trigger NOTIFY pode ser plugado a edge function depois.

CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  motivo TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_user
  ON public.data_deletion_requests (user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_status
  ON public.data_deletion_requests (status, requested_at DESC);

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- O próprio user vê seus pedidos
DROP POLICY IF EXISTS "ddr_self_read" ON public.data_deletion_requests;
CREATE POLICY "ddr_self_read" ON public.data_deletion_requests
  FOR SELECT
  USING (user_id = auth.uid());

-- Admin da empresa lê os pedidos da empresa
DROP POLICY IF EXISTS "ddr_admin_read" ON public.data_deletion_requests;
CREATE POLICY "ddr_admin_read" ON public.data_deletion_requests
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin')
  );

-- Inserção apenas via RPC (security definer)
DROP POLICY IF EXISTS "ddr_no_direct_insert" ON public.data_deletion_requests;
CREATE POLICY "ddr_no_direct_insert" ON public.data_deletion_requests
  FOR INSERT
  WITH CHECK (false);

-- Update apenas admin
DROP POLICY IF EXISTS "ddr_admin_update" ON public.data_deletion_requests;
CREATE POLICY "ddr_admin_update" ON public.data_deletion_requests
  FOR UPDATE
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin')
  );

-- =============================================
-- RPC: request_data_deletion
-- =============================================

CREATE OR REPLACE FUNCTION public.request_data_deletion(p_motivo TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_empresa_id UUID;
  v_request_id UUID;
  v_existing UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Não permitir duplicatas pendentes
  SELECT id INTO v_existing
  FROM public.data_deletion_requests
  WHERE user_id = v_user_id
    AND status IN ('pending', 'in_progress')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Best-effort: pega empresa do profile
  BEGIN
    SELECT empresa_id INTO v_empresa_id FROM public.profiles WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_empresa_id := NULL;
  END;

  INSERT INTO public.data_deletion_requests (user_id, empresa_id, motivo)
  VALUES (v_user_id, v_empresa_id, NULLIF(TRIM(COALESCE(p_motivo, '')), ''))
  RETURNING id INTO v_request_id;

  -- Hook de notificação ao admin (placeholder: log no servidor).
  -- TODO: trocar por pg_notify + edge function "notify-admin-deletion-request"
  --       que dispara email real via Resend.
  RAISE NOTICE 'LGPD data deletion requested: user=% empresa=% request=%',
    v_user_id, v_empresa_id, v_request_id;

  PERFORM pg_notify(
    'data_deletion_request',
    json_build_object(
      'request_id', v_request_id,
      'user_id', v_user_id,
      'empresa_id', v_empresa_id
    )::text
  );

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_data_deletion(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_data_deletion(TEXT) TO authenticated;

COMMENT ON FUNCTION public.request_data_deletion(TEXT) IS
  'LGPD Art. 18 IV: usuário autenticado solicita eliminação dos próprios dados.';
