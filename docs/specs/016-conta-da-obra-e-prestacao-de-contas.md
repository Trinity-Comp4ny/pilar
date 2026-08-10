# SPEC: Conta da obra e prestação de contas (obra por administração)

**Data:** 2026-07-31
**Status:** Draft
**Autor:** Matheus (com painel de agentes 2026-07-31)
**Módulo:** obras (+ financeiro, portal)

Decisão de arquitetura em [ADR 0013](../architecture/adr/0013-financeiro-de-obra-por-administracao-dois-bolsos-uma-lente.md)
(dois bolsos e uma lente). Cresce sobre o MVP da [spec 015](./015-obras-mvp.md)
(obra = RDO + frentes + timeline). Base competitiva em
`research/aec/obra-por-administracao-prestacao-de-contas-mercado-br.md`.

Esta é a **fase 1 da evolução do módulo Obra** — o pilar de maior valor e o mais
defensável (nenhum concorrente atende o escritório que administra a obra do cliente).
As fases seguintes (esqueleto de etapas, captura por voz, compra unificada) estão no
"Roadmap do módulo" ao fim, cada uma virando sua própria spec.

## Problema

O escritório que **administra a obra do cliente** (modelo por administração, taxa de
8-15% sobre o custo) movimenta **dinheiro do cliente**, não dele. Hoje isso vive numa
planilha por obra e o cliente cobra transparência toda reunião ("cadê meu dinheiro?").
Pior: quando esse custo entra no mesmo financeiro que mede a saúde do escritório, a
margem do escritório vira mentira (o faturamento aparente infla com R$ que não é dele).
Quem sente: o sócio do escritório (VRZ, que passa a administrar também a obra de um
terceiro em Indaiatuba) e o dono da obra, que não enxerga onde o dinheiro foi.

## Objetivo

Depois desta feature: cada obra tem uma **conta da obra** que registra os **aportes do
cliente** e as **despesas pagas com esse dinheiro**, com **saldo** e **previsto vs
realizado por grande etapa**; a **taxa de administração** vira **automaticamente**
receita do escritório (Bolso 1) sem digitação dupla; e o dono da obra vê um **extrato**
no portal. O custo da obra **não polui** a margem do escritório.

Métrica de sucesso: a VRZ registra a conta de pelo menos uma obra por 2 semanas e
consegue, sem abrir planilha, dizer ao cliente quanto entrou, quanto saiu por etapa e
qual o saldo — e ver a margem do escritório (honorário + taxa) limpa do custo da obra.

**Fora de escopo (fase 1):**

- **Asaas / conta bancária real e repasse automático.** A conta da obra é registro
  (manual/assistido) nesta fase. A conta bancária real via Asaas é fase 2 (ADR 0013).
- **Comprovante em imagem no lançamento.** Reusa a decisão de storage de foto da spec
  015 (bucket privado + Supabase Pro); entra quando o RDO ganhar foto. Nesta fase o
  comprovante é um link opcional (padrão de anexo por link, decisão de 30/07).
- **Curva ABC / composição de custo por insumo.** Previsto/realizado é por **grande
  etapa**, nunca por insumo. Território de ERP, cortado (spec 015, ADR 0013).
- **Objeto "compra" com estoque e lead time.** É a fase 4 do roadmap; aqui a despesa é
  um lançamento simples. A compra unificada (estoque + lead time + custo) vem depois.
- **Conciliação bancária / importação de extrato OFX.** Fase futura da captura.

## Requisitos

Funcionais:

1. A obra ganha **modelo de cobrança** (`administracao` | `preco_fechado`, default
   `administracao`) e **`taxa_administracao_pct`** (numérico, ex. 10). Só aparece na UI
   da obra quando o modelo é `administracao`.
2. Numa obra, o usuário registra **lançamentos** na conta da obra: **aporte** (entrada,
   dinheiro que o cliente colocou) ou **despesa** (saída paga com o dinheiro do cliente).
   Cada lançamento tem data, descrição, valor, e — para despesa — **etapa** (a frente da
   obra, spec 015), **fornecedor** (opcional, reusa o cadastro existente), **pago por**
   (`cliente` | `escritorio_reembolsavel`) e link de comprovante (opcional).
3. Ao registrar uma **despesa**, o sistema cria/atualiza **automaticamente** a receita
   de **taxa de administração** no Financeiro do escritório (Bolso 1), no valor
   `valor_despesa * taxa/100`, como "a receber". O usuário nunca digita a taxa.
4. Quando a despesa é `escritorio_reembolsavel`, além da taxa, o sistema registra o
   **valor da despesa como "a receber" do cliente** no Bolso 1 (reembolso do
   adiantamento), separado da taxa.
5. A conta da obra mostra **saldo** (aportes − despesas). O saldo **pode ser negativo**
   (despesa sem aporte é permitida).
6. O usuário define um **orçamento previsto por grande etapa** da obra; a tela mostra
   **previsto vs realizado** (realizado = soma das despesas daquela etapa) com o desvio
   em valor e %.
7. O **custo da obra não aparece** na margem/DRE do Financeiro do escritório. O Bolso 1
   só reconhece honorário + taxa de administração + reembolsos como receita da obra.
8. No **portal do cliente**, o dono da obra vê o **extrato da obra**: aportes, despesas
   por etapa, saldo, e a **taxa de administração como linha destacada**. Read-only.
9. Tudo respeita a **feature flag `obras`** (spec 015). A conta da obra é uma aba nova
   na tela da obra (`/obras/:id`), ao lado de Timeline/Diário/Frentes.

Não-funcionais:

- **Segurança / RLS:** tabelas novas (`obra_conta_lancamento`, `obra_orcamento_etapa`)
  com `empresa_id` e policy `empresa_id = public.get_user_empresa_id()`; INSERT/UPDATE
  revalidam FKs cross-tenant (`obra_id`, `obra_frente_id`, `fornecedor_id`) com `EXISTS`,
  no padrão de `tarefas`/spec 015. O extrato no portal usa o caminho de acesso do portal
  do cliente já existente (sem expor a empresa inteira). Soft delete via `deleted_at`.
- **Integridade financeira:** o lançamento de taxa/reembolso no Bolso 1 é derivado do
  lançamento da obra e precisa ser **idempotente** (editar/estornar a despesa reflete na
  taxa; sem lançamento órfão). Definir o mecanismo no plano (trigger vs RPC transacional).
- **Performance:** saldo e realizado por etapa por agregação (sem N+1 no client);
  `staleTime` generoso na conta da obra.
- **Multi-tenant:** isolamento por `empresa_id`; nenhum lançamento cruza empresa nem obra.

## Critérios de aceite

- [ ] Dada uma obra com `taxa_administracao_pct = 10`, quando registro uma despesa de
      R$ 1.000 com `pago por = cliente`, então a conta da obra mostra saída de R$ 1.000
      e o Financeiro do escritório ganha uma receita a receber de R$ 100 (taxa),
      automaticamente, sem eu digitar a taxa.
- [ ] Dada a mesma obra, quando registro despesa de R$ 1.000 com
      `pago por = escritorio_reembolsavel`, então o Financeiro do escritório registra
      R$ 100 de taxa **e** R$ 1.000 a receber do cliente (reembolso), em linhas
      separadas.
- [ ] Dado aportes somando R$ 50.000 e despesas somando R$ 30.000, então o saldo da
      conta da obra é R$ 20.000.
- [ ] Dada uma obra sem nenhum aporte, quando registro uma despesa de R$ 5.000, então o
      sistema aceita e o saldo fica −R$ 5.000.
- [ ] Dado orçamento previsto de R$ 40.000 na etapa Fundação e despesas realizadas de
      R$ 45.000 nessa etapa, então a etapa mostra estouro de R$ 5.000 (+12,5%).
- [ ] Dada uma obra com R$ 800.000 de custo lançado, quando abro o Financeiro do
      escritório, então a margem do escritório **não** inclui esses R$ 800.000; só
      aparecem honorário + taxa + reembolsos.
- [ ] Quando edito uma despesa de R$ 1.000 para R$ 1.200, então a taxa a receber no
      Bolso 1 passa de R$ 100 para R$ 120 (sem criar lançamento de taxa duplicado);
      quando excluo a despesa, a taxa correspondente é estornada.
- [ ] Dado o dono da obra no portal do cliente, quando abre a obra, então vê o extrato
      (aportes, despesas por etapa, saldo, taxa destacada) e **não** vê outra obra nem
      dado da empresa.
- [ ] Caso de borda: usuário de outra empresa não vê nem consegue inserir lançamento na
      conta da obra (RLS); INSERT com `obra_id`/`fornecedor_id` de outra empresa é
      rejeitado.
- [ ] `npm run test:run` e `npm run typecheck` verdes; testes do cálculo de saldo, do
      previsto vs realizado por etapa, e da derivação idempotente da taxa/reembolso.

## Dados e contratos

Tabelas novas (migration + `npm run gen:types`, commitar `types.ts` — staging primeiro,
ADR 0007):

```sql
-- lançamento na conta da obra (dinheiro do cliente)
create table public.obra_conta_lancamento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  obra_id uuid not null references public.obras(id) on delete cascade,
  tipo text not null check (tipo in ('aporte','despesa')),
  data date not null,
  descricao text not null,
  valor numeric(14,2) not null check (valor >= 0),
  -- só para despesa:
  obra_frente_id uuid references public.obra_frente(id) on delete set null, -- a "grande etapa"
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  pago_por text check (pago_por in ('cliente','escritorio_reembolsavel')),
  comprovante_url text,
  created_by uuid, updated_by uuid,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz
);

-- orçamento previsto por grande etapa (realizado = soma das despesas da etapa)
create table public.obra_orcamento_etapa (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  obra_id uuid not null references public.obras(id) on delete cascade,
  obra_frente_id uuid not null references public.obra_frente(id) on delete cascade,
  valor_previsto numeric(14,2) not null default 0,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (obra_id, obra_frente_id)
);
```

Alteração em tabela existente:

```sql
alter table public.obras
  add column modelo_cobranca text not null default 'administracao'
    check (modelo_cobranca in ('administracao','preco_fechado')),
  add column taxa_administracao_pct numeric(5,2) not null default 0;
```

Elo com o Bolso 1 (o ponto a resolver no plano): a receita de taxa e o reembolso vivem
nas tabelas financeiras já existentes do escritório (contas a receber / lançamentos).
**Não** criar um segundo motor de receita. Definir no plano: (a) qual tabela financeira
recebe a taxa/reembolso, (b) trigger vs RPC transacional para manter idempotência, (c)
como marcar esses lançamentos como derivados da obra (ex. `origem_obra_lancamento_id`)
para editar/estornar em cascata.

RLS: as duas tabelas novas seguem o padrão de `tarefas`/spec 015 (SELECT/INSERT/UPDATE/
DELETE por `empresa_id = public.get_user_empresa_id()`, `EXISTS` revalidando `obra_id`,
`obra_frente_id`, `fornecedor_id`). O extrato do portal usa o caminho de leitura do
portal do cliente existente.

Nomenclatura (marca): "**Obra**" passa a ser termo oficial para a fase de execução
física; "**projeto**" segue o termo canônico para o trabalho de escritório. Atualizar
`brand/voice-tone.md:66` para que "obra" saia da lista de banidas **só** nesse sentido
(execução), continuando banida como sinônimo preguiçoso de "projeto". Telas: "Conta da
obra" / "Prestação de contas" (Bolso 2); "Financeiro" (Bolso 1); "Resultado do projeto"
(lente) — nunca "financeiro do projeto".

## Plano de implementação

Preenchido/refinado em plan mode e aprovado antes de gerar código. Esboço:

1. Migration: colunas em `obras`, tabelas `obra_conta_lancamento` e
   `obra_orcamento_etapa` + RLS; **decidir e implementar o elo com o Bolso 1**
   (taxa/reembolso idempotentes). `gen:types`; commitar `types.ts` (staging, ADR 0007).
2. Hooks: `useObraConta` (lançamentos + saldo), `useObraOrcamento` (previsto vs
   realizado por etapa). Cálculos puros em `src/lib/obras.ts` (testáveis, como
   `calcularAvanco`).
3. Aba "Conta da obra" em `/obras/:id`: lançar aporte/despesa, lista, saldo, previsto vs
   realizado por etapa. Campo de taxa/modelo na edição da obra.
4. Elo automático da taxa/reembolso no Financeiro do escritório + garantir que o custo
   da obra fica **fora** da margem do Bolso 1 (checar as queries de margem existentes).
5. Extrato no portal do cliente (read-only): aportes, despesas por etapa, saldo, taxa
   destacada.
6. Testes dos critérios de aceite (saldo, previsto/realizado, idempotência da taxa,
   isolamento RLS, portal) + QA dos perfis (com/sem feature `obras`), dark mode.
7. Atualizar `brand/voice-tone.md` (nomenclatura obra vs projeto).

## Decisões e riscos

- **Decisão (ADR 0013):** dois bolsos e uma lente; taxa automática; "pago por" modela o
  dinheiro que encosta no escritório; previsto/realizado por grande etapa.
- **Risco (Red Team):** escorregar para ERP se o previsto/realizado virar curva ABC de
  insumo. **Guardrail:** grande etapa apenas; sem SINAPI/TCPO/composição.
- **Risco (tela vazia):** lançamento manual mais lento que a planilha mata o uso (lição
  do timesheet). Mitigação nesta fase: lançamento enxuto (data/descrição/valor/etapa/
  pago por, salvou). Mitigação estrutural: captura por voz e importação de extrato
  (roadmap).
- **Risco (integridade):** lançamento derivado (taxa/reembolso) órfão ou duplicado ao
  editar/estornar a despesa. Mitigação: idempotência via `origem_obra_lancamento_id`,
  coberta por teste.
- **Suposição a validar com a VRZ (teste de R$0):** que a prestação de contas ao cliente
  e a taxa automática são as dores do topo. Pedir as 2-3 dores por escrito antes de
  ampliar o escopo. O caso do Rafa (Indaiatuba) é o piloto natural.
- **Dependência:** reusa `fornecedores`, `obra_frente` (spec 015) e o portal do cliente
  existentes. Confirmar no plano o nome real da tabela de fornecedores e das tabelas
  financeiras de contas a receber.

## Roadmap do módulo (fases seguintes, cada uma vira spec)

Ordem por retorno sobre esforço, todas sobre o que já existe:

- **Fase 2 — Esqueleto de etapas.** Template de 8 macroetapas padrão BR (preliminares,
  fundação, estrutura, alvenaria, cobertura, instalações, revestimentos, acabamento,
  entrega) aplicável na criação da obra, com um nível de **subetapa** entre frente e
  tarefa. Mata a tela vazia; conteúdo + 1 nível, não modelo novo
  (`research/aec/obra-etapas-quantitativos-e-ferramentas-campo.md`).
- **Fase 3 — Captura por voz (nível ≤2, HITL).** Áudio → RDO/andamento estruturado via
  edge function (Whisper + LLM com JSON schema), rascunho editável com confirmação
  humana. Barato (~US$0,03-0,05/RDO) e tira a fricção de lançamento. Herói não é o
  RDO por voz (commodity), é "falo o andamento e o Pilar avisa se estourou custo/prazo".
  Nunca predição/quantitativo (`research/aec/captura-rdo-por-voz-e-ia-gestao-obra.md`).
- **Fase 4 — Compra unificada.** Objeto "compra" (material, qtd, unidade, fornecedor,
  valor, prazo de entrega) que resolve de uma vez: saldo de estoque (comprado − usado),
  alerta de lead time ("compre até dia Y") e custo (vira despesa da conta da obra).
  Quantitativo humano-no-loop (previsto/utilizado), nunca IA prevendo.
- **Fase 5 — Clima cruzado com a agenda.** A previsão (Open-Meteo, já existe) cruza com
  a data agendada de tarefa sensível a chuva (concretagem) e alerta. Depende das datas
  no esqueleto (fase 2).
- **Fase 2 (financeiro) — Asaas.** A conta da obra vira conta bancária real com repasse
  e extrato automático (paridade Vobi Pay). Backend Asaas já existe, dormente.
