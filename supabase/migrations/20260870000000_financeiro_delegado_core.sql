-- SPEC 073 / ADR 0034: financeiro vira dois eixos (papel x concessão).
-- Fase 1: coluna, guards de escrita, os dois helpers de sigilo, RPC de
-- concessão, whitelist de papéis vivos nas RPCs de atribuição.
--
-- Nenhuma policy muda aqui ainda (fase 2). Esta migration só cria a base;
-- can_view_financeiro/can_view_folha ficam prontas mas ainda sem consumidor.

-- ==========================================================================
-- 1. Coluna nova: boolean único, sem JSONB, sem validação de subconjunto.
--    Escrita só pela RPC set_financeiro_delegado (seção 3): revoga UPDATE
--    da coluna de authenticated/anon, e o trigger de tampering (seção 4)
--    barra qualquer tentativa de contornar isso num UPDATE do próprio profile.
--
--    ATENÇÃO: REVOKE UPDATE (coluna) sozinho não bloqueia nada aqui — public.
--    profiles já tem GRANT ALL ON TABLE ... TO authenticated desde o schema
--    base (000_base_schema.sql), e privilégio de coluna no Postgres é aditivo
--    ao de tabela, nunca subtrativo: revogar só a coluna deixa o grant de
--    tabela valendo. Preciso revogar UPDATE da TABELA inteira e reconceder
--    coluna a coluna, exatamente o padrão que pessoas_safe já usa para
--    SELECT (20260715000050_pessoas_safe_view.sql). Sem isso, a "dupla
--    barreira" do comentário acima seria só uma (o trigger de tampering).
-- ==========================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS financeiro_delegado boolean NOT NULL DEFAULT false;

REVOKE UPDATE ON public.profiles FROM authenticated, anon;

GRANT UPDATE (
  avatar_url, contato, created_at, created_by, email, empresa_id, first_name,
  id, last_name, nome, onboarding_completed, onboarding_state, role,
  updated_at, updated_by
) ON public.profiles TO authenticated, anon;
-- financeiro_delegado de propósito FORA da lista: só muda via
-- set_financeiro_delegado (SECURITY DEFINER, seção 3).

-- ==========================================================================
-- 2. can_view_financeiro / can_view_folha: os dois helpers de sigilo.
--    Admin nunca depende do flag (has_role() primeiro, sempre OR, nunca a
--    única condição) — é a lição direta do incidente do ADR 0029: lá o bug
--    foi provisionamento que dependia de um grant explícito existir.
-- ==========================================================================
DROP FUNCTION IF EXISTS public.can_view_financeiro();
CREATE FUNCTION public.can_view_financeiro()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role('admin')
    OR COALESCE(
      (SELECT financeiro_delegado FROM public.profiles WHERE id = auth.uid()),
      FALSE
    );
$$;

REVOKE ALL ON FUNCTION public.can_view_financeiro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_financeiro() TO authenticated;

-- Folha e PII (salário, CPF completo, chave PIX, conta bancária): só admin,
-- sem bypass por financeiro_delegado, nunca. Substitui a versão anterior
-- (20260818000000), que dependia de user_has_feature('financeiro','editor')
-- e ficou sem efeito quando o ADR 0029 fez editor == viewer para todo mundo.
--
-- CREATE OR REPLACE (não DROP+CREATE): a view pessoas_safe depende desta
-- função e a assinatura não muda, então não há risco de overload.
CREATE OR REPLACE FUNCTION public.can_view_folha()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role('admin');
$$;

REVOKE ALL ON FUNCTION public.can_view_folha() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_folha() TO authenticated;

-- ==========================================================================
-- 3. set_financeiro_delegado: único caminho de escrita da coluna.
--    Mesmo padrão de escopo de update_user_access (admin só edita a própria
--    empresa; ultra_admin cruza). Grava em audit_log via o trigger da seção 4
--    (AFTER UPDATE), não aqui — mantém a auditoria num único lugar.
-- ==========================================================================
DROP FUNCTION IF EXISTS public.set_financeiro_delegado(uuid, boolean);
CREATE FUNCTION public.set_financeiro_delegado(p_user_id uuid, p_delegado boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_empresa uuid;
  v_target_empresa uuid;
  v_target_role public.user_role;
BEGIN
  IF NOT (public.has_role('admin') OR public.is_ultra_admin()) THEN
    RAISE EXCEPTION 'Apenas administradores podem conceder acesso financeiro'
      USING ERRCODE = '42501';
  END IF;

  v_caller_empresa := public.get_user_empresa_id();

  SELECT empresa_id, role INTO v_target_empresa, v_target_role
  FROM public.profiles WHERE id = p_user_id;

  IF v_target_empresa IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_ultra_admin() AND v_target_empresa IS DISTINCT FROM v_caller_empresa THEN
    RAISE EXCEPTION 'Sem permissão para editar usuário de outra empresa'
      USING ERRCODE = '42501';
  END IF;

  IF v_target_role = 'ultra_admin' THEN
    RAISE EXCEPTION 'Ultra admin não usa o toggle de acesso financeiro'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET financeiro_delegado = p_delegado,
      updated_at = NOW(),
      updated_by = auth.uid()
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_financeiro_delegado(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_financeiro_delegado(uuid, boolean) TO authenticated;

-- ==========================================================================
-- 4. Auditoria e anti-tampering: estende os triggers de profiles existentes
--    (20260854000000) para cobrir financeiro_delegado além de role.
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.tg_audit_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id UUID := COALESCE(NEW.empresa_id, OLD.empresa_id);
  v_actor      UUID := COALESCE(auth.uid(), NEW.updated_by, OLD.updated_by);
  v_email      TEXT;
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = v_actor;

    PERFORM public.insert_audit_log(
      'role_change', 'profiles', OLD.id,
      jsonb_build_object('role', jsonb_build_object('old', OLD.role, 'new', NEW.role)),
      v_actor, v_email,
      jsonb_build_object('empresa_id', v_empresa_id, 'target_email', OLD.email)
    );
  END IF;

  IF OLD.financeiro_delegado IS DISTINCT FROM NEW.financeiro_delegado THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = v_actor;

    PERFORM public.insert_audit_log(
      'financeiro_delegado_change', 'profiles', OLD.id,
      jsonb_build_object('financeiro_delegado', jsonb_build_object(
        'old', OLD.financeiro_delegado, 'new', NEW.financeiro_delegado
      )),
      v_actor, v_email,
      jsonb_build_object('empresa_id', v_empresa_id, 'target_email', OLD.email)
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS audit_profile_changes ON public.profiles;
CREATE TRIGGER audit_profile_changes
  AFTER UPDATE OF role, financeiro_delegado ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_profile_changes();

-- Bloqueia autoconcessão: sem esta checagem, o REVOKE UPDATE da seção 1
-- barra o cliente PostgREST comum, mas qualquer caminho que rode como
-- 'authenticated' (RPC mal escrita, policy futura) ainda passaria pelo
-- trigger sem isso. Defesa em profundidade, mesmo padrão de role/empresa_id.
CREATE OR REPLACE FUNCTION public.tg_prevent_profile_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Bloqueia concessão de acesso financeiro por não-admin (autoconcessão
  -- inclusa: um admin não pode ser o próprio alvo por engano de UI, mas a
  -- checagem aqui é sobre QUEM concede, não sobre o alvo).
  IF NEW.financeiro_delegado IS DISTINCT FROM OLD.financeiro_delegado THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'ultra_admin')
    ) THEN
      RAISE EXCEPTION 'Permissão negada: alteração de acesso financeiro não autorizada';
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

  RETURN NEW;
END;
$function$;

-- ==========================================================================
-- 5. update_user_access / set_access_profile: whitelist de papéis vivos.
--    Hoje as duas ainda deixam cunhar 'owner'/'colaborador', que não passam
--    em has_role('admin') e ficariam fora do gate novo (ex.: um sócio
--    promovido a 'owner' perderia financeiro).
-- ==========================================================================
DROP FUNCTION IF EXISTS public.update_user_access(uuid, text);
CREATE FUNCTION public.update_user_access(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_empresa UUID;
  v_target_empresa UUID;
  v_target_role public.user_role;
  v_new_role public.user_role;
BEGIN
  v_caller_empresa := public.get_user_empresa_id();

  IF NOT (public.has_role('admin') OR public.is_ultra_admin()) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar acessos';
  END IF;

  SELECT empresa_id, role INTO v_target_empresa, v_target_role
  FROM public.profiles WHERE id = p_user_id;

  IF v_target_empresa IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  IF NOT public.is_ultra_admin() AND v_target_empresa <> v_caller_empresa THEN
    RAISE EXCEPTION 'Sem permissão para editar usuário de outra empresa';
  END IF;

  IF v_target_role = 'ultra_admin' THEN
    RAISE EXCEPTION 'Ultra admin só pode ser editado via SQL direto';
  END IF;

  BEGIN
    v_new_role := p_role::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Role inválido: %', p_role;
  END;

  IF v_new_role = 'ultra_admin' THEN
    RAISE EXCEPTION 'Promoção a ultra_admin requer SQL direto';
  END IF;

  -- Whitelist: só os três papéis vivos. owner/colaborador (deprecados-em-lugar,
  -- ADR 0034) e os legados de contrato caem em 'user', igual ao backfill de
  -- segurança abaixo.
  IF v_new_role NOT IN ('user', 'coordenador', 'admin') THEN
    v_new_role := 'user';
  END IF;

  UPDATE public.profiles
  SET role = v_new_role,
      updated_at = NOW(),
      updated_by = auth.uid()
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_user_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_user_access(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.set_access_profile(uuid, text);
CREATE FUNCTION public.set_access_profile(p_user_id uuid, p_perfil text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   public.user_role;
  v_caller_emp    uuid;
  v_target_emp    uuid;
  v_target_role   public.user_role;
BEGIN
  -- 'coordenador' entra na whitelist: era só owner/coordenador/colaborador
  -- (modelo A da spec 031, nunca chegou a virar autoridade real). Agora
  -- coordenador É o papel vivo; owner/colaborador saem, mapeiam pra admin/user.
  IF p_perfil NOT IN ('user', 'coordenador', 'admin') THEN
    RAISE EXCEPTION 'Perfil inválido: %', p_perfil USING ERRCODE = '22023';
  END IF;

  SELECT role, empresa_id INTO v_caller_role, v_caller_emp
  FROM public.profiles WHERE id = auth.uid();

  IF v_caller_role IS NULL
     OR v_caller_role NOT IN ('admin', 'ultra_admin') THEN
    RAISE EXCEPTION 'Apenas admin podem definir perfis de acesso'
      USING ERRCODE = '42501';
  END IF;

  SELECT role, empresa_id INTO v_target_role, v_target_emp
  FROM public.profiles WHERE id = p_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = '22023';
  END IF;

  IF v_caller_role <> 'ultra_admin' AND v_target_emp IS DISTINCT FROM v_caller_emp THEN
    RAISE EXCEPTION 'Usuário de outra empresa' USING ERRCODE = '42501';
  END IF;

  IF v_target_role = 'ultra_admin' THEN
    RAISE EXCEPTION 'Não é possível alterar o perfil de um ultra_admin'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET role = p_perfil::public.user_role
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_access_profile(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_access_profile(uuid, text) TO authenticated;

-- ==========================================================================
-- 6. Backfill idempotente: qualquer role residual owner/colaborador cai no
--    modelo vivo. 'financeiro'/'marketing'/'operacional'/'editor'/'viewer'
--    nem existem mais como label do enum (removidos em 20260504700000,
--    cleanup_user_role_enum) — incluí-los aqui quebraria o UPDATE inteiro
--    (Postgres valida o literal do enum antes do WHERE rodar).
-- ==========================================================================
UPDATE public.profiles SET role = 'admin' WHERE role = 'owner';
UPDATE public.profiles SET role = 'user'  WHERE role = 'colaborador';
