-- Adiciona webhook_token por empresa para validação segura de webhooks multi-tenant
-- Cada empresa gera seu próprio token e configura no painel Asaas

ALTER TABLE asaas_config
  ADD COLUMN IF NOT EXISTS webhook_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex');
