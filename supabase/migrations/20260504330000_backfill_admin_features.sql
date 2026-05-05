-- Backfill: admins existentes ficaram com features={} por causa do trigger antigo
-- (tg_validate_profile_features que forçava admin/ultra_admin a features={}).
--
-- Após 20260504250000_features_strict_admin.sql, admin precisa ter features
-- atribuídas para usar módulos operacionais (financeiro, projetos, leads, etc).
--
-- Esta migration atribui a cada admin TODAS as features que sua empresa tem
-- ativadas no plano, com nível 'editor'. Ultra_admin não recebe (bypass total).
--
-- Idempotente: só atualiza admins que ainda têm features = {} ou NULL.

UPDATE public.profiles p
SET features = (
  SELECT COALESCE(jsonb_object_agg(key, 'editor'), '{}'::jsonb)
  FROM jsonb_each_text(e.features)
  WHERE value::boolean = TRUE
    AND key <> 'dashboard'  -- 'dashboard' é universal, não precisa atribuir
)
FROM public.empresas e
WHERE p.empresa_id = e.id
  AND p.role = 'admin'
  AND (p.features = '{}'::jsonb OR p.features IS NULL)
  AND e.features IS NOT NULL
  AND e.features <> '{}'::jsonb;

-- Diagnóstico: quantos admins receberam features? (apenas log via NOTICE)
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.profiles
  WHERE role = 'admin' AND features <> '{}'::jsonb;

  RAISE NOTICE 'Backfill features admins: % admin(s) agora com features atribuídas', v_count;
END $$;
