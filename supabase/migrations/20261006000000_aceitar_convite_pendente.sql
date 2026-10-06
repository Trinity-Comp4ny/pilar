-- Recuperação de contas Auth órfãs: sem parâmetros de tenant/role vindos do
-- client. O vínculo é derivado do convite enviado ao email confirmado da conta.
CREATE OR REPLACE FUNCTION public.aceitar_convite_pendente()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmado timestamptz;
  v_convite public.convites%ROWTYPE;
  v_role public.user_role;
  v_nome text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE = '42501';
  END IF;

  -- Serializa duas recuperações da mesma conta, mesmo para convites distintos.
  SELECT lower(btrim(email)), email_confirmed_at INTO v_email, v_confirmado
  FROM auth.users WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid) THEN
    RETURN v_uid;
  END IF;
  IF v_confirmado IS NULL OR v_email IS NULL THEN
    RAISE EXCEPTION 'Confirme seu email pelo link de acesso enviado pelo administrador' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_convite FROM public.convites
  WHERE lower(btrim(email)) = v_email AND usado_em IS NULL AND expira_em > now()
  ORDER BY created_at DESC, id DESC
  LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_convite.cargo::text IN ('owner', 'ultra_admin') THEN
    RAISE EXCEPTION 'Cargo não permitido no convite' USING ERRCODE = '42501';
  END IF;
  v_role := CASE WHEN v_convite.cargo::text IN ('admin', 'coordenador', 'user')
    THEN v_convite.cargo ELSE 'user'::public.user_role END;
  v_nome := coalesce(nullif(btrim(v_convite.nome), ''), split_part(v_email, '@', 1));

  INSERT INTO public.profiles (id, empresa_id, email, role, first_name, last_name, onboarding_completed)
  VALUES (v_uid, v_convite.empresa_id, v_email, v_role,
    split_part(v_nome, ' ', 1), btrim(substr(v_nome, length(split_part(v_nome, ' ', 1)) + 1)), false);
  UPDATE public.convites SET usado_em = now() WHERE id = v_convite.id;
  RETURN v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.aceitar_convite_pendente() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.aceitar_convite_pendente() TO authenticated;
COMMENT ON FUNCTION public.aceitar_convite_pendente() IS
  'Cria o profile ausente a partir do convite válido mais recente para o email confirmado da própria conta. Idempotente; nunca muda um profile existente.';
