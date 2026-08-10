-- Conta da obra · fase 1 núcleo interno (spec 016, ADR 0013)
-- "Dois bolsos e uma lente": o custo da obra é dinheiro do CLIENTE e vive numa conta
-- própria (obra_conta_lancamento), NUNCA em despesas — senão rpc_projeto_rentabilidade
-- (que soma toda despesa por projeto_id) contaminaria a margem do escritório.
-- Só a TAXA de administração (receita real) cruza para public.receitas, via RPC
-- transacional idempotente, vinculada por obra_lancamento_origem_id.

-- ---------------------------------------------------------------------------
-- 1. obras ganha modelo de cobrança + taxa de administração
-- ---------------------------------------------------------------------------
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS modelo_cobranca text NOT NULL DEFAULT 'administracao'
    CHECK (modelo_cobranca IN ('administracao', 'preco_fechado')),
  ADD COLUMN IF NOT EXISTS taxa_administracao_pct numeric(5,2) NOT NULL DEFAULT 0
    CHECK (taxa_administracao_pct >= 0 AND taxa_administracao_pct <= 100);

-- ---------------------------------------------------------------------------
-- 2. obra_conta_lancamento — aportes do cliente e despesas pagas com esse dinheiro
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.obra_conta_lancamento (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id        uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  tipo           text NOT NULL CHECK (tipo IN ('aporte', 'despesa')),
  data           date NOT NULL,
  descricao      text NOT NULL,
  valor          numeric(14,2) NOT NULL CHECK (valor >= 0),
  -- só para despesa:
  obra_frente_id uuid REFERENCES public.obra_frente(id) ON DELETE SET NULL,
  fornecedor_id  uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  pago_por       text CHECK (pago_por IN ('cliente', 'escritorio_reembolsavel')),
  comprovante_url text,
  created_by     uuid NOT NULL DEFAULT auth.uid(),
  updated_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_obra_conta_lanc_obra
  ON public.obra_conta_lancamento (obra_id, data DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_obra_conta_lanc_frente
  ON public.obra_conta_lancamento (obra_frente_id) WHERE obra_frente_id IS NOT NULL;

CREATE TRIGGER trg_obra_conta_lanc_updated_at
  BEFORE UPDATE ON public.obra_conta_lancamento
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. obra_orcamento_etapa — previsto por grande etapa (realizado = soma das despesas)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.obra_orcamento_etapa (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id        uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  obra_frente_id uuid NOT NULL REFERENCES public.obra_frente(id) ON DELETE CASCADE,
  valor_previsto numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_previsto >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_id, obra_frente_id)
);

CREATE INDEX IF NOT EXISTS idx_obra_orcamento_obra
  ON public.obra_orcamento_etapa (obra_id);

CREATE TRIGGER trg_obra_orcamento_updated_at
  BEFORE UPDATE ON public.obra_orcamento_etapa
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. receitas: vínculo idempotente com o lançamento de despesa que gerou a taxa
-- ---------------------------------------------------------------------------
ALTER TABLE public.receitas
  ADD COLUMN IF NOT EXISTS obra_lancamento_origem_id uuid
    REFERENCES public.obra_conta_lancamento(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS receitas_obra_lancamento_origem_uniq
  ON public.receitas (obra_lancamento_origem_id)
  WHERE obra_lancamento_origem_id IS NOT NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 5. RLS — isolamento por empresa + revalidação cross-tenant (padrão obra_frente)
-- ---------------------------------------------------------------------------
ALTER TABLE public.obra_conta_lancamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_orcamento_etapa ENABLE ROW LEVEL SECURITY;

-- obra_conta_lancamento
CREATE POLICY obra_conta_lanc_select ON public.obra_conta_lancamento
  FOR SELECT USING (empresa_id = public.get_user_empresa_id() AND deleted_at IS NULL);

CREATE POLICY obra_conta_lanc_insert ON public.obra_conta_lancamento
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()
    )
    AND (
      obra_frente_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.obra_frente f
        WHERE f.id = obra_frente_id AND f.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      fornecedor_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.fornecedores fo
        WHERE fo.id = fornecedor_id AND fo.empresa_id = public.get_user_empresa_id()
      )
    )
  );

CREATE POLICY obra_conta_lanc_update ON public.obra_conta_lancamento
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()
    )
    AND (
      obra_frente_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.obra_frente f
        WHERE f.id = obra_frente_id AND f.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      fornecedor_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.fornecedores fo
        WHERE fo.id = fornecedor_id AND fo.empresa_id = public.get_user_empresa_id()
      )
    )
  );

CREATE POLICY obra_conta_lanc_delete ON public.obra_conta_lancamento
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

-- obra_orcamento_etapa
CREATE POLICY obra_orcamento_select ON public.obra_orcamento_etapa
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY obra_orcamento_insert ON public.obra_orcamento_etapa
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.obra_frente f
      WHERE f.id = obra_frente_id AND f.empresa_id = public.get_user_empresa_id()
    )
  );

CREATE POLICY obra_orcamento_update ON public.obra_orcamento_etapa
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()
    )
  );

CREATE POLICY obra_orcamento_delete ON public.obra_orcamento_etapa
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

-- ---------------------------------------------------------------------------
-- 6. RPC transacional idempotente: salvar/excluir despesa + taxa de administração
--    SECURITY DEFINER com tenant check explícito e revalidação de FK (endurecido,
--    como as RPCs *_agente). search_path fixo evita hijack.
-- ---------------------------------------------------------------------------
-- Obrigatórios primeiro, opcionais com DEFAULT depois (p_id nulo = criar). Assim os
-- types gerados marcam os opcionais como opcionais e o client passa `undefined`.
-- DROP defensivo: assinatura muda, e CREATE OR REPLACE criaria overload silencioso
-- (ver memória "Supabase Function Overloads").
DROP FUNCTION IF EXISTS public.rpc_obra_despesa_salvar(uuid, uuid, date, text, numeric, uuid, uuid, text, text);
CREATE OR REPLACE FUNCTION public.rpc_obra_despesa_salvar(
  p_obra_id        uuid,
  p_data           date,
  p_descricao      text,
  p_valor          numeric,
  p_id             uuid DEFAULT NULL,
  p_obra_frente_id uuid DEFAULT NULL,
  p_fornecedor_id  uuid DEFAULT NULL,
  p_pago_por       text DEFAULT 'cliente',
  p_comprovante_url text DEFAULT NULL
)
RETURNS public.obra_conta_lancamento
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa    uuid := public.get_user_empresa_id();
  v_obra       public.obras;
  v_lanc       public.obra_conta_lancamento;
  v_cliente    uuid;
  v_taxa_valor numeric(14,2);
BEGIN
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'usuário sem empresa';
  END IF;
  IF p_valor IS NULL OR p_valor < 0 THEN
    RAISE EXCEPTION 'valor inválido';
  END IF;

  SELECT * INTO v_obra
  FROM public.obras
  WHERE id = p_obra_id AND empresa_id = v_empresa AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'obra inexistente ou de outra empresa';
  END IF;

  IF p_obra_frente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.obra_frente
    WHERE id = p_obra_frente_id AND empresa_id = v_empresa
  ) THEN
    RAISE EXCEPTION 'frente inválida';
  END IF;

  IF p_fornecedor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.fornecedores
    WHERE id = p_fornecedor_id AND empresa_id = v_empresa
  ) THEN
    RAISE EXCEPTION 'fornecedor inválido';
  END IF;

  IF p_pago_por IS NOT NULL AND p_pago_por NOT IN ('cliente', 'escritorio_reembolsavel') THEN
    RAISE EXCEPTION 'pago_por inválido';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.obra_conta_lancamento (
      empresa_id, obra_id, tipo, data, descricao, valor,
      obra_frente_id, fornecedor_id, pago_por, comprovante_url, created_by
    ) VALUES (
      v_empresa, p_obra_id, 'despesa', p_data, p_descricao, p_valor,
      p_obra_frente_id, p_fornecedor_id, COALESCE(p_pago_por, 'cliente'), p_comprovante_url, auth.uid()
    )
    RETURNING * INTO v_lanc;
  ELSE
    UPDATE public.obra_conta_lancamento SET
      data = p_data, descricao = p_descricao, valor = p_valor,
      obra_frente_id = p_obra_frente_id, fornecedor_id = p_fornecedor_id,
      pago_por = COALESCE(p_pago_por, 'cliente'), comprovante_url = p_comprovante_url,
      updated_by = auth.uid()
    WHERE id = p_id AND empresa_id = v_empresa AND deleted_at IS NULL AND tipo = 'despesa'
    RETURNING * INTO v_lanc;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'lançamento inexistente ou de outra empresa';
    END IF;
  END IF;

  -- Taxa de administração: só no modelo administracao e taxa > 0. Idempotente pelo
  -- vínculo obra_lancamento_origem_id (upsert; estorna se a taxa deixar de existir).
  IF v_obra.modelo_cobranca = 'administracao' AND COALESCE(v_obra.taxa_administracao_pct, 0) > 0 THEN
    v_taxa_valor := round(p_valor * v_obra.taxa_administracao_pct / 100, 2);
    SELECT cliente_id INTO v_cliente FROM public.projetos WHERE id = v_obra.projeto_id;

    UPDATE public.receitas SET
      valor = v_taxa_valor,
      descricao = 'Taxa de administração — ' || v_obra.nome,
      projeto_id = v_obra.projeto_id,
      cliente_id = v_cliente,
      data_vencimento = p_data,
      deleted_at = NULL,
      updated_by = auth.uid()
    WHERE obra_lancamento_origem_id = v_lanc.id;

    IF NOT FOUND THEN
      INSERT INTO public.receitas (
        empresa_id, descricao, valor, status, projeto_id, cliente_id,
        data_vencimento, obra_lancamento_origem_id, created_by
      ) VALUES (
        v_empresa, 'Taxa de administração — ' || v_obra.nome, v_taxa_valor, 'Pendente',
        v_obra.projeto_id, v_cliente, p_data, v_lanc.id, auth.uid()
      );
    END IF;
  ELSE
    UPDATE public.receitas SET deleted_at = now(), updated_by = auth.uid()
    WHERE obra_lancamento_origem_id = v_lanc.id AND deleted_at IS NULL;
  END IF;

  RETURN v_lanc;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_obra_despesa_excluir(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
BEGIN
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'usuário sem empresa';
  END IF;

  UPDATE public.obra_conta_lancamento
    SET deleted_at = now(), updated_by = auth.uid()
  WHERE id = p_id AND empresa_id = v_empresa AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lançamento inexistente ou de outra empresa';
  END IF;

  UPDATE public.receitas SET deleted_at = now(), updated_by = auth.uid()
  WHERE obra_lancamento_origem_id = p_id AND deleted_at IS NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Grants — tabelas para authenticated; RPCs só authenticated (nunca anon)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_conta_lancamento TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_orcamento_etapa TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_obra_despesa_salvar(uuid, date, text, numeric, uuid, uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_obra_despesa_excluir(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_obra_despesa_salvar(uuid, date, text, numeric, uuid, uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_obra_despesa_excluir(uuid) TO authenticated;
