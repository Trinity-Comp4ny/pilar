-- Pilar Campo — vincula o diário do campo às tarefas do cronograma (spec 040 +
-- spec 042). É o loop completo que a obra inteligente promete: o campo marca o
-- que andou nas tarefas do cronograma, e isso fecha/sinaliza a tarefa igual ao
-- fluxo do escritório (useSaveRdoTarefas). Escrita por RPC porque a conta de
-- campo não tem auth.uid() (obra_rdo_tarefa.created_by tinha DEFAULT auth.uid()
-- NOT NULL, que falharia sob uma sessão de campo).

ALTER TABLE public.obra_rdo_tarefa
  ADD COLUMN IF NOT EXISTS campo_account_id uuid REFERENCES public.campo_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.obra_rdo_tarefa
  ALTER COLUMN created_by DROP NOT NULL;
-- tarefas.created_by também é NOT NULL DEFAULT auth.uid() (spec 015); a conta de
-- campo não tem auth.uid(), então campo_criar_tarefa precisa gravar NULL.
ALTER TABLE public.tarefas
  ALTER COLUMN created_by DROP NOT NULL;

-- 1. Listar as tarefas do cronograma da obra da sessão (para o checklist) -----
CREATE OR REPLACE FUNCTION public.campo_listar_tarefas(p_token text)
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

  SELECT coalesce(json_agg(t ORDER BY t.created_at ASC), '[]'::json) INTO v_rows
  FROM (
    SELECT tr.id, tr.titulo, tr.status, tr.created_at, f.nome AS frente_nome
    FROM public.tarefas tr
    LEFT JOIN public.obra_frente f ON f.id = tr.obra_frente_id
    WHERE tr.obra_id = v_acc.obra_id
  ) t;

  RETURN json_build_object('ok', true, 'tarefas', v_rows);
END;
$$;

-- 2. Criar tarefa na hora (sem frente — mesmo "sem etapa" do escritório) ------
CREATE OR REPLACE FUNCTION public.campo_criar_tarefa(p_token text, p_titulo text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc public.campo_accounts;
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
  IF p_titulo IS NULL OR btrim(p_titulo) = '' THEN
    RETURN json_build_object('ok', false, 'erro', 'Informe o título da tarefa');
  END IF;

  INSERT INTO public.tarefas (empresa_id, obra_id, obra_frente_id, titulo, status)
  VALUES (v_acc.empresa_id, v_acc.obra_id, NULL, btrim(p_titulo), 'a_fazer')
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', true, 'tarefa_id', v_id);
END;
$$;

-- 3. Registrar o resultado do dia numa tarefa (upsert, aplica efeito no cronograma)
CREATE OR REPLACE FUNCTION public.campo_registrar_tarefa_rdo(
  p_token text, p_rdo_id uuid, p_tarefa_id uuid, p_resultado text, p_observacao text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc public.campo_accounts;
BEGIN
  SELECT * INTO v_acc
  FROM public.campo_accounts
  WHERE token_sessao = encode(extensions.digest(p_token, 'sha256'), 'hex')
    AND ativo = true AND token_expira_em > now()
  LIMIT 1;
  IF v_acc.id IS NULL OR v_acc.must_change_senha THEN
    RETURN json_build_object('ok', false, 'erro', 'Sessão inválida');
  END IF;
  IF p_resultado NOT IN ('avancou', 'concluiu', 'parou') THEN
    RETURN json_build_object('ok', false, 'erro', 'Resultado inválido');
  END IF;
  -- Defesa em profundidade (achado do rls-auditor): revalida que a obra do
  -- token é mesmo da empresa do token, como campo_salvar_rdo já faz.
  IF NOT EXISTS (
    SELECT 1 FROM public.obras o WHERE o.id = v_acc.obra_id AND o.empresa_id = v_acc.empresa_id
  ) THEN
    RETURN json_build_object('ok', false, 'erro', 'Obra inválida');
  END IF;

  -- O RDO e a tarefa têm que ser da obra do token (nunca de outra obra/empresa).
  IF NOT EXISTS (SELECT 1 FROM public.obra_rdo WHERE id = p_rdo_id AND obra_id = v_acc.obra_id) THEN
    RETURN json_build_object('ok', false, 'erro', 'Registro do dia inválido');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tarefas WHERE id = p_tarefa_id AND obra_id = v_acc.obra_id) THEN
    RETURN json_build_object('ok', false, 'erro', 'Tarefa inválida');
  END IF;

  INSERT INTO public.obra_rdo_tarefa (empresa_id, rdo_id, tarefa_id, resultado, observacao, campo_account_id, created_by)
  VALUES (v_acc.empresa_id, p_rdo_id, p_tarefa_id, p_resultado, NULLIF(btrim(p_observacao), ''), v_acc.id, NULL)
  ON CONFLICT (rdo_id, tarefa_id) DO UPDATE SET
    resultado        = EXCLUDED.resultado,
    observacao       = EXCLUDED.observacao,
    campo_account_id = EXCLUDED.campo_account_id;

  -- Mesmo efeito no cronograma do fluxo do escritório (useSaveRdoTarefas):
  -- concluir fecha a tarefa; parar sinaliza; avançar limpa a sinalização.
  IF p_resultado = 'concluiu' THEN
    UPDATE public.tarefas SET status = 'concluida', sinalizada = false WHERE id = p_tarefa_id;
  ELSIF p_resultado = 'parou' THEN
    UPDATE public.tarefas SET sinalizada = true WHERE id = p_tarefa_id;
  ELSE
    UPDATE public.tarefas SET sinalizada = false WHERE id = p_tarefa_id;
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.campo_listar_tarefas(text) FROM public;
REVOKE ALL ON FUNCTION public.campo_criar_tarefa(text, text) FROM public;
REVOKE ALL ON FUNCTION public.campo_registrar_tarefa_rdo(text, uuid, uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.campo_listar_tarefas(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campo_criar_tarefa(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campo_registrar_tarefa_rdo(text, uuid, uuid, text, text) TO anon, authenticated;

-- 4. campo_listar_rdos passa a devolver também a contagem de tarefas por dia ---
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
           (SELECT count(*) FROM public.obra_rdo_tarefa rt WHERE rt.rdo_id = rd.id) AS tarefas
    FROM public.obra_rdo rd
    WHERE rd.obra_id = v_acc.obra_id
    ORDER BY rd.data DESC
    LIMIT greatest(1, least(p_limite, 90))
  ) r;

  RETURN json_build_object('ok', true, 'rdos', v_rows);
END;
$$;
