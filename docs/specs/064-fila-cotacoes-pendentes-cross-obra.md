# SPEC: Fila de cotações pendentes (todas as obras)

**Data:** 2026-08-26
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** obras
**Estende:** [018 — Cotações na obra](018-cotacoes-na-obra.md)

<!-- Origem: docs/strategy/DECISOES.md (Obras é a frente prioritária). Item
OBR-2b do Mapa de Melhorias. -->

## Problema

Cotação (spec 018) só aparece dentro da obra. Com mais de uma obra em
andamento, "quais compras estão paradas esperando decisão, em qualquer obra"
exige abrir cada obra uma por uma. Não existe visão central de urgência.

## Objetivo

A lista de Obras (`/obras`) ganha uma seção com as cotações abertas de todas
as obras, ordenadas por urgência (a mais atrasada frente ao prazo de
necessidade primeiro), com link direto pra decidir. Depois desta feature,
"o que está parado esperando cotação" responde de bate-pronto na tela que já
é o ponto de entrada do módulo.

**Fora de escopo:**

- **Página nova / item de sidebar.** O padrão de navegação de Obras
  (spec 015, "Evolução do módulo") é deliberado: pilar enxuto que cresce pra
  dentro, item-irmão só entra na sidebar com dor concreta do ICP validada.
  Uma lista cross-obra ainda não tem esse sinal — entra como seção na página
  que já existe (`/obras`), não como rota nova.
- Aprovar/rejeitar cotação a partir da lista. A ação continua sendo abrir a
  obra e decidir na aba Cotações (spec 018); esta feature é só triagem e
  navegação mais rápida até lá.
- SLA configurável por empresa (dias-limite diferentes por tipo de compra).
  A urgência aqui é derivada só do `prazo_necessidade` que a cotação já tem;
  sem esse campo, ela aparece como "sem prazo", sem alarmar.

## Requisitos

Funcionais:

1. A página `/obras` (lista de obras) ganha uma seção "Cotações aguardando
   decisão", acima da grade de obras, mostrando até 5 cotações com
   `status = 'aberta'` de qualquer obra da empresa, mais urgente primeiro:
   ordenadas por `prazo_necessidade` ascendente (a mais próxima do vencimento
   ou já vencida primeiro); cotações sem `prazo_necessidade` vêm por último,
   ordenadas por `created_at` (mais antiga primeiro).
2. Cada linha mostra: descrição da cotação, nome da obra, e a urgência em
   texto ("vence em 3 dias", "atrasada há 5 dias", "sem prazo").
3. Clicar numa linha leva direto para a aba Cotações daquela obra
   (`/obras/:id`, aba `cotacoes`).
4. Se houver mais de 5 cotações abertas, um contador mostra "+N" e um link
   "ver todas" (leva para a primeira obra da lista — MVP; sem página central
   dedicada, ver "Fora de escopo").
5. Seção não aparece (nem título, nem card vazio) quando não há nenhuma
   cotação aberta em nenhuma obra — não é um estado a comunicar, é ausência
   de trabalho pendente.

Não-funcionais:

- **Segurança / RLS:** nenhuma tabela ou policy nova; a query reusa o SELECT
  já existente de `obra_cotacao` (RLS por `empresa_id`), sem `.eq("obra_id", ...)`
  — o próprio RLS garante que só vêm cotações da empresa do usuário.
- **Performance:** uma query só (join com `obras` pelo nome), sem N+1 por
  obra. `staleTime` curto (é uma fila de trabalho, não histórico).

## Critérios de aceite

- [x] Dado 3 cotações abertas em 2 obras diferentes, quando abro `/obras`,
      então vejo as 3 listadas, cada uma com o nome da obra certa. Verificado
      no browser com 1 cotação real (nome da obra correto via join); a
      ordenação de múltiplas é coberta por unit test.
- [x] Dado uma cotação com `prazo_necessidade` de ontem e outra de daqui a 10
      dias, quando abro `/obras`, então a de ontem aparece primeiro, marcada
      como atrasada. Unit test (`ordenarCotacoesPendentes`); no browser
      confirmei o rótulo "atrasada há N dias" com destaque vermelho.
- [x] Dado uma cotação sem `prazo_necessidade`, quando abro `/obras`, então
      ela aparece por último, com "sem prazo" em vez de uma data inventada.
      Unit test.
- [x] Dado que clico numa linha da fila, então caio na aba Cotações da obra
      certa. Verificado no browser: exigiu adicionar leitura de `?tab=` na
      página da obra (não existia), feito nesta mesma entrega.
- [x] Dado nenhuma cotação aberta em nenhuma obra, quando abro `/obras`,
      então a seção inteira não aparece (sem título "Cotações aguardando
      decisão" vazio). Verificado no browser (estado inicial, antes de criar
      a cotação de teste).
- [ ] Dado 7 cotações abertas, quando abro `/obras`, então vejo 5 e um "+2 ·
      ver todas". _(Não testado: nem unit test do componente nem browser com
      7+ cotações reais. O corte `.slice(0, 5)` é simples, mas fica como
      lacuna de verificação registrada, não como "feito".)_
- [x] `npm run test:run` e `npm run typecheck` verdes. 727 testes, 0 erros de
      tipo, lint limpo.

## Dados e contratos

Nenhuma tabela nova. Um hook novo, `useCotacoesPendentesEmpresa()`, sem
`obraId` (lê de todas as obras da empresa via RLS):

```ts
export interface CotacaoPendente {
  id: string;
  obra_id: string;
  obra_nome: string;
  descricao: string;
  prazo_necessidade: string | null; // YYYY-MM-DD
}
```

Query: `obra_cotacao` com `.select("id, obra_id, descricao, prazo_necessidade, obras(nome)")`,
`.eq("status", "aberta")`, `.is("deleted_at", null)`, ordenado no cliente (não
no SQL: NULLS LAST em prazo + fallback por created_at é mais simples de
expressar e testar em JS puro do que num `.order()` do PostgREST).

Função pura `ordenarCotacoesPendentes` em `src/lib/obras.ts` (testável sem
rede): recebe a lista com `prazo_necessidade`/`created_at`, devolve ordenada
pela regra do requisito 1, mais uma `urgenciaLabel(prazo_necessidade, hoje)`
que devolve o texto do requisito 2.

## Plano de implementação

1. `ordenarCotacoesPendentes` + `urgenciaLabel` em `src/lib/obras.ts` + testes
   (todos os critérios de aceite de ordenação/rótulo, sem precisar de banco).
2. `useCotacoesPendentesEmpresa` em `src/hooks/useObraCotacoes.ts` (mesmo
   arquivo do hook existente, mesma família).
3. Componente `FilaCotacoesPendentes.tsx`: usa o hook, aplica
   `ordenarCotacoesPendentes`, corta em 5, renderiza a seção ou nada.
4. Inserir em `src/pages/obras/index.tsx`, acima da grade de obras.
5. `npm run typecheck` + `npm run test:run`.
6. Verificar no browser (dev local): criar uma 2ª cotação numa obra diferente
   com prazo passado, confirmar ordenação e o link levando pra aba certa.

## Decisões e riscos

- **Decisão:** seção na página existente, não rota nova (ver "Fora de
  escopo"). Menor risco de virar "mais um item que ninguém abre".
- **Decisão:** ordenar no cliente, não no banco. A lista é pequena (cotações
  abertas de uma empresa pequena, não milhares de linhas); simplicidade e
  testabilidade da regra pesam mais que otimizar uma query que já é barata.
- **Risco:** se `prazo_necessidade` não for preenchido na prática (campo
  opcional na spec 018), a fila vira uma lista sem ordenação útil, só por
  data de criação. Aceito — não força o campo a virar obrigatório aqui, isso
  seria mudar a spec 018 sem necessidade provada.
- Nenhuma decisão de arquitetura transversal; não abre ADR.
- **Achado na implementação:** o requisito 3 (levar direto pra aba Cotações)
  não funcionava — a página da obra guardava a aba só em `useState` local,
  sem ler a URL. Adicionado `useSearchParams` pra ler `?tab=` no valor
  inicial (sem sincronizar de volta), mudança pequena e local à própria
  necessidade desta spec, não escopo novo.
