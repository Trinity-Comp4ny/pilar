# SPEC: Funil comercial no Leads (proposta dentro do card)

**Data:** 2026-08-11
**Status:** Em implementação
**Autor:** Matheus (com painel de agentes 2026-08-11: ICP, Red Team, Produto)
**Módulo:** gestao (Comercial): leads + propostas

Consolida o funil comercial dentro do Kanban de Leads que já existe (`/leads`),
trazendo a proposta para dentro do card em vez de mantê-la numa tela separada
(`/documentos`). Reusa a ponte que já está no banco: `propostas` carrega `lead_id`,
`cliente_id` e `projeto_id`.

> **GATE 0 (RODADO em prod 2026-08-11, dados reais da VRZ).** 25 leads, 6 propostas na
> história inteira (4 `aceita` todas já convertidas em projeto, 2 `rascunho`). As três
> contagens:
>
> 1. Leads com >1 proposta não-recusada: **1** (raro).
> 2. Propostas `enviada` com `validade < hoje`: **0** (o `expirada` não morde ninguém hoje).
> 3. Propostas com `cliente_id` e `lead_id` nulo (recompra sem lead): **1** de 6 (17%).
>
> **Leitura:** o funil mal foi usado (6 propostas), a dor de "cruzar duas telas" é real mas
> antecipatória, não aparece como pilha em aberto. **Decisões travadas por este Gate:**
> (a) recompra sem lead **fica fora da v1** (n=1 não justifica dobrar a complexidade do
> board; posiciona como funil de **negócio novo**, gatilho de reabertura = recompra virar
> ~20% sustentado ou a VRZ reclamar); (b) `expirada` derivado em runtime só como blindagem
> futura, não urgente; (c) proposta primária (mais recente não-recusada) por design, o caso
> multi-proposta já existe mesmo a n=6. O baixo volume também **confirma o PM**: não é P0,
> vem depois de fechar obras (018).

## Problema

O comercial vive em duas telas que não conversam. O Kanban de Leads (`/leads`) mostra o
estágio (`Novo → Em contato → Proposta → Negociação → Ganho → Perdido`) com o **valor
estimado** (o chute do lead). As propostas vivem numa tabela à parte (`/documentos`) com o
**valor proposto** real, a margem e o status próprio (`rascunho/enviada/aceita/recusada`).
Para responder "quanto tenho em jogo no comercial e em que pé", o sócio olha os dois lados
e cruza na cabeça. Pior: os números mentem por omissão. O card mostra `valor_estimado`
mesmo quando já existe proposta com valor real; a "taxa de conversão" (`LeadsKPIs.tsx`)
só olha lead Ganho/Perdido e ignora se a proposta foi aceita ou recusada. Quem sente: o
sócio que trabalha o funil (VRZ, BM3), que hoje mantém a verdade comercial numa planilha
paralela.

## Objetivo

Depois desta feature: o Kanban de Leads é a **lente primária** do funil comercial. Cada
card de lead com proposta vinculada mostra o **valor proposto real**, a **margem estimada**
e o **status da proposta** (badge), sem sair da tela. Os KPIs do topo passam a refletir a
proposta (valor real quando existe, taxa de fechamento honesta). A tela `/documentos`
continua como a **oficina** (editar proposta, PDF, contrato) e como a **lista seca** para
quem precisa cobrar. Bater o olho no Kanban passa a responder "quanto de trabalho está
pendurado e em que pé", com número em que o sócio confia.

Métrica de sucesso: a VRZ olha o Kanban de Leads e enxerga o valor real e o estágio das
propostas em aberto sem abrir a planilha paralela nem a tela de Documentos; o número de
"valor no funil" e a taxa de fechamento batem com uma conferência manual dos dados dela.

**Fora de escopo (cortado, não "depois"):**

- **Estágio derivado da proposta.** O estágio continua sendo do lead, arrastável na mão. A
  proposta enriquece o card, nunca move o card sozinha. Rejeitado pelo painel: lead
  (6 estados, "Negociação" sem par) e proposta (5 estados, N por lead sem UNIQUE) não
  colapsam num eixo determinístico; um estágio derivado faria o card pular de coluna
  sozinho. Metade do comercial (visita, escopo) acontece **antes** de existir proposta.
- **Arrastar para "Ganho" cria o projeto.** Converter em projeto é botão explícito no
  detalhe do lead (reusa `rpc_converter_proposta_projeto`), nunca efeito colateral de um
  drag. Encadear cliente + projeto + disciplinas + orçamento num gesto de arrastar (sem
  undo) é a receita do problema de "converter sem querer" que já mordeu antes.
- **Edição da proposta inline no card.** Editar valor/escopo/PDF continua em
  `/documentos?edit=`. O card mostra e leva pra oficina; não vira editor apertado.
- **Matar a rota `/documentos`.** A lista seca de propostas (todas em aberto, valor, data,
  status, para cobrar) é tabela, não card. Não reconstruir nem remover.
- **UI de múltiplas propostas por lead.** A v1 mostra **uma** proposta por card (a
  "primária"): a mais recente não-recusada. Sem carrossel/lista de propostas no card.
- **Um número único de "conversão".** São duas perguntas diferentes (de cada 10 leads,
  quantos ganho? vs de cada 10 propostas enviadas, quantas fecho?). Ficam **dois** KPIs
  rotulados, nunca um número fundido que não responde nenhuma.
- **Recompra sem lead (proposta `lead_id` nulo) no board.** Fora da v1 **por padrão**;
  continua visível em `/documentos`. Entra na v1 **apenas se o Gate 0 (item 3) mostrar que
  é material** para a VRZ; nesse caso vira card sintético de "oportunidade sem lead".
- **Tabela/entidade "oportunidade" no banco.** Zero migration. O funil se reconstrói por
  join sobre `propostas` (que já tem as três FKs). Criar entidade nova é a armadilha CRM
  genérico (Monday/Pipedrive); o diferencial do Pilar mora depois do Ganho, na margem do
  projeto.

## Requisitos

Funcionais:

1. No Kanban de Leads, um card cujo lead tem proposta vinculada mostra: **badge do status**
   da proposta (rascunho/enviada/aceita/recusada, e `expirada` derivada quando
   `validade < hoje`), o **valor proposto** real e a **margem estimada** (`margem_estimada_pct`).
2. Quando o lead tem proposta, o valor exibido é o **proposto** (com marca visual de "real"),
   distinguível do **estimado** (chute) mostrado nos leads ainda sem proposta.
3. Regra de proposta primária: quando um lead tem mais de uma proposta, o card usa a **mais
   recente não-recusada**. Nenhuma soma conta um lead duas vezes.
4. Os KPIs do topo de Leads passam a:
   - **Valor no funil:** para cada lead ativo, `valor_proposto` da proposta primária se
     existe, senão `valor_estimado`. Sem dupla contagem (uma primária por lead).
   - **Dois indicadores separados e rotulados:** conversão de leads (`Ganho / (Ganho +
     Perdido)`) e fechamento de propostas (`aceita / enviada`).
5. O estágio (coluna) continua sendo `leads.status`, movido por drag como hoje. Mover um
   card **não** altera o status da proposta.
6. Criar proposta a partir do lead continua um **botão explícito** que leva a
   `/documentos?edit=` (fluxo atual). Ao criar, o lead só **avança** para "Proposta" se
   estiver antes dela; nunca **retrocede** um lead em "Negociação" (corrige o efeito de
   `useCreatePropostaFromLead` que hoje força `status = "Proposta"`).
7. O detalhe do lead ganha um **resumo da proposta** (valor, margem, status, validade) com
   link para editar em `/documentos?edit=` e o botão explícito **"Converter em projeto"**
   (reusa `rpc_converter_proposta_projeto`, com o dialog de confirmação atual).
8. Propostas com `lead_id` nulo continuam visíveis em `/documentos` e não somem do produto.

Não-funcionais:

- **Sem migration.** Tudo é leitura: join de `propostas` por `lead_id` no client, cálculo
  puro dos KPIs. Nenhuma tabela nova, nenhuma coluna nova, nenhum RPC novo.
- **Segurança / RLS:** nenhuma superfície nova de escrita; as leituras usam as policies já
  existentes de `leads` e `propostas` (isolamento por `empresa_id`). A conversão reusa a
  RPC existente sem ampliar grants.
- **Performance:** uma query de propostas por `lead_id` das leads visíveis (sem N+1 por
  card); `staleTime` alinhado ao das leads. O embed do PostgREST não remove soft-deleted,
  então filtrar `deleted_at` no client.
- **Honestidade do número (não-funcional dura):** card e KPI usam a **mesma** regra de
  valor (primária → proposto, senão estimado). Não pode divergir na mesma tela.

## Critérios de aceite

- [ ] Dado um lead com uma proposta `enviada` de R$ 40.000 e margem 22%, o card mostra
      badge "enviada", R$ 40.000 marcado como valor real e "22%".
- [ ] Dado um lead **sem** proposta, o card fica idêntico ao de hoje (valor estimado, sem
      badge de proposta).
- [ ] Dado um lead com duas propostas (uma `recusada`, uma `rascunho`), o card usa a
      `rascunho` (mais recente não-recusada) e nenhum KPI conta o lead duas vezes.
- [ ] O KPI "Valor no funil" soma, por lead ativo, o valor proposto quando há proposta e o
      estimado quando não há; o total bate com conferência manual nos dados da VRZ.
- [ ] Existem **dois** indicadores rotulados: conversão de leads (Ganho/Perdido) e
      fechamento de propostas (aceita/enviada). Nenhum rótulo "conversão" ambíguo.
- [ ] Dada uma proposta `enviada` com `validade` no passado, o badge mostra "expirada"
      (derivado em runtime), sem alterar o dado persistido.
- [ ] Mover um card de "Proposta" para "Negociação" grava só `leads.status`; a proposta
      permanece `enviada` e o card **não volta** sozinho no próximo render.
- [ ] Criar proposta de um lead em "Negociação" não retrocede o lead para "Proposta".
- [ ] "Converter em projeto" é um botão no detalhe do lead; arrastar para "Ganho" **não**
      cria projeto (mantém o comportamento atual de promover lead a cliente, com o dialog).
- [ ] Propostas com `lead_id` nulo seguem listadas em `/documentos`.
- [ ] `npm run test:run` e `npm run typecheck` verdes; teste da regra de proposta primária,
      do override de valor (sem dupla contagem) e das duas taxas.

## Dados e contratos

**Sem mudança de schema.** As ligações já existem:

- `propostas.lead_id` (FK para `leads`), `propostas.valor_proposto`,
  `propostas.margem_estimada_pct`, `propostas.status`, `propostas.validade`.
- `leads.status`, `leads.valor_estimado`.

Cálculo puro (novo, testável, ex. em `src/lib/comercial.ts`):

- `propostaPrimaria(propostasDoLead)` → a mais recente com `status != 'recusada'` (ou
  `null`).
- `statusExibido(proposta)` → `'expirada'` quando `status === 'enviada'` e
  `validade < hoje`, senão `proposta.status` (mesma regra que `getDisplayStatus` já usa em
  `propostas/index.tsx`).
- `valorNoFunil(lead, primaria)` → `primaria?.valor_proposto ?? lead.valor_estimado`.
- `taxaFechamentoPropostas(propostas)` → `aceita / enviada` (denominador = enviadas +
  aceitas + recusadas + expiradas, a definir no plano com a pergunta exata).

Front:

- `useLeads` (ou um hook irmão) passa a trazer as propostas por `lead_id` das leads
  carregadas (uma query, mapa `lead_id → propostas[]`).
- `LeadKanbanCard` (`src/pages/leads/components/LeadKanbanCard.tsx`) renderiza badge +
  valor real + margem quando há proposta primária.
- `LeadsKPIs` (`src/pages/leads/LeadsKPIs.tsx`) usa `valorNoFunil` e expõe as duas taxas.
- O detalhe do lead ganha o resumo da proposta + "Converter em projeto"
  (reusa `useConverterProposta` / `rpc_converter_proposta_projeto`).

## Plano de implementação

Preenchido/refinado em plan mode e aprovado antes de gerar código. Esboço:

1. **Gate 0:** rodar as três contagens (staging/prod) e registrar o resultado aqui. Decide
   se "recompra sem lead" entra na v1 e se `expirada` é obrigatória.
2. `src/lib/comercial.ts`: `propostaPrimaria`, `statusExibido`, `valorNoFunil`,
   `taxaFechamentoPropostas` + testes (incluindo múltiplas propostas e sem dupla contagem).
3. Hook: trazer propostas por `lead_id` junto das leads (uma query, filtrando soft-deleted).
4. `LeadKanbanCard`: badge de status + valor real + margem quando há proposta primária;
   marca visual "real vs estimado".
5. `LeadsKPIs`: `valorNoFunil` no "Valor no funil"; dois indicadores rotulados.
6. Corrigir `useCreatePropostaFromLead` para só avançar o status, nunca retroceder.
7. Detalhe do lead: resumo da proposta + link de editar + botão "Converter em projeto".
8. Testes dos critérios de aceite + QA (com/sem feature, com/sem proposta, dark, board com
   ~30 cards para checar o custo de render que o ICP levantou).

## Decisões e riscos

- **Decisão (a que reformula o pedido):** a fusão é o card, não o modelo. O estágio segue
  do lead e arrastável; a proposta é conteúdo do card. Consolidar aqui é uma **lente**
  sobre dados que já estão ligados, não uma nova máquina de estado.
- **Decisão:** dois KPIs, não um. "Conversão de leads" e "fechamento de propostas"
  respondem perguntas diferentes; fundir num número só produz um artefato que engana a
  decisão de esforço comercial (Red Team).
- **Risco (overclaim):** vender "funil comercial único" enquanto recompra sem lead fica em
  `/documentos`. **Mitigação:** posicionar como funil de **negócio novo**; o Gate 0 decide
  se a recompra é material o bastante para entrar já na v1 (posição do ICP).
- **Risco (dado que já mente):** `expirada` nunca é computada; múltiplas propostas por lead
  sem UNIQUE. **Mitigação:** `expirada` derivada em runtime; proposta primária = mais
  recente não-recusada, testada. O Gate 0 mede o tamanho real do problema hoje.
- **Risco (mini-CRM):** cada hora aqui é hora fora do `useRentabilidade` (que ainda ignora
  mão de obra). **Guardrail:** escopo S, zero migration, sem entidade nova; se cruzar para
  "deals/pipeline genérico", parou.
- **Risco (custo de render, ICP):** card gordo pode travar o board. **Mitigação:** QA com
  ~30 cards; badge/valor leves; se pesar, degradar para densidade menor, nunca voltar a
  cruzar telas na mão.
- **Custo escondido (PM):** hoje o trabalho ativo é `feat/obras-cotacoes` (018 em uso pela
  VRZ). Sair dessa branch no meio é o maior custo desta decisão, não o código. Sequenciar:
  fechar a fatia de obras aberta, depois esta v1 como quick-win.
- **Suposição a validar (teste de R$0):** que ver valor/margem da proposta no card muda o
  jeito da VRZ olhar o comercial. Se ela não olhar o Kanban por isso, a fusão não valeu.

## Sequência e gates

- **Gate 0 (antes de codar):** as três contagens. Definem escopo da recompra e do
  `expirada`.
- **Prioridade:** não é P0. Entra depois de fechar a fatia de obras em uso (018) e antes de
  abrir 019/020, como quick-win de aquisição/honestidade de métrica. Sobe na fila se um
  prospect travar na conversa comercial por funil confuso ou a VRZ pedir valor/margem no
  pipeline.
- **Depois da v1:** recompra sem lead como card sintético (se o Gate 0 pedir), e só então
  eventual UI de múltiplas propostas. Nunca entidade "oportunidade" nem drag-converte sem
  pedido escrito de pagante.
