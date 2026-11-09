-- Feedback da VRZ (16/10): parcela entrando no financeiro com "PRJ-0034" na descrição.
--
-- A migration 20261111000000 corrigiu rpc_gerar_parcelas_dia_fixo, mas a irmã
-- rpc_gerar_parcelas_projeto (intervalo em dias) continuava escrevendo
-- `codigo_projeto || ' - Parcela'`. O código é chave interna (SPEC 100); a descrição
-- usa o nome do projeto. Projeto sem código também deixava a descrição nula e
-- derrubava a chamada (NOT NULL em receitas.descricao).
--
-- Só a descrição muda. Assinatura, permissões e o resto da regra ficam como estavam.

CREATE OR REPLACE FUNCTION public.rpc_gerar_parcelas_projeto(p_projeto_id uuid, p_num_parcelas integer DEFAULT 1, p_intervalo_dias integer DEFAULT 30)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_projeto RECORD;
  v_valor_parcela NUMERIC;
  v_data_base DATE;
  i INTEGER;
  parcelas_criadas INTEGER := 0;
  v_caller_empresa_id UUID;
BEGIN
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para gerar parcelas';
  END IF;

  v_caller_empresa_id := public.get_user_empresa_id();

  IF v_caller_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT id, valor_contrato, cliente_id, empresa_id, data_inicio, nome, codigo_projeto
  INTO v_projeto
  FROM projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_projeto IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto.empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_projeto.valor_contrato IS NULL OR v_projeto.valor_contrato <= 0 THEN
    RAISE EXCEPTION 'Projeto sem valor de contrato';
  END IF;

  IF p_num_parcelas < 1 OR p_num_parcelas > 60 THEN
    RAISE EXCEPTION 'Número de parcelas deve ser entre 1 e 60';
  END IF;

  v_valor_parcela := ROUND(v_projeto.valor_contrato / p_num_parcelas, 2);
  v_data_base := COALESCE(v_projeto.data_inicio, CURRENT_DATE);

  FOR i IN 1..p_num_parcelas LOOP
    INSERT INTO receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id)
    VALUES (
      v_projeto.empresa_id,
      COALESCE(NULLIF(btrim(v_projeto.nome), ''), v_projeto.codigo_projeto) || ' - Parcela ' || i || '/' || p_num_parcelas,
      v_valor_parcela,
      v_data_base + ((i - 1) * p_intervalo_dias),
      'Pendente',
      p_projeto_id,
      v_projeto.cliente_id
    );
    parcelas_criadas := parcelas_criadas + 1;
  END LOOP;

  IF p_num_parcelas > 1 THEN
    UPDATE receitas
    SET valor = v_projeto.valor_contrato - (v_valor_parcela * (p_num_parcelas - 1))
    WHERE projeto_id = p_projeto_id
      AND descricao LIKE '%Parcela ' || p_num_parcelas || '/' || p_num_parcelas
      AND deleted_at IS NULL;
  END IF;

  RETURN parcelas_criadas;
END;
$function$;
