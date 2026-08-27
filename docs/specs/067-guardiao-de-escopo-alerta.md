# SPEC: Guardião de escopo — alerta de despesa acima do orçado sem aditivo

**Data:** 2026-08-27
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** financeiro / projetos

<!-- Origem: FIN-5 do Mapa de Melhorias ("Guardião de escopo — horas estouradas +
mudança sem aditivo"), escolhida pelo CEO como próximo alvo após a Frente Obras,
com a restrição de não tocar em nada do Asaas. Escopo revisado ao pesquisar o
código: "horas estouradas" já existe como alerta (`horas_excedidas` em
`rpc_gerar_alertas`), mas depende de `timesheets`, um módulo dormente — a
memória do projeto registra "timesheet morreu 2x". Na prática esse alerta
nunca dispara porque `horas_consumidas` fica sempre zero. Não é escopo desta
spec reviver Timesheet. -->

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
aditivo em rascunho ou pendente de aprovação cobrindo essa diferença, gera um
alerta. O alerta aparece no Radar dos agentes (Início), o mesmo lugar onde já
aparecem os outros achados automáticos — zero tela nova.

**Fora de escopo:**

- **"Horas estouradas".** O alerta `horas_excedidas` já existe no código, mas
  depende de `timesheets` (dormente, "morreu 2x" — ver memória do projeto).
  Reviver timesheet é uma decisão de produto própria, não cabe aqui. Este
  alerta existente fica como está, silencioso; não é desta spec consertá-lo.
- **UI nova.** O alerta usa a infra que já existe (tabela `alertas` +
  `rpc_gerar_alertas`, lida pelo dashboard via `buildAlertas`/Radar dos
  agentes). Nenhum componente novo.
- **Notificação por e-mail/push.** Só o Radar, como os outros 4 tipos de
  alerta já gerados hoje.
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
   `status` em (`rascunho`, `pendente_aprovacao`), gera um alerta tipo
   `orcamento_excedido` (valor já reservado no CHECK da tabela `alertas`,
   nunca usado até agora — reaproveitado em vez de criar tipo novo),
   severidade `high`, citando o nome do projeto e os dois valores (orçado vs
   gasto).
3. Se já existe um aditivo em rascunho/pendente cobrindo a situação (alguém já
   começou o processo), não gera alerta novo — o guardião não repete o que o
   usuário já está resolvendo.
4. Mesma regra de dedupe dos outros alertas de `gerar_alertas_ambient()`: não
   repete enquanto o alerta anterior do mesmo tipo+projeto não for marcado
   `lido = true` (não é janela de tempo, é "enquanto ninguém tratar").
5. Projeto sem escopo original definido nunca gera este alerta (não há
   orçado pra comparar; `custo_orcado > 0` é obrigatório).

Não-funcionais:

- **Onde roda:** dentro de `gerar_alertas_ambient()` — **não** em
  `rpc_gerar_alertas()`. Achado ao investigar onde o alerta apareceria de
  fato: `rpc_gerar_alertas()` (gerador mais antigo, por linha) está morto —
  nenhum lugar do código chama, o overload `(uuid)` foi dropado em
  `20260835000000`, e o loop de `horas_excedidas` quebra em runtime
  (`relation "timesheets" does not exist`, tabela dropada em
  `20260429000001`) — confirmado lendo `pg_get_functiondef` no banco local,
  não só grep. `gerar_alertas_ambient()` é quem de fato roda via pg_cron
  (staging desde 30/07, prod pendente — ver memória
  `project_pg_cron_alertas_ambient`) e alimenta a lista real: o "Radar do
  agente" em `/agentes?tab=revisao` (`RevisaoInbox.tsx`, via `useAlertas()`).
  A faixa "Radar dos agentes" da Início (`/inicio`) é outra coisa: achados
  100% client-side (`buildAchados` em `src/pages/inicio/index.tsx`), não lê
  a tabela `alertas` — não confundir os dois "radares".
- **Sem N+1:** um `INSERT ... SELECT` set-based com `LEFT JOIN LATERAL`,
  mesmo padrão dos outros 8 blocos da função; nada por linha.

## Critérios de aceite

- [x] Dado um projeto com escopo original de R$10k e R$12k em despesas
      diretas, sem aditivo aberto, quando o gerador roda, então cria um
      alerta `orcamento_excedido` citando R$10k orçado e R$12k gasto.
- [x] Dado o mesmo cenário mas com um aditivo em `rascunho` no projeto,
      quando o gerador roda, então não cria alerta.
- [x] Dado um projeto sem escopo original nenhum, mesmo com despesas altas,
      quando o gerador roda, então não cria alerta (nada pra comparar).
- [x] Dado um projeto dentro do orçado (despesas ≤ orçado), quando o gerador
      roda, então não cria alerta.
- [x] Rodando o gerador duas vezes seguidas pro mesmo projeto estourado,
      então só existe 1 alerta (dedupe por `lido = false`), não 2.
- [x] `supabase test db` verde (novo teste pgTAP pro cenário acima — 18
      arquivos, 181 testes, todos verdes).
- [x] Verificado ao vivo no browser: alerta apareceu em `/agentes?tab=revisao`
      com o texto certo, "Abrir" navegou pro projeto correto.

## Dados e contratos

Nenhuma tabela nova. Uma seção a mais dentro de `gerar_alertas_ambient()`
(migration nova, `CREATE OR REPLACE` — mesma assinatura, sem `DROP`), lendo
`escopos` e `despesas`, escrevendo em `alertas` com `tipo = 'orcamento_excedido'`
(já no CHECK constraint, sem migration de schema).

## Plano de implementação

1. ~~Migration com o novo bloco de alerta em `rpc_gerar_alertas()`~~ — pivô:
   migration no bloco correto, `gerar_alertas_ambient()`, depois de descobrir
   que o primeiro alvo estava morto.
2. Teste pgTAP em `supabase/tests/gerar_alertas_ambient_escopo_estourado.sql`
   cobrindo os 4 cenários + dedupe.
3. Verificado manualmente em dev local: escopo original R$5k + despesa R$8k
   num projeto real (Residencial Vale Verde), `select gerar_alertas_ambient()`,
   conferida a linha em `alertas` e o card aparecendo em
   `/agentes?tab=revisao` com "Abrir" levando ao projeto certo.

## Decisões e riscos

- **Decisão:** não tentar consertar `rpc_gerar_alertas()`/`horas_excedidas`
  (timesheet morto) nesta spec — função já confirmada morta (zero callers),
  consertá-la ou removê-la é decisão própria de limpeza técnica, fora do que
  foi pedido (FIN-5 sem Asaas, sem reabrir Timesheet). Registrado como achado
  técnico, não resolvido aqui.
- **Achado (não é desta spec consertar):** o pg_cron de `gerar_alertas_ambient()`
  está ativo em staging desde 30/07 mas **pendente em produção** (memória
  `project_pg_cron_alertas_ambient`) — os outros 8 tipos de alerta desta
  função, incluindo este novo, não geram nada em prod até alguém rodar o
  setup manual de lá.
- **Risco:** empresa com muitos projetos sem escopo cadastrado não vê
  nenhum alerta (silêncio, não falso positivo) — aceitável, é o comportamento
  seguro; a alternativa (alertar sem orçado de referência) seria pior.
- Nenhuma decisão de arquitetura transversal; não abre ADR.
