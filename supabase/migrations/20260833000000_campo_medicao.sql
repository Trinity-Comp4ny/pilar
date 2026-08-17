-- Pilar Campo fase 5 (spec 042): medição do serviço (item + quantidade +
-- unidade), por dia. Escopo desta migração é o RDO, não a tarefa do
-- cronograma: obra_rdo_tarefa (spec 040) ainda não existe nesta branch; ligar
-- a medição à tarefa fica para quando os dois convergirem (ver campo_rdo_tarefa
-- na spec 042, seção Decisões).

CREATE TABLE IF NOT EXISTS public.obra_rdo_medicao (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id          uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  rdo_id           uuid NOT NULL REFERENCES public.obra_rdo(id) ON DELETE CASCADE,
  item             text NOT NULL,
  quantidade       numeric NOT NULL CHECK (quantidade >= 0),
  unidade          text NOT NULL,
  campo_account_id uuid REFERENCES public.campo_accounts(id) ON DELETE SET NULL,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obra_rdo_medicao_rdo ON public.obra_rdo_medicao (rdo_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_medicao_obra ON public.obra_rdo_medicao (obra_id);

ALTER TABLE public.obra_rdo_medicao ENABLE ROW LEVEL SECURITY;

-- Escritório: só a própria empresa. Campo grava pela RPC (SECURITY DEFINER).
CREATE POLICY obra_rdo_medicao_select ON public.obra_rdo_medicao
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY obra_rdo_medicao_insert ON public.obra_rdo_medicao
  FOR INSERT WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY obra_rdo_medicao_delete ON public.obra_rdo_medicao
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

-- Grava a medição pela sessão de campo. Dado simples (sem upload binário), por
-- isso é RPC direta como campo_salvar_rdo, sem precisar de edge function.
CREATE OR REPLACE FUNCTION public.campo_registrar_medicao(
  p_token text, p_rdo_id uuid, p_item text, p_quantidade numeric, p_unidade text
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

  IF p_item IS NULL OR btrim(p_item) = '' THEN
    RETURN json_build_object('ok', false, 'erro', 'Informe o item');
  END IF;
  IF p_quantidade IS NULL OR p_quantidade < 0 THEN
    RETURN json_build_object('ok', false, 'erro', 'Quantidade inválida');
  END IF;
  IF p_unidade IS NULL OR btrim(p_unidade) = '' THEN
    RETURN json_build_object('ok', false, 'erro', 'Informe a unidade');
  END IF;

  -- O RDO tem que ser da obra do token (mesma checagem de _campo_registrar_foto).
  SELECT * INTO v_rdo FROM public.obra_rdo WHERE id = p_rdo_id AND obra_id = v_acc.obra_id LIMIT 1;
  IF v_rdo.id IS NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Registro do dia inválido');
  END IF;

  INSERT INTO public.obra_rdo_medicao (empresa_id, obra_id, rdo_id, item, quantidade, unidade, campo_account_id)
  VALUES (v_acc.empresa_id, v_acc.obra_id, p_rdo_id, btrim(p_item), p_quantidade, btrim(p_unidade), v_acc.id)
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', true, 'medicao_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.campo_registrar_medicao(text, uuid, text, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.campo_registrar_medicao(text, uuid, text, numeric, text) TO anon, authenticated;

-- campo_listar_rdos passa a devolver também a contagem de medições por dia.
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
           (SELECT count(*) FROM public.obra_rdo_medicao m WHERE m.rdo_id = rd.id) AS medicoes
    FROM public.obra_rdo rd
    WHERE rd.obra_id = v_acc.obra_id
    ORDER BY rd.data DESC
    LIMIT greatest(1, least(p_limite, 90))
  ) r;

  RETURN json_build_object('ok', true, 'rdos', v_rows);
END;
$$;
