-- DB-A1: Backfill fatura_id for despesas that have cartao_id but no fatura_id
-- These were created before the find_or_create_fatura trigger was in place
DO $$
DECLARE
  r RECORD;
  v_fatura_id UUID;
BEGIN
  FOR r IN
    SELECT id, cartao_id, data_vencimento
    FROM despesas
    WHERE cartao_id IS NOT NULL
      AND fatura_id IS NULL
      AND deleted_at IS NULL
      AND is_fatura_payment = false
  LOOP
    v_fatura_id := public.find_or_create_fatura(r.cartao_id, r.data_vencimento::date);
    IF v_fatura_id IS NOT NULL THEN
      UPDATE despesas SET fatura_id = v_fatura_id WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;
