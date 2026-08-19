-- ADR 0026 / SPEC 052, follow-up ao achado do rls-auditor na migration
-- 20260845000000: `tg_cascade_feature_revocation()` ainda tratava
-- `empresas.features` como fonte de verdade pra revogar acesso dos usuários,
-- sem saber que uma chave universal (`_universal_features()`) não depende
-- desse JSONB.
--
-- Reprodução real do achado: `PUT /ultra-admin-empresas?action=bulk-feature`
-- desliga uma feature em massa fazendo `delete empresas.features[feature]`
-- (supabase/functions/ultra-admin-empresas/index.ts). Antes deste fix, isso
-- disparava este trigger, que enxergava "financeiro" sumindo do JSONB e
-- apagava `financeiro` de `profiles.features` de todo mundo na empresa —
-- mesmo `user_has_feature('financeiro', ...)` não dependendo mais do JSONB
-- da empresa. Resultado: o usuário perdia o nível explícito no profile e
-- ficava sem acesso de novo, na prática anulando o ADR 0026 pra quem passasse
-- por esse caminho (mesmo a feature sendo "universal").
--
-- Fix: pular chaves universais no laço de revogação. Sem isso, mesmo com o
-- bypass de leitura correto (migration anterior), uma escrita em
-- empresas.features ainda conseguia apagar o grant do usuário na prática.

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
  -- (exceto universal: não depende do JSONB da empresa, não deve ser revogada).
  FOR feat_key IN SELECT jsonb_object_keys(OLD.features)
  LOOP
    IF feat_key = ANY (public._universal_features()) THEN
      CONTINUE;
    END IF;

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
