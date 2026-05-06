-- =============================================================================
-- SEC-11 — Endurecer handle_new_user contra escalada via raw_user_meta_data
-- =============================================================================
--
-- CONTEXTO HISTÓRICO
-- ------------------
-- Versão original (001_schema_base_e_auth.sql) confiava em flags do metadata:
--   • raw_user_meta_data->>'is_company_owner'   → criava empresa + role admin
--   • raw_user_meta_data->>'empresa_id_convite' → entrava em qualquer tenant
--   • raw_user_meta_data->>'cargo_convite'      → escolhia o próprio role
-- Como o cliente controla esses campos via supabase.auth.signUp({data:{...}}),
-- qualquer usuário público virava admin de qualquer empresa.
--
-- Versões 012 e 20260425000001 já trocaram para validação por token
-- (convites + empresa_owners_pending). Esta migration NÃO desfaz aquilo —
-- ela formaliza a postura "deny by default", remove qualquer leitura residual
-- de flags de metadata, adiciona defesa-em-profundidade contra inserções
-- diretas em empresa_owners_pending sem signup pago, e mantém os dois
-- caminhos legítimos vivos:
--
--   1. CONVIDADO (employee invite via edge function invite-user)
--      → registra convites(token, empresa_id, email, cargo, features)
--      → admin.inviteUserByEmail(email, { data: { invite_token } })
--      → trigger valida convites por token + email
--
--   2. NOVO OWNER (self-service checkout)
--      → pilar-checkout-create cria pilar_pending_signups (status=pending)
--      → Asaas confirma pagamento → pilar-checkout-webhook
--          marca payment_status='paid', cria empresa_owners_pending,
--          chama admin.inviteUserByEmail(email, { data: { invite_token } })
--      → trigger valida empresa_owners_pending por token + email
--          + EXIGE pilar_pending_signups vinculado e pago (defesa extra)
--
-- VETORES FECHADOS
-- ----------------
-- ✗ raw_user_meta_data.is_company_owner = true                  → ignorado
-- ✗ raw_user_meta_data.empresa_id_convite = "<vítima>"          → ignorado
-- ✗ raw_user_meta_data.cargo_convite = "ultra_admin"            → ignorado
-- ✗ raw_user_meta_data.role / company_name                      → ignorados
-- ✗ self-signup com invite_token forjado                        → exception
-- ✗ self-signup com convite válido para OUTRO email             → exception
-- ✗ insert direto em empresa_owners_pending sem pagamento       → exception
-- ✗ replay de token (usado_em IS NOT NULL)                      → exception
-- ✗ token expirado                                              → exception
--
-- CAMPOS DE METADATA AINDA LIDOS (lista exclusiva)
-- ------------------------------------------------
--   • invite_token : TEXT — token server-generated, validado contra DB
--   • nome         : TEXT — nome de exibição, só usado se convite/pending
--                            não tiver nome próprio; sanitizado e capado em 200
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_token            TEXT;
  v_meta_nome        TEXT;
  v_email            TEXT;
  v_convite          RECORD;
  v_owner_pending    RECORD;
  v_pending_signup   RECORD;
  v_empresa_id       UUID;
BEGIN
  -- Email é obrigatório. Sem email não há como cruzar com convite.
  IF NEW.email IS NULL OR length(trim(NEW.email)) = 0 THEN
    RAISE EXCEPTION 'Cadastro inválido: email ausente';
  END IF;

  v_email := lower(trim(NEW.email));

  -- Único campo de identificação aceito do metadata é o token.
  -- Demais flags (is_company_owner, empresa_id_convite, cargo_convite,
  -- role, company_name) são deliberadamente ignoradas.
  v_token := NEW.raw_user_meta_data->>'invite_token';

  -- Nome é cosmético; cap em 200 chars pra evitar lixo.
  v_meta_nome := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'nome', '')), '');
  IF v_meta_nome IS NOT NULL AND length(v_meta_nome) > 200 THEN
    v_meta_nome := substring(v_meta_nome FROM 1 FOR 200);
  END IF;

  -- Sem token = sem caminho legítimo. Bloqueia self-signup público.
  IF v_token IS NULL OR length(v_token) = 0 THEN
    RAISE EXCEPTION 'Cadastro não autorizado. Entre em contato com a equipe comercial.';
  END IF;

  -- ===========================================================================
  -- CENÁRIO 1: FUNCIONÁRIO CONVIDADO
  -- ===========================================================================
  SELECT id, empresa_id, email, cargo, nome, features
  INTO v_convite
  FROM public.convites
  WHERE token = v_token
    AND email = v_email
    AND usado_em IS NULL
    AND expira_em > NOW();

  IF v_convite.id IS NOT NULL THEN
    INSERT INTO public.profiles (
      id, empresa_id, nome, email, role, features, onboarding_completed
    )
    VALUES (
      NEW.id,
      v_convite.empresa_id,
      COALESCE(v_convite.nome, v_meta_nome, NEW.email),
      NEW.email,
      v_convite.cargo,                                  -- role vem do convite
      COALESCE(v_convite.features, '{}'::jsonb),
      FALSE
    );

    UPDATE public.convites
    SET usado_em = NOW()
    WHERE id = v_convite.id;

    RETURN NEW;
  END IF;

  -- ===========================================================================
  -- CENÁRIO 2: NOVO OWNER (self-service checkout pago)
  -- ===========================================================================
  SELECT id, email, company_name, nome
  INTO v_owner_pending
  FROM public.empresa_owners_pending
  WHERE token = v_token
    AND email = v_email
    AND usado_em IS NULL
    AND expira_em > NOW();

  IF v_owner_pending.id IS NOT NULL THEN
    -- Defesa em profundidade: empresa_owners_pending só deveria existir
    -- após pilar-checkout-webhook confirmar pagamento. Reconfere aqui.
    -- Se alguém conseguir burlar e inserir direto, ainda bloqueia.
    SELECT id, payment_status
    INTO v_pending_signup
    FROM public.pilar_pending_signups
    WHERE empresa_owner_pending_id = v_owner_pending.id
      AND payment_status = 'paid'
    LIMIT 1;

    IF v_pending_signup.id IS NULL THEN
      RAISE EXCEPTION 'Cadastro de novo owner sem pagamento confirmado';
    END IF;

    INSERT INTO public.empresas (
      owner_id, nome, features, onboarding_completed
    )
    VALUES (
      NEW.id,
      v_owner_pending.company_name,
      jsonb_build_object(
        'dashboard',     true,
        'relatorios',    true,
        'leads',         true,
        'propostas',     true,
        'clientes',      true,
        'projetos',      true,
        'planejamento',  true,
        'timesheet',     true,
        'mapa',          true,
        'financeiro',    true,
        'pessoas',       true,
        'metas',         true,
        'portal_cliente', true,
        'ai_hub',        false,
        'capacidade',    false,
        'templates',     false
      ),
      FALSE
    )
    RETURNING id INTO v_empresa_id;

    INSERT INTO public.profiles (
      id, empresa_id, nome, email, role, features, onboarding_completed
    )
    VALUES (
      NEW.id,
      v_empresa_id,
      COALESCE(v_owner_pending.nome, v_meta_nome, NEW.email),
      NEW.email,
      'admin',                                          -- role fixo, nunca metadata
      '{}'::jsonb,
      FALSE
    );

    UPDATE public.empresa_owners_pending
    SET usado_em = NOW()
    WHERE id = v_owner_pending.id;

    RETURN NEW;
  END IF;

  -- Token presente mas não bate com nada válido.
  RAISE EXCEPTION 'Token de convite inválido ou expirado';
END;
$$;

-- O trigger on_auth_user_created (migration 029) continua apontando pra esta
-- função. Não precisa recriar o trigger aqui — só reescrevemos o corpo.

COMMENT ON FUNCTION public.handle_new_user() IS
  'SEC-11: cria profile/empresa apenas via convite (convites) ou owner pago '
  '(empresa_owners_pending + pilar_pending_signups paid). Ignora flags de '
  'raw_user_meta_data; só lê invite_token e nome.';
