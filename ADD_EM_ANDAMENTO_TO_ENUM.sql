-- SOLUÇÃO RÁPIDA: Adiciona "Em andamento" ao enum se não existir

DO $$
BEGIN
    -- Tenta adicionar o valor "Em andamento" ao enum
    BEGIN
        ALTER TYPE status_projeto ADD VALUE IF NOT EXISTS 'Em andamento';
        RAISE NOTICE 'Valor "Em andamento" adicionado ao enum com sucesso!';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'Valor "Em andamento" já existe no enum.';
    END;
END $$;

-- Agora verifica todos os valores aceitos
SELECT 
    enumlabel as valor_enum,
    enumsortorder as ordem
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'status_projeto'
ORDER BY enumsortorder;
