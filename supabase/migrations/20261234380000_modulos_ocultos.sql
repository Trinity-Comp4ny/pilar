-- SPEC 171 / ADR 0066: módulos ocultos por empresa e por usuário (lista de exclusão).
-- Vazio = vê tudo. Fase 1 é gate de experiência: nenhuma policy muda aqui.

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS modulos_ocultos text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS modulos_ocultos text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_modulos_ocultos_validos
  CHECK (modulos_ocultos <@ ARRAY['gestao','projetos','obras']::text[]);
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_modulos_ocultos_validos
  CHECK (modulos_ocultos <@ ARRAY['gestao','projetos','obras']::text[]);

-- profiles já tem UPDATE revogado da tabela e concedido por coluna (financeiro_delegado_core):
-- a coluna nova fica fora da lista de propósito, então o usuário não edita a própria lista.
-- Única via de escrita: set_modulos_ocultos (SECURITY DEFINER).

DROP FUNCTION IF EXISTS public.set_modulos_ocultos(text, uuid, text[]);
CREATE FUNCTION public.set_modulos_ocultos(p_alvo text, p_usuario_id uuid, p_modulos text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_modulos text[] := COALESCE(p_modulos, '{}');
  v_caller_empresa uuid;
  v_target_empresa uuid;
  v_target_role public.user_role;
  v_empresa_ocultos text[];
  v_total constant int := 3;
BEGIN
  IF NOT (public.has_role('admin') OR public.is_ultra_admin()) THEN
    RAISE EXCEPTION 'Apenas administradores podem ocultar módulos' USING ERRCODE = '42501';
  END IF;

  IF NOT (v_modulos <@ ARRAY['gestao','projetos','obras']::text[]) THEN
    RAISE EXCEPTION 'Módulo inválido' USING ERRCODE = '22023';
  END IF;

  v_modulos := ARRAY(SELECT DISTINCT m FROM unnest(v_modulos) AS m ORDER BY m);
  v_caller_empresa := public.get_user_empresa_id();

  IF p_alvo = 'empresa' THEN
    IF cardinality(v_modulos) >= v_total THEN
      RAISE EXCEPTION 'A empresa precisa de pelo menos um módulo visível' USING ERRCODE = '22023';
    END IF;

    UPDATE public.empresas SET modulos_ocultos = v_modulos WHERE id = v_caller_empresa;
    RETURN;
  END IF;

  IF p_alvo <> 'usuario' THEN
    RAISE EXCEPTION 'Alvo inválido' USING ERRCODE = '22023';
  END IF;

  SELECT empresa_id, role INTO v_target_empresa, v_target_role
  FROM public.profiles WHERE id = p_usuario_id;

  IF v_target_empresa IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_ultra_admin() AND v_target_empresa IS DISTINCT FROM v_caller_empresa THEN
    RAISE EXCEPTION 'Sem permissão para editar usuário de outra empresa' USING ERRCODE = '42501';
  END IF;

  IF v_target_role IN ('admin', 'ultra_admin') THEN
    RAISE EXCEPTION 'Administradores sempre veem todos os módulos' USING ERRCODE = '42501';
  END IF;

  SELECT modulos_ocultos INTO v_empresa_ocultos FROM public.empresas WHERE id = v_target_empresa;

  -- O efetivo é a união empresa + usuário; precisa sobrar ao menos um módulo.
  IF cardinality(ARRAY(SELECT DISTINCT m FROM unnest(v_modulos || COALESCE(v_empresa_ocultos, '{}')) AS m)) >= v_total THEN
    RAISE EXCEPTION 'O usuário precisa de pelo menos um módulo visível' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
  SET modulos_ocultos = v_modulos, updated_at = NOW(), updated_by = auth.uid()
  WHERE id = p_usuario_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_modulos_ocultos(text, uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_modulos_ocultos(text, uuid, text[]) TO authenticated;
