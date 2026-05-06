-- Fix: contas.saldo_atual e cartoes.usado eram text mas são usados como numeric
-- Fix: remover colunas legado user_id (text) que não têm uso no sistema

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contas' AND column_name = 'saldo_atual' AND data_type = 'text') THEN
    ALTER TABLE contas ALTER COLUMN saldo_atual TYPE numeric USING
      CASE WHEN saldo_atual ~ '^-?[0-9]+(\.[0-9]+)?$' THEN saldo_atual::numeric ELSE NULL END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contas' AND column_name = 'user_id') THEN
    ALTER TABLE contas DROP COLUMN user_id;
  END IF;
END $$;

DO $$ BEGIN
  -- Suporta tanto o nome antigo (cartoes_credito) quanto o novo (cartoes)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cartoes_credito' AND column_name = 'usado' AND data_type = 'text') THEN
    ALTER TABLE cartoes_credito ALTER COLUMN usado TYPE numeric USING
      CASE WHEN usado ~ '^-?[0-9]+(\.[0-9]+)?$' THEN usado::numeric ELSE NULL END;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cartoes' AND column_name = 'usado' AND data_type = 'text') THEN
    ALTER TABLE cartoes ALTER COLUMN usado TYPE numeric USING
      CASE WHEN usado ~ '^-?[0-9]+(\.[0-9]+)?$' THEN usado::numeric ELSE NULL END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cartoes_credito' AND column_name = 'user_id') THEN
    ALTER TABLE cartoes_credito DROP COLUMN user_id;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cartoes' AND column_name = 'user_id') THEN
    ALTER TABLE cartoes DROP COLUMN user_id;
  END IF;
END $$;
