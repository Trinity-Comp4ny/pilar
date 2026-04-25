-- Migration 012: Convites Server-Side
-- Corrige escalação via signup metadata. Antes, handle_new_user confiava em
-- raw_user_meta_data->>'empresa_id_convite' e 'is_company_owner' — campos
-- que o cliente pode injetar via supabase.auth.signUp({data:{...}}).
-- Agora exigimos token server-side válido em public.convites.

-- =============================================
-- 1. TABELA: convites
-- =============================================

CREATE TABLE IF NOT EXISTS public.convites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  cargo public.user_role NOT NULL DEFAULT 'user',
  nome TEXT,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  criado_por UUID REFERENCES auth.users(id),
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  usado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_convites_token ON public.convites(token) WHERE usado_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_convites_email ON public.convites(email) WHERE usado_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_convites_empresa ON public.convites(empresa_id);

ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "convites_admin_full" ON public.convites;
CREATE POLICY "convites_admin_full" ON public.convites
  FOR ALL
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin'))
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin'));

-- =============================================
-- 2. TABELA: empresa_owners_pending (autoriza criação de nova empresa)
-- =============================================

CREATE TABLE IF NOT EXISTS public.empresa_owners_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  nome TEXT,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  criado_por UUID REFERENCES auth.users(id),
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  usado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_empresa_owners_pending_token
  ON public.empresa_owners_pending(token) WHERE usado_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_empresa_owners_pending_email
  ON public.empresa_owners_pending(email) WHERE usado_em IS NULL;

ALTER TABLE public.empresa_owners_pending ENABLE ROW LEVEL SECURITY;

-- Sem policies: apenas service_role acessa (via edge function)

-- =============================================
-- 3. TRIGGER REESCRITO: handle_new_user com validação server-side
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_convite RECORD;
  v_owner_pending RECORD;
  v_empresa_id UUID;
  v_token TEXT;
BEGIN
  v_token := NEW.raw_user_meta_data->>'invite_token';

  -- CENÁRIO 1: FUNCIONÁRIO CONVIDADO — token em convites
  IF v_token IS NOT NULL THEN
    SELECT id, empresa_id, email, cargo, nome
    INTO v_convite
    FROM public.convites
    WHERE token = v_token
      AND email = lower(NEW.email)
      AND usado_em IS NULL
      AND expira_em > NOW();

    IF v_convite.id IS NOT NULL THEN
      INSERT INTO public.profiles (id, empresa_id, nome, email, role, onboarding_completed)
      VALUES (
        NEW.id,
        v_convite.empresa_id,
        COALESCE(v_convite.nome, NEW.email),
        NEW.email,
        v_convite.cargo,
        FALSE
      );

      UPDATE public.convites SET usado_em = NOW() WHERE id = v_convite.id;
      RETURN NEW;
    END IF;

    -- CENÁRIO 2: NOVO DONO DE EMPRESA — token em empresa_owners_pending
    SELECT id, email, company_name, nome
    INTO v_owner_pending
    FROM public.empresa_owners_pending
    WHERE token = v_token
      AND email = lower(NEW.email)
      AND usado_em IS NULL
      AND expira_em > NOW();

    IF v_owner_pending.id IS NOT NULL THEN
      INSERT INTO public.empresas (owner_id, nome, onboarding_completed)
      VALUES (NEW.id, v_owner_pending.company_name, FALSE)
      RETURNING id INTO v_empresa_id;

      INSERT INTO public.profiles (id, empresa_id, nome, email, role, onboarding_completed)
      VALUES (
        NEW.id,
        v_empresa_id,
        COALESCE(v_owner_pending.nome, NEW.email),
        NEW.email,
        'admin',
        FALSE
      );

      UPDATE public.empresa_owners_pending SET usado_em = NOW() WHERE id = v_owner_pending.id;
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Token de convite inválido ou expirado';
  END IF;

  -- CENÁRIO 3: SIGNUP NÃO AUTORIZADO
  RAISE EXCEPTION 'Cadastro não autorizado. Entre em contato com a equipe comercial.';
END;
$$;

-- =============================================
-- 4. RPCs de gerência de convites (chamáveis por admin)
-- =============================================

-- Cria convite e retorna token (usado pela edge function invite-user)
CREATE OR REPLACE FUNCTION public.create_convite(
  p_email TEXT,
  p_cargo TEXT,
  p_nome TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_cargo public.user_role;
  v_token TEXT;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem criar convites';
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  BEGIN
    v_cargo := p_cargo::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    v_cargo := 'user';
  END;

  -- Invalida convites antigos não usados para o mesmo email + empresa
  UPDATE public.convites
  SET usado_em = NOW()
  WHERE email = lower(trim(p_email))
    AND empresa_id = v_empresa_id
    AND usado_em IS NULL;

  INSERT INTO public.convites (empresa_id, email, cargo, nome, criado_por)
  VALUES (v_empresa_id, lower(trim(p_email)), v_cargo, p_nome, auth.uid())
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_convite(TEXT, TEXT, TEXT) TO authenticated;

-- =============================================
-- 5. REVOGAR execução do signup padrão para anon (opcional; signup ainda
-- necessário para convidados — o trigger bloqueia sem token)
-- =============================================

-- Nada a revogar: signup continua aberto mas o trigger exige token.
-- Recomenda-se também bloquear signup público no dashboard Supabase
-- (Authentication → Providers → Email → Disable new sign-ups)
-- e usar apenas auth.admin.inviteUserByEmail via edge function.
