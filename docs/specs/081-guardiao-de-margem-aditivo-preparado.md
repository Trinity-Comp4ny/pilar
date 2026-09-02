# SPEC: Guardião de margem, agente prepara o aditivo, aba Escopo aprova

**Data:** 2026-09-01
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** projetos / agentes

<!-- Origem: continuação da spec 067 (guardião de escopo). Escopo revisado ao investigar o
código antes de codar: a query do guardião (`orcamento_excedido`, em
20260865000000_notificacao_orcamento_excedido.sql) compara despesas contra
`SUM(escopos.custo_estimado) WHERE tipo='original'`, mas nada no sistema, em nenhum ponto,
grava um `escopos` com `tipo='original'`. O alerta está no pg_cron desde 27/08 e listado como
entregue em DECISOES.md, mas estruturalmente não pode disparar para nenhuma empresa real: a
condição `COALESCE(esc.custo_orcado, 0) > 0` filtra tudo. A própria spec 067 também assumia a
existência de um componente `EscopoTab` ("aprovação atualiza orçamento e contrato
automaticamente") que não existe em `src/pages/projetos/` nem em lugar nenhum do front.

O orçamento vivo de verdade é `projeto_orcamento_fases`, populado pelo agente de Orçamento de
Honorários (aprovado via `aprovar_orcamento_agente`, spec de junho/2026) e é a fonte que
`v_budget_vs_actual` já usa corretamente. O trigger `handle_escopo_aprovado()` (000_base_schema)
já faz a parte pesada quando um `escopos.tipo='aditivo'` vira `status='aprovado'`: soma os itens
em `projeto_orcamento_fases` e incrementa `projetos.valor_contrato`. Está pronto e não é tocado
por esta spec, só finalmente vai ser usado.

Aditivo hoje só nasce por um caminho manual: o usuário pede no chat (`/agentes`), o
`AditivoCard.tsx` monta um formulário, cria um rascunho em `escopos`. Depois de criado, não
existe UI nenhuma para aprovar ou rejeitar esse rascunho em lugar nenhum do produto (a RPC
`criar_aditivo_agente` até documenta isso: "a aprovação fica FORA do agente, humano aprova na
tela", mas a tela nunca foi construída).

Decisão tomada em conversa: o gatilho do agente é um cron dedicado (mesmo padrão de
`trial-expiry-cron`), não a fila `jobs`/outbox (que existe sem consumidor desde 15/07). Fila fica
para quando um segundo agente proativo justificar a infraestrutura compartilhada. -->

## Problema

Quando um projeto em andamento gasta mais do que o orçamento vivo previa, ninguém prepara o
aditivo automaticamente, e mesmo que alguém crie um rascunho manualmente (pelo chat), não existe
tela para aprová-lo. O sócio recebe uma notificação (quando ela dispara, o que hoje nunca
acontece por um bug de fonte de dados) mas o vazamento de margem não vira ação nenhuma dentro do
Pilar.

## Objetivo

Quando despesas diretas de um projeto ultrapassam o orçamento vivo (`projeto_orcamento_fases`)
sem nenhum aditivo em rascunho ou pendente cobrindo a diferença, um agente prepara
automaticamente um rascunho de aditivo com itens e justificativa. O usuário revisa e
aprova/rejeita numa aba "Escopo" nova dentro do projeto, sem sair da tela nem redigir nada do
zero. O mesmo lugar também passa a ser onde aditivos criados manualmente pelo chat são
aprovados, porque hoje eles não têm lar nenhum.

**Fora de escopo:**

- **"Horas estouradas" / Timesheet.** Mesma exclusão da spec 067: módulo dormente, decisão de
  produto própria.
- **Criar "escopo original" (baseline por item).** Não constrói fluxo para popular
  `escopos` tipo='original'. A régua de orçamento continua sendo `projeto_orcamento_fases`
  (Orçamento de Honorários), como já é hoje para `v_budget_vs_actual` e Rentabilidade.
- **Fila `jobs`/outbox.** Disparo é cron dedicado, decisão já tomada; migrar para fila é
  trabalho futuro se um segundo agente proativo justificar.
- **Notificação por e-mail.** Só in-app (sino), mesmo padrão dos outros 11 tipos gerados hoje.
- **Editar itens do aditivo depois de criado.** V1 é aprovar ou rejeitar como veio; editar
  fica para quando houver sinal de que o rascunho da IA erra o suficiente para valer a pena.
- **Negociação, envio ao cliente ou geração de PDF do aditivo.** Aprovar aqui só materializa no
  contrato interno (o que o trigger já faz); comunicar ao cliente é outro fluxo.

## Requisitos

Funcionais:

1. Nova migration corrige a query de `orcamento_excedido` (dentro de
   `gerar_notificacoes_ambient()`): troca a fonte de `custo_orcado` de `escopos` tipo='original'
   para `SUM(projeto_orcamento_fases.custo_estimado)` por projeto. A regra de "sem aditivo em
   aberto" continua igual (`escopos` tipo='aditivo' status IN rascunho/pendente_aprovacao).
2. Novo cron dedicado (edge function, mesmo padrão de `trial-expiry-cron`: Bearer service role,
   `--no-verify-jwt`, agendado alguns minutos depois de `gerar-notificacoes-ambient`) consulta os
   mesmos projetos estourados que o guardião acima de novo detectaria.
3. Para cada projeto encontrado, o cron chama `callGeminiStructured` com um schema novo
   (`AditivoSugeridoSchema`: descrição, justificativa, `confianca` 0 a 1, itens com
   descrição/disciplina/horas/custo) e grava, numa transação: 1 linha em `escopos`
   (`tipo='aditivo'`, `status='rascunho'`, `created_by=NULL`), N linhas em `escopo_itens`, e 1
   linha em `agent_runs` (`status='executed'`, `entity_type='escopo'`, `entity_id` = id do
   escopo criado, `confidence` = `confianca` do schema).
4. Idempotência: se já existe um `escopos` tipo='aditivo' com status rascunho/pendente_aprovacao
   para aquele projeto, o cron não cria outro (mesma condição de guarda do item 1).
5. Nova aba "Escopo" em `ProjetoDetailTabs.tsx` (`PROJETO_TABS`, ao lado de Disciplinas e
   Pagamentos). Mostra: orçamento vivo agregado (soma de `projeto_orcamento_fases` do projeto),
   lista de aditivos com status e origem ("sugerido pelo agente" quando `created_by IS NULL`,
   nome de quem criou quando não), ação Aprovar/Rejeitar em cada rascunho/pendente.
6. Aprovar: `UPDATE escopos SET status='aprovado', aprovado_por=auth.uid(), aprovado_em=now()`
   direto do client autenticado (RLS `escopos_write` já libera para quem tem `projetos:editor`) —
   dispara `handle_escopo_aprovado()`, que já soma em `projeto_orcamento_fases` e incrementa
   `projetos.valor_contrato`. Nenhuma RPC nova para aprovar.
7. Rejeitar: `UPDATE escopos SET status='rejeitado'`. Não altera contrato nem orçamento (o
   trigger só age em `status='aprovado'`).

Não-funcionais:

- **Segurança / RLS:** cron escreve com service_role (sem depender de RLS, como
  `trial-expiry-cron`), sempre com `empresa_id` do projeto correspondente. Aprovar/rejeitar no
  front respeita a policy `escopos_write` existente, sem bypass novo.
- **Multi-tenant:** todo acesso do agente é escopado por `projeto_id → empresa_id`; nunca
  cross-tenant.
- **Observabilidade:** `agent_runs.confidence` passa a ser preenchido de verdade (hoje morto em
  todo o codebase) — é o dado que falta para decidir depois se este agente pode subir de "prepara"
  para "executa dentro de limite".

## Critérios de aceite

- [ ] Dado um projeto "Em andamento" cujas despesas diretas (Pago+Pendente) excedem
      `SUM(projeto_orcamento_fases.custo_estimado)` e sem aditivo em aberto, quando o cron roda,
      então nasce 1 `escopos` tipo=aditivo status=rascunho com itens e 1 `agent_runs` com
      `confidence` preenchido.
- [ ] Dado que já existe um aditivo rascunho/pendente para o projeto, quando o cron roda de
      novo (mesmo dia ou dia seguinte), então não cria um segundo.
- [ ] Dado um projeto sem nenhuma linha em `projeto_orcamento_fases` (`custo_orcado` = 0), quando
      o cron roda, então não gera nada (sem baseline, sem comparação, mesma regra do guardião).
- [ ] Dado um rascunho de aditivo (criado por humano no chat OU pelo agente), na aba Escopo,
      quando o usuário aprova, então `projetos.valor_contrato` aumenta pelo `valor_aditivo` e
      `projeto_orcamento_fases` reflete os novos itens.
- [ ] Dado o mesmo rascunho, quando o usuário rejeita, então some da lista de pendentes e
      contrato/orçamento não mudam.
- [ ] Dado um aditivo com `created_by IS NULL`, na aba Escopo, então aparece rotulado como
      sugerido pelo agente (não como se um usuário sem nome tivesse criado).
- [ ] Caso de borda: dois disparos do cron no mesmo dia (retry de infraestrutura) não duplicam
      rascunho para o mesmo projeto.

## Dados e contratos

- **Migration nova:** corrige a CTE/subquery de `orcamento_excedido` dentro de
  `gerar_notificacoes_ambient()` (função existente, `CREATE OR REPLACE`, ler o arquivo inteiro
  antes de editar, não reescrever de memória).
- **Sem coluna nova.** `created_by IS NULL` em `escopos` já é suficiente como sinal "criado por
  agente" (o cron roda com service_role, sem `auth.uid()`), documentado como convenção explícita
  no comentário da migration.
- **`_shared/agent-schemas.ts`:** novo `AditivoSugeridoSchema` (mesmo padrão do `OrcamentoSchema`
  existente): `descricao`, `justificativa`, `confianca` (0 a 1), `itens[]` (descricao,
  disciplina, horas, custo).
- **Edge function nova:** cron dedicado (nome a definir, ex. `guardiao-margem-cron`), padrão
  `trial-expiry-cron`.
- **Front novo:** `src/pages/projetos/components/EscopoTab.tsx` + hook `useEscopos(projetoId)`
  (padrão dos hooks `useObra*` já existentes: query + mutation direto no client autenticado).

## Plano de implementação

1. Migration: corrigir a fonte de `custo_orcado` em `orcamento_excedido` para
   `projeto_orcamento_fases`. Validar local com pgTAP que o alerta dispara num projeto de teste
   com orçamento aprovado e despesa acima dele.
2. `_shared/agent-schemas.ts`: `AditivoSugeridoSchema`.
3. Edge function cron: query dos projetos estourados (mesma condição do item 1 da spec) +
   `callGeminiStructured` + grava `escopos`/`escopo_itens`/`agent_runs` numa transação,
   idempotente por projeto.
4. Deploy em staging + agendar no `pg_cron` (staging primeiro, mesmo processo do motor de
   tokens).
5. `EscopoTab.tsx` + `useEscopos`: lista orçamento vivo, aditivos por status, aprovar/rejeitar.
6. `PROJETO_TABS` em `ProjetoDetailTabs.tsx` ganha "Escopo".
7. Testes: pgTAP do fix de query + idempotência do cron; vitest do hook e da aprovação/rejeição.
8. Verificação manual em staging: forçar um projeto de teste a estourar, rodar o cron a mão,
   conferir que o rascunho aparece na aba e que aprovar de fato altera `valor_contrato`.

## Decisões e riscos

- **Disparo por cron dedicado, não fila `jobs`.** Decisão já tomada nesta conversa. Reavaliar
  se um segundo agente proativo aparecer — aí a fila (que já existe sem consumidor desde 15/07)
  passa a valer o esforço de ligar.
- **`created_by IS NULL` como convenção de "vindo de agente".** Simples, sem migration, mas é
  uma convenção implícita que precisa de comentário no código para não confundir sessões
  futuras. Se aparecer outro caso legítimo de `created_by NULL` não relacionado a agente, essa
  premissa quebra.
- **Risco de qualidade do rascunho.** Itens sugeridos pela IA podem estar imprecisos; mitigado
  por natureza (é sempre rascunho, humano aprova antes de qualquer coisa tocar o contrato).
- **Sem ADR novo.** Segue o padrão já registrado em ADR 0006 (arquitetura de agentes). Se o
  padrão "agente escreve rascunho direto na tabela de domínio, sem inbox própria" se repetir
  2 a 3 vezes, aí formalizar como ADR.
