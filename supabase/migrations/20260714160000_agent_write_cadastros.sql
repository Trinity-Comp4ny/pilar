-- Onda 1 do Agente: cadastros atômicos (1 INSERT cada), no padrão criar_*_agente.
-- Cada RPC: gate server-side por feature + guard de agent_runs (empresa/status/agent_type).
-- Entidades: cliente, fornecedor, categoria, conta, centro de custo, pessoa, proposta, marco, disciplina.

-- Helper macro (repetido em cada função por serem SECURITY DEFINER independentes).

-- ============================ CLIENTE ============================
DROP FUNCTION IF EXISTS public.criar_cliente_agente(uuid);
CREATE OR REPLACE FUNCTION public.criar_cliente_agente(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.agent_runs; v_empresa uuid; v_id uuid; v_nome text;
BEGIN
  IF NOT public.user_has_feature('clientes','editor') THEN RAISE EXCEPTION 'Sem permissão para criar cliente'; END IF;
  v_empresa := public.get_user_empresa_id();
  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN RAISE EXCEPTION 'Run não está aguardando revisão'; END IF;
  IF v_run.agent_type != 'criar_cliente' THEN RAISE EXCEPTION 'Tipo não suportado: %', v_run.agent_type; END IF;
  v_nome := NULLIF(trim(v_run.result->>'nome'),''); IF v_nome IS NULL THEN RAISE EXCEPTION 'Cliente sem nome'; END IF;
  INSERT INTO public.clientes (empresa_id, nome, sobrenome, cpf_cnpj, email, contato, tipo_nf, origem, endereco)
  VALUES (v_empresa, v_nome,
    NULLIF(trim(v_run.result->>'sobrenome'),''), NULLIF(trim(v_run.result->>'cpf_cnpj'),''),
    NULLIF(trim(v_run.result->>'email'),''), NULLIF(trim(v_run.result->>'contato'),''),
    NULLIF(trim(v_run.result->>'tipo_nf'),''), NULLIF(trim(v_run.result->>'origem'),''),
    NULLIF(trim(v_run.result->>'endereco'),''))
  RETURNING id INTO v_id;
  UPDATE public.agent_runs SET status='executed', entity_type='cliente', entity_id=v_id, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=p_run_id;
  RETURN jsonb_build_object('ok',true,'cliente_id',v_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.criar_cliente_agente(uuid) TO authenticated;

-- ============================ FORNECEDOR ============================
DROP FUNCTION IF EXISTS public.criar_fornecedor_agente(uuid);
CREATE OR REPLACE FUNCTION public.criar_fornecedor_agente(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.agent_runs; v_empresa uuid; v_id uuid; v_nome text;
BEGIN
  IF NOT public.user_has_feature('financeiro','editor') THEN RAISE EXCEPTION 'Sem permissão para criar fornecedor'; END IF;
  v_empresa := public.get_user_empresa_id();
  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN RAISE EXCEPTION 'Run não está aguardando revisão'; END IF;
  IF v_run.agent_type != 'criar_fornecedor' THEN RAISE EXCEPTION 'Tipo não suportado: %', v_run.agent_type; END IF;
  v_nome := NULLIF(trim(v_run.result->>'nome'),''); IF v_nome IS NULL THEN RAISE EXCEPTION 'Fornecedor sem nome'; END IF;
  INSERT INTO public.fornecedores (empresa_id, nome, cnpj, contato, email, telefone)
  VALUES (v_empresa, v_nome, NULLIF(trim(v_run.result->>'cnpj'),''), NULLIF(trim(v_run.result->>'contato'),''),
          NULLIF(trim(v_run.result->>'email'),''), NULLIF(trim(v_run.result->>'telefone'),''))
  RETURNING id INTO v_id;
  UPDATE public.agent_runs SET status='executed', entity_type='fornecedor', entity_id=v_id, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=p_run_id;
  RETURN jsonb_build_object('ok',true,'fornecedor_id',v_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.criar_fornecedor_agente(uuid) TO authenticated;

-- ============================ CATEGORIA ============================
DROP FUNCTION IF EXISTS public.criar_categoria_agente(uuid);
CREATE OR REPLACE FUNCTION public.criar_categoria_agente(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.agent_runs; v_empresa uuid; v_id uuid; v_nome text; v_tipo text;
BEGIN
  IF NOT public.user_has_feature('financeiro','editor') THEN RAISE EXCEPTION 'Sem permissão para criar categoria'; END IF;
  v_empresa := public.get_user_empresa_id();
  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN RAISE EXCEPTION 'Run não está aguardando revisão'; END IF;
  IF v_run.agent_type != 'criar_categoria' THEN RAISE EXCEPTION 'Tipo não suportado: %', v_run.agent_type; END IF;
  v_nome := NULLIF(trim(v_run.result->>'nome'),''); IF v_nome IS NULL THEN RAISE EXCEPTION 'Categoria sem nome'; END IF;
  v_tipo := NULLIF(trim(v_run.result->>'tipo'),'');
  IF v_tipo NOT IN ('Receita','Despesa') THEN RAISE EXCEPTION 'Tipo da categoria deve ser Receita ou Despesa'; END IF;
  INSERT INTO public.categorias_financeiras (empresa_id, nome, tipo)
  VALUES (v_empresa, v_nome, v_tipo::tipo_categoria)
  RETURNING id INTO v_id;
  UPDATE public.agent_runs SET status='executed', entity_type='categoria', entity_id=v_id, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=p_run_id;
  RETURN jsonb_build_object('ok',true,'categoria_id',v_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.criar_categoria_agente(uuid) TO authenticated;

-- ============================ CONTA ============================
DROP FUNCTION IF EXISTS public.criar_conta_agente(uuid);
CREATE OR REPLACE FUNCTION public.criar_conta_agente(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.agent_runs; v_empresa uuid; v_id uuid; v_nome text; v_banco text;
BEGIN
  IF NOT public.user_has_feature('financeiro','editor') THEN RAISE EXCEPTION 'Sem permissão para criar conta'; END IF;
  v_empresa := public.get_user_empresa_id();
  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN RAISE EXCEPTION 'Run não está aguardando revisão'; END IF;
  IF v_run.agent_type != 'criar_conta' THEN RAISE EXCEPTION 'Tipo não suportado: %', v_run.agent_type; END IF;
  v_nome := NULLIF(trim(v_run.result->>'nome'),''); IF v_nome IS NULL THEN RAISE EXCEPTION 'Conta sem nome'; END IF;
  v_banco := NULLIF(trim(v_run.result->>'banco'),''); IF v_banco IS NULL THEN RAISE EXCEPTION 'Conta sem banco'; END IF;
  INSERT INTO public.contas (empresa_id, nome, banco, saldo_inicial, chave_pix, tipo_chave_pix)
  VALUES (v_empresa, v_nome, v_banco, COALESCE(NULLIF(v_run.result->>'saldo_inicial','')::numeric,0),
          NULLIF(trim(v_run.result->>'chave_pix'),''), NULLIF(trim(v_run.result->>'tipo_chave_pix'),''))
  RETURNING id INTO v_id;
  UPDATE public.agent_runs SET status='executed', entity_type='conta', entity_id=v_id, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=p_run_id;
  RETURN jsonb_build_object('ok',true,'conta_id',v_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.criar_conta_agente(uuid) TO authenticated;

-- ============================ CENTRO DE CUSTO ============================
-- RLS de centros_custo só checa empresa; reforçamos financeiro/editor aqui.
DROP FUNCTION IF EXISTS public.criar_centro_custo_agente(uuid);
CREATE OR REPLACE FUNCTION public.criar_centro_custo_agente(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.agent_runs; v_empresa uuid; v_id uuid; v_nome text;
BEGIN
  IF NOT public.user_has_feature('financeiro','editor') THEN RAISE EXCEPTION 'Sem permissão para criar centro de custo'; END IF;
  v_empresa := public.get_user_empresa_id();
  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN RAISE EXCEPTION 'Run não está aguardando revisão'; END IF;
  IF v_run.agent_type != 'criar_centro_custo' THEN RAISE EXCEPTION 'Tipo não suportado: %', v_run.agent_type; END IF;
  v_nome := NULLIF(trim(v_run.result->>'nome'),''); IF v_nome IS NULL THEN RAISE EXCEPTION 'Centro de custo sem nome'; END IF;
  INSERT INTO public.centros_custo (empresa_id, nome, codigo, descricao, ativo, created_by, updated_by)
  VALUES (v_empresa, v_nome, NULLIF(trim(v_run.result->>'codigo'),''), NULLIF(trim(v_run.result->>'descricao'),''), true, auth.uid(), auth.uid())
  RETURNING id INTO v_id;
  UPDATE public.agent_runs SET status='executed', entity_type='centro_custo', entity_id=v_id, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=p_run_id;
  RETURN jsonb_build_object('ok',true,'centro_custo_id',v_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.criar_centro_custo_agente(uuid) TO authenticated;

-- ============================ PESSOA ============================
DROP FUNCTION IF EXISTS public.criar_pessoa_agente(uuid);
CREATE OR REPLACE FUNCTION public.criar_pessoa_agente(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.agent_runs; v_empresa uuid; v_id uuid; v_pn text; v_sn text; v_email text;
BEGIN
  IF NOT public.user_has_feature('pessoas','editor') THEN RAISE EXCEPTION 'Sem permissão para criar pessoa'; END IF;
  v_empresa := public.get_user_empresa_id();
  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN RAISE EXCEPTION 'Run não está aguardando revisão'; END IF;
  IF v_run.agent_type != 'criar_pessoa' THEN RAISE EXCEPTION 'Tipo não suportado: %', v_run.agent_type; END IF;
  v_pn := NULLIF(trim(v_run.result->>'primeiro_nome'),'');
  v_sn := NULLIF(trim(v_run.result->>'sobrenome'),'');
  v_email := NULLIF(trim(v_run.result->>'email'),'');
  IF v_pn IS NULL OR v_sn IS NULL THEN RAISE EXCEPTION 'Pessoa precisa de primeiro nome e sobrenome'; END IF;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Pessoa precisa de e-mail'; END IF;
  INSERT INTO public.pessoas (empresa_id, nome, primeiro_nome, sobrenome, email, cargo, cpf, telefone, tipo_contrato,
     salario_fixo, valor_m2, cnpj, razao_social, pis_nit, created_by, updated_by)
  VALUES (v_empresa, v_pn||' '||v_sn, v_pn, v_sn, v_email,
     NULLIF(trim(v_run.result->>'cargo'),''), NULLIF(trim(v_run.result->>'cpf'),''), NULLIF(trim(v_run.result->>'telefone'),''),
     NULLIF(trim(v_run.result->>'tipo_contrato'),''),
     NULLIF(v_run.result->>'salario_fixo','')::numeric, NULLIF(v_run.result->>'valor_m2','')::numeric,
     NULLIF(trim(v_run.result->>'cnpj'),''), NULLIF(trim(v_run.result->>'razao_social'),''), NULLIF(trim(v_run.result->>'pis_nit'),''),
     auth.uid(), auth.uid())
  RETURNING id INTO v_id;
  UPDATE public.agent_runs SET status='executed', entity_type='pessoa', entity_id=v_id, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=p_run_id;
  RETURN jsonb_build_object('ok',true,'pessoa_id',v_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.criar_pessoa_agente(uuid) TO authenticated;

-- ============================ PROPOSTA (rascunho) ============================
DROP FUNCTION IF EXISTS public.criar_proposta_agente(uuid);
CREATE OR REPLACE FUNCTION public.criar_proposta_agente(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.agent_runs; v_empresa uuid; v_id uuid; v_titulo text;
BEGIN
  IF NOT public.user_has_feature('propostas','editor') THEN RAISE EXCEPTION 'Sem permissão para criar proposta'; END IF;
  v_empresa := public.get_user_empresa_id();
  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN RAISE EXCEPTION 'Run não está aguardando revisão'; END IF;
  IF v_run.agent_type != 'criar_proposta' THEN RAISE EXCEPTION 'Tipo não suportado: %', v_run.agent_type; END IF;
  v_titulo := NULLIF(trim(v_run.result->>'titulo'),''); IF v_titulo IS NULL THEN RAISE EXCEPTION 'Proposta sem título'; END IF;
  INSERT INTO public.propostas (empresa_id, titulo, cliente_id, lead_id, valor_proposto, area_m2, localizacao,
     prazo_estimado_dias, validade, observacao, status)
  VALUES (v_empresa, v_titulo,
     NULLIF(v_run.result->>'cliente_id','')::uuid, NULLIF(v_run.result->>'lead_id','')::uuid,
     NULLIF(v_run.result->>'valor_proposto','')::numeric, NULLIF(v_run.result->>'area_m2','')::numeric,
     NULLIF(trim(v_run.result->>'localizacao'),''), NULLIF(v_run.result->>'prazo_estimado_dias','')::int,
     NULLIF(v_run.result->>'validade','')::date, NULLIF(trim(v_run.result->>'observacao'),''), 'rascunho')
  RETURNING id INTO v_id;
  UPDATE public.agent_runs SET status='executed', entity_type='proposta', entity_id=v_id, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=p_run_id;
  RETURN jsonb_build_object('ok',true,'proposta_id',v_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.criar_proposta_agente(uuid) TO authenticated;

-- ============================ MARCO DE FATURAMENTO ============================
DROP FUNCTION IF EXISTS public.criar_marco_agente(uuid);
CREATE OR REPLACE FUNCTION public.criar_marco_agente(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.agent_runs; v_empresa uuid; v_id uuid; v_nome text; v_valor numeric; v_projeto uuid;
BEGIN
  IF NOT public.user_has_feature('financeiro','editor') THEN RAISE EXCEPTION 'Sem permissão para criar marco'; END IF;
  v_empresa := public.get_user_empresa_id();
  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN RAISE EXCEPTION 'Run não está aguardando revisão'; END IF;
  IF v_run.agent_type != 'criar_marco' THEN RAISE EXCEPTION 'Tipo não suportado: %', v_run.agent_type; END IF;
  v_projeto := NULLIF(v_run.result->>'projeto_id','')::uuid;
  IF v_projeto IS NULL THEN RAISE EXCEPTION 'Marco precisa de um projeto'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projetos WHERE id=v_projeto AND empresa_id=v_empresa AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Projeto inválido'; END IF;
  v_nome := NULLIF(trim(v_run.result->>'nome'),''); IF v_nome IS NULL THEN RAISE EXCEPTION 'Marco sem nome'; END IF;
  v_valor := NULLIF(v_run.result->>'valor','')::numeric; IF v_valor IS NULL OR v_valor <= 0 THEN RAISE EXCEPTION 'Marco precisa de valor'; END IF;
  INSERT INTO public.marcos_faturamento (empresa_id, projeto_id, nome, valor, disciplina, percentual, data_prevista, status)
  VALUES (v_empresa, v_projeto, v_nome, v_valor, NULLIF(trim(v_run.result->>'disciplina'),''),
          NULLIF(v_run.result->>'percentual','')::numeric, NULLIF(v_run.result->>'data_prevista','')::date, 'pendente')
  RETURNING id INTO v_id;
  UPDATE public.agent_runs SET status='executed', entity_type='marco', entity_id=v_id, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=p_run_id;
  RETURN jsonb_build_object('ok',true,'marco_id',v_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.criar_marco_agente(uuid) TO authenticated;

-- ============================ DISCIPLINA em projeto existente ============================
DROP FUNCTION IF EXISTS public.criar_disciplina_agente(uuid);
CREATE OR REPLACE FUNCTION public.criar_disciplina_agente(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.agent_runs; v_empresa uuid; v_id uuid; v_nome text; v_projeto uuid;
BEGIN
  IF NOT public.user_has_feature('projetos','editor') THEN RAISE EXCEPTION 'Sem permissão para adicionar disciplina'; END IF;
  v_empresa := public.get_user_empresa_id();
  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN RAISE EXCEPTION 'Run não está aguardando revisão'; END IF;
  IF v_run.agent_type != 'criar_disciplina' THEN RAISE EXCEPTION 'Tipo não suportado: %', v_run.agent_type; END IF;
  v_projeto := NULLIF(v_run.result->>'projeto_id','')::uuid;
  IF v_projeto IS NULL THEN RAISE EXCEPTION 'Disciplina precisa de um projeto'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projetos WHERE id=v_projeto AND empresa_id=v_empresa AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Projeto inválido'; END IF;
  v_nome := NULLIF(trim(v_run.result->>'nome'),''); IF v_nome IS NULL THEN RAISE EXCEPTION 'Disciplina sem nome'; END IF;
  INSERT INTO public.projeto_disciplinas (projeto_id, nome, status, prioridade, horas_estimadas, custo_hora, data_inicio, data_fim)
  VALUES (v_projeto, v_nome, COALESCE(NULLIF(trim(v_run.result->>'status'),''),'Não Iniciado'),
          NULLIF(trim(v_run.result->>'prioridade'),''),
          COALESCE(NULLIF(v_run.result->>'horas_estimadas','')::numeric,0),
          COALESCE(NULLIF(v_run.result->>'custo_hora','')::numeric,0),
          NULLIF(v_run.result->>'data_inicio','')::date, NULLIF(v_run.result->>'data_fim','')::date)
  RETURNING id INTO v_id;
  UPDATE public.agent_runs SET status='executed', entity_type='disciplina', entity_id=v_id, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=p_run_id;
  RETURN jsonb_build_object('ok',true,'disciplina_id',v_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.criar_disciplina_agente(uuid) TO authenticated;
