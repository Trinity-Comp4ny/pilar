-- Bug de produção achado em 03/09 (Sentry PILAR-2V, relatado pela VRZ): criar
-- projeto morria em
--   duplicate key value violates unique constraint "projetos_unique_empresa_codigo"
-- e a empresa ficava impedida de cadastrar projeto para sempre, não só naquela
-- tentativa.
--
-- Causa: o código PRJ-XXXX era gerado no client (useProjetoForm), que lia o
-- maior código existente filtrando `deleted_at IS NULL`. O unique da tabela é
-- TOTAL, não parcial em deleted_at, então soft-deletar o projeto de maior código
-- faz o client gerar de novo um código que continua ocupado na tabela, e todo
-- INSERT seguinte falha. Estado em produção quando este fix foi escrito:
-- VRZ Engenharia com maior código vivo PRJ-0009 e PRJ-0010..0012 soft-deletados
-- em 28/08 (6 dias travada), CBSP sem código vivo e PRJ-0001 soft-deletado.
-- O mesmo cálculo no client também perde a corrida quando dois usuários da mesma
-- empresa criam projeto ao mesmo tempo: ambos leem o mesmo máximo.
--
-- Fix: gerar o código no servidor, na mesma transação do INSERT, contando TODAS
-- as linhas (inclusive soft-deletadas, que é o que o unique enxerga) e sob
-- advisory lock por empresa, que serializa criações concorrentes até o commit.
-- p_codigo continua respeitado quando informado (QuickAddCard deixa o usuário
-- digitar o código); só quando vem vazio o servidor gera.
--
-- Só a sobrecarga de 13 argumentos é alterada: é a única com DEFAULT em todos os
-- argumentos opcionais e, por isso, a única alcançável pelas chamadas parciais do
-- front (as outras duas seguem como a dívida do ADR 0026 / spec 052 descreve).

CREATE OR REPLACE FUNCTION public.create_projeto_completo(
  p_codigo TEXT,
  p_nome TEXT,
  p_cliente_id UUID,
  p_data_inicio DATE DEFAULT NULL,
  p_data_previsao DATE DEFAULT NULL,
  p_data_final DATE DEFAULT NULL,
  p_valor_contrato DECIMAL DEFAULT 0,
  p_observacao TEXT DEFAULT '',
  p_localizacao TEXT DEFAULT '',
  p_parcelas TEXT DEFAULT NULL,
  p_area_m2 NUMERIC DEFAULT 0,
  p_disciplinas JSONB DEFAULT '[]',
  p_prioridade TEXT DEFAULT 'Media'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_user_id UUID;
  v_projeto_id UUID;
  v_codigo TEXT;
  v_max_seq INT;
BEGIN
  v_user_id := auth.uid();
  SELECT empresa_id INTO v_empresa_id FROM public.profiles WHERE id = v_user_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não vinculado a uma empresa';
  END IF;

  v_codigo := NULLIF(BTRIM(COALESCE(p_codigo, '')), '');

  IF v_codigo IS NULL THEN
    -- 4242 é o namespace deste lock (primeiro advisory lock do banco). A segunda
    -- chave escopa por empresa: duas empresas criando junto não se bloqueiam.
    -- xact: o lock cai no commit/rollback, cobrindo a janela até o INSERT.
    PERFORM pg_advisory_xact_lock(4242, hashtext(v_empresa_id::TEXT));

    -- Sem filtro de deleted_at de propósito: o unique
    -- projetos_unique_empresa_codigo vale para linha soft-deletada também.
    -- O limite de 9 dígitos evita estourar o INT num código digitado à mão.
    SELECT COALESCE(MAX((regexp_replace(codigo_projeto, '\D', '', 'g'))::INT), 0)
      INTO v_max_seq
    FROM public.projetos
    WHERE empresa_id = v_empresa_id
      AND codigo_projeto ~* '^PRJ-[0-9]{1,9}$';

    v_codigo := 'PRJ-' || LPAD((v_max_seq + 1)::TEXT, 4, '0');
  END IF;

  INSERT INTO public.projetos (
    empresa_id, codigo_projeto, nome, cliente_id,
    data_inicio, data_previsao, data_final,
    valor_contrato, observacao, localizacao,
    parcelas, area_m2, disciplinas, prioridade,
    created_by, updated_by
  ) VALUES (
    v_empresa_id, v_codigo, p_nome, p_cliente_id,
    p_data_inicio, p_data_previsao, p_data_final,
    p_valor_contrato, p_observacao, p_localizacao,
    p_parcelas, p_area_m2, p_disciplinas, p_prioridade,
    v_user_id, v_user_id
  ) RETURNING id INTO v_projeto_id;

  RETURN v_projeto_id;
END;
$$;

COMMENT ON FUNCTION public.create_projeto_completo(
  TEXT, TEXT, UUID, DATE, DATE, DATE, DECIMAL, TEXT, TEXT, TEXT, NUMERIC, JSONB, TEXT
) IS
  'Cria projeto com disciplinas. p_codigo vazio faz o servidor gerar PRJ-XXXX sequencial por empresa, contando também os soft-deletados (o unique é total) e sob advisory lock por empresa.';

-- ==========================================================================
-- Segundo bug da mesma leva, também confirmado em produção: quem NÃO tem
-- can_view_financeiro() não conseguia salvar NENHUMA edição de projeto que
-- tivesse valor de contrato, nem trocar o nome ou a data.
--
-- O gate de 20260874000000 quis ser cirúrgico ("só barra se o valor mudar de
-- verdade"), mas ele compara com o que o cliente MANDA, e o cliente sem
-- financeiro lê o projeto por projetos_safe, onde valor_contrato vem
-- mascarado como NULL. O form transforma esse NULL em 0 e envia 0. Aí
-- `0 IS DISTINCT FROM 200000` é verdadeiro e a RPC levanta exceção: o usuário
-- é barrado por "alterar" um valor que ele nem podia ver, e a edição inteira
-- morre com ele.
--
-- Fix: p_valor_contrato NULL passa a significar "não mexe no valor", e o
-- cliente sem permissão manda NULL. Quem tem permissão continua mandando o
-- número (0 explícito segue zerando, comportamento inalterado). Com isso o
-- gate barra só quem realmente tenta mudar dinheiro, que era a intenção
-- original.
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.update_projeto_completo(
  p_projeto_id UUID,
  p_codigo TEXT,
  p_nome TEXT,
  p_cliente_id UUID,
  p_data_inicio DATE DEFAULT NULL,
  p_data_previsao DATE DEFAULT NULL,
  p_data_final DATE DEFAULT NULL,
  p_valor_contrato NUMERIC DEFAULT 0,
  p_observacao TEXT DEFAULT '',
  p_localizacao TEXT DEFAULT '',
  p_parcelas TEXT DEFAULT NULL,
  p_area_m2 NUMERIC DEFAULT 0,
  p_disciplinas JSONB DEFAULT '[]',
  p_status TEXT DEFAULT 'Planejamento',
  p_prioridade TEXT DEFAULT 'Media'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_caller_empresa_id UUID;
  v_projeto_empresa_id UUID;
  v_valor_atual NUMERIC;
  v_valor_final NUMERIC;
BEGIN
  v_user_id := auth.uid();
  v_caller_empresa_id := public.get_user_empresa_id();

  IF v_caller_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT empresa_id, valor_contrato INTO v_projeto_empresa_id, v_valor_atual
  FROM public.projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_projeto_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto_empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- NULL = não informado = mantém o que está salvo.
  v_valor_final := COALESCE(p_valor_contrato, v_valor_atual);

  IF v_valor_final IS DISTINCT FROM v_valor_atual AND NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para alterar valor de contrato'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.projetos SET
    codigo_projeto = p_codigo,
    nome = p_nome,
    cliente_id = p_cliente_id,
    data_inicio = p_data_inicio,
    data_previsao = p_data_previsao,
    data_final = p_data_final,
    valor_contrato = v_valor_final,
    observacao = p_observacao,
    localizacao = p_localizacao,
    parcelas = p_parcelas,
    area_m2 = p_area_m2,
    disciplinas = p_disciplinas,
    status = p_status::status_projeto,
    prioridade = p_prioridade,
    updated_by = v_user_id,
    updated_at = now()
  WHERE id = p_projeto_id;
END;
$$;

COMMENT ON FUNCTION public.update_projeto_completo(
  UUID, TEXT, TEXT, UUID, DATE, DATE, DATE, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, JSONB, TEXT, TEXT
) IS
  'Edita projeto. p_valor_contrato NULL mantém o valor salvo, para quem não tem can_view_financeiro() poder editar os campos não-financeiros de um projeto com valor.';
