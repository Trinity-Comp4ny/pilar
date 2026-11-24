-- Corrige prospec_config_salvar: o UPDATE sem WHERE é barrado pelo Postgres do Supabase
-- ("UPDATE requires a WHERE clause"), então não era possível ligar o mapeador.
CREATE OR REPLACE FUNCTION public.prospec_config_salvar(p_ativo boolean, p_teto integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Ultra Admin' USING ERRCODE = '42501';
  END IF;
  IF p_teto IS NULL OR p_teto < 0 OR p_teto > 5000 THEN
    RAISE EXCEPTION 'Teto inválido' USING ERRCODE = '22023';
  END IF;
  UPDATE public.prospec_config
     SET ativo = coalesce(p_ativo, ativo), teto_semanal_buscas = p_teto
   WHERE id;
END;
$$;
