-- Rename cartoes_credito → cartoes and add tipo (credito/debito)
-- Idempotente: tabela pode já existir como cartoes no banco local

-- 1. Rename table (somente se ainda existir com nome antigo)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cartoes_credito') THEN
    ALTER TABLE public.cartoes_credito RENAME TO cartoes;
  END IF;
END $$;

-- 2. Rename constraints (somente se existirem com nome antigo)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cartoes_credito_pkey') THEN
    ALTER TABLE public.cartoes RENAME CONSTRAINT cartoes_credito_pkey TO cartoes_pkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cartoes_credito_empresa_id_fkey') THEN
    ALTER TABLE public.cartoes RENAME CONSTRAINT cartoes_credito_empresa_id_fkey TO cartoes_empresa_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cartoes_credito_conta_pagamento_id_fkey') THEN
    ALTER TABLE public.cartoes RENAME CONSTRAINT cartoes_credito_conta_pagamento_id_fkey TO cartoes_conta_pagamento_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cartoes_credito_dia_fechamento_check') THEN
    ALTER TABLE public.cartoes RENAME CONSTRAINT cartoes_credito_dia_fechamento_check TO cartoes_dia_fechamento_check;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cartoes_credito_dia_vencimento_check') THEN
    ALTER TABLE public.cartoes RENAME CONSTRAINT cartoes_credito_dia_vencimento_check TO cartoes_dia_vencimento_check;
  END IF;
END $$;

-- 3. Add tipo column (default credito to keep backwards compat)
ALTER TABLE public.cartoes
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'credito'
    CHECK (tipo IN ('credito', 'debito'));

-- 4. Recreate view referencing new table name + expose tipo
DROP VIEW IF EXISTS public.view_cartao_resumo;
CREATE VIEW public.view_cartao_resumo AS
SELECT
  c.id,
  c.nome,
  c.empresa_id,
  c.dia_fechamento,
  c.dia_vencimento,
  c.cor,
  c.limite,
  c.conta_pagamento_id,
  c.tipo,
  COALESCE(
    (SELECT SUM(d.valor)
     FROM public.despesas d
     WHERE d.cartao_id = c.id
       AND d.status = 'Pendente'
       AND d.deleted_at IS NULL),
    0
  ) AS usado,
  (c.limite - COALESCE(
    (SELECT SUM(d.valor)
     FROM public.despesas d
     WHERE d.cartao_id = c.id
       AND d.status = 'Pendente'
       AND d.deleted_at IS NULL),
    0
  )) AS disponivel
FROM public.cartoes c
WHERE c.deleted_at IS NULL;

GRANT SELECT ON public.view_cartao_resumo TO authenticated;

-- 5. Grants on renamed table
GRANT ALL ON TABLE public.cartoes TO anon;
GRANT ALL ON TABLE public.cartoes TO authenticated;
GRANT ALL ON TABLE public.cartoes TO service_role;
