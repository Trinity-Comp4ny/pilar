# SPEC: Obras — MVP (execução em campo sobre o projeto)

**Data:** 2026-07-30
**Status:** Em implementação
**Autor:** Matheus (com painel de agentes 2026-07-30)
**Módulo:** obras

Contexto estratégico: `docs/strategy/DECISAO_PILARES_E_AGENTES_2026-07-25.md` adiou
Obras com gatilho; o gatilho fechou (VRZ, obra própria) e a reabertura + a decisão de
modelagem estão no [ADR 0011](../architecture/adr/0011-reabrir-obras-como-fase-de-execucao-do-projeto.md).
Esta spec substitui a página `/obras` "Em breve" da [spec 001](./001-shell-3-pilares.md).

## Problema

O sócio da VRZ executa a obra do próprio projeto e não tem onde registrar o que
acontece no canteiro. O acompanhamento diário vive em WhatsApp e planilha: o que foi
feito, quem estava lá, que pendência travou, que ocorrência precisa virar decisão. No
fim da semana ninguém reconstrói a obra a partir disso, e a informação que deveria
alimentar prazo e cobrança se perde.

## Objetivo

Depois desta feature: o projeto que entra em execução vira uma **Obra** no Pilar, com
um **diário (RDO)** que registra cada dia de campo, **frentes de serviço** com suas
pendências, e uma **timeline** que mostra num lugar só o andamento. Tudo web-first
(lançado do escritório), sobre o projeto que já existe, sem duplicar cliente, equipe
ou financeiro.

Métrica de sucesso: a VRZ registra RDO em pelo menos uma obra por 2 semanas seguidas
e consegue, ao fim de uma semana, dizer o que aconteceu na obra sem abrir o WhatsApp.

**Fora de escopo (v1) — vira fase própria, não entra agora:**

- **Fotos no RDO** (exige bucket privado + URL assinada + Supabase Pro; decisão de
  custo de 25/07). Fase 2, reusa o bucket `anexos` com `entidade='obra_rdo'`.
- **Medição → faturamento** (avanço vira receita). Os `marcos_faturamento` do projeto
  já existem e aparecem só como leitura na timeline; a ação de faturar continua na
  aba Financeiro. Ligar medição de obra ao `rpc_faturar_marco` é fase 3.
- **Clima por API meteorológica e previsão/alerta de chuva.** No v1 o clima é um
  campo escolhido à mão no RDO. Integração e alerta são fase 2.
- **Mobile / PWA offline de campo.** A VRZ lança do escritório hoje; quando o uso
  migrar para o canteiro, PWA offline é fase própria (é o item mais caro).
- **Estoque, suprimento, composição de custo (SINAPI/TCPO), curva ABC.** Território
  de ERP de obra; a research é unânime que ali o Pilar perde e não é a dor. Não entra.
- **Radar de Prontidão** (dependência com lead time): é o item P6 do backlog próprio,
  não se mistura com este MVP.
- **Cálculo de avanço a partir do cronograma de disciplinas.** O avanço do v1 é
  derivado de frentes/tarefas concluídas, não do Gantt.

## Regra de arquitetura

Segue a régua da spec 001 e o ADR 0011: **a Obra é a fase de execução de um Projeto,
não uma entidade paralela.** Ela referencia o projeto (`obras.projeto_id`) e por ele
herda cliente, disciplinas, equipe (responsáveis de disciplina) e o Financeiro.
Nenhum dado é duplicado. O módulo Obras é dono só das telas de obra (timeline, RDO,
frentes) e das tabelas novas abaixo.

## Requisitos

Funcionais:

1. Um usuário com a feature `obras` pode **criar uma obra a partir de um projeto
   existente**: escolhe o projeto, dá nome (default = nome do projeto), status inicial
   e datas previstas. Um projeto pode ter no máximo uma obra ativa no v1.
2. A obra tem **status** (`planejada`, `em_andamento`, `paralisada`, `concluida`),
   `responsavel_id` (uma pessoa da empresa) e datas prevista/real de início e fim. A
   localização é herdada do projeto (não se redigita).
3. A tela da obra tem três abas: **Timeline**, **Diário** e **Frentes**.
4. **Timeline (visão):** cabeçalho com status, responsável, datas e **avanço** (% de
   tarefas concluídas nas frentes, determinístico); lista dos marcos de faturamento do
   projeto (somente leitura, com data e status); os 5 RDOs mais recentes; as frentes
   com contagem de pendências abertas. Sem tabela nova; compõe dados existentes.
5. **Diário (RDO):** o usuário registra um dia de obra com `data`, `clima`
   (escolhido de uma lista: `ensolarado`, `nublado`, `chuvoso`, `chuva_forte`),
   `condicao_trabalho` (`normal`, `parcial`, `paralisada`), `efetivo` (nº de pessoas),
   `atividades` (texto do que foi feito), `ocorrencias` e `pendencias`. Há no máximo um
   RDO por obra por dia. O diário lista os registros em ordem decrescente de data.
6. **Frentes:** o usuário cria **frentes de serviço** da obra (ex.: fundação,
   alvenaria, instalações) com nome e ordem. Dentro de cada frente, cria **tarefas**
   (pendências de campo) reusando a tabela `tarefas`: título, responsável, prazo,
   prioridade, status (`a_fazer`/`fazendo`/`concluida`). Uma tarefa de obra também
   aparece no "Meu trabalho" do seu responsável (mesmo motor de tarefa).
7. A **rota `/obras`** deixa de ser "Em breve" e passa a listar as obras da empresa
   (nome, projeto, status, avanço, responsável), com acesso à obra em `/obras/:id`. A
   página "Em breve" só aparece para empresa/usuário sem a feature `obras`.
8. O módulo respeita a **feature flag `obras`**: sem ela, o switcher mostra Obras como
   "Em breve" (comportamento atual da spec 001); com ela, mostra o módulo funcional.

Não-funcionais:

- **Segurança / RLS:** três tabelas novas (`obras`, `obra_rdo`, `obra_frente`), todas
  com `empresa_id` e policy `empresa_id = public.get_user_empresa_id()`; INSERT/UPDATE
  revalidam FKs cross-tenant (projeto_id, obra_id, responsavel_id) com `EXISTS`, no
  padrão de `tarefas` (`20260730000100`). Soft delete via `deleted_at` em `obras`. A
  coluna nova `tarefas.obra_id` entra na revalidação das policies de `tarefas`.
- **Performance:** a lista de obras e a timeline usam queries agregadas com
  `staleTime` generoso; nada de full-scan por RDO. Avanço calculado por contagem
  agregada de tarefas por obra, não N+1 no client.
- **Multi-tenant:** isolamento por `empresa_id` mantido; obra e RDO nunca cruzam
  empresa (revalidação no INSERT como no exemplo de `tarefas`).

## Critérios de aceite

- [ ] Dado um projeto da empresa e usuário com feature `obras`, quando cria uma obra
      escolhendo esse projeto, então a obra nasce com status `planejada` e herda a
      localização do projeto.
- [ ] Dado um projeto que já tem obra ativa, quando o usuário tenta criar outra, então
      o sistema recusa com mensagem clara ("este projeto já tem uma obra").
- [ ] Dada uma obra, quando registra um RDO de hoje com clima `chuvoso` e condição
      `paralisada`, então o registro aparece no topo do diário com a data de hoje.
- [ ] Dado um RDO já existente para a data de hoje, quando tenta criar outro no mesmo
      dia, então o sistema abre o registro existente para edição em vez de duplicar.
- [ ] Dada uma frente com 4 tarefas e 1 concluída, então o avanço da obra na timeline
      mostra 25% e a frente mostra 3 pendências abertas.
- [ ] Dada uma tarefa de obra com responsável X, quando X abre "Meu trabalho", então a
      tarefa aparece na lista dele (mesmo motor de `tarefas`).
- [ ] Dado usuário sem a feature `obras`, quando acessa `/obras`, então vê a página
      "Em breve" e nenhuma chamada às tabelas de obra.
- [ ] Caso de borda: usuário de outra empresa não vê nem consegue inserir RDO na obra
      (RLS); tentativa de INSERT com `obra_id` de outra empresa é rejeitada.
- [ ] `npm run test:run` e `npm run typecheck` verdes; teste do cálculo de avanço e do
      filtro de obras por feature/empresa.

## Dados e contratos

Tabelas novas (migration + `npm run gen:types`, commitar `types.ts`):

```sql
-- obras: a fase de execução de um projeto
create table public.obras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  projeto_id uuid not null references public.projetos(id),
  nome text not null,
  status text not null default 'planejada'
    check (status in ('planejada','em_andamento','paralisada','concluida')),
  responsavel_id uuid references public.pessoas(id) on delete set null,
  data_inicio_prevista date, data_fim_prevista date,
  data_inicio_real date, data_fim_real date,
  observacoes text,
  created_by uuid, updated_by uuid,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz
);
-- uma obra ativa por projeto
create unique index obras_projeto_ativa_uniq on public.obras(projeto_id)
  where deleted_at is null;

-- obra_frente: agrupador de serviço dentro da obra
create table public.obra_frente (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  obra_id uuid not null references public.obras(id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- obra_rdo: diário de obra, um por dia
create table public.obra_rdo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  obra_id uuid not null references public.obras(id) on delete cascade,
  data date not null,
  clima text check (clima in ('ensolarado','nublado','chuvoso','chuva_forte')),
  condicao_trabalho text
    check (condicao_trabalho in ('normal','parcial','paralisada')),
  efetivo int,
  atividades text, ocorrencias text, pendencias text,
  autor_id uuid references public.pessoas(id) on delete set null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (obra_id, data)
);
```

Alteração em tabela existente:

```sql
-- tarefa pode pertencer a uma obra e a uma frente (nullable; motor de tarefa reusado)
alter table public.tarefas add column obra_id uuid references public.obras(id) on delete set null;
alter table public.tarefas add column obra_frente_id uuid references public.obra_frente(id) on delete set null;
-- ao criar tarefa de obra, o front preenche projeto_id = obra.projeto_id (Meu trabalho segue funcionando)
```

RLS: as três tabelas seguem o padrão de `tarefas` (SELECT/INSERT/UPDATE/DELETE por
`empresa_id = public.get_user_empresa_id()`, com `EXISTS` revalidando `projeto_id` e
`obra_id` no INSERT/UPDATE). As policies de `tarefas` ganham a revalidação de
`obra_id` (quando não nulo, a obra tem que ser da empresa). Sem RPC nova no MVP.

Feature flag: adicionar `obras` ao catálogo de features (`src/lib/features.ts`) e ao
gate do módulo em `src/lib/modules.ts` (hoje `badge: "em breve"`).

## Plano de implementação

Preenchido/refinado em plan mode e aprovado antes de gerar código. Esboço:

1. Migration das 3 tabelas + colunas em `tarefas` + RLS; `gen:types`; commitar
   `types.ts` (staging primeiro, ADR 0007).
2. Feature `obras` no catálogo + trocar o gate de módulo em `modules.ts`.
3. Rota `/obras` (lista) e `/obras/:id` (obra com abas), atrás de `FeatureRoute`.
4. Aba Diário (RDO): form + lista, hook `useObraRdo`. Regra de 1 por dia.
5. Aba Frentes: CRUD de frente + tarefas via motor `tarefas` (reusar componentes de
   tarefa existentes, passando `obra_id`/`obra_frente_id`).
6. Aba Timeline: composição (cabeçalho, avanço agregado, marcos read-only, RDOs
   recentes, frentes com pendências).
7. Testes dos critérios de aceite + QA dos perfis (com/sem feature), dark mode.

## Evolução do módulo (pós-MVP, gated por demanda real)

Modelo de navegação decidido em 2026-07-30: Obras é **pilar enxuto que cresce pra
dentro**. Um item na sidebar (a lista de obras); a profundidade mora nas abas de cada
obra (hoje Visão/Diário/Frentes, mais abas depois). A obra empresta cliente,
calendário e financeiro do projeto, então o pilar naturalmente tem menos itens de
sidebar que Projetos, e isso é correto (não inflar com entidade sem dono).

Itens-irmãos só entram na sidebar quando houver dor concreta do ICP. Estado:

- **Clima** (FEITO, 2026-07-30, ADR 0012): 2º item da sidebar. Previsão via Open-Meteo
  (grátis, sem chave) por obra (usa a localização própria da obra) ou por cidade livre;
  clima atual + 7 dias + alerta de chuva. Foi o primeiro item "pra fora".
- **Mapa de obras** (geo dos canteiros), quando houver várias obras espalhadas.
- **Diários / Relatório semanal** (feed dos RDOs de todas as obras + gerador do
  resumo semanal para o cliente). Pedido recorrente do ICP; forte candidato a próximo item.

O que NÃO vira item de sidebar: Calendário (camada "obra" no calendário compartilhado,
ADR 0010), Medição/Faturamento (vive no Financeiro), Cliente/Documentos (do projeto).

## Decisões e riscos

- **Decisão (ADR 0011):** Obra = fase de execução do projeto; reusa cliente/equipe/
  financeiro; feature flag off por padrão (ligada só para a VRZ).
- **Decisão (navegação, 30/07):** pilar enxuto que cresce pra dentro (abas), não pra
  fora (itens de sidebar); irmãos só sob demanda do ICP (ver "Evolução do módulo").
- **Atualização (30/07, ADR 0012):** o vínculo obra↔projeto virou **opcional** (campo
  de projeto só aparece se a empresa tem Projetos), a obra ganhou **localização própria**
  (CEP → coordenadas), e **Clima** entrou como 2º item da sidebar (Open-Meteo, grátis).
- **Decisão:** avanço é determinístico (tarefas concluídas / total), não campo manual
  nem derivado do Gantt. Simples e verificável no v1.
- **Decisão:** tarefas de obra reusam a tabela `tarefas` (não uma tabela nova),
  aparecendo também no "Meu trabalho". Evita achatar/duplicar o modelo.
- **Risco (Red Team):** ao suportar execução própria, o Pilar compete com Vobi/ERP de
  obra, com mais superfície e menos preço. Mitigação: escopo mínimo e vigiado; nada de
  SINAPI/curva ABC/estoque no v1.
- **Risco:** obra exige projeto. Obra sem projeto não existe no v1 (assumido no ADR).
- **Suposição a validar com a VRZ:** o RDO web-first (lançado do escritório) é usado
  de fato; medir se registram na semana. Se o uso for no canteiro, PWA offline sobe de
  prioridade.
- **Storage de foto** fica para a fase que trouxer imagem ao RDO, com bucket privado +
  URL assinada + Supabase Pro (decisão de 25/07). O CHECK de `anexos.entidade` ganha
  `'obra_rdo'` nessa fase.
