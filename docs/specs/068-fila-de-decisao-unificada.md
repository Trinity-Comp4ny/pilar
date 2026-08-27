# SPEC: Fila de decisão unificada (FIN-6) — corrige a fonte, não reinventa a tela

**Data:** 2026-08-27
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** agentes / financeiro

<!-- Origem: FIN-6 do Mapa de Melhorias ("Inbox única de pendências... ordenada
vencidos → hoje → prazo, ação por linha"). Escopo revisado ao pesquisar o
código: a tela pedida já existe — `RevisaoInbox.tsx` em `/agentes?tab=revisao`
já tem Panorama (Esperando decisão / Vencido / Vence em 7 dias / Prazos
estourados), "Radar do agente" (achados automáticos) e "Precisa de você"
(aprovação de orçamento e outros drafts de agente) num inbox só. O gap real,
achado ao investigar por que a seção "Radar do agente" pareceria vazia pra
qualquer empresa nova: ela lê da tabela `alertas`, que ficou órfã em 17/08
(spec 067/PR #356 documenta a troca de gerador). Ninguém tinha percebido
porque a sessão que fez essa troca não sabia que RevisaoInbox dependia dela. -->

## Problema

`/agentes?tab=revisao` já é a fila de decisão unificada que o FIN-6 pede:
Panorama do dia + achados automáticos + pendências dos agentes, um lugar só.
Mas a seção "Radar do agente" (achados automáticos: pagamento atrasado,
prazo estourado, escopo estourado etc.) lê `useAlertas()` → tabela `alertas`,
e nada escreve mais nessa tabela desde 17/08 (o cron foi trocado pra
`gerar_notificacoes_ambient()` → tabela `notificacoes`, spec 029/067). Toda a
seção está silenciosamente congelada: só mostra o que já existia antes dessa
troca, nunca mais um achado novo — inclusive o alerta de escopo estourado que
acabou de ser corrigido (PR #356) não aparece aqui, só no sino.

## Objetivo

O "Radar do agente" volta a mostrar achados de verdade, lendo da tabela que
o gerador ativo realmente escreve (`notificacoes`). Como bônus honesto (não
construído, só corrigido): a lista de tipos cobertos cresce sozinha — de 8
tipos em `alertas` (congelados) pra 11 em `notificacoes` (financeiro, prazo
de projeto/disciplina, passo de obra atrasado, escopo sem aditivo).

**Fora de escopo (não é reinventar a tela, é destravar a existente):**

- **"Fatura a emitir".** Não existe conceito de fatura separada do
  lançamento hoje (depende de LOG-4, "fatura como objeto", não feito).
- **"Diário em atraso".** Não existe detecção de RDO sem registro há N dias
  no gerador de notificações hoje; adicionar isso é um novo tipo de
  notificação, trabalho à parte (poderia ser um FIN-6b se o CEO priorizar).
- **"Proposta parada".** Mesma lógica: não existe hoje um gerador olhando
  propostas sem movimento; FIN-3 (a outra task desta rodada) mexe em
  proposta pelo lado do documento exportado, não deste alerta.
- **Redesenho visual do Panorama/Radar/Precisa de você.** A tela já segue o
  design system (`PanoramaCard`, `AlertaCard`, grid responsivo); não mexer
  no que já funciona.

## Requisitos

Funcionais:

1. `RevisaoInbox.tsx` lê `useNotificacoes("inbox")` (não `useAlertas`) para
   a seção "Radar do agente": mesmos itens não lidos e não arquivados que já
   aparecem no sino da sidebar.
2. "Resolver" num item do Radar chama `useMarcarLida` (`notificacoes.lido_em`),
   não `useMarcarAlertaLido` (`alertas.lido`).
3. Abrir um item usa o campo `link` que `notificacoes` já grava (removendo a
   função `rotaAlerta()` que adivinhava a rota a partir de `referencia_tipo` —
   `notificacoes` já grava o link certo na origem, spec 029).
4. O KPI "Prazos estourados" do Panorama conta os tipos que significam prazo
   vencido no vocabulário novo: `projeto_atrasado`, `disciplina_atrasada`,
   `obra_passo_atrasado` (substituindo `prazo_estourado`/`disciplina_atrasada`
   do vocabulário antigo).
5. O badge "Revisão" no topo da página `/agentes` (contagem de pendências)
   conta `notificacoes` não lidas, não `alertas` não lidas.

Não-funcionais:

- **RLS já resolvida.** `notificacoes` é por destinatário (`auth.uid()`), não
  por empresa como `alertas` era — cada usuário só vê as suas, que é
  inclusive mais correto (a versão antiga mostrava o alerta pra qualquer
  membro da empresa, mesmo sem ser gestão).
- **Sem migration.** Troca é só client-side (hooks e tipos).

## Critérios de aceite

- [x] Dado uma notificação `orcamento_excedido` gerada (spec 067), quando abro
      `/agentes?tab=revisao`, então ela aparece em "Radar do agente".
- [x] Clicar "Abrir" num item do Radar navega para o `link` gravado na
      notificação.
- [x] Clicar "Resolver" marca `lido_em` e o item some da lista (sem reload) —
      verificado ao vivo: Radar foi de 7 pra 6 itens, badge do topo também.
- [x] O contador do badge "Revisão" bate com a contagem de não lidas do sino.
- [x] Nenhuma referência a `useAlertas`/`alertas` sobra em `RevisaoInbox.tsx`
      nem em `chat/index.tsx` (a tabela fica só pro histórico do
      `gerar_alertas_ambient()` dormente, spec 067).
- [x] `npm run typecheck` e `npm run test:run` verdes (736 testes).

## Dados e contratos

Nenhuma tabela nova, nenhuma migration. Troca de hook em dois arquivos:

- `src/pages/revisao-ia/RevisaoInbox.tsx`: `useAlertas`/`useMarcarAlertaLido`
  (`@/hooks/useAlertas`) → `useNotificacoes`/`useMarcarLida`
  (`@/hooks/useNotificacoes`). Tipo `Alerta` → `Notificacao`. Campo `lido` →
  `lido_em` (boolean → timestamp | null, checar truthiness). Campo `mensagem`
  igual. `rotaAlerta(a)` sai, usa `a.link` direto.
- `src/pages/chat/index.tsx`: `useAlertasNaoLidos` → `useNotificacoesNaoLidas`.

`src/hooks/useAlertas.ts` fica no repo sem uso (código morto, não é desta
spec remover — pode servir de referência histórica ou ser limpo depois).

## Plano de implementação

1. Trocar os imports/hooks/tipos nos dois arquivos.
2. Atualizar `categoriaAlerta()` pro vocabulário de tipos de
   `gerar_notificacoes_ambient()`.
3. `npm run typecheck` + `npm run test:run`.
4. Verificar no browser: gerar uma notificação de teste (reusa o cenário da
   spec 067), confirmar que aparece no Radar, "Abrir" e "Resolver" funcionam.

## Decisões e riscos

- **Decisão:** não construir uma tela nova pro FIN-6 — a existente já
  cumpre o pedido; o gap era um fio desconectado, não ausência de feature.
- **Risco:** RLS por destinatário pode significar que ninguém vê nada se
  `_notif_gestao`/`_notif_resp_*` não resolverem destinatário nenhum pra um
  achado (empresa sem ninguém com role owner/admin, por exemplo). Mesmo
  comportamento que já existe pro sino; não é regressão desta mudança.
- Nenhuma decisão de arquitetura transversal; não abre ADR.
