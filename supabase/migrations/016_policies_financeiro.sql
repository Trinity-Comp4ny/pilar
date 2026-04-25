-- Migration 016: Policies financeiras — fecha leitura para roles não autorizadas
-- Antes: policies FOR SELECT "Read Only" com filtro só empresa_id faziam OR
-- com FOR ALL → qualquer funcionário (marketing/operacional/user) lia todo
-- financeiro. Agora só admin/financeiro leem receitas, despesas, contas,
-- cartoes, fornecedores.
-- Categorias ficam legíveis por todos da empresa (necessário para dropdowns).

-- =============================================
-- 1. RECEITAS — remove Read Only
-- =============================================
DROP POLICY IF EXISTS "Receitas Read Only" ON public.receitas;

-- =============================================
-- 2. DESPESAS — remove Read Only
-- =============================================
DROP POLICY IF EXISTS "Despesas Read Only" ON public.despesas;

-- =============================================
-- 3. CONTAS BANCÁRIAS — remove Read Only
-- =============================================
DROP POLICY IF EXISTS "Contas Read Only" ON public.contas;

-- =============================================
-- 4. CARTÕES DE CRÉDITO — remove Read Only
-- =============================================
DROP POLICY IF EXISTS "Cartoes Read Only" ON public.cartoes_credito;

-- =============================================
-- 5. FORNECEDORES — remove Read Only
-- =============================================
DROP POLICY IF EXISTS "Fornecedores Read Only" ON public.fornecedores;

-- =============================================
-- 6. CATEGORIAS FINANCEIRAS — manter leitura para todos da empresa
-- (categorias são metadados não-sensíveis, usadas em dropdowns)
-- Nenhuma ação — policy existente mantida.
-- =============================================
