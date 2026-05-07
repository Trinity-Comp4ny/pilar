-- Prevent users from escalating their own role or changing their empresa_id via direct UPDATE
CREATE OR REPLACE FUNCTION public.tg_prevent_profile_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Block role escalation by non-admins
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'ultra_admin')
    ) THEN
      RAISE EXCEPTION 'Permissão negada: alteração de role não autorizada';
    END IF;
  END IF;

  -- Block cross-tenant empresa_id change
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'ultra_admin'
    ) THEN
      RAISE EXCEPTION 'Permissão negada: alteração de empresa_id não autorizada';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_prevent_profile_tampering ON profiles;
CREATE TRIGGER tg_prevent_profile_tampering
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION tg_prevent_profile_tampering();

-- Drop legacy 4-arg overload of pagar_fatura if it exists
DROP FUNCTION IF EXISTS public.pagar_fatura(uuid, uuid, numeric, date);
DROP FUNCTION IF EXISTS public.pagar_fatura(uuid, uuid, decimal, date);
