-- ACH-AUTH-04: o token de novo owner era gravado e comparado em PLAINTEXT em
-- empresa_owners_pending (CENÁRIO 2 do handle_new_user), enquanto o convite de
-- funcionário (CENÁRIO 1) já usava token_hash sha256. Alinhamos o owner ao
-- mesmo padrão: guardar só o hash, validar por hash. O token cru trafega apenas
-- no invite (metadata), nunca é persistido.

ALTER TABLE public.empresa_owners_pending ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE public.empresa_owners_pending ALTER COLUMN token DROP NOT NULL;
ALTER TABLE public.empresa_owners_pending ALTER COLUMN token DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_empresa_owners_pending_token_hash
  ON public.empresa_owners_pending(token_hash) WHERE usado_em IS NULL;

-- Recriação do trigger com o CENÁRIO 2 validando por token_hash (única mudança
-- vs. a versão vigente: a cláusula WHERE do SELECT do owner pendente).
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_token            TEXT;
  v_meta_nome        TEXT;
  v_email            TEXT;
  v_first_name       TEXT;
  v_convite          RECORD;
  v_owner_pending    RECORD;
  v_pending_signup   RECORD;
  v_empresa_id       UUID;
BEGIN
  IF NEW.email IS NULL OR length(trim(NEW.email)) = 0 THEN
    RAISE EXCEPTION 'Cadastro inválido: email ausente';
  END IF;

  v_email := lower(trim(NEW.email));

  v_token := NEW.raw_user_meta_data->>'invite_token';

  v_meta_nome := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'nome', '')), '');
  IF v_meta_nome IS NOT NULL AND length(v_meta_nome) > 200 THEN
    v_meta_nome := substring(v_meta_nome FROM 1 FOR 200);
  END IF;

  IF v_token IS NULL OR length(v_token) = 0 THEN
    RAISE EXCEPTION 'Cadastro não autorizado. Entre em contato com a equipe comercial.';
  END IF;

  -- ===========================================================================
  -- CENÁRIO 1: FUNCIONÁRIO CONVIDADO
  -- ===========================================================================
  SELECT id, empresa_id, email, cargo, nome, features
  INTO v_convite
  FROM public.convites
  WHERE token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex')
    AND email = v_email
    AND usado_em IS NULL
    AND expira_em > NOW();

  IF v_convite.id IS NOT NULL THEN
    v_first_name := COALESCE(v_convite.nome, v_meta_nome, split_part(NEW.email, '@', 1));

    INSERT INTO public.profiles (
      id, empresa_id, first_name, email, role, features, onboarding_completed
    )
    VALUES (
      NEW.id,
      v_convite.empresa_id,
      v_first_name,
      NEW.email,
      v_convite.cargo,
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
  WHERE token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex')
    AND email = v_email
    AND usado_em IS NULL
    AND expira_em > NOW();

  IF v_owner_pending.id IS NOT NULL THEN
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

    v_first_name := COALESCE(v_owner_pending.nome, v_meta_nome, split_part(NEW.email, '@', 1));

    INSERT INTO public.profiles (
      id, empresa_id, first_name, email, role, features, onboarding_completed
    )
    VALUES (
      NEW.id,
      v_empresa_id,
      v_first_name,
      NEW.email,
      'admin',
      '{}'::jsonb,
      FALSE
    );

    UPDATE public.empresa_owners_pending
    SET usado_em = NOW()
    WHERE id = v_owner_pending.id;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Token de convite inválido ou expirado';
END;
$function$;
