-- Fix: contas.saldo_atual e cartoes.usado eram text mas são usados como numeric
-- Fix: remover colunas legado user_id (text) que não têm uso no sistema

ALTER TABLE contas
  ALTER COLUMN saldo_atual TYPE numeric USING NULLIF(saldo_atual, '')::numeric,
  DROP COLUMN IF EXISTS user_id;

ALTER TABLE cartoes
  ALTER COLUMN usado TYPE numeric USING NULLIF(usado, '')::numeric,
  DROP COLUMN IF EXISTS user_id;
