-- Migration: Atualizar views financeiras com campos faltantes para a UI

-- View de resumo de contas bancárias (adiciona banco e cor)
-- DROP + CREATE porque CREATE OR REPLACE não permite alterar colunas existentes
DROP VIEW IF EXISTS public.view_financas_resumo;
CREATE VIEW public.view_financas_resumo AS
SELECT
  c.id as conta_id,
  c.nome as conta_nome,
  c.banco,
  c.cor,
  c.empresa_id,
  c.saldo_inicial,
  COALESCE((SELECT SUM(r.valor) FROM public.receitas r WHERE r.conta_id = c.id AND r.status = 'Recebido' AND r.deleted_at IS NULL), 0) as total_entradas,
  COALESCE((SELECT SUM(d.valor) FROM public.despesas d WHERE d.conta_id = c.id AND d.status = 'Pago' AND d.deleted_at IS NULL), 0) as total_saidas,
  (c.saldo_inicial +
   COALESCE((SELECT SUM(r.valor) FROM public.receitas r WHERE r.conta_id = c.id AND r.status = 'Recebido' AND r.deleted_at IS NULL), 0) -
   COALESCE((SELECT SUM(d.valor) FROM public.despesas d WHERE d.conta_id = c.id AND d.status = 'Pago' AND d.deleted_at IS NULL), 0)
  ) as saldo_atual
FROM public.contas c
WHERE c.deleted_at IS NULL;

GRANT SELECT ON public.view_financas_resumo TO authenticated;

-- View de resumo de cartões de crédito (sem conta_pagamento_id por enquanto,
-- será adicionada na migration 20260402000000_create_faturas_system.sql)
DROP VIEW IF EXISTS public.view_cartao_resumo;
CREATE VIEW public.view_cartao_resumo AS
SELECT
  cc.id,
  cc.nome,
  cc.empresa_id,
  cc.dia_fechamento,
  cc.dia_vencimento,
  cc.cor,
  cc.limite,
  COALESCE((SELECT SUM(d.valor) FROM public.despesas d WHERE d.cartao_id = cc.id AND d.status = 'Pendente' AND d.deleted_at IS NULL), 0) as usado,
  (cc.limite - COALESCE((SELECT SUM(d.valor) FROM public.despesas d WHERE d.cartao_id = cc.id AND d.status = 'Pendente' AND d.deleted_at IS NULL), 0)) as disponivel
FROM public.cartoes_credito cc
WHERE cc.deleted_at IS NULL;

GRANT SELECT ON public.view_cartao_resumo TO authenticated;
