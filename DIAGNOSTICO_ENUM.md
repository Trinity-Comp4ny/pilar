# 🔍 DIAGNÓSTICO: Descobrir Valores Corretos do Enum

## Passo 1: Descobrir os Valores Aceitos

Execute este SQL no **Supabase SQL Editor**:

```sql
SELECT 
    enumlabel as valor_enum,
    enumsortorder as ordem
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'status_projeto'
ORDER BY enumsortorder;
```

Isso vai mostrar **EXATAMENTE** quais valores o enum aceita.

---

## Passo 2: Verificar Valores Atuais nos Projetos

Execute este SQL:

```sql
SELECT DISTINCT status::text as status_atual, COUNT(*) as quantidade
FROM public.projetos
GROUP BY status::text
ORDER BY status_atual;
```

Isso mostra quais valores estão sendo usados atualmente.

---

## Possíveis Cenários

### Cenário A: O enum tem espaço diferente
Se o resultado mostrar algo como `'Emandamento'` (sem espaço), então:

**Solução**: Atualizar o TypeScript para usar o valor sem espaço:

```typescript
// Em Projetos.tsx, linha 37 e 45
status: "Planejamento" | "Emandamento" | "Paralisado" | "Concluído" | "Cancelado";

const statusConfig = {
  "Planejamento": { ... },
  "Emandamento": { label: "Em andamento", ... }, // Label pode ter espaço
  ...
}
```

### Cenário B: O enum precisa ser recriado
Se o enum está com valores errados, precisamos recriá-lo:

```sql
-- 1. Primeiro, veja quais projetos têm status problemático
SELECT id, codigo_projeto, status::text 
FROM public.projetos 
WHERE status::text LIKE '%andamento%';

-- 2. Altere temporariamente para um valor válido
UPDATE public.projetos 
SET status = 'Planejamento'
WHERE status::text LIKE '%andamento%';

-- 3. Remova o valor antigo do enum (se existir)
ALTER TYPE status_projeto RENAME TO status_projeto_old;

-- 4. Crie o enum correto
CREATE TYPE status_projeto AS ENUM (
  'Planejamento', 
  'Em andamento',  -- COM espaço
  'Paralisado', 
  'Concluído', 
  'Cancelado'
);

-- 5. Altere a coluna para usar o novo tipo
ALTER TABLE public.projetos 
  ALTER COLUMN status TYPE status_projeto 
  USING status::text::status_projeto;

-- 6. Remova o tipo antigo
DROP TYPE status_projeto_old;

-- 7. Volte os projetos para "Em andamento"
UPDATE public.projetos 
SET status = 'Em andamento'
WHERE status = 'Planejamento' 
  AND codigo_projeto IN (
    -- Liste aqui os códigos dos projetos que devem voltar para "Em andamento"
  );
```

---

## Passo 3: Me Envie o Resultado

**Execute o Passo 1** e me envie o resultado. Vou te dizer exatamente o que fazer!

Exemplo do que você deve me enviar:
```
valor_enum       | ordem
-----------------|------
Planejamento     | 1
Emandamento      | 2  <-- SEM espaço!
Paralisado       | 3
Concluído        | 4
Cancelado        | 5
```

Ou:
```
valor_enum       | ordem
-----------------|------
Planejamento     | 1
Em andamento     | 2  <-- COM espaço!
Paralisado       | 3
Concluído        | 4
Cancelado        | 5
```

**Aguardo o resultado para te dar a solução exata!** 🔍
