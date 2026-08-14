-- Pilar Campo fase 2 (spec 042): o campo registra o dia (RDO). A conta de campo
-- NÃO tem auth.uid(), então a escrita não passa pelo RLS do obra_rdo — vai por
-- RPC SECURITY DEFINER que valida o token de campo → obra e grava escopado.
-- Defesa em profundidade: revalida que a obra do token é da empresa do token, e
-- recusa se a senha ainda é provisória (must_change_senha).

-- 1. obra_rdo ganha rastro de autoria de campo; created_by deixa de ser NOT NULL
--    (o campo não tem auth.uid; office continua preenchendo pelo default).
ALTER TABLE public.obra_rdo
  ADD COLUMN IF NOT EXISTS campo_account_id uuid REFERENCES public.campo_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.obra_rdo
  ALTER COLUMN created_by DROP NOT NULL;

-- 2. Gravar o dia pela sessão de campo (upsert por obra+data) ------------------
CREATE OR REPLACE FUNCTION public.campo_salvar_rdo(
  p_token       text,
  p_data        date,
  p_clima       text,
  p_condicao    text,
  p_efetivo     int,
  p_atividades  text,
  p_ocorrencias text,
  p_pendencias  text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc    public.campo_accounts;
  v_rdo_id uuid;
BEGIN
  SELECT * INTO v_acc
  FROM public.campo_accounts
  WHERE token_sessao = encode(extensions.digest(p_token, 'sha256'), 'hex')
    AND ativo = true
    AND token_expira_em > now()
  LIMIT 1;

  IF v_acc.id IS NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Sessão inválida');
  END IF;
  IF v_acc.must_change_senha THEN
    RETURN json_build_object('ok', false, 'erro', 'Troque a senha antes de registrar');
  END IF;
  -- A obra do token tem que ser da empresa do token (não confiar só no obra_id).
  IF NOT EXISTS (
    SELECT 1 FROM public.obras o WHERE o.id = v_acc.obra_id AND o.empresa_id = v_acc.empresa_id
  ) THEN
    RETURN json_build_object('ok', false, 'erro', 'Obra inválida');
  END IF;
  IF p_data IS NULL OR p_data > current_date THEN
    RETURN json_build_object('ok', false, 'erro', 'Data inválida');
  END IF;

  INSERT INTO public.obra_rdo
    (empresa_id, obra_id, data, clima, condicao_trabalho, efetivo,
     atividades, ocorrencias, pendencias, campo_account_id, created_by)
  VALUES
    (v_acc.empresa_id, v_acc.obra_id, p_data, p_clima, p_condicao, p_efetivo,
     NULLIF(btrim(p_atividades), ''), NULLIF(btrim(p_ocorrencias), ''), NULLIF(btrim(p_pendencias), ''),
     v_acc.id, NULL)
  ON CONFLICT (obra_id, data) DO UPDATE SET
    clima             = EXCLUDED.clima,
    condicao_trabalho = EXCLUDED.condicao_trabalho,
    efetivo           = EXCLUDED.efetivo,
    atividades        = EXCLUDED.atividades,
    ocorrencias       = EXCLUDED.ocorrencias,
    pendencias        = EXCLUDED.pendencias,
    campo_account_id  = EXCLUDED.campo_account_id
  RETURNING id INTO v_rdo_id;

  RETURN json_build_object('ok', true, 'rdo_id', v_rdo_id);
END;
$$;

-- 3. Ler os últimos dias da obra da sessão (para a lista no app) ---------------
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
    AND ativo = true
    AND token_expira_em > now()
  LIMIT 1;

  IF v_acc.id IS NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Sessão inválida');
  END IF;

  SELECT coalesce(json_agg(r ORDER BY r.data DESC), '[]'::json) INTO v_rows
  FROM (
    SELECT id, data, clima, condicao_trabalho, efetivo, atividades, ocorrencias, pendencias
    FROM public.obra_rdo
    WHERE obra_id = v_acc.obra_id
    ORDER BY data DESC
    LIMIT greatest(1, least(p_limite, 90))
  ) r;

  RETURN json_build_object('ok', true, 'rdos', v_rows);
END;
$$;

-- 4. Concessões: a sessão de campo (anon) chama as duas RPCs --------------------
REVOKE ALL ON FUNCTION public.campo_salvar_rdo(text, date, text, text, int, text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.campo_listar_rdos(text, int) FROM public;
GRANT EXECUTE ON FUNCTION public.campo_salvar_rdo(text, date, text, text, int, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campo_listar_rdos(text, int) TO anon, authenticated;
