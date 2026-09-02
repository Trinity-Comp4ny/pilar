# SPEC: Guardião de escopo — alerta de despesa acima do orçado sem aditivo

**Data:** 2026-08-27
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** financeiro / projetos

<!-- Origem: FIN-5 do Mapa de Melhorias ("Guardião de escopo — horas estouradas +
mudança sem aditivo"), escolhida pelo CEO como próximo alvo após a Frente Obras,
com a restrição de não tocar em nada do Asaas. Escopo revisado ao pesquisar o
código: "horas estouradas" já existe como alerta (`horas_excedidas`), mas
depende de `timesheets`, um módulo dormente — a memória do projeto registra
"timesheet morreu 2x". Na prática esse alerta nunca dispara porque
`horas_consumidas` fica sempre zero. Não é escopo desta spec reviver Timesheet.

CORREÇÃO (mesmo dia, ao ser perguntado se faltava ligar o pg_cron em prod):
a primeira versão desta spec/implementação mirou `gerar_alertas_ambient()`,
achando (com base numa memória de 27 dias) que essa era a função viva. Não é
— foi aposentada em `20260817000100_notificacoes_ambient.sql`, dez dias antes
desta spec começar, e trocada por `gerar_notificacoes_ambient()` (Central de
notificações por usuário, spec 029). Confirmado com leitura read-only direto
em produção via MCP: `pg_cron` já instalado, job `gerar-alertas-ambient`
desagendado, `gerar-notificacoes-ambient` ativo (jobid 1). O texto abaixo já
reflete a versão corrigida; a primeira tentativa fica só no histórico do PR. -->

## Problema

O ICP disse, em pesquisa, que um alerta de escopo estourado é a dor que faria
ele **evangelizar** o Pilar — e a auditoria T2B não cobria nada parecido. Hoje,
quando um projeto gasta mais do que o escopo aprovado previa, ninguém é
avisado: o sócio só percebe quando olha a rentabilidade do projeto (se olhar).
O modelo de Aditivo já existe e funciona (`EscopoTab`, aprovação atualiza
orçamento e contrato automaticamente) — falta o gatilho que diz "hora de criar
um aditivo".

## Objetivo

Um projeto em andamento cujas despesas diretas já ultrapassam o custo estimado
do escopo aprovado (original + aditivos aprovados), e que não tem nenhum
aditivo em rascunho ou pendente de aprovação cobrindo essa diferença, notifica
a gestão da empresa e os responsáveis do projeto. A notificação usa o sino que
já existe (Central de notificações, spec 029) — zero tela nova.

**Fora de escopo:**

- **"Horas estouradas".** O alerta `horas_excedidas` (em `rpc_gerar_alertas()`,
  já dormente por decisão anterior do time — ver Decisões) depende de
  `timesheets` (dormente, "morreu 2x" — ver memória do projeto). Reviver
  timesheet é uma decisão de produto própria, não cabe aqui.
- **UI nova.** Usa a infra que já existe (tabela `notificacoes` +
  `gerar_notificacoes_ambient()` + `notificar()`, lida via `NotificationInbox.tsx`
  / sino na sidebar). Nenhum componente novo.
- **Notificação por e-mail/push.** Só in-app, como os outros 9 tipos já
  gerados hoje (o canal `email` da tabela `notificacao_preferencias` existe
  mas nenhum gerador o usa ainda).
- **Threshold configurável por empresa.** Fixo: despesas > orçado, sem % de
  tolerância. Ajustar depois se virar ruído.

## Requisitos

Funcionais:

1. Para cada projeto `Em andamento` com escopo original definido, o gerador de
   alertas compara `despesas diretas do projeto` (soma de `despesas.valor`
   com status `Pago` ou `Pendente`) contra `custo orçado` (soma de
   `escopos.custo_estimado` onde `tipo = 'original'` ou `tipo = 'aditivo' AND
status = 'aprovado'`).
2. Se despesas > orçado **e** não existe nenhum aditivo do projeto com
   `status` em (`rascunho`, `pendente_aprovacao`), notifica (via `notificar()`)
   a gestão da empresa (`_notif_gestao`, role `owner`/`admin`) + os
   responsáveis do projeto (`_notif_resp_projeto`) — mesmo padrão de
   `projeto_atrasado`/`disciplina_atrasada`. Tipo `orcamento_excedido`
   (`notificacoes.tipo` não tem CHECK, livre pra usar), categoria
   `financeiro`, severidade `high`, título + mensagem citando o nome do
   projeto e os dois valores (orçado vs gasto), link pro projeto.
3. Se já existe um aditivo em rascunho/pendente cobrindo a situação (alguém já
   começou o processo), não notifica — o guardião não repete o que o usuário
   já está resolvendo.
4. Dedupe é o do próprio `notificar()`: não empilha, por destinatário, uma
   notificação não-lida do mesmo tipo+referência.
5. Projeto sem escopo original definido nunca notifica (não há orçado pra
   comparar; `custo_orcado > 0` é obrigatório).

Não-funcionais:

- **Onde roda:** dentro de `gerar_notificacoes_ambient()`. Confirmado em
  produção via MCP (read-only): `pg_cron` instalado, job
  `gerar-notificacoes-ambient` ativo diário 06:00 UTC, `gerar-alertas-ambient`
  desagendado (o `rpc_gerar_alertas()`/`gerar_alertas_ambient()` antigos ficam
  como código morto/dormente por decisão do time em `20260817000100`, não
  desta spec mexer). Ver a nota de correção no topo do arquivo.
- **Sem N+1:** um `INSERT` por achado, mesmo padrão dos outros 9 blocos da
  função; a query de origem é set-based com `LEFT JOIN LATERAL`.

## Critérios de aceite

- [x] Dado um projeto com escopo original de R$10k e R$12k em despesas
      diretas, sem aditivo aberto, quando o gerador roda, então notifica a
      gestão citando R$10k orçado e R$12k gasto.
- [x] Dado o mesmo cenário mas com um aditivo em `rascunho` no projeto,
      quando o gerador roda, então não notifica.
- [x] Dado um projeto sem escopo original nenhum, mesmo com despesas altas,
      quando o gerador roda, então não notifica (nada pra comparar).
- [x] Dado um projeto dentro do orçado (despesas ≤ orçado), quando o gerador
      roda, então não notifica.
- [x] Rodando o gerador duas vezes seguidas pro mesmo projeto estourado,
      então só existe 1 notificação não-lida (dedupe do `notificar()`), não 2.
- [x] `supabase test db` verde (novo teste pgTAP pro cenário acima — 19
      arquivos, 187 testes, todos verdes).
- [x] Verificado direto no banco: notificação criada com destinatário,
      título, mensagem e link corretos, pro papel certo (`owner`/`admin`, não
      `ultra_admin` — confirmado que o dev user não a recebe, só o admin).

## Dados e contratos

Nenhuma tabela nova. Uma seção a mais dentro de `gerar_notificacoes_ambient()`
(migration nova, `CREATE OR REPLACE` — mesma assinatura, sem `DROP`), lendo
`escopos` e `despesas`, chamando `notificar()` já existente.

## Plano de implementação

1. ~~Migration no bloco de `gerar_alertas_ambient()`~~ — **corrigido**: essa
   função está aposentada desde 17/08. Migration final no bloco correto,
   `gerar_notificacoes_ambient()`.
2. Teste pgTAP em
   `supabase/tests/gerar_notificacoes_ambient_orcamento_excedido.sql`
   cobrindo os 4 cenários + dedupe (o teste da tentativa anterior,
   `gerar_alertas_ambient_escopo_estourado.sql`, continua no repo — testa
   código real só que dormente, sem necessidade de remover).
3. Verificado em dev local: escopo original R$5k + despesa R$9k num projeto
   real (Residencial Vale Verde), `select gerar_notificacoes_ambient()`,
   conferida a linha em `notificacoes` (destinatário = admin da empresa,
   título/mensagem/link corretos) e, no browser como `dev@local.test`
   (`ultra_admin`, fora do papel-alvo), confirmado que ele **não** recebe —
   exatamente o comportamento esperado da regra de destinatário.

## Decisões e riscos

- **Decisão:** não tentar consertar `rpc_gerar_alertas()`/`gerar_alertas_ambient()`/
  `horas_excedidas` nesta spec — já dormentes por decisão anterior do time
  (17/08), não desta mudança. Registrado como achado técnico.
- **Risco:** empresa com muitos projetos sem escopo cadastrado não vê
  nenhuma notificação (silêncio, não falso positivo) — aceitável, é o
  comportamento seguro; a alternativa (notificar sem orçado de referência)
  seria pior.
- Nenhuma decisão de arquitetura transversal; não abre ADR.
