-- Diário de obra: efetivo por fornecedor, impedimento tipado, visita (spec 062).
-- Estende obra_rdo (spec 015) e o padrão de tabela-satélite de obra_rdo_tarefa
-- (spec 040). Escritório escreve direto (RLS); Pilar Campo escreve por RPC
-- SECURITY DEFINER (a conta de campo não tem auth.uid, spec 042), uma linha
-- por vez, no padrão de campo_registrar_medicao (registro append-only: seguro
-- reenviar o mesmo item da fila offline sem duplicar risco de perda de dado).

-- 1. obra_rdo_efetivo — quantas pessoas de cada fornecedor estiveram na obra --
CREATE TABLE public.obra_rdo_efetivo (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  rdo_id          uuid NOT NULL REFERENCES public.obra_rdo(id) ON DELETE CASCADE,
  fornecedor_id   uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  fornecedor_nome text,
  quantidade      int NOT NULL CHECK (quantidade > 0),
  campo_account_id uuid REFERENCES public.campo_accounts(id) ON DELETE SET NULL,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (fornecedor_id IS NOT NULL OR fornecedor_nome IS NOT NULL)
);

CREATE INDEX idx_obra_rdo_efetivo_rdo ON public.obra_rdo_efetivo (rdo_id);

-- 2. obra_rdo_impedimento — o que travou o serviço no dia (sem foto no MVP) ---
CREATE TABLE public.obra_rdo_impedimento (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  rdo_id          uuid NOT NULL REFERENCES public.obra_rdo(id) ON DELETE CASCADE,
  descricao       text NOT NULL,
  tipo            text NOT NULL CHECK (tipo IN
    ('falta_material', 'clima', 'pendencia_projeto', 'mao_de_obra', 'outro')),
  campo_account_id uuid REFERENCES public.campo_accounts(id) ON DELETE SET NULL,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_obra_rdo_impedimento_rdo ON public.obra_rdo_impedimento (rdo_id);

-- 3. obra_rdo_visita — quem visitou a obra no dia -----------------------------
CREATE TABLE public.obra_rdo_visita (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  rdo_id          uuid NOT NULL REFERENCES public.obra_rdo(id) ON DELETE CASCADE,
  fornecedor_id   uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  fornecedor_nome text,
  observacao      text,
  campo_account_id uuid REFERENCES public.campo_accounts(id) ON DELETE SET NULL,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (fornecedor_id IS NOT NULL OR fornecedor_nome IS NOT NULL)
);

CREATE INDEX idx_obra_rdo_visita_rdo ON public.obra_rdo_visita (rdo_id);

-- 4. RLS — escritório: escopo por empresa + revalida rdo e fornecedor --------
ALTER TABLE public.obra_rdo_efetivo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_rdo_impedimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_rdo_visita ENABLE ROW LEVEL SECURITY;

CREATE POLICY obra_rdo_efetivo_select ON public.obra_rdo_efetivo
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY obra_rdo_efetivo_insert ON public.obra_rdo_efetivo
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (SELECT 1 FROM public.obra_rdo r WHERE r.id = rdo_id AND r.empresa_id = public.get_user_empresa_id())
    AND (fornecedor_id IS NULL OR EXISTS (
      SELECT 1 FROM public.fornecedores f WHERE f.id = fornecedor_id AND f.empresa_id = public.get_user_empresa_id()
    ))
  );
CREATE POLICY obra_rdo_efetivo_update ON public.obra_rdo_efetivo
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY obra_rdo_efetivo_delete ON public.obra_rdo_efetivo
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY obra_rdo_impedimento_select ON public.obra_rdo_impedimento
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY obra_rdo_impedimento_insert ON public.obra_rdo_impedimento
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (SELECT 1 FROM public.obra_rdo r WHERE r.id = rdo_id AND r.empresa_id = public.get_user_empresa_id())
  );
CREATE POLICY obra_rdo_impedimento_update ON public.obra_rdo_impedimento
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY obra_rdo_impedimento_delete ON public.obra_rdo_impedimento
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY obra_rdo_visita_select ON public.obra_rdo_visita
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY obra_rdo_visita_insert ON public.obra_rdo_visita
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (SELECT 1 FROM public.obra_rdo r WHERE r.id = rdo_id AND r.empresa_id = public.get_user_empresa_id())
    AND (fornecedor_id IS NULL OR EXISTS (
      SELECT 1 FROM public.fornecedores f WHERE f.id = fornecedor_id AND f.empresa_id = public.get_user_empresa_id()
    ))
  );
CREATE POLICY obra_rdo_visita_update ON public.obra_rdo_visita
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY obra_rdo_visita_delete ON public.obra_rdo_visita
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_rdo_efetivo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_rdo_impedimento TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_rdo_visita TO authenticated;

-- 5. RPCs de campo — registro append-only, uma linha por chamada -------------
CREATE OR REPLACE FUNCTION public.campo_registrar_efetivo(
  p_token text, p_rdo_id uuid, p_fornecedor_id uuid, p_fornecedor_nome text, p_quantidade int
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc public.campo_accounts;
  v_rdo public.obra_rdo;
  v_id  uuid;
BEGIN
  SELECT * INTO v_acc
  FROM public.campo_accounts
  WHERE token_sessao = encode(extensions.digest(p_token, 'sha256'), 'hex')
    AND ativo = true AND token_expira_em > now()
  LIMIT 1;
  IF v_acc.id IS NULL OR v_acc.must_change_senha THEN
    RETURN json_build_object('ok', false, 'erro', 'Sessão inválida');
  END IF;

  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RETURN json_build_object('ok', false, 'erro', 'Quantidade inválida');
  END IF;
  IF p_fornecedor_id IS NULL AND (p_fornecedor_nome IS NULL OR btrim(p_fornecedor_nome) = '') THEN
    RETURN json_build_object('ok', false, 'erro', 'Informe o fornecedor');
  END IF;
  IF p_fornecedor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.fornecedores f WHERE f.id = p_fornecedor_id AND f.empresa_id = v_acc.empresa_id
  ) THEN
    RETURN json_build_object('ok', false, 'erro', 'Fornecedor inválido');
  END IF;

  SELECT * INTO v_rdo FROM public.obra_rdo WHERE id = p_rdo_id AND obra_id = v_acc.obra_id LIMIT 1;
  IF v_rdo.id IS NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Registro do dia inválido');
  END IF;

  INSERT INTO public.obra_rdo_efetivo
    (empresa_id, rdo_id, fornecedor_id, fornecedor_nome, quantidade, campo_account_id)
  VALUES
    (v_acc.empresa_id, p_rdo_id, p_fornecedor_id, NULLIF(btrim(p_fornecedor_nome), ''), p_quantidade, v_acc.id)
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', true, 'efetivo_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.campo_registrar_efetivo(text, uuid, uuid, text, int) FROM public;
GRANT EXECUTE ON FUNCTION public.campo_registrar_efetivo(text, uuid, uuid, text, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.campo_registrar_impedimento(
  p_token text, p_rdo_id uuid, p_descricao text, p_tipo text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc public.campo_accounts;
  v_rdo public.obra_rdo;
  v_id  uuid;
BEGIN
  SELECT * INTO v_acc
  FROM public.campo_accounts
  WHERE token_sessao = encode(extensions.digest(p_token, 'sha256'), 'hex')
    AND ativo = true AND token_expira_em > now()
  LIMIT 1;
  IF v_acc.id IS NULL OR v_acc.must_change_senha THEN
    RETURN json_build_object('ok', false, 'erro', 'Sessão inválida');
  END IF;

  IF p_descricao IS NULL OR btrim(p_descricao) = '' THEN
    RETURN json_build_object('ok', false, 'erro', 'Descreva o impedimento');
  END IF;
  IF p_tipo IS NULL OR p_tipo NOT IN ('falta_material', 'clima', 'pendencia_projeto', 'mao_de_obra', 'outro') THEN
    RETURN json_build_object('ok', false, 'erro', 'Tipo inválido');
  END IF;

  SELECT * INTO v_rdo FROM public.obra_rdo WHERE id = p_rdo_id AND obra_id = v_acc.obra_id LIMIT 1;
  IF v_rdo.id IS NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Registro do dia inválido');
  END IF;

  INSERT INTO public.obra_rdo_impedimento (empresa_id, rdo_id, descricao, tipo, campo_account_id)
  VALUES (v_acc.empresa_id, p_rdo_id, btrim(p_descricao), p_tipo, v_acc.id)
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', true, 'impedimento_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.campo_registrar_impedimento(text, uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.campo_registrar_impedimento(text, uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.campo_registrar_visita(
  p_token text, p_rdo_id uuid, p_fornecedor_id uuid, p_fornecedor_nome text, p_observacao text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc public.campo_accounts;
  v_rdo public.obra_rdo;
  v_id  uuid;
BEGIN
  SELECT * INTO v_acc
  FROM public.campo_accounts
  WHERE token_sessao = encode(extensions.digest(p_token, 'sha256'), 'hex')
    AND ativo = true AND token_expira_em > now()
  LIMIT 1;
  IF v_acc.id IS NULL OR v_acc.must_change_senha THEN
    RETURN json_build_object('ok', false, 'erro', 'Sessão inválida');
  END IF;

  IF p_fornecedor_id IS NULL AND (p_fornecedor_nome IS NULL OR btrim(p_fornecedor_nome) = '') THEN
    RETURN json_build_object('ok', false, 'erro', 'Informe o visitante');
  END IF;
  IF p_fornecedor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.fornecedores f WHERE f.id = p_fornecedor_id AND f.empresa_id = v_acc.empresa_id
  ) THEN
    RETURN json_build_object('ok', false, 'erro', 'Fornecedor inválido');
  END IF;

  SELECT * INTO v_rdo FROM public.obra_rdo WHERE id = p_rdo_id AND obra_id = v_acc.obra_id LIMIT 1;
  IF v_rdo.id IS NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Registro do dia inválido');
  END IF;

  INSERT INTO public.obra_rdo_visita (empresa_id, rdo_id, fornecedor_id, fornecedor_nome, observacao, campo_account_id)
  VALUES (v_acc.empresa_id, p_rdo_id, p_fornecedor_id, NULLIF(btrim(p_fornecedor_nome), ''), NULLIF(btrim(p_observacao), ''), v_acc.id)
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', true, 'visita_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.campo_registrar_visita(text, uuid, uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.campo_registrar_visita(text, uuid, uuid, text, text) TO anon, authenticated;

-- 6. campo_listar_rdos passa a devolver a contagem dos três novos por dia -----
CREATE OR REPLACE FUNCTION public.campo_listar_rdos(p_token text, p_limite int DEFAULT 30)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc  public.campo_accounts;
  v_rows json;
BEGIN
  SELECT * INTO v_acc
  FROM public.campo_accounts
  WHERE token_sessao = encode(extensions.digest(p_token, 'sha256'), 'hex')
    AND ativo = true AND token_expira_em > now()
  LIMIT 1;
  IF v_acc.id IS NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Sessão inválida');
  END IF;

  SELECT coalesce(json_agg(r ORDER BY r.data DESC), '[]'::json) INTO v_rows
  FROM (
    SELECT rd.id, rd.data, rd.clima, rd.condicao_trabalho, rd.efetivo,
           rd.atividades, rd.ocorrencias, rd.pendencias,
           (SELECT count(*) FROM public.obra_rdo_foto f WHERE f.rdo_id = rd.id) AS fotos,
           (SELECT count(*) FROM public.obra_rdo_medicao m WHERE m.rdo_id = rd.id) AS medicoes,
           (SELECT count(*) FROM public.obra_rdo_tarefa rt WHERE rt.rdo_id = rd.id) AS tarefas,
           (SELECT count(*) FROM public.obra_rdo_efetivo e WHERE e.rdo_id = rd.id) AS efetivos,
           (SELECT count(*) FROM public.obra_rdo_impedimento i WHERE i.rdo_id = rd.id) AS impedimentos,
           (SELECT count(*) FROM public.obra_rdo_visita v WHERE v.rdo_id = rd.id) AS visitas
    FROM public.obra_rdo rd
    WHERE rd.obra_id = v_acc.obra_id
    ORDER BY rd.data DESC
    LIMIT greatest(1, least(p_limite, 90))
  ) r;

  RETURN json_build_object('ok', true, 'rdos', v_rows);
END;
$$;
