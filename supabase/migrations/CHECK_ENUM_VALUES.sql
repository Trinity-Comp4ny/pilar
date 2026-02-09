-- Verifica quais são os valores EXATOS aceitos pelo enum status_projeto
SELECT 
    enumlabel as valor_enum,
    enumsortorder as ordem
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'status_projeto'
ORDER BY enumsortorder;
