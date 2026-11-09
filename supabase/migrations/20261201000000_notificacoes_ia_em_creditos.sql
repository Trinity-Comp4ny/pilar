-- Notificações de IA falam em créditos, não em tokens (DECISOES.md 2026-11-06).
--
-- O motor continua contando tokens; o cliente vê créditos na razão fixa de
-- 1 crédito = 5 mil tokens (src/lib/creditos.ts). Esta migration troca só o
-- texto que chega ao usuário: os tipos de notificação (`tokens_baixo`,
-- `tokens_solicitacao_usuario`) e os nomes das funções ficam, porque são
-- chaves internas usadas pelo dedupe, pelo roteamento e pelos testes.

BEGIN;

-- =============================================
-- 1. Aviso de saldo baixo, dentro de gerar_notificacoes_ambient(). A função é
--    longa e já foi ajustada no lugar por outras migrations (20261120000000,
--    20261125000000): lê a definição atual, troca o trecho exato e recria.
--    Se o trecho não existir exatamente uma vez, a migration falha em vez de
--    seguir com o texto antigo.
-- =============================================

CREATE FUNCTION pg_temp.sub_creditos(p_def text, p_de text, p_para text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_achou integer := (length(p_def) - length(replace(p_def, p_de, ''))) / length(p_de);
BEGIN
  IF v_achou <> 1 THEN
    RAISE EXCEPTION 'Créditos de IA: esperava 1 ocorrência de [%], achei %', p_de, v_achou;
  END IF;
  RETURN replace(p_def, p_de, p_para);
END;
$$;

DO $ambient$
DECLARE
  v_def text := pg_get_functiondef('public.gerar_notificacoes_ambient()'::regprocedure);
BEGIN
  v_def := pg_temp.sub_creditos(v_def,
    $x$'Tokens de IA acabando',$x$,
    $x$'Créditos de IA acabando',$x$);
  v_def := pg_temp.sub_creditos(v_def,
    $x$'Restam ' || rec.saldo_total || ' tokens de IA neste ciclo$x$,
    $x$'Restam ' || (rec.saldo_total / 5000) || ' créditos de IA neste ciclo$x$);
  EXECUTE v_def;
END;
$ambient$;

-- =============================================
-- 2. Pedido de mais créditos (spec 094): mesmo corpo de 20260910000000, só
--    o texto do erro e da notificação muda.
-- =============================================

CREATE OR REPLACE FUNCTION public.solicitar_mais_tokens(
  p_mensagem text DEFAULT NULL,
  p_limite_sugerido bigint DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_id uuid;
  v_nome text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT empresa_id, NULLIF(trim(concat(first_name, ' ', last_name)), '')
    INTO v_empresa_id, v_nome
  FROM public.profiles WHERE id = auth.uid();

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Perfil sem empresa' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ai_token_solicitacao
    WHERE empresa_id = v_empresa_id AND user_id = auth.uid() AND status = 'pendente'
  ) THEN
    RAISE EXCEPTION 'Você já tem um pedido de créditos de IA em análise. Aguarde a resposta do administrador.'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.ai_token_solicitacao (empresa_id, user_id, mensagem, limite_sugerido)
  VALUES (v_empresa_id, auth.uid(), p_mensagem, p_limite_sugerido)
  RETURNING id INTO v_id;

  PERFORM public.notificar(
    v_empresa_id, public._notif_gestao(v_empresa_id),
    'tokens_solicitacao_usuario', 'financeiro', 'medium',
    'Pedido de mais créditos de IA',
    COALESCE(v_nome, 'Um usuário') || ' atingiu o limite de créditos de IA deste mês e pediu mais. ' ||
      'Revise em Configurações > Uso > Equipe.',
    'ai_token_solicitacao', v_id, NULL
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.solicitar_mais_tokens(text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_mais_tokens(text, bigint) TO authenticated;

-- =============================================
-- 3. Resolver o pedido: só a mensagem de permissão fala em créditos.
-- =============================================

CREATE OR REPLACE FUNCTION public.resolver_solicitacao_tokens(
  p_solicitacao_id uuid,
  p_aprovar boolean,
  p_novo_limite bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_user_id uuid;
  v_status text;
BEGIN
  IF NOT public.can_manage_equipe() THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar limites de créditos de IA da equipe'
      USING ERRCODE = '42501';
  END IF;

  SELECT empresa_id, user_id, status INTO v_empresa_id, v_user_id, v_status
  FROM public.ai_token_solicitacao WHERE id = p_solicitacao_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada' USING ERRCODE = '22023';
  END IF;

  IF v_empresa_id IS DISTINCT FROM public.get_user_empresa_id() AND NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Sem permissão para editar solicitação de outra empresa'
      USING ERRCODE = '42501';
  END IF;

  IF v_status <> 'pendente' THEN
    RAISE EXCEPTION 'Esta solicitação já foi resolvida' USING ERRCODE = '22023';
  END IF;

  IF p_aprovar THEN
    IF p_novo_limite IS NULL THEN
      DELETE FROM public.ai_token_limite_usuario WHERE empresa_id = v_empresa_id AND user_id = v_user_id;
    ELSE
      INSERT INTO public.ai_token_limite_usuario (empresa_id, user_id, limite_mensal, criado_por)
      VALUES (v_empresa_id, v_user_id, p_novo_limite, auth.uid())
      ON CONFLICT (empresa_id, user_id)
      DO UPDATE SET limite_mensal = EXCLUDED.limite_mensal, updated_at = now();
    END IF;
  END IF;

  UPDATE public.ai_token_solicitacao
  SET status = CASE WHEN p_aprovar THEN 'aprovado' ELSE 'negado' END,
      novo_limite = CASE WHEN p_aprovar THEN p_novo_limite ELSE NULL END,
      resolvido_por = auth.uid(),
      resolvido_em = now()
  WHERE id = p_solicitacao_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolver_solicitacao_tokens(uuid, boolean, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_solicitacao_tokens(uuid, boolean, bigint) TO authenticated;

COMMIT;
