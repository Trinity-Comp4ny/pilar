-- Performance: add missing FK indexes not covered by previous migrations
CREATE INDEX IF NOT EXISTS idx_faturas_conta_pgto ON faturas(conta_pagamento_id);
CREATE INDEX IF NOT EXISTS idx_folha_pessoa ON folha_pagamento(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_asaas_webhook_receita ON asaas_webhook_logs(receita_id);
