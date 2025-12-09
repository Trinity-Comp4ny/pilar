# ⚡ SOLUÇÃO RÁPIDA - Erro de Enum Status

## O Problema

O erro `invalid input value for enum status_projeto: "Em andamento"` significa que o enum **NÃO** aceita o valor `'Em andamento'` (com espaço).

Provavelmente o enum foi criado com um dos seguintes valores:
- `'Emandamento'` (sem espaço)
- `'em andamento'` (minúsculo)
- Ou o valor simplesmente não existe

## 🎯 Solução em 3 Passos

### Passo 1: Adicionar o Valor ao Enum

Execute no **Supabase SQL Editor**:

```sql
ALTER TYPE status_projeto ADD VALUE IF NOT EXISTS 'Em andamento';
```

Se der erro, tente:

```sql
ALTER TYPE status_projeto ADD VALUE 'Em andamento';
```

---

### Passo 2: Verificar os Valores Atuais

```sql
-- Ver todos os valores aceitos pelo enum
SELECT enumlabel 
FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'status_projeto'
ORDER BY enumsortorder;
```

**Me envie o resultado!** Vai aparecer algo como:
```
Planejamento
Emandamento     <-- Sem espaço? 
Paralisado
Concluído
Cancelado
```

---

### Passo 3A: Se o Enum TEM "Emandamento" (sem espaço)

Atualize o código TypeScript para usar o valor sem espaço:

**Arquivo**: `/src/pages/Projetos.tsx`

Mude a linha 37 de:
```typescript
status: "Planejamento" | "Em andamento" | "Paralisado" | "Concluído" | "Cancelado";
```

Para:
```typescript
status: "Planejamento" | "Emandamento" | "Paralisado" | "Concluído" | "Cancelado";
```

E a linha 45 de:
```typescript
"Em andamento": { label: "Em andamento", color: "bg-blue-100 text-blue-800", columnColor: "bg-blue-50" },
```

Para:
```typescript
"Emandamento": { label: "Em andamento", color: "bg-blue-100 text-blue-800", columnColor: "bg-blue-50" },
```

Depois, atualize os projetos existentes:
```sql
UPDATE public.projetos 
SET status = 'Emandamento'
WHERE status::text SIMILAR TO '%(em|Em)%(andamento|Andamento)%';
```

---

### Passo 3B: Se o Enum NÃO TEM nenhum valor de "andamento"

Execute:
```sql
ALTER TYPE status_projeto ADD VALUE 'Em andamento';
```

E depois atualize os projetos:
```sql
-- Primeiro, veja quais projetos precisam ser atualizados
SELECT id, codigo_projeto, status::text 
FROM public.projetos;

-- Se houver projetos com status inválido, atualize-os
-- (substitua 'STATUS_INVALIDO' pelo valor que aparecer)
UPDATE public.projetos 
SET status = 'Planejamento'
WHERE status::text = 'STATUS_INVALIDO';
```

---

## 📋 Checklist

- [ ] Executei o Passo 1 (adicionar valor ao enum)
- [ ] Executei o Passo 2 (verificar valores)
- [ ] Enviei o resultado para você me ajudar
- [ ] Executei a correção recomendada
- [ ] Recarreguei a página
- [ ] Testei o drag and drop

---

## 🆘 Se Nada Funcionar

Execute este SQL e me envie TODO o resultado:

```sql
-- 1. Valores do enum
SELECT 'ENUM VALUES:' as info, enumlabel as valor
FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'status_projeto'
ORDER BY enumsortorder;

-- 2. Valores nos projetos
SELECT 'PROJECT VALUES:' as info, DISTINCT status::text as valor, COUNT(*) as qtd
FROM public.projetos
GROUP BY status::text;
```

**Me envie o resultado completo e vou te dar a solução exata!** 🚀
