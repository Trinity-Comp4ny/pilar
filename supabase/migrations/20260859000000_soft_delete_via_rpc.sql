-- Soft delete por RPC para as tabelas cuja policy de SELECT esconde linha
-- deletada. Fecha a mesma classe de bug que a 20260858000000 resolveu para
-- `projetos`, medida em produção em 24/08 e confirmada em 5 de 5 tabelas que
-- tinham linha para testar.
--
-- A MECÂNICA (importa, porque a explicação anterior estava incompleta): não é o
-- WITH CHECK da policy de escrita, que nem menciona deleted_at. Um UPDATE que
-- referencia coluna na cláusula WHERE (o `.eq("id", id)` do cliente) faz o
-- Postgres aplicar as policies de SELECT também à LINHA NOVA. A linha nova tem
-- deleted_at preenchido, a policy de SELECT exige `deleted_at IS NULL`, e o
-- resultado é `42501 new row violates row-level security policy`. Provado por
-- controle: `UPDATE ... SET nome = nome WHERE id = X` passa na mesma tabela, no
-- mesmo padrão; só quebra o UPDATE que grava deleted_at.
--
-- Medido em produção (transação revertida, como o admin da VRZ):
--   clientes 125 linhas → 42501      receitas 17 → 42501
--   despesas   3 linhas → 42501      contas    1 → 42501
--   projetos  96 linhas → 42501 (já corrigido pela 20260858000000)
--
-- POR QUE UMA FUNÇÃO GENÉRICA e não 32 específicas: são 16 tabelas restantes,
-- e duas RPCs por tabela seria a mesma regra copiada 32 vezes, cada cópia um
-- lugar a mais para divergir. A injeção fica fechada pela allowlist explícita
-- (a tabela precisa estar no CASE) mais `format('%I')`, nunca por concatenação.
--
-- O que a função NÃO relaxa: ela reproduz a mesma regra de acesso das policies
-- de cada tabela (empresa da linha = empresa do caller, mais o gate de módulo
-- onde a policy usa um). As policies de obra_* checam consistência de FK na
-- escrita; soft delete não muda FK nenhuma, então essa parte não se aplica.

-- =============================================
-- 0. Drift: as policies de `clientes` em produção não vêm de migration
-- =============================================
-- Achado ao escrever o teste desta migration. Comparando o banco local
-- (construído das migrations, igual ao que o CI usa) contra produção:
--
--   224 policies nos dois; 26 com `deleted_at IS NULL` no local, 28 em produção.
--   As duas de diferença são EXATAMENTE `clientes_select` e `clientes_write`.
--
-- A última migration que define essas duas é a 20260507300000, e ela NÃO tem a
-- condição. Alguém acrescentou `deleted_at IS NULL` direto no banco (staging e
-- produção), sem migration. Consequências que isso já causava:
--
--   1. O CI validava, para `clientes`, um schema que produção não roda. A suíte
--      de RLS dava garantia sobre a policy errada.
--   2. Qualquer migration futura que recriasse essas policies REMOVERIA a
--      condição em produção sem ninguém notar, e cliente excluído voltaria a
--      aparecer nas listagens.
--
-- As outras 15 tabelas com o mesmo desenho vêm de migration corretamente, então
-- a condição é a intenção do projeto e o certo é formalizar, não remover. Aqui
-- prod não muda de comportamento (já é assim); quem passa a bater é o local.

DROP POLICY IF EXISTS clientes_select ON public.clientes;
CREATE POLICY clientes_select ON public.clientes
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('clientes', 'viewer')
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS clientes_write ON public.clientes;
CREATE POLICY clientes_write ON public.clientes
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('clientes', 'editor')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('clientes', 'editor')
  );

-- =============================================
-- Allowlist: tabela → feature que governa a escrita
-- =============================================
-- NULL = a policy da tabela não usa user_has_feature, só empresa_id (é o caso
-- das 6 de obra). Reproduzir exatamente evita a função negar onde a RLS
-- permite, ou o contrário.
CREATE OR REPLACE FUNCTION public._soft_delete_feature(p_tabela text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT CASE p_tabela
    WHEN 'clientes'               THEN 'clientes'
    -- projetos já tem rpc_excluir_projeto/rpc_restaurar_projeto (20260858000000,
    -- de horas antes). Entra aqui também para a allowlist ficar completa: um
    -- helper de front que caia no fallback de UPDATE direto para projetos
    -- reintroduziria o bug. Consolidar as duas vias é follow-up; não mexo agora
    -- numa mudança que subiu no mesmo dia.
    WHEN 'projetos'               THEN 'projetos'
    WHEN 'fornecedores'           THEN 'financeiro'
    WHEN 'receitas'               THEN 'financeiro'
    WHEN 'despesas'               THEN 'financeiro'
    WHEN 'contas'                 THEN 'financeiro'
    WHEN 'cartoes'                THEN 'financeiro'
    WHEN 'faturas'                THEN 'financeiro'
    WHEN 'categorias_financeiras' THEN 'financeiro'
    WHEN 'marcos_faturamento'     THEN 'financeiro'
    WHEN 'templates_projeto'      THEN 'templates'
    -- Obras: policy só checa empresa_id, sem gate de feature.
    WHEN 'obras'                 THEN ''
    WHEN 'obra_material'         THEN ''
    WHEN 'obra_material_mov'     THEN ''
    WHEN 'obra_cotacao'          THEN ''
    WHEN 'obra_cotacao_proposta' THEN ''
    WHEN 'obra_conta_lancamento' THEN ''
    ELSE NULL
  END;
$function$;

REVOKE ALL ON FUNCTION public._soft_delete_feature(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._soft_delete_feature(text) TO authenticated;

-- =============================================
-- Guard comum: valida tabela e permissão, devolve a empresa do caller
-- =============================================
CREATE OR REPLACE FUNCTION public._soft_delete_guard(p_tabela text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_feature text;
  v_empresa uuid;
BEGIN
  v_feature := public._soft_delete_feature(p_tabela);
  IF v_feature IS NULL THEN
    RAISE EXCEPTION 'Tabela % não permite soft delete por esta via', p_tabela
      USING ERRCODE = '22023';
  END IF;

  v_empresa := public.get_user_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa' USING ERRCODE = '42501';
  END IF;

  IF v_feature <> '' AND NOT public.user_has_feature(v_feature, 'editor') THEN
    RAISE EXCEPTION 'Sem permissão de escrita em %', v_feature USING ERRCODE = '42501';
  END IF;

  RETURN v_empresa;
END;
$function$;

REVOKE ALL ON FUNCTION public._soft_delete_guard(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._soft_delete_guard(text) TO authenticated;

-- =============================================
-- Excluir (soft) uma linha
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_soft_delete(p_tabela text, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid;
  v_linhas int;
BEGIN
  v_empresa := public._soft_delete_guard(p_tabela);

  EXECUTE format(
    'UPDATE public.%I SET deleted_at = now() WHERE id = $1 AND empresa_id = $2 AND deleted_at IS NULL',
    p_tabela
  ) USING p_id, v_empresa;

  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  IF v_linhas = 0 THEN
    -- Mesma resposta para "não existe", "de outra empresa" e "já excluído": não
    -- vale contar a diferença para quem não deveria ver a linha.
    RAISE EXCEPTION 'Registro não encontrado' USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_soft_delete(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_soft_delete(text, uuid) TO authenticated;

-- =============================================
-- Excluir (soft) um grupo de parcelas
-- =============================================
-- O Financeiro exclui "todas as parcelas" de uma vez (useFinanceItemMutations,
-- e o desfazer do chat), então precisa da variante por grupo_parcela.
CREATE OR REPLACE FUNCTION public.rpc_soft_delete_grupo(p_tabela text, p_grupo uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid;
  v_linhas int;
BEGIN
  v_empresa := public._soft_delete_guard(p_tabela);

  EXECUTE format(
    'UPDATE public.%I SET deleted_at = now() WHERE grupo_parcela = $1 AND empresa_id = $2 AND deleted_at IS NULL',
    p_tabela
  ) USING p_grupo, v_empresa;

  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  IF v_linhas = 0 THEN
    RAISE EXCEPTION 'Nenhuma parcela encontrada' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_linhas;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_soft_delete_grupo(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_soft_delete_grupo(text, uuid) TO authenticated;

-- =============================================
-- Restaurar (o "Desfazer" dos toasts)
-- =============================================
-- Espelho do mesmo problema: a linha excluída não passa pela policy de SELECT,
-- então o UPDATE do cliente não encontrava nada e o desfazer falhava calado.
CREATE OR REPLACE FUNCTION public.rpc_restaurar(p_tabela text, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid;
  v_linhas int;
BEGIN
  v_empresa := public._soft_delete_guard(p_tabela);

  EXECUTE format(
    'UPDATE public.%I SET deleted_at = NULL WHERE id = $1 AND empresa_id = $2 AND deleted_at IS NOT NULL',
    p_tabela
  ) USING p_id, v_empresa;

  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  IF v_linhas = 0 THEN
    RAISE EXCEPTION 'Registro não encontrado ou não estava excluído' USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_restaurar(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_restaurar(text, uuid) TO authenticated;
