# 🔧 Correção de Erro: "invalid input value for enum status_projeto"

## Problema

Você está recebendo o erro:
```
invalid input value for enum status_projeto: "Em andamento"
```

Isso acontece porque pode haver valores no banco de dados que não correspondem exatamente ao enum definido (case-sensitive).

## Solução Rápida

Execute este SQL no **Supabase SQL Editor**:

```sql
-- 1. Verifica e corrige valores de status
UPDATE public.projetos
SET status = 'Em andamento'
WHERE status::text SIMILAR TO '%(em|Em)%(andamento|Andamento)%'
  AND status::text != 'Em andamento';

-- 2. Verifica se há valores inválidos
SELECT id, codigo_projeto, status::text as status_atual
FROM public.projetos
WHERE status::text NOT IN ('Planejamento', 'Em andamento', 'Paralisado', 'Concluído', 'Cancelado');

-- 3. Se encontrar valores inválidos, corrija manualmente:
-- UPDATE public.projetos SET status = 'Em andamento' WHERE id = 'UUID_DO_PROJETO';
```

## Valores Corretos do Enum

O enum `status_projeto` aceita **EXATAMENTE** estes valores (case-sensitive):

- ✅ `'Planejamento'`
- ✅ `'Em andamento'` (com 'E' maiúsculo e 'a' minúsculo)
- ✅ `'Paralisado'`
- ✅ `'Concluído'`
- ✅ `'Cancelado'`

❌ **NÃO** aceita:
- `'em andamento'` (e minúsculo)
- `'EM ANDAMENTO'` (tudo maiúsculo)
- `'Em Andamento'` (A maiúsculo)

## Após Executar

1. Recarregue a página
2. Tente arrastar um card novamente
3. Verifique o console do navegador para ver o log: `"Tentando atualizar status para: ..."`
4. Se ainda houver erro, copie o valor exato que aparece no erro e me envie

---

# 📱 Melhoria de Responsividade

O layout das colunas foi otimizado para diferentes tamanhos de tela:

- **Mobile** (< 640px): 1 coluna
- **Tablet** (640px - 1024px): 2 colunas
- **Desktop** (1024px - 1536px): 3 colunas
- **Telas grandes** (> 1536px): 5 colunas

Isso garante melhor aproveitamento do espaço em todas as resoluções.
