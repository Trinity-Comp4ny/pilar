-- Migration: feature hardening
-- 1. Trigger: profiles.features ⊆ empresas.features (subset validation)
-- 2. Trigger: cascade revocation quando empresa perde feature

-- ---------------------------------------------------------------------------
-- 1. SUBSET VALIDATION: profiles.features não pode ter feature
--    que a empresa não habilitou.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_validate_features_subset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  company_features JSONB;
  feat_key TEXT;
BEGIN
  -- Só valida se profiles.features mudou e há empresa
  IF NEW.features IS NULL OR NEW.features = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  IF NEW.empresa_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT features INTO company_features
  FROM public.empresas
  WHERE id = NEW.empresa_id;

  -- Para cada feature em profiles.features, verificar se está ativa na empresa
  FOR feat_key IN SELECT jsonb_object_keys(NEW.features)
  LOOP
    -- Features core (dashboard) sempre permitidas
    IF feat_key = 'dashboard' THEN
      CONTINUE;
    END IF;

    IF (company_features ->> feat_key)::boolean IS NOT TRUE THEN
      RAISE EXCEPTION
        'Feature "%" não está habilitada para esta empresa', feat_key
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_validate_features_subset ON public.profiles;
CREATE TRIGGER tg_validate_features_subset
  BEFORE INSERT OR UPDATE OF features, empresa_id
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_validate_features_subset();

-- ---------------------------------------------------------------------------
-- 2. CASCADE REVOCATION: quando empresas.features muda,
--    remover de todos os profiles as features desabilitadas.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_cascade_feature_revocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  feat_key TEXT;
  is_enabled BOOLEAN;
BEGIN
  -- Para cada feature que mudou de true → false/null, revogar dos usuários
  FOR feat_key IN SELECT jsonb_object_keys(OLD.features)
  LOOP
    is_enabled := (NEW.features ->> feat_key)::boolean;

    IF is_enabled IS NOT TRUE AND (OLD.features ->> feat_key)::boolean IS TRUE THEN
      UPDATE public.profiles
      SET features = features - feat_key
      WHERE empresa_id = NEW.id
        AND features ? feat_key;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_cascade_feature_revocation ON public.empresas;
CREATE TRIGGER tg_cascade_feature_revocation
  AFTER UPDATE OF features
  ON public.empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_cascade_feature_revocation();

-- ---------------------------------------------------------------------------
-- 3. Mesma validação para convites.features
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_validate_convite_features_subset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  company_features JSONB;
  feat_key TEXT;
BEGIN
  IF NEW.features IS NULL OR NEW.features = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  IF NEW.empresa_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT features INTO company_features
  FROM public.empresas
  WHERE id = NEW.empresa_id;

  FOR feat_key IN SELECT jsonb_object_keys(NEW.features)
  LOOP
    IF feat_key = 'dashboard' THEN
      CONTINUE;
    END IF;

    IF (company_features ->> feat_key)::boolean IS NOT TRUE THEN
      RAISE EXCEPTION
        'Feature "%" não está habilitada para esta empresa', feat_key
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_validate_convite_features_subset ON public.convites;
CREATE TRIGGER tg_validate_convite_features_subset
  BEFORE INSERT OR UPDATE OF features, empresa_id
  ON public.convites
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_validate_convite_features_subset();
