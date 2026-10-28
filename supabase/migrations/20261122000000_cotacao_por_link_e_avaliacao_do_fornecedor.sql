-- SPEC 144 (BEZ-351): cotação por link e nota do fornecedor.
--
-- 1. obra_cotacao_convite: um link por fornecedor por cotação. O token nunca é guardado, só o
--    hash (SHA-256). Quem escreve é só a RPC (SECURITY DEFINER); o authenticated lê, sem o hash.
-- 2. obra_cotacao_proposta: origem (manual ou link) e desconto em %.
-- 3. fornecedor_avaliacao: nota de 0 a 5 em 4 critérios, dada pelo escritório na proposta vencedora.
-- 4. RPCs do escritório: criar e revogar convite, avaliar fornecedor.
-- 5. RPCs só do service_role (a edge `cotacao-link` chama): consultar e responder pelo hash do token.
--
-- Fica de fora desta migration: cotação em cesta (tipo = 'cesta'); o link é só do tipo 'item'.

-- ---------------------------------------------------------------------------
-- 1. Convites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.obra_cotacao_convite (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cotacao_id      uuid NOT NULL REFERENCES public.obra_cotacao(id) ON DELETE CASCADE,
  fornecedor_id   uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  fornecedor_nome text NOT NULL CHECK (char_length(btrim(fornecedor_nome)) BETWEEN 2 AND 200),
  token_hash      text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expira_em       timestamptz NOT NULL,
  aberto_em       timestamptz,
  respondido_em   timestamptz,
  revogado_em     timestamptz,
  proposta_id     uuid REFERENCES public.obra_cotacao_proposta(id) ON DELETE SET NULL,
  created_by      uuid NOT NULL DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obra_cotacao_convite_cotacao ON public.obra_cotacao_convite (cotacao_id);
CREATE INDEX IF NOT EXISTS idx_obra_cotacao_convite_empresa ON public.obra_cotacao_convite (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_cotacao_convite_fornecedor ON public.obra_cotacao_convite (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_obra_cotacao_convite_proposta
  ON public.obra_cotacao_convite (proposta_id) WHERE proposta_id IS NOT NULL;

ALTER TABLE public.obra_cotacao_convite ENABLE ROW LEVEL SECURITY;

-- Empresa em modo leitura (pós-trial) não gera link: mesmo gatilho das demais tabelas de operação.
CREATE TRIGGER trg_enforce_empresa_nao_leitura
  BEFORE INSERT OR UPDATE OR DELETE ON public.obra_cotacao_convite
  FOR EACH ROW EXECUTE FUNCTION public.enforce_empresa_nao_leitura();

CREATE POLICY obra_cotacao_convite_select ON public.obra_cotacao_convite
  FOR SELECT USING (empresa_id = (SELECT public.get_user_empresa_id()));

-- Sem policy de escrita: INSERT, UPDATE e DELETE só pelas RPCs. O hash do token não sai por SELECT.
REVOKE ALL ON public.obra_cotacao_convite FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, empresa_id, cotacao_id, fornecedor_id, fornecedor_nome, expira_em, aberto_em,
              respondido_em, revogado_em, proposta_id, created_by, created_at)
  ON public.obra_cotacao_convite TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Proposta: origem e desconto
-- ---------------------------------------------------------------------------
ALTER TABLE public.obra_cotacao_proposta
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual'
    CHECK (origem IN ('manual', 'link')),
  ADD COLUMN IF NOT EXISTS desconto_pct numeric(5,2)
    CHECK (desconto_pct IS NULL OR (desconto_pct >= 0 AND desconto_pct <= 100));

-- ---------------------------------------------------------------------------
-- 3. Avaliação do fornecedor
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fornecedor_avaliacao (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  fornecedor_id  uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  cotacao_id     uuid NOT NULL REFERENCES public.obra_cotacao(id) ON DELETE CASCADE,
  proposta_id    uuid NOT NULL UNIQUE REFERENCES public.obra_cotacao_proposta(id) ON DELETE CASCADE,
  nota_demora    smallint CHECK (nota_demora BETWEEN 0 AND 5),
  nota_preco     smallint CHECK (nota_preco BETWEEN 0 AND 5),
  nota_prazo     smallint CHECK (nota_prazo BETWEEN 0 AND 5),
  nota_qualidade smallint CHECK (nota_qualidade BETWEEN 0 AND 5),
  nota_geral     numeric(2,1),
  comentario     text CHECK (comentario IS NULL OR char_length(comentario) <= 500),
  avaliado_por   uuid NOT NULL DEFAULT auth.uid(),
  avaliado_em    timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fornecedor_avaliacao_ao_menos_um_criterio
    CHECK (num_nonnulls(nota_demora, nota_preco, nota_prazo, nota_qualidade) >= 1)
);

CREATE INDEX IF NOT EXISTS idx_fornecedor_avaliacao_fornecedor ON public.fornecedor_avaliacao (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_fornecedor_avaliacao_empresa ON public.fornecedor_avaliacao (empresa_id);
CREATE INDEX IF NOT EXISTS idx_fornecedor_avaliacao_cotacao ON public.fornecedor_avaliacao (cotacao_id);

-- nota_geral = média dos critérios preenchidos, uma casa decimal.
CREATE OR REPLACE FUNCTION public.tg_fornecedor_avaliacao_nota_geral()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.nota_geral := round(
    (COALESCE(NEW.nota_demora, 0) + COALESCE(NEW.nota_preco, 0)
     + COALESCE(NEW.nota_prazo, 0) + COALESCE(NEW.nota_qualidade, 0))::numeric
    / NULLIF(num_nonnulls(NEW.nota_demora, NEW.nota_preco, NEW.nota_prazo, NEW.nota_qualidade), 0),
    1);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fornecedor_avaliacao_nota_geral
  BEFORE INSERT OR UPDATE ON public.fornecedor_avaliacao
  FOR EACH ROW EXECUTE FUNCTION public.tg_fornecedor_avaliacao_nota_geral();

ALTER TABLE public.fornecedor_avaliacao ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_enforce_empresa_nao_leitura
  BEFORE INSERT OR UPDATE OR DELETE ON public.fornecedor_avaliacao
  FOR EACH ROW EXECUTE FUNCTION public.enforce_empresa_nao_leitura();

CREATE POLICY fornecedor_avaliacao_select ON public.fornecedor_avaliacao
  FOR SELECT USING (empresa_id = (SELECT public.get_user_empresa_id()));

REVOKE ALL ON public.fornecedor_avaliacao FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fornecedor_avaliacao TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. RPCs do escritório
-- ---------------------------------------------------------------------------

-- Gera o link. Devolve o token UMA vez; no banco fica só o hash. Fornecedor novo (sem id)
-- entra no cadastro com o nome digitado.
CREATE OR REPLACE FUNCTION public.rpc_criar_convite_cotacao(
  p_cotacao_id      uuid,
  p_fornecedor_id   uuid DEFAULT NULL,
  p_fornecedor_nome text DEFAULT NULL,
  p_validade_dias   integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
  v_cot     public.obra_cotacao%ROWTYPE;
  v_forn_id uuid;
  v_nome    text;
  v_token   text;
  v_expira  timestamptz;
  v_id      uuid;
BEGIN
  IF v_empresa IS NULL OR NOT public.user_has_feature('obras', 'editor') THEN
    RAISE EXCEPTION 'Cotação não encontrada ou sem permissão';
  END IF;

  IF p_validade_dias IS NULL OR p_validade_dias < 1 OR p_validade_dias > 30 THEN
    RAISE EXCEPTION 'A validade do link vai de 1 a 30 dias';
  END IF;

  SELECT * INTO v_cot
  FROM public.obra_cotacao
  WHERE id = p_cotacao_id AND empresa_id = v_empresa AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada ou sem permissão';
  END IF;
  IF v_cot.status <> 'aberta' THEN
    RAISE EXCEPTION 'A cotação já foi decidida ou cancelada';
  END IF;
  IF v_cot.tipo <> 'item' THEN
    RAISE EXCEPTION 'O link vale para cotação de item único';
  END IF;

  IF (SELECT count(*) FROM public.obra_cotacao_convite
      WHERE cotacao_id = p_cotacao_id AND revogado_em IS NULL AND respondido_em IS NULL
        AND expira_em > now()) >= 20 THEN
    RAISE EXCEPTION 'Esta cotação já tem 20 links ativos';
  END IF;

  IF p_fornecedor_id IS NOT NULL THEN
    SELECT id, nome INTO v_forn_id, v_nome
    FROM public.fornecedores
    WHERE id = p_fornecedor_id AND empresa_id = v_empresa AND deleted_at IS NULL;
    IF v_forn_id IS NULL THEN
      RAISE EXCEPTION 'Fornecedor não encontrado';
    END IF;
  ELSE
    v_nome := btrim(COALESCE(p_fornecedor_nome, ''));
    IF char_length(v_nome) < 2 OR char_length(v_nome) > 200 THEN
      RAISE EXCEPTION 'Informe o nome do fornecedor';
    END IF;
    INSERT INTO public.fornecedores (empresa_id, nome) VALUES (v_empresa, v_nome) RETURNING id INTO v_forn_id;
  END IF;

  -- 32 bytes aleatórios em base64url, sem preenchimento.
  v_token := translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_token := translate(v_token, E'\n', '');
  v_expira := now() + make_interval(days => p_validade_dias);

  INSERT INTO public.obra_cotacao_convite
    (empresa_id, cotacao_id, fornecedor_id, fornecedor_nome, token_hash, expira_em)
  VALUES
    (v_empresa, p_cotacao_id, v_forn_id, v_nome, encode(digest(v_token, 'sha256'), 'hex'), v_expira)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('convite_id', v_id, 'token', v_token, 'expira_em', v_expira, 'fornecedor_id', v_forn_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_revogar_convite_cotacao(p_convite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
BEGIN
  IF v_empresa IS NULL OR NOT public.user_has_feature('obras', 'editor') THEN
    RAISE EXCEPTION 'Convite não encontrado ou sem permissão';
  END IF;

  UPDATE public.obra_cotacao_convite
  SET revogado_em = COALESCE(revogado_em, now())
  WHERE id = p_convite_id AND empresa_id = v_empresa;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado ou sem permissão';
  END IF;
END;
$$;

-- Avalia o fornecedor da proposta vencedora. Reenviar edita a avaliação da mesma proposta.
CREATE OR REPLACE FUNCTION public.rpc_avaliar_fornecedor(
  p_proposta_id uuid,
  p_demora      smallint DEFAULT NULL,
  p_preco       smallint DEFAULT NULL,
  p_prazo       smallint DEFAULT NULL,
  p_qualidade   smallint DEFAULT NULL,
  p_comentario  text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
  v_prop    public.obra_cotacao_proposta%ROWTYPE;
  v_nota    numeric;
BEGIN
  IF v_empresa IS NULL OR NOT public.user_has_feature('obras', 'editor') THEN
    RAISE EXCEPTION 'Proposta não encontrada ou sem permissão';
  END IF;

  SELECT p.* INTO v_prop
  FROM public.obra_cotacao_proposta p
  JOIN public.obra_cotacao c ON c.id = p.cotacao_id
  WHERE p.id = p_proposta_id
    AND p.empresa_id = v_empresa AND p.deleted_at IS NULL
    AND c.empresa_id = v_empresa AND c.deleted_at IS NULL
    AND c.proposta_vencedora_id = p.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Só a proposta vencedora pode ser avaliada';
  END IF;
  IF v_prop.fornecedor_id IS NULL THEN
    RAISE EXCEPTION 'A proposta não tem fornecedor cadastrado';
  END IF;

  IF num_nonnulls(p_demora, p_preco, p_prazo, p_qualidade) = 0 THEN
    RAISE EXCEPTION 'Preencha ao menos um critério';
  END IF;

  INSERT INTO public.fornecedor_avaliacao
    (empresa_id, fornecedor_id, cotacao_id, proposta_id,
     nota_demora, nota_preco, nota_prazo, nota_qualidade, comentario)
  VALUES
    (v_empresa, v_prop.fornecedor_id, v_prop.cotacao_id, p_proposta_id,
     p_demora, p_preco, p_prazo, p_qualidade, NULLIF(btrim(COALESCE(p_comentario, '')), ''))
  ON CONFLICT (proposta_id) DO UPDATE
  SET nota_demora = EXCLUDED.nota_demora,
      nota_preco = EXCLUDED.nota_preco,
      nota_prazo = EXCLUDED.nota_prazo,
      nota_qualidade = EXCLUDED.nota_qualidade,
      comentario = EXCLUDED.comentario
  RETURNING nota_geral INTO v_nota;

  RETURN v_nota;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_criar_convite_cotacao(uuid, uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_criar_convite_cotacao(uuid, uuid, text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_revogar_convite_cotacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_revogar_convite_cotacao(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_avaliar_fornecedor(uuid, smallint, smallint, smallint, smallint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_avaliar_fornecedor(uuid, smallint, smallint, smallint, smallint, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPCs só do service_role (edge `cotacao-link`). Token inexistente, expirado, revogado ou de
--    cotação encerrada devolvem exatamente o mesmo `{"ok": false}`: sem enumeração.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cotacao_link_consultar(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.obra_cotacao_convite%ROWTYPE;
  v_cot  public.obra_cotacao%ROWTYPE;
  v_prop public.obra_cotacao_proposta%ROWTYPE;
BEGIN
  SELECT * INTO v_conv FROM public.obra_cotacao_convite WHERE token_hash = p_token_hash;
  IF NOT FOUND OR v_conv.revogado_em IS NOT NULL OR v_conv.expira_em <= now() THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT * INTO v_cot FROM public.obra_cotacao
  WHERE id = v_conv.cotacao_id AND deleted_at IS NULL AND status = 'aberta';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  UPDATE public.obra_cotacao_convite SET aberto_em = COALESCE(aberto_em, now()) WHERE id = v_conv.id;

  IF v_conv.proposta_id IS NOT NULL THEN
    SELECT * INTO v_prop FROM public.obra_cotacao_proposta
    WHERE id = v_conv.proposta_id AND deleted_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'empresa_nome', (SELECT nome FROM public.empresas WHERE id = v_conv.empresa_id),
    'descricao', v_cot.descricao,
    'quantidade', v_cot.quantidade,
    'unidade', v_cot.unidade,
    'prazo_necessidade', v_cot.prazo_necessidade,
    'observacoes', v_cot.observacoes,
    'expira_em', v_conv.expira_em,
    'resposta_atual', CASE WHEN v_prop.id IS NULL THEN NULL ELSE jsonb_build_object(
      'valor', v_prop.valor,
      'valor_parcelado', v_prop.valor_parcelado,
      'condicao_pagamento', v_prop.condicao_pagamento,
      'desconto_pct', v_prop.desconto_pct,
      'prazo_entrega_dias', v_prop.prazo_entrega_dias,
      'observacoes', v_prop.observacoes) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cotacao_link_responder(
  p_token_hash      text,
  p_valor           numeric,
  p_valor_parcelado numeric,
  p_condicao        text,
  p_desconto_pct    numeric,
  p_prazo_dias      integer,
  p_observacoes     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv    public.obra_cotacao_convite%ROWTYPE;
  v_cot     public.obra_cotacao%ROWTYPE;
  v_prop_id uuid;
BEGIN
  -- Trava o convite: dois envios quase simultâneos viram dois updates em fila, nunca duas propostas.
  SELECT * INTO v_conv FROM public.obra_cotacao_convite WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR v_conv.revogado_em IS NOT NULL OR v_conv.expira_em <= now() THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT * INTO v_cot FROM public.obra_cotacao
  WHERE id = v_conv.cotacao_id AND deleted_at IS NULL AND status = 'aberta'
  FOR SHARE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  IF p_valor IS NULL OR p_valor <= 0 OR p_valor > 999999999
     OR (p_valor_parcelado IS NOT NULL AND (p_valor_parcelado <= 0 OR p_valor_parcelado > 999999999))
     OR (p_desconto_pct IS NOT NULL AND (p_desconto_pct < 0 OR p_desconto_pct > 100))
     OR (p_prazo_dias IS NULL OR p_prazo_dias < 0 OR p_prazo_dias > 3650)
     OR p_condicao IS NULL OR char_length(btrim(p_condicao)) = 0 OR char_length(p_condicao) > 200
     OR (p_observacoes IS NOT NULL AND char_length(p_observacoes) > 1000) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'dados_invalidos');
  END IF;

  v_prop_id := v_conv.proposta_id;
  IF v_prop_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.obra_cotacao_proposta WHERE id = v_prop_id AND deleted_at IS NULL
  ) THEN
    v_prop_id := NULL;
  END IF;

  IF v_prop_id IS NULL THEN
    INSERT INTO public.obra_cotacao_proposta
      (empresa_id, cotacao_id, fornecedor_id, fornecedor_nome, valor, valor_parcelado,
       condicao_pagamento, prazo_entrega_dias, observacoes, desconto_pct, origem,
       quantidade, unidade, created_by)
    VALUES
      (v_conv.empresa_id, v_conv.cotacao_id, v_conv.fornecedor_id, v_conv.fornecedor_nome, p_valor,
       p_valor_parcelado, btrim(p_condicao), p_prazo_dias, NULLIF(btrim(COALESCE(p_observacoes, '')), ''),
       p_desconto_pct, 'link', v_cot.quantidade, v_cot.unidade, v_conv.created_by)
    RETURNING id INTO v_prop_id;
  ELSE
    UPDATE public.obra_cotacao_proposta
    SET valor = p_valor, valor_parcelado = p_valor_parcelado, condicao_pagamento = btrim(p_condicao),
        prazo_entrega_dias = p_prazo_dias, observacoes = NULLIF(btrim(COALESCE(p_observacoes, '')), ''),
        desconto_pct = p_desconto_pct
    WHERE id = v_prop_id;
  END IF;

  UPDATE public.obra_cotacao_convite
  SET respondido_em = now(), proposta_id = v_prop_id
  WHERE id = v_conv.id;

  -- Avisa quem criou o link (central de notificações, SPEC 029). Não derruba a resposta se falhar.
  BEGIN
    PERFORM public.notificar(
      v_conv.empresa_id, ARRAY[v_conv.created_by], 'cotacao_respondida', 'obra', 'medium',
      'Fornecedor respondeu a cotação',
      v_conv.fornecedor_nome || ' enviou a proposta de ' || v_cot.descricao || '.',
      'obra_cotacao', v_conv.cotacao_id,
      '/obras/' || v_cot.obra_id || '?tab=cotacoes', NULL);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cotacao_link_consultar(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cotacao_link_consultar(text) TO service_role;
REVOKE ALL ON FUNCTION public.cotacao_link_responder(text, numeric, numeric, text, numeric, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cotacao_link_responder(text, numeric, numeric, text, numeric, integer, text)
  TO service_role;
