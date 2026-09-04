-- Motor de tokens, extensão de controle por usuário (SPEC 094). Constrói sobre a
-- fundação (20260867000000, ADR 0035) e o enforcement por empresa (20260880000000,
-- SPEC 075): admin da equipe ganha teto opcional por usuário, sobre o MESMO pool da
-- empresa (nunca um saldo separado), e o usuário travado pode pedir mais ao admin
-- sem sair do produto.

-- =============================================
-- 1. ai_token_limite_usuario: ausência de linha = sem teto (comportamento atual).
--    Só existe linha quando o admin trava alguém deliberadamente.
-- =============================================

CREATE TABLE IF NOT EXISTS public.ai_token_limite_usuario (
  empresa_id    uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  limite_mensal bigint NOT NULL CHECK (limite_mensal > 0),
  criado_por    uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, user_id)
);

CREATE TRIGGER trg_ai_token_limite_usuario_updated_at
  BEFORE UPDATE ON public.ai_token_limite_usuario
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

REVOKE ALL ON TABLE public.ai_token_limite_usuario FROM anon;

-- =============================================
-- 2. ai_token_solicitacao: pedido de "mais tokens" do usuário travado pelo próprio
--    teto. Único pendente por vez (o botão não vira canal de spam pro admin).
-- =============================================

CREATE TABLE IF NOT EXISTS public.ai_token_solicitacao (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mensagem        text,
  limite_sugerido bigint CHECK (limite_sugerido IS NULL OR limite_sugerido > 0),
  status          text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'negado')),
  novo_limite     bigint CHECK (novo_limite IS NULL OR novo_limite > 0),
  resolvido_por   uuid REFERENCES public.profiles(id),
  resolvido_em    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_token_solicitacao_pendente_unica
  ON public.ai_token_solicitacao (empresa_id, user_id)
  WHERE status = 'pendente';

CREATE INDEX IF NOT EXISTS idx_ai_token_solicitacao_empresa
  ON public.ai_token_solicitacao (empresa_id, created_at DESC);

REVOKE ALL ON TABLE public.ai_token_solicitacao FROM anon;

-- =============================================
-- 3. Índice de suporte: SUM do consumo do ciclo por usuário (gate + view), sem
--    varrer o ledger inteiro. Mesma régua de (empresa_id, agent_key) já existente.
-- =============================================

CREATE INDEX IF NOT EXISTS idx_ai_token_ledger_empresa_user_source_created
  ON public.ai_token_ledger (empresa_id, user_id, source, created_at);

-- =============================================
-- 4. can_manage_equipe(): mesmo esqueleto de can_view_financeiro()
--    (20260904000000) — admin/owner sempre, coordenador só com equipe_delegado.
--    Vira o helper de RLS que hoje só existia como canDo('pessoas') no front.
-- =============================================

CREATE OR REPLACE FUNCTION public.can_manage_equipe()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_effective_role() IN ('admin', 'ultra_admin', 'owner')
    OR COALESCE(
      (SELECT equipe_delegado FROM public.profiles WHERE id = auth.uid()),
      FALSE
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_equipe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_equipe() TO authenticated;

-- =============================================
-- 5. RLS de ai_token_limite_usuario
--    SELECT: o próprio usuário vê só o SEU teto; quem administra equipe vê o de
--    toda a empresa. Nunca há policy de escrita para o próprio usuário — ele não
--    define o próprio teto, só pede (ai_token_solicitacao).
-- =============================================

ALTER TABLE public.ai_token_limite_usuario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "limite_usuario_select" ON public.ai_token_limite_usuario;
CREATE POLICY "limite_usuario_select" ON public.ai_token_limite_usuario
  FOR SELECT USING (
    user_id = auth.uid()
    OR (empresa_id = public.get_user_empresa_id() AND public.can_manage_equipe())
    OR public.is_ultra_admin()
  );

DROP POLICY IF EXISTS "limite_usuario_insert" ON public.ai_token_limite_usuario;
CREATE POLICY "limite_usuario_insert" ON public.ai_token_limite_usuario
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id() AND public.can_manage_equipe()
  );

DROP POLICY IF EXISTS "limite_usuario_update" ON public.ai_token_limite_usuario;
CREATE POLICY "limite_usuario_update" ON public.ai_token_limite_usuario
  FOR UPDATE USING (
    empresa_id = public.get_user_empresa_id() AND public.can_manage_equipe()
  ) WITH CHECK (
    empresa_id = public.get_user_empresa_id() AND public.can_manage_equipe()
  );

DROP POLICY IF EXISTS "limite_usuario_delete" ON public.ai_token_limite_usuario;
CREATE POLICY "limite_usuario_delete" ON public.ai_token_limite_usuario
  FOR DELETE USING (
    empresa_id = public.get_user_empresa_id() AND public.can_manage_equipe()
  );

-- =============================================
-- 6. RLS de ai_token_solicitacao
--    SELECT: o próprio autor, ou quem administra equipe (mensagem do pedido é
--    conteúdo pessoal, não é aberto pra empresa toda como o extrato de consumo).
--    Nenhuma policy de INSERT/UPDATE/DELETE para authenticated: as duas RPCs
--    abaixo rodam SECURITY DEFINER e são o único caminho de escrita (mesmo
--    padrão de `notificacoes`: cliente nunca insere/edita direto).
-- =============================================

ALTER TABLE public.ai_token_solicitacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "solicitacao_select" ON public.ai_token_solicitacao;
CREATE POLICY "solicitacao_select" ON public.ai_token_solicitacao
  FOR SELECT USING (
    user_id = auth.uid()
    OR (empresa_id = public.get_user_empresa_id() AND public.can_manage_equipe())
    OR public.is_ultra_admin()
  );

-- =============================================
-- 7. gate_tokens ganha p_user_id (DEFAULT NULL: chamadas antigas, o cron de
--    renovação e o bootstrap seguem idênticos). Função com overload por tipo de
--    assinatura exige DROP+CREATE, nunca só CREATE OR REPLACE (achado de 27/08,
--    já documentado na spec 074) — CREATE OR REPLACE aqui criaria um SEGUNDO
--    overload (uuid) além do (uuid, uuid), órfão e sem os REVOKE/GRANT novos.
--
--    Motivo de bloqueio (bloqueado_motivo) tem prioridade saldo_empresa sobre
--    limite_usuario: se os dois estourarem juntos, o problema é da empresa, não
--    da pessoa (spec 094).
-- =============================================

DROP FUNCTION IF EXISTS public.gate_tokens(uuid);

CREATE FUNCTION public.gate_tokens(p_empresa_id uuid, p_user_id uuid DEFAULT NULL)
RETURNS TABLE (saldo_plano bigint, saldo_comprado bigint, cota_ciclo bigint, bloqueado_motivo text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ciclo text := to_char(now(), 'YYYY-MM');
  v_ref_grant text;
  v_cota bigint;
  v_sobra bigint;
  v_saldo_plano bigint;
  v_saldo_comprado bigint;
  v_limite_usuario bigint;
  v_consumo_usuario bigint;
  v_motivo text;
BEGIN
  IF auth.role() <> 'service_role' AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'gate_tokens: apenas service_role pode executar'
      USING ERRCODE = '42501';
  END IF;

  v_ref_grant := 'plan_grant:' || p_empresa_id || ':' || v_ciclo;

  -- Caminho quente sem lock: ciclo já concedido → só devolve o saldo.
  IF NOT EXISTS (SELECT 1 FROM public.ai_token_ledger t WHERE t.reference_id = v_ref_grant) THEN
    -- Serializa concessões concorrentes da mesma empresa e RE-CHECA depois do lock
    -- (double-checked locking): sem isso, duas chamadas na virada do mês passam o IF
    -- juntas e a segunda expiraria a cota que a primeira acabou de conceder.
    INSERT INTO public.ai_token_saldo (empresa_id) VALUES (p_empresa_id)
    ON CONFLICT (empresa_id) DO NOTHING;
    PERFORM 1 FROM public.ai_token_saldo s WHERE s.empresa_id = p_empresa_id FOR UPDATE;

    IF NOT EXISTS (SELECT 1 FROM public.ai_token_ledger t WHERE t.reference_id = v_ref_grant) THEN
      -- Cota do plano da assinatura viva; sem assinatura (empresa antiga/trial manual),
      -- vale a cota do plano de entrada.
      SELECT p.tokens_mensais INTO v_cota
      FROM public.pilar_subscriptions s
      JOIN public.pilar_subscription_plans p ON p.id = s.plan_id
      WHERE s.empresa_id = p_empresa_id AND s.status IN ('trialing', 'active')
      LIMIT 1;
      IF v_cota IS NULL THEN
        SELECT p.tokens_mensais INTO v_cota
        FROM public.pilar_subscription_plans p
        WHERE p.slug = 'starter';
      END IF;
      v_cota := COALESCE(v_cota, 500000);

      -- Sobra do ciclo anterior expira (use-or-lose); balde comprado fica intacto.
      SELECT s.saldo_plano INTO v_sobra FROM public.ai_token_saldo s WHERE s.empresa_id = p_empresa_id;
      IF v_sobra > 0 THEN
        INSERT INTO public.ai_token_ledger (empresa_id, agent_key, source, tokens_delta, reference_id)
        VALUES (p_empresa_id, 'ciclo', 'plan_expire', -v_sobra, 'plan_expire:' || p_empresa_id || ':' || v_ciclo)
        ON CONFLICT (reference_id) WHERE reference_id IS NOT NULL DO NOTHING;
      END IF;

      INSERT INTO public.ai_token_ledger (empresa_id, agent_key, source, tokens_delta, reference_id)
      VALUES (p_empresa_id, 'ciclo', 'plan_grant', v_cota, v_ref_grant)
      ON CONFLICT (reference_id) WHERE reference_id IS NOT NULL DO NOTHING;
    END IF;
  END IF;

  SELECT s.saldo_plano, s.saldo_comprado INTO v_saldo_plano, v_saldo_comprado
  FROM public.ai_token_saldo s WHERE s.empresa_id = p_empresa_id;

  IF COALESCE(v_saldo_plano, 0) + COALESCE(v_saldo_comprado, 0) <= 0 THEN
    v_motivo := 'saldo_empresa';
  ELSIF p_user_id IS NOT NULL THEN
    SELECT l.limite_mensal INTO v_limite_usuario
    FROM public.ai_token_limite_usuario l
    WHERE l.empresa_id = p_empresa_id AND l.user_id = p_user_id;

    IF v_limite_usuario IS NOT NULL THEN
      SELECT COALESCE(SUM(t.tokens_input + t.tokens_output), 0) INTO v_consumo_usuario
      FROM public.ai_token_ledger t
      WHERE t.empresa_id = p_empresa_id AND t.user_id = p_user_id
        AND t.source = 'usage' AND t.created_at >= date_trunc('month', now());

      IF v_consumo_usuario >= v_limite_usuario THEN
        v_motivo := 'limite_usuario';
      END IF;
    END IF;
  END IF;

  RETURN QUERY
  SELECT s.saldo_plano, s.saldo_comprado,
         (SELECT t.tokens_delta::bigint FROM public.ai_token_ledger t WHERE t.reference_id = v_ref_grant),
         v_motivo
  FROM public.ai_token_saldo s
  WHERE s.empresa_id = p_empresa_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gate_tokens(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gate_tokens(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gate_tokens(uuid, uuid) TO service_role;

-- =============================================
-- 8. solicitar_mais_tokens: o usuário travado pede mais, sem sair do produto.
--    Idempotência social (não de retry): unique parcial acima barra um segundo
--    pedido pendente; a RAISE aqui só dá a mensagem certa antes do 23505 cru.
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
    RAISE EXCEPTION 'Você já tem um pedido de tokens em análise. Aguarde a resposta do administrador.'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.ai_token_solicitacao (empresa_id, user_id, mensagem, limite_sugerido)
  VALUES (v_empresa_id, auth.uid(), p_mensagem, p_limite_sugerido)
  RETURNING id INTO v_id;

  PERFORM public.notificar(
    v_empresa_id, public._notif_gestao(v_empresa_id),
    'tokens_solicitacao_usuario', 'financeiro', 'medium',
    'Pedido de mais tokens',
    COALESCE(v_nome, 'Um usuário') || ' atingiu o limite de tokens deste mês e pediu mais acesso. ' ||
      'Revise em Configurações > Uso > Equipe.',
    'ai_token_solicitacao', v_id, NULL
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.solicitar_mais_tokens(text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_mais_tokens(text, bigint) TO authenticated;

-- =============================================
-- 9. resolver_solicitacao_tokens: só quem can_manage_equipe(). Aprovar com
--    p_novo_limite NULL remove o teto do usuário (fica sem limite de novo).
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
    RAISE EXCEPTION 'Sem permissão para gerenciar limites de tokens da equipe'
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

-- =============================================
-- 10. v_uso_tokens_usuario_ciclo: fonte única da tabela do admin e do autoconsumo
--     do usuário comum. tokens_ciclo herda a RLS do ledger (leitura por qualquer
--     membro da empresa, mesmo padrão de transparência do extrato geral já
--     existente — princípio 2 do motor de tokens); limite_mensal herda a RLS
--     restrita da tabela 5 (só o próprio ou quem administra equipe). O front
--     decide o que MOSTRA a cada papel; a coluna sensível já vem protegida.
-- =============================================

DROP VIEW IF EXISTS public.v_uso_tokens_usuario_ciclo;
CREATE VIEW public.v_uso_tokens_usuario_ciclo
  WITH (security_invoker = true)
AS
SELECT
  p.empresa_id,
  p.id AS user_id,
  NULLIF(trim(concat(p.first_name, ' ', p.last_name)), '') AS user_nome,
  p.role,
  COALESCE(u.tokens_ciclo, 0)::bigint AS tokens_ciclo,
  l.limite_mensal,
  EXISTS (
    SELECT 1 FROM public.ai_token_solicitacao s
    WHERE s.empresa_id = p.empresa_id AND s.user_id = p.id AND s.status = 'pendente'
  ) AS solicitacao_pendente
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT SUM(t.tokens_input + t.tokens_output) AS tokens_ciclo
  FROM public.ai_token_ledger t
  WHERE t.empresa_id = p.empresa_id AND t.user_id = p.id
    AND t.source = 'usage' AND t.created_at >= date_trunc('month', now())
) u ON true
LEFT JOIN public.ai_token_limite_usuario l ON l.empresa_id = p.empresa_id AND l.user_id = p.id
WHERE p.empresa_id IS NOT NULL;

REVOKE ALL ON TABLE public.v_uso_tokens_usuario_ciclo FROM anon;
