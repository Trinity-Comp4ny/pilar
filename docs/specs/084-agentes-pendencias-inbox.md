# SPEC: Pendências — inbox único do trabalho dos agentes em /agentes

**Data:** 2026-09-01
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** agentes / projetos

<!-- Origem: continuação direta das specs 081 (guardião de margem) e 083 (orçamento por
disciplina). Ao consultar produção via MCP, achei que /agentes tem uso quase zero (6 sessões, 24
mensagens, 11 `agent_runs` desde sempre, 10 delas só consulta e 1 aditivo rejeitado) e que o
guardião de margem que acabei de entregar é INVISÍVEL pra quem só abre /agentes: ele materializa
o rascunho direto em `escopos`, dentro da aba Escopo de um projeto específico (decisão da spec
081: artefato no domínio é o próprio estado de revisão, sem inbox própria). Se a meta é "agentes
proativos pegando bastante coisa", ter o trabalho deles espalhado por telas de projeto individual,
sem nenhum lugar central que prove que algo está acontecendo, é o oposto do que se quer mostrar.

Decisão tomada em conversa: /agentes vira o inbox único (chat + pendências cross-projeto), não só
melhora de onboarding do chat isolado. Mantém a arquitetura da spec 081 (artefato no domínio =
estado de revisão) — o inbox é uma CONSULTA que sabe dos tipos de pendência que existem hoje, não
uma reforma pra forçar tudo por `agent_runs.status='pending_review'`. -->

## Problema

Quem abre `/agentes` não vê nenhum sinal de que os agentes proativos (ex. guardião de margem)
estão fazendo alguma coisa — o único jeito de descobrir um aditivo sugerido é abrir o projeto
certo e entrar na aba Escopo. Não existe hoje nenhum lugar central que responda "o que os agentes
prepararam e está esperando minha decisão".

## Objetivo

`/agentes` ganha uma segunda visão, "Pendências", ao lado da conversa: lista todo item de agente
aguardando decisão humana no momento, de qualquer projeto, com aprovar/rejeitar sem sair da tela.
Um contador visível no menu lateral mostra quantas pendências existem sem precisar abrir nada.

**Fora de escopo:**

- **Unificar com notificações reativas (sino).** Este inbox é só trabalho de agente aguardando
  decisão (rascunho pra aprovar/rejeitar), não alerta informativo (prazo, pagamento). São
  categorias diferentes de coisa; misturar dilui as duas.
- **Substituir a aba Escopo.** Ela continua existindo por projeto; Pendências é um atalho
  cross-projeto pro mesmo dado, lendo a mesma fonte — não duplica estado, não é uma segunda
  verdade.
- **Onboarding/descoberta do chat em si** (prompts sugeridos, exemplos do que os cards fazem).
  Trilha separada, mencionada mas não atacada aqui.
- **Cobertura de Obras no chat** (hoje só financeiro/projetos/comercial). Fora de escopo.
- **Generalizar a query pra um registry de tipos de pendência.** Hoje só existe um tipo real
  (aditivo). Generalizar antes de existir um segundo tipo é abstração prematura — YAGNI.

## Requisitos

Funcionais:

1. `/agentes` ganha abas simples "Conversar" / "Pendências" (estado local, sem rota nova).
2. A aba Pendências lista, cross-projeto, todo `escopos` com `tipo='aditivo'` e `status IN
   ('rascunho', 'pendente_aprovacao')`, ordenado por `created_at desc`, com nome do projeto,
   descrição, valor, origem (agente quando `created_by IS NULL`, senão nome de quem criou).
3. Aprovar/rejeitar direto na lista, reaproveitando exatamente a mutação já usada na aba Escopo
   (`useAprovarEscopo`/`useRejeitarEscopo`, refatoradas pra aceitar `projetoId` por chamada em
   vez de por instância do hook, já que a lista cruza vários projetos).
4. Aprovar/rejeitar aqui invalida a mesma query key que a aba Escopo usa — abrir o projeto depois
   já reflete o novo estado, sem F5.
5. Contador de pendências como badge no item "Agentes" do menu lateral (`AppSidebar`), some
   quando chega a zero.
6. Zero pendências mostra um empty state claro, nunca tela em branco ou erro.

Não-funcionais:

- **Segurança / RLS:** reusa a policy já validada de `escopos` (`projetos:viewer` pra ler,
  `projetos:editor` pra aprovar/rejeitar). Nenhuma policy nova.
- **Performance:** volume esperado é baixo (mesmo dado que hoje é ~zero em produção); sem
  paginação nesta v1 — revisitar se volume crescer.

## Critérios de aceite

- [ ] Dado um aditivo pendente em qualquer projeto, quando o usuário abre `/agentes` > Pendências,
      então o item aparece com nome do projeto, descrição e ação.
- [ ] Dado que o usuário aprova pela aba Pendências, quando ele depois abre a aba Escopo daquele
      projeto, então o aditivo já aparece como aprovado, sem recarregar a página.
- [ ] Dado zero pendências, quando o usuário abre a aba Pendências, então vê um empty state
      claro.
- [ ] O badge de contagem no menu lateral reflete o número real de pendências e desaparece em
      zero.
- [ ] Caso de borda: usuário sem `projetos:editor` vê a lista mas sem os botões de ação (mesmo
      padrão de `canEdit` já usado na aba Escopo).

## Dados e contratos

- Sem migration — mesma tabela/policy da spec 081/083.
- Novo hook `usePendenciasAgentes()` em `src/hooks/useEscopos.ts` (join `escopos` + `projetos`
  via select aninhado, mesma RLS).
- `useAprovarEscopo`/`useRejeitarEscopo` mudam de assinatura: de `useAprovarEscopo(projetoId)`
  (hook-level) para `useAprovarEscopo()` com `{ escopoId, projetoId }` por chamada — atualiza os
  2 call sites existentes em `EscopoTab.tsx`.
- Novo componente compartilhado `src/components/AditivoReviewCard.tsx`, extraído do
  `AditivoCard` local hoje dentro de `EscopoTab.tsx`, usado nos dois lugares (Escopo do projeto e
  Pendências cross-projeto).

## Plano de implementação

1. Extrair `AditivoReviewCard` de `EscopoTab.tsx` pra componente compartilhado.
2. Refatorar `useAprovarEscopo`/`useRejeitarEscopo` pra `projetoId` por chamada; atualizar
   `EscopoTab.tsx`.
3. Novo hook `usePendenciasAgentes()`.
4. Aba "Pendências" em `src/pages/chat/index.tsx` (ou `PendenciasTab.tsx` próprio).
5. Badge de contagem no `AppSidebar`.
6. Testes (vitest do hook + contagem; lint/typecheck).
7. Verificação manual local: aditivo pendente aparece nas duas telas, aprovar em uma reflete na
   outra sem reload.

## Decisões e riscos

- **Não força tudo por `agent_runs.status='pending_review'`.** Mantém a arquitetura da spec 081
  (artefato no domínio = estado de revisão), já provada em produção local. O inbox é uma consulta
  que sabe dos tipos existentes, não uma abstração genérica prematura.
- **Sem generalização de tipos de pendência nesta v1.** Revisitar quando existir um segundo tipo
  real de trabalho proativo (ex. relatório de pausa, concierge do cliente).
