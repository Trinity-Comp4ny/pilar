-- Asaas Integration
-- Configura tabelas e colunas necessárias para integração com gateway de pagamento Asaas

-- 1. Tabela de configuração Asaas por empresa
CREATE TABLE IF NOT EXISTS asaas_config (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  api_key     TEXT        NOT NULL,
  ambiente    TEXT        NOT NULL DEFAULT 'sandbox' CHECK (ambiente IN ('sandbox', 'producao')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id)
);

ALTER TABLE asaas_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'asaas_config' AND policyname = 'asaas_config_empresa_select'
  ) THEN
    CREATE POLICY "asaas_config_empresa_select" ON asaas_config
      FOR SELECT USING (
        empresa_id IN (SELECT empresa_id FROM profiles WHERE id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'asaas_config' AND policyname = 'asaas_config_empresa_insert'
  ) THEN
    CREATE POLICY "asaas_config_empresa_insert" ON asaas_config
      FOR INSERT WITH CHECK (
        empresa_id IN (SELECT empresa_id FROM profiles WHERE id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'asaas_config' AND policyname = 'asaas_config_empresa_update'
  ) THEN
    CREATE POLICY "asaas_config_empresa_update" ON asaas_config
      FOR UPDATE USING (
        empresa_id IN (SELECT empresa_id FROM profiles WHERE id = auth.uid())
      );
  END IF;
END $$;

GRANT ALL ON asaas_config TO authenticated;

-- 2. Colunas Asaas em clientes (customer_id reutilizado entre cobranças)
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

-- 3. Colunas Asaas em receitas
ALTER TABLE receitas
  ADD COLUMN IF NOT EXISTS asaas_payment_id     TEXT,
  ADD COLUMN IF NOT EXISTS asaas_payment_url    TEXT,
  ADD COLUMN IF NOT EXISTS asaas_payment_status TEXT,
  ADD COLUMN IF NOT EXISTS asaas_billing_type   TEXT;

-- 4. Log de webhooks recebidos do Asaas (auditoria)
CREATE TABLE IF NOT EXISTS asaas_webhook_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID        REFERENCES empresas(id),
  event        TEXT        NOT NULL,
  payment_id   TEXT,
  receita_id   UUID        REFERENCES receitas(id),
  payload      JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE asaas_webhook_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'asaas_webhook_logs' AND policyname = 'asaas_webhook_logs_select'
  ) THEN
    CREATE POLICY "asaas_webhook_logs_select" ON asaas_webhook_logs
      FOR SELECT USING (
        empresa_id IN (SELECT empresa_id FROM profiles WHERE id = auth.uid())
      );
  END IF;
END $$;

-- Service role pode inserir (via webhook sem JWT)
GRANT SELECT ON asaas_webhook_logs TO authenticated;
