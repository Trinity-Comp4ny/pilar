-- Onda 0 — Financeiro: view_financas_resumo passa a refletir TRANSFERÊNCIAS no saldo da conta.
-- Antes: saldo_atual = saldo_inicial + receitas(Recebido) - despesas(Pago), sem considerar
-- transferencias → transferir A→B não mexia no saldo de nenhuma conta.
-- Fix: saldo_atual += Σ transferencias.valor (destino = conta) e -= Σ (origem = conta).
-- total_entradas/total_saidas continuam sendo receita/despesa (transferência é movimento interno).
-- Preserva security_invoker=true (RLS por empresa). Mesmas colunas/ordem → CREATE OR REPLACE ok.

CREATE OR REPLACE VIEW public.view_financas_resumo
WITH (security_invoker = true) AS
SELECT
  c.id AS conta_id,
  c.nome AS conta_nome,
  c.banco,
  c.cor,
  c.empresa_id,
  c.saldo_inicial,
  COALESCE((SELECT SUM(r.valor) FROM public.receitas r
            WHERE r.conta_id = c.id AND r.status = 'Recebido'::public.status_financeiro AND r.deleted_at IS NULL), 0::numeric) AS total_entradas,
  COALESCE((SELECT SUM(d.valor) FROM public.despesas d
            WHERE d.conta_id = c.id AND d.status = 'Pago'::public.status_financeiro AND d.deleted_at IS NULL), 0::numeric) AS total_saidas,
  (
    c.saldo_inicial
    + COALESCE((SELECT SUM(r.valor) FROM public.receitas r
                WHERE r.conta_id = c.id AND r.status = 'Recebido'::public.status_financeiro AND r.deleted_at IS NULL), 0::numeric)
    - COALESCE((SELECT SUM(d.valor) FROM public.despesas d
                WHERE d.conta_id = c.id AND d.status = 'Pago'::public.status_financeiro AND d.deleted_at IS NULL), 0::numeric)
    + COALESCE((SELECT SUM(t.valor) FROM public.transferencias t WHERE t.conta_destino_id = c.id), 0::numeric)
    - COALESCE((SELECT SUM(t.valor) FROM public.transferencias t WHERE t.conta_origem_id = c.id), 0::numeric)
  ) AS saldo_atual
FROM public.contas c
WHERE c.deleted_at IS NULL;
