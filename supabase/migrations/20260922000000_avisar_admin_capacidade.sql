-- SPEC 098 Fase 1, requisito 19: usuário sem permissão de desbloquear nível
-- (não-admin) que bate num limite de capacidade avisa os admins da própria
-- empresa em vez de ver o formulário de documento. Notificação (spec 029) +
-- e-mail (o cron de notificacoes-email-cron da spec 096 já cobre qualquer
-- notificacao nova, não precisa de envio separado aqui).

BEGIN;

CREATE OR REPLACE FUNCTION public.avisar_admin_capacidade(p_recurso text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_nome       text;
  v_titulo     text;
  v_destinatarios uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_recurso NOT IN ('projetos', 'obras', 'usuarios') THEN
    RAISE EXCEPTION 'Recurso inválido' USING ERRCODE = '22023';
  END IF;

  SELECT empresa_id, NULLIF(trim(concat(first_name, ' ', last_name)), '')
    INTO v_empresa_id, v_nome
  FROM public.profiles WHERE id = auth.uid();

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Perfil sem empresa' USING ERRCODE = '22023';
  END IF;

  SELECT array_agg(p.id) INTO v_destinatarios
  FROM public.profiles p
  WHERE p.empresa_id = v_empresa_id AND p.role IN ('admin', 'owner');

  v_titulo := CASE p_recurso
    WHEN 'projetos' THEN 'Limite de projetos do período de teste atingido'
    WHEN 'obras' THEN 'Limite de obras do período de teste atingido'
    ELSE 'Limite de usuários do período de teste atingido'
  END;

  RETURN public.notificar(
    v_empresa_id, v_destinatarios,
    'capacidade_avisar_admin:' || p_recurso, 'sistema', 'medium',
    v_titulo,
    COALESCE(v_nome, 'Um usuário') || ' tentou criar mais ' || p_recurso ||
      ' do que o período de teste permite. Informe o CNPJ da empresa ou ative um plano ' ||
      'em Configurações para liberar mais capacidade.',
    'empresas', v_empresa_id, '/configuracoes?tab=empresa'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.avisar_admin_capacidade(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.avisar_admin_capacidade(text) TO authenticated;

COMMENT ON FUNCTION public.avisar_admin_capacidade(text) IS
  'SPEC 098: usuário sem permissão de desbloquear nível avisa os admins da própria empresa ao bater um limite de capacidade do trial.';

COMMIT;
