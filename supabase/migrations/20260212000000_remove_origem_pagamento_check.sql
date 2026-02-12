-- Remove origem_pagamento_check constraint from despesas table
-- This allows marking expenses as paid without requiring conta_id or cartao_id

-- First, drop the existing constraint
ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS origem_pagamento_check;

-- The constraint is now removed. Expenses can be marked as 'Pago' without requiring payment source
