-- Solicitações de exportação de dados (LGPD Art. 18, V — portabilidade)
-- Usuário solicita; equipe processa em até 15 dias e envia por email.

CREATE TABLE IF NOT EXISTS public.data_export_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id    UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  download_url  TEXT,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas suas próprias solicitações
CREATE POLICY "user sees own export requests"
  ON public.data_export_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user creates own export requests"
  ON public.data_export_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Limite: 1 solicitação pendente por usuário
CREATE UNIQUE INDEX IF NOT EXISTS uniq_data_export_pending
  ON public.data_export_requests(user_id)
  WHERE status = 'pending';

-- RPC pública para o usuário solicitar exportação
CREATE OR REPLACE FUNCTION public.request_data_export()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_id UUID;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM public.profiles
  WHERE id = auth.uid();

  INSERT INTO public.data_export_requests (user_id, empresa_id)
  VALUES (auth.uid(), v_empresa_id)
  RETURNING id INTO v_id;

  RETURN json_build_object('id', v_id, 'status', 'pending');
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('error', 'already_pending');
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_data_export() TO authenticated;
