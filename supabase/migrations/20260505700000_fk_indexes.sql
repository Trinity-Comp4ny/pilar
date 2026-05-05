-- Índices em colunas FK sem cobertura.
-- Postgres não cria índice automático em FK — cada um aqui evita seq scan
-- em filtragem, JOIN e ON DELETE CASCADE dessas tabelas.

CREATE INDEX IF NOT EXISTS idx_receitas_cliente_id
  ON public.receitas(cliente_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_receitas_categoria_id
  ON public.receitas(categoria_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_receitas_conta_id
  ON public.receitas(conta_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_receitas_centro_custo_id
  ON public.receitas(centro_custo_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_fornecedor_id
  ON public.despesas(fornecedor_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_categoria_id
  ON public.despesas(categoria_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_conta_id
  ON public.despesas(conta_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_cartao_id
  ON public.despesas(cartao_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_centro_custo_id
  ON public.despesas(centro_custo_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_despesa_pai_id
  ON public.despesas(despesa_pai_id) WHERE despesa_pai_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_faturas_conta_pagamento_id
  ON public.faturas(conta_pagamento_id);

CREATE INDEX IF NOT EXISTS idx_folha_pagamento_pessoa_id
  ON public.folha_pagamento(pessoa_id);

CREATE INDEX IF NOT EXISTS idx_propostas_lead_id
  ON public.propostas(lead_id);

CREATE INDEX IF NOT EXISTS idx_propostas_cliente_id
  ON public.propostas(cliente_id);

CREATE INDEX IF NOT EXISTS idx_propostas_projeto_id
  ON public.propostas(projeto_id);

CREATE INDEX IF NOT EXISTS idx_propostas_template_id
  ON public.propostas(template_id) WHERE template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_responsavel_id
  ON public.leads(responsavel_id) WHERE responsavel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_cliente_id
  ON public.leads(cliente_id) WHERE cliente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_escopos_aprovado_por
  ON public.escopos(aprovado_por) WHERE aprovado_por IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aprovacoes_solicitante_id
  ON public.aprovacoes(solicitante_id);

CREATE INDEX IF NOT EXISTS idx_aprovacoes_aprovador_id
  ON public.aprovacoes(aprovador_id) WHERE aprovador_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asaas_webhook_logs_receita_id
  ON public.asaas_webhook_logs(receita_id) WHERE receita_id IS NOT NULL;
