-- ACH-RLS-01 (CRÍTICO): o trigger anti-tampering de profiles bloqueia mudar
-- `role` e `empresa_id`, mas NÃO `features`. Um colaborador conseguia
-- `PATCH /rest/v1/profiles?id=eq.<self>` com {"features":{"financeiro":"editor"}}
-- e destravar todo o financeiro. Enquanto isso existir, os gates de feature das
-- outras tabelas são teatro. Aqui incluímos `features` na proteção: só admin/
-- ultra_admin pode alterar features de um profile via UPDATE direto.
-- service_role (edge functions, RPCs SECURITY DEFINER, migrations) segue livre.

CREATE OR REPLACE FUNCTION public.tg_prevent_profile_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (edge functions, migrations, admin operations) bypassa
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Bloqueia escalada de role por não-admin
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'ultra_admin')
    ) THEN
      RAISE EXCEPTION 'Permissão negada: alteração de role não autorizada';
    END IF;
  END IF;

  -- Bloqueia troca de empresa (cross-tenant)
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'ultra_admin'
    ) THEN
      RAISE EXCEPTION 'Permissão negada: alteração de empresa_id não autorizada';
    END IF;
  END IF;

  -- Bloqueia auto-concessão de features por não-admin (ACH-RLS-01)
  IF NEW.features IS DISTINCT FROM OLD.features THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'ultra_admin')
    ) THEN
      RAISE EXCEPTION 'Permissão negada: alteração de features não autorizada';
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
