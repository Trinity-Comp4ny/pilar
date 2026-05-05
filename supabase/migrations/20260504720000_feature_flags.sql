-- Feature flags caseiros — toggles de UI/comportamento por empresa, com
-- rollout gradual via percentage (hash determinístico por empresa_id).
--
-- Leitura/escrita restrita a ultra_admin (operador da plataforma Labrynth).
-- A RPC is_feature_flag_enabled() é SECURITY DEFINER e devolve apenas BOOLEAN,
-- então qualquer usuário autenticado pode consultar suas próprias flags sem
-- precisar de SELECT na tabela.

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key TEXT PRIMARY KEY,
  description TEXT,
  enabled_for_all BOOLEAN NOT NULL DEFAULT FALSE,
  percentage INTEGER NOT NULL DEFAULT 0 CHECK (percentage BETWEEN 0 AND 100),
  enabled_for_empresas UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.tg_feature_flags_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feature_flags_touch_updated_at ON public.feature_flags;
CREATE TRIGGER feature_flags_touch_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.tg_feature_flags_touch_updated_at();

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_flags_ultra_admin_select" ON public.feature_flags;
CREATE POLICY "feature_flags_ultra_admin_select"
  ON public.feature_flags
  FOR SELECT
  TO authenticated
  USING (public.has_role('ultra_admin'));

DROP POLICY IF EXISTS "feature_flags_ultra_admin_insert" ON public.feature_flags;
CREATE POLICY "feature_flags_ultra_admin_insert"
  ON public.feature_flags
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role('ultra_admin'));

DROP POLICY IF EXISTS "feature_flags_ultra_admin_update" ON public.feature_flags;
CREATE POLICY "feature_flags_ultra_admin_update"
  ON public.feature_flags
  FOR UPDATE
  TO authenticated
  USING (public.has_role('ultra_admin'))
  WITH CHECK (public.has_role('ultra_admin'));

DROP POLICY IF EXISTS "feature_flags_ultra_admin_delete" ON public.feature_flags;
CREATE POLICY "feature_flags_ultra_admin_delete"
  ON public.feature_flags
  FOR DELETE
  TO authenticated
  USING (public.has_role('ultra_admin'));

-- Hash determinístico por empresa_id em [0,100). Usa MD5 dos primeiros 8 hex
-- chars da combinação flag_key + empresa_id — estável entre sessões e regiões.
CREATE OR REPLACE FUNCTION public.is_feature_flag_enabled(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_flag public.feature_flags%ROWTYPE;
  v_bucket INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT empresa_id INTO v_empresa_id
  FROM public.profiles
  WHERE id = auth.uid();

  SELECT * INTO v_flag
  FROM public.feature_flags
  WHERE key = p_key;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_flag.enabled_for_all THEN
    RETURN TRUE;
  END IF;

  IF v_empresa_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_empresa_id = ANY (v_flag.enabled_for_empresas) THEN
    RETURN TRUE;
  END IF;

  IF v_flag.percentage > 0 THEN
    -- 8 hex chars => até 0xFFFFFFFF; mod 100 dá bucket [0,99]
    v_bucket := ('x' || substr(md5(p_key || ':' || v_empresa_id::TEXT), 1, 8))::BIT(32)::INT & 2147483647;
    v_bucket := v_bucket % 100;
    IF v_bucket < v_flag.percentage THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.is_feature_flag_enabled(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_feature_flag_enabled(TEXT) TO authenticated;

COMMENT ON TABLE public.feature_flags IS
  'Feature flags caseiros — gerenciados por ultra_admin. RPC is_feature_flag_enabled é o ponto de leitura para o app.';
