-- ADR 0026 / SPEC 052: feature madura (Financeiro, Projetos, Obras...) vira
-- universal por empresa, sem depender do toggle `empresas.features`.
--
-- Contexto: `user_has_feature()`, `tg_validate_features_subset()` (profiles) e
-- `tg_validate_convite_features_subset()` (convites) checam
-- `empresas.features ->> feature = true` antes de aceitar qualquer grant de
-- usuário. Essa checagem é a fronteira de dado real (RLS de ~8 tabelas, não só
-- UI): sem ajustar aqui, o app pode achar Obras "universal" via
-- `isFeatureEnabledForCompany` (src/lib/features.ts) e mesmo assim o banco
-- recusar o profile/convite com a feature (mesma trava que quase deixou
-- 'obras' fora do convite da Mawe: `tg_validate_convite_features_subset`
-- rejeitaria o INSERT se a empresa não tivesse `obras: true` gravado).
--
-- `_universal_features()` espelha `universal: true` de src/lib/features.ts
-- (coberto por teste de sincronia em src/lib/features.test.ts). Não inclui
-- 'dashboard'/'meu_trabalho': são `core`, já bypassados à parte (dashboard já
-- tinha o próprio bypass; meu_trabalho não é checado por nenhuma RLS hoje).
--
-- NÃO mexe em `handle_new_user()` nem faz cleanup de `empresas.features`
-- existente: com o bypass abaixo, o conteúdo daquela coluna fica irrelevante
-- para as chaves universais (o toggle de "Features da empresa" já para de
-- mostrá-las, ver CompanyFeatureToggles.tsx). Fica como dívida de higiene
-- documentada na spec 052, não bloqueante.

CREATE OR REPLACE FUNCTION public._universal_features()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT ARRAY[
    'relatorios',
    'leads',
    'propostas',
    'clientes',
    'projetos',
    'mapa',
    'financeiro',
    'pessoas',
    'metas',
    'portal_cliente',
    'ai_chat',
    'obras',
    'obras_fornecedores',
    'obras_clima',
    'obras_diario',
    'obras_cronograma',
    'obras_cotacoes',
    'obras_estoque',
    'obras_conta'
  ];
$function$;

COMMENT ON FUNCTION public._universal_features() IS
  'Features que toda empresa tem, sem depender de empresas.features (ADR 0026). Espelha universal:true em src/lib/features.ts.';

-- ── user_has_feature: bypassa o gate de empresa pra feature universal ──────
-- O nível de usuário (profiles.features viewer/editor) continua exigido: só
-- muda o que a empresa precisa ter marcado. Sem isso, financeiro/projetos/etc
-- ficariam bloqueados no RLS pra qualquer empresa cujo JSONB não tenha a
-- chave true (ex.: empresa criada antes desta feature existir).
CREATE OR REPLACE FUNCTION public.user_has_feature(p_feature TEXT, p_min_level TEXT DEFAULT 'viewer')
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_empresa_features JSONB;
  v_profile_features JSONB;
  v_user_level TEXT;
BEGIN
  IF p_min_level NOT IN ('viewer', 'editor') THEN
    RAISE EXCEPTION 'p_min_level deve ser "viewer" ou "editor"';
  END IF;

  IF NOT (p_feature = ANY (public._feature_catalog())) THEN
    RETURN FALSE;
  END IF;

  SELECT p.role, e.features, p.features
  INTO v_role, v_empresa_features, v_profile_features
  FROM public.profiles p
  LEFT JOIN public.empresas e ON e.id = p.empresa_id
  WHERE p.id = auth.uid();

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Ultra admin: bypass total (cross-empresa, plataforma)
  IF v_role = 'ultra_admin' THEN
    RETURN TRUE;
  END IF;

  -- Empresa precisa ter feature ativa, exceto 'dashboard' (core) e as
  -- universais (ADR 0026): essas não dependem de empresas.features.
  IF p_feature <> 'dashboard'
     AND NOT (p_feature = ANY (public._universal_features()))
     AND COALESCE((v_empresa_features ->> p_feature)::BOOLEAN, FALSE) = FALSE THEN
    RETURN FALSE;
  END IF;

  -- Admin e user seguem mesma regra granular: precisam ter level explícito no profile.
  v_user_level := v_profile_features ->> p_feature;

  IF v_user_level IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_min_level = 'viewer' THEN
    RETURN v_user_level IN ('viewer', 'editor');
  ELSE -- 'editor'
    RETURN v_user_level = 'editor';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.user_has_feature(TEXT, TEXT) IS
  'Feature gate operacional. Ultra_admin bypassa. Feature universal (ADR 0026) bypassa o gate de empresa, mas ainda exige level explícito no profile. Admin segue a mesma regra granular que user.';

-- ── tg_validate_features_subset (profiles.features): mesma bypass ─────────
CREATE OR REPLACE FUNCTION public.tg_validate_features_subset()
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
    -- Core ('dashboard') e universal (ADR 0026) sempre permitidas.
    IF feat_key = 'dashboard' OR feat_key = ANY (public._universal_features()) THEN
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

-- ── tg_validate_convite_features_subset (convites.features): mesma bypass ─
-- Esta é a trava que quase rejeitou 'obras' no convite da Mawe: sem o bypass,
-- convidar alguém com uma feature universal cuja empresa não tem o JSONB
-- marcado (empresa antiga, ou toggle nunca ligado) falharia aqui.
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
    IF feat_key = 'dashboard' OR feat_key = ANY (public._universal_features()) THEN
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

-- ── _validate_features_payload (segunda linhagem de validação, redundante
-- com as duas acima, mas ativa nos dois triggers abaixo) ───────────────────
-- Achado ao testar esta migration: `tg_validate_features_subset` (que já
-- corrigi acima) NÃO é o único guarda em profiles/convites. Existem DOIS
-- mecanismos paralelos, ambos ativos há tempos (não introduzidos por esta
-- mudança):
--   1. tg_validate_features_subset / tg_validate_convite_features_subset
--   2. tg_validate_profile_features → _validate_features_payload
--      tg_validate_convite_features → _validate_features_payload
-- Sem patchear esta também, convidar ou atribuir uma feature universal numa
-- empresa cujo JSONB não tem a chave marcada continuava sendo rejeitado por
-- este segundo guarda, mesmo com o primeiro já corrigido. Confirmado batendo
-- a cabeça: supabase test db passava porque o teste antigo esperava rejeição
-- (comportamento antigo), só ao tentar o cenário "financeiro deveria passar
-- por ser universal" o erro apareceu vindo desta função, não da que eu tinha
-- corrigido. Ver "Estado real vs proposto" — catálogo/validação em mais
-- lugares do que a spec 052 havia mapeado.
CREATE OR REPLACE FUNCTION public._validate_features_payload(
  p_features JSONB,
  p_empresa_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_key TEXT;
  v_value TEXT;
  v_empresa_features JSONB;
  v_catalog TEXT[] := public._feature_catalog();
BEGIN
  IF p_features IS NULL OR p_features = '{}'::jsonb THEN
    RETURN;
  END IF;

  IF jsonb_typeof(p_features) <> 'object' THEN
    RAISE EXCEPTION 'features deve ser um objeto JSON';
  END IF;

  SELECT features INTO v_empresa_features
  FROM public.empresas
  WHERE id = p_empresa_id;

  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_features)
  LOOP
    IF NOT (v_key = ANY (v_catalog)) THEN
      RAISE EXCEPTION 'Feature desconhecida: %', v_key;
    END IF;

    IF v_value NOT IN ('viewer', 'editor') THEN
      RAISE EXCEPTION 'Nível inválido para %: % (use "viewer" ou "editor")', v_key, v_value;
    END IF;

    IF v_key <> 'dashboard'
       AND NOT (v_key = ANY (public._universal_features()))
       AND COALESCE((v_empresa_features ->> v_key)::BOOLEAN, FALSE) = FALSE THEN
      RAISE EXCEPTION 'Feature "%" não está habilitada na empresa', v_key;
    END IF;
  END LOOP;
END;
$$;
