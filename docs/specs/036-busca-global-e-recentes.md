# 036 — Busca global e recentes no ⌘K

Status: implementado (MVP)
Data: 2026-08-13

## Contexto

O Command Palette (⌘K) só navegava entre telas fixas e disparava criações. Não
achava um registro pelo nome: para abrir um cliente ou projeto, o usuário tinha
que ir na lista, filtrar e clicar. Falta o básico de um launcher: buscar uma
entidade pelo nome e voltar rápido ao que já foi aberto.

## Decisão

Busca global client-side e recentes/favoritos em localStorage. Zero migration,
zero tabela, zero RPC.

- **Busca**: ao digitar (>= 2 chars, debounce 250ms), dispara 6 selects em
  paralelo sobre `clientes`, `projetos`, `fornecedores`, `leads`, `propostas`,
  `pessoas`, cada um com `.is("deleted_at", null).ilike(<coluna>, %termo%).limit(5)`.
  Resultado agrupado por tipo. A coluna de `propostas` é `titulo` (não `nome`).
- **Recentes/favoritos**: localStorage namespaced por usuário
  (`pilar:recentes:<profileId>`, `pilar:favoritos:<profileId>`). Recentes é FIFO,
  cap 8, dedup por `tipo+id`, mais recente no topo. Sem `profileId`, roda só em
  memória (best-effort).
- **cmdk**: `shouldFilter={false}`. A busca de registros já vem filtrada do
  servidor; os grupos estáticos (Navegação/Criar/Ações) são filtrados à mão por
  `includes` case-insensitive sobre label+keywords.

### Por que não RPC / não server-side

- A RLS por empresa já filtra cada tabela por tenant. Não há filtro de empresa no
  client e não é preciso view/RPC nova.
- 6 selects `limit 5` com índice de PK/tenant são baratos e o volume por empresa é
  pequeno no estágio atual. Uma RPC de busca unificada seria otimização prematura.
- Erros são isolados por entidade (cada query tem `catch → []`): uma tabela sem
  permissão ou indisponível não derruba as outras.

## Arquivos

- `src/hooks/useDebouncedValue.ts` — debounce genérico.
- `src/hooks/useBuscaGlobal.ts` — 6 selects em `Promise.all`, TanStack Query
  (`["busca-global", termo]`, staleTime 30s), agrupamento por tipo.
- `src/hooks/useRecentItems.ts` — recentes/favoritos em localStorage.
- `src/components/CommandPalette.tsx` — UI: grupo Resultados no topo quando há
  termo; Favoritos + Recentes quando vazio; estrela para favoritar sem fechar.
- `src/components/ui/command.tsx` — `CommandDialog` passa a repassar `shouldFilter`
  ao `Command`.

## Lazy / bundle

Os hooks novos são importados só pelo `CommandPalette`, que é montado lazy no
`Layout` (só baixa no 1º ⌘K). Nada disso entra no bundle de entrada.

## Riscos e limites

- Leads, propostas e pessoas não têm rota de detalhe (`:id`): o resultado navega
  para a lista, não para o registro. Aceito no MVP.
- Busca só por `ilike` na coluna de nome/título. Sem busca por código, cidade,
  documento ou acento-insensível. Suficiente para "achar pelo nome".
- localStorage é por browser/dispositivo: recentes e favoritos não sincronizam
  entre máquinas.
- `fornecedor` usa rota `/obras/fornecedores/:id` (entidade de Obras, gated).
