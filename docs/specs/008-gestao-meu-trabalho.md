# SPEC: Gestão — "Meu trabalho" (lista de tarefas do dia)

**Data:** 2026-07-30
**Status:** Aprovada (decisões D1-D4 resolvidas 2026-07-30)
**Autor:** Matheus Rezende
**Módulo:** gestao

## Problema

Hoje o Pilar só sabe representar trabalho que nasce de um **projeto**: você cria um
projeto e pendura disciplinas, etapas e financeiro nele. Falta o lugar das coisas
pequenas do dia que não valem virar projeto: "responder o cliente X", "organizar a
pasta de documentos", "revisar a proposta antes de enviar". E falta a visão
agregada do óbvio: **tudo que eu tenho pra fazer, num lugar só**.

Quem sente isso é o dono/coordenador do escritório, que passa o dia resolvendo o
operacional e nunca enxerga o conjunto. Foi a dor literal trazida pelo design
partner na demo de 2026-07-24 ("estou toda hora resolvendo problema operacional,
nunca consigo visualizar onde quero chegar"), e ele apontou o modelo mental do
Monday: uma lista de tarefas com responsável, status e prazo, filtrável por pessoa.

## Objetivo

Uma tela **"Meu trabalho"** no pilar Gestão com **duas abas**:

- **Projetos:** o trabalho que já existe derivado dos projetos (disciplinas/etapas
  sob minha responsabilidade), agrupado por status. Acompanhar e atualizar, não criar.
- **Tarefas:** as avulsas que eu crio e gerencio na hora.

As duas abas são filtráveis por pessoa, com "meus cards" como padrão. Depois disso, o
usuário consegue abrir o Pilar e ver a fila do dia sem depender de criar um projeto.

Separar em abas (em vez de uma lista única) evita misturar item só-leitura (disciplina
de projeto) com item editável (tarefa avulsa), e evita que o mesmo status signifique
coisas diferentes na mesma lista.

**Fora de escopo (corta discussão depois):**

- **Colunas customizáveis pelo usuário.** O esquema é fixo (tarefa, responsável,
  status, prazo). Isso é deliberado: board genérico é a armadilha que o Pilar recusa
  (ver `research/aec/monday-com-benchmark-2026.md`, seção Armadilha). Sem "Add
  column", sem tipos de coluna configuráveis.
- **Board por departamento** (RH, financeiro, logística como estruturas
  configuráveis). Uma lista pessoal, não um workspace.
- **Sub-tarefas, dependências, automações, IA que gera view.** Nada disso na v1.
- **Timesheet / captura de horas.** Esta spec é o esqueleto onde a captura de horas
  vai se encaixar depois (gate 2 da sequência de 90 dias), mas não a implementa.
- **Kanban com arrastar entre colunas.** Agrupamento por status sim; drag-and-drop
  pode vir depois, não é requisito da v1.

## O que já existe (aproveitar)

- Pilar **`gestao`** em `src/lib/modules.ts` (label "Gestão"). "Meu trabalho" entra
  como item novo e vira o `homeRoute` natural do pilar.
- **`public.pessoas`**: fonte do responsável (padrão `responsavel_id`/`pessoa_id`
  usado em todo o código de projetos).
- **`public.projeto_disciplinas`**: disciplinas normalizadas com responsável, prazo
  e status. É a fonte do trabalho derivado de projeto (sem tabela nova).
- Padrão de RLS por `empresa_id` e `useToast`/early-return da casa.

## Requisitos

Funcionais (numerados, testáveis):

1. A tela "Meu trabalho" tem duas abas: **Projetos** e **Tarefas**. A aba ativa
   persiste (última usada) e é deep-linkável.
2. Cada item das duas abas mostra: título, responsável (avatar/nome), status, prazo.
   Na aba Projetos, mostra também o projeto de origem.
3. Aba **Projetos:** lista disciplinas/etapas de `projeto_disciplinas` cujo
   `responsavel_id` bate com o filtro, agrupadas por status. Mudar o status aqui
   reflete na disciplina de origem. Não se cria nem exclui item nesta aba.
4. Aba **Tarefas:** lista as tarefas avulsas (tabela `tarefas`), agrupadas por status.
5. Na aba Tarefas, o usuário cria uma tarefa com: título (obrigatório), responsável
   (default: ele mesmo), status (default: A fazer), prazo (opcional), projeto
   (opcional, só para vincular; não a transforma em item da aba Projetos).
6. O usuário muda o status de uma tarefa (A fazer → Fazendo → Concluído) e o item se
   move de grupo.
7. O usuário edita e exclui uma tarefa que ele possa gerenciar. Exclusão pede
   confirmação (padrão do projeto: sem delete silencioso).
8. Filtro por pessoa nas duas abas. Default = usuário logado ("meus cards"); pode ver
   de outra pessoa ou de todos (respeitando papel).
9. Em ambas as abas, itens concluídos ficam no grupo "Concluído", recolhível, sem sumir.

Não-funcionais:

- **Segurança / RLS:** `tarefas` tem RLS por `empresa_id`. `SELECT/INSERT/UPDATE/
DELETE` só para membros da empresa; `auth.uid()` resolve a `pessoa`/`empresa` do
  chamador. Responsável e projeto referenciados devem ser da mesma empresa
  (validar FK cross-tenant, como no hardening dos RPCs `*_agente`).
- **Multi-tenant:** nenhum item de outra empresa aparece em nenhuma fonte.
- **Performance:** a lista filtra por `empresa_id` + `responsavel_id` com índice; sem
  full-scan. A união das duas fontes é paginável/limitada.
- **Papéis:** ver tarefa dos outros e filtrar por pessoa respeita RBAC (colaborador
  vê o dele; coordenador/owner vê da equipe). Reusar `src/lib/rbac.ts`/`roles.ts`.

## Critérios de aceite

- [ ] Dado que sou responsável por uma disciplina de um projeto, quando abro a aba
      **Projetos**, então ela aparece com o projeto de origem, sem eu ter criado nada.
- [ ] Dado que na aba **Tarefas** crio "responder cliente X" sem projeto, quando
      salvo, então ela aparece no grupo "A fazer" com meu nome como responsável.
- [ ] Dado que troco de aba, quando volto à tela depois, então a última aba usada é a
      que abre.
- [ ] Dado uma tarefa em "A fazer", quando marco como "Concluído", então ela sai do
      grupo "A fazer" e entra em "Concluído", que continua acessível.
- [ ] Dado o filtro padrão, quando abro a tela, então vejo só os meus itens; ao
      trocar para "todos", vejo os da equipe (se meu papel permite).
- [ ] Dado que excluo uma tarefa avulsa, então o sistema pede confirmação antes.
- [ ] Multi-tenant: dado um usuário de outra empresa, então nenhuma tarefa nem
      disciplina minha aparece pra ele (testar com `auth.uid()` das duas empresas).
- [ ] Borda: dado uma tarefa sem prazo, então ela lista normalmente (prazo vazio, não
      quebra ordenação).
- [ ] Borda: dado um responsável de outra empresa no payload de criação, então o
      INSERT é rejeitado (validação cross-tenant).

## Dados e contratos

Tabela nova `public.tarefas` (migration + `npm run gen:types` + commit do `types.ts`):

```
tarefas
  id            uuid primary key default gen_random_uuid()
  empresa_id    uuid not null references empresas(id)
  titulo        text not null
  descricao     text
  status        text not null default 'a_fazer'
                  check (status in ('a_fazer','fazendo','concluida'))
  responsavel_id uuid references pessoas(id)      -- null = sem responsável
  projeto_id     uuid references projetos(id)     -- null = tarefa avulsa
  prazo          date
  created_by     uuid not null                    -- auth.uid() na criação
  created_at     timestamptz not null default now()
  updated_at     timestamptz not null default now()
```

- Índices: `(empresa_id, responsavel_id)`, `(empresa_id, status)`.
- RLS: policies `select/insert/update/delete` restritas a `empresa_id` do chamador;
  `insert/update` validam que `responsavel_id` e `projeto_id` pertencem à empresa.
- **Trabalho derivado de projeto** não vai para `tarefas`: é lido de
  `projeto_disciplinas` no momento da montagem da aba Projetos. O responsável vem da
  join `projeto_disciplina_responsaveis` (`pessoa_id`) e a empresa vem de
  `projetos.empresa_id` (a tabela `projeto_disciplinas` não tem `empresa_id` próprio).
  Mudar status de um item derivado atualiza a disciplina de origem, não cria linha em
  `tarefas`.
- **Normalização de status na aba Projetos:** `projeto_disciplinas.status` é texto
  livre e inconsistente no dado atual (`Não Iniciado`/`Nao Iniciado`,
  `Concluído`/`Concluida`, `Atrasado`, `Em Andamento`...). A aba mapeia para 3
  baldes de UI: **A fazer** / **Fazendo** / **Concluído** (função de mapeamento
  tolerante a acento/grafia). Ao gravar, escreve um valor canônico.
- **RPC de leitura da aba Projetos:** `get_minhas_disciplinas(p_pessoa_id uuid
default null)` retorna as disciplinas do responsável (default = pessoa do
  `auth.uid()`), escopadas à empresa. Shape:
  `{ id, titulo (=nome), status_bucket, status_raw, prazo (=data_fim),
projeto: { id, nome } }`.
- **"Minha pessoa"** = `pessoas WHERE profile_id = auth.uid() AND deleted_at IS NULL`.
- Cada aba consome sua própria fonte (sem união num único shape):
  - Projetos: shape da RPC acima (só-leitura exceto status).
  - Tarefas: select direto em `tarefas` →
    `{ id, titulo, descricao, status, responsavel, prazo, projeto: { id, nome } | null }`
    (editável, RLS cuida do escopo).

## Plano de implementação

Passos ordenados e verificáveis. Aprovar as decisões em aberto (fim da seção) antes
de gerar código.

**Fase A — Banco (`tarefas`)**

1. Migration `NNNN_tarefas.sql`: cria `public.tarefas` (schema acima), trigger
   `tg_pilar_touch_updated_at` no `updated_at`, índices `(empresa_id, responsavel_id)`
   e `(empresa_id, status)`, `ENABLE ROW LEVEL SECURITY`.
2. Policies RLS (padrão `get_user_empresa_id()`):
   - `select/update/delete`: `empresa_id = get_user_empresa_id()`.
   - `insert`: `WITH CHECK` empresa do chamador **e** `responsavel_id`/`projeto_id`
     (quando não nulos) pertencem à mesma empresa (subselect em `pessoas`/`projetos`),
     seguindo o hardening cross-tenant dos RPCs `*_agente`.
   - `created_by` preenchido com `auth.uid()` (default ou trigger).
3. `npm run gen:types` (staging, ADR 0007) e commitar `types.ts` (CI não valida isso,
   ver CLAUDE.md).
   _Verificação:_ teste SQL/pgTAP de RLS com dois `auth.uid()` de empresas diferentes.

**Fase B — Leitura**

4. RPC `get_minhas_disciplinas(p_pessoa_id uuid default null)`: junta
   `projeto_disciplinas` + `projeto_disciplina_responsaveis` + `projetos`, escopo
   `projetos.empresa_id = get_user_empresa_id()`, responsável default = pessoa do
   `auth.uid()`. Aplica a função de mapeamento de status → 3 baldes. Retorna o shape
   da seção Dados.
   _Verificação:_ confirmar RLS de `projeto_disciplinas`; se houver, RPC
   `SECURITY INVOKER`; se não, `SECURITY DEFINER` com filtro de empresa explícito.
5. Aba Tarefas: `select` direto em `tarefas` (RLS), filtro opcional por
   `responsavel_id`. Sem RPC.

**Fase C — Escrita**

6. Tarefas: criar/editar/mudar status/excluir via mutations Supabase (RLS cuida do
   escopo). Excluir usa `AlertDialog` de confirmação; feedback com `useToast`.
7. Status na aba Projetos: reutiliza o caminho de update de status de disciplina que
   o detalhe do projeto já usa; grava valor canônico (ver decisão D2).

**Fase D — Front**

8. `src/lib/features.ts`: adiciona `FeatureKey` `"meu_trabalho"` + `FeatureDefinition`
   (grupo e planos, ver decisão D1) com gate de escrita `editor`.
9. `src/lib/modules.ts`: item `{ title: "Meu trabalho", url: "/meu-trabalho", icon,
feature: "meu_trabalho" }` no topo do pilar `gestao` (ver decisão D4 sobre
   `homeRoute`).
10. Rota protegida `/meu-trabalho` no roteador.
11. `src/pages/meu-trabalho/index.tsx`: `Tabs` (shadcn, padrão de
    `src/pages/financeiro/tabs`) com abas Projetos/Tarefas; aba persistida
    (localStorage) e deep-linkável (query/hash); cada aba agrupada por status (3
    grupos, "Concluído" recolhível); filtro de pessoa (default = pessoa do usuário);
    `PageHeader` padrão (spec 002) + breadcrumb; empty states que orientam a 1ª ação.

**Fase E — Verificação (critérios de aceite)**

12. Testes: RLS multi-tenant, criação de tarefa, mudança de status nas duas abas,
    validação cross-tenant no insert, persistência da aba, borda de prazo vazio.

### Decisões resolvidas (2026-07-30)

- **D1 — Feature flag e planos: decidir depois.** Cria a `FeatureKey` `meu_trabalho`
  e coda atrás dela, com escrita gated em `editor`. `includedInPlans` fica provisório
  (não fixar o pricing agora); ajustar quando o modelo de planos for calibrado.
- **D2 — Status da disciplina: gravar valor canônico.** Concluir/reabrir na aba
  Projetos escreve um dos 3 valores canônicos (`Não Iniciado`/`Em Andamento`/
  `Concluído`), de quebra normalizando a grafia bagunçada do dado atual.
- **D3 — Responsável único na `tarefas` v1** (a disciplina segue admitindo vários).
- **D4 — `homeRoute` do pilar Gestão passa a ser `/meu-trabalho`** (hoje `/financeiro`):
  clicar em Gestão abre "Meu trabalho".
- **D5 — filtro "Todos" adiado (escopo v1).** O filtro de pessoa oferece "Eu"
  (default) e cada pessoa da empresa. Ver disciplinas de "Todos" de uma vez exige
  uma RPC nova (a atual filtra por uma pessoa); fica como follow-up.

### Estado da implementação (2026-07-30, banco LOCAL)

- **Fase A/B/C/D prontas e no banco local.** Migration
  `20260730000100_gestao_tarefas_e_meu_trabalho.sql` aplicada; RLS multi-tenant e
  cross-tenant testados no banco; `types.ts` atualizado por splice (não sobrescrito,
  porque o local diverge do staging em `update_projeto_completo`). Front: feature
  `meu_trabalho` (core), item + homeRoute em Gestão, rota `/meu-trabalho`, página com
  abas Projetos/Tarefas (persistida na URL), filtro de pessoa, CRUD de tarefa com
  confirmação de exclusão. `typecheck` + `lint` + `build` verdes.
- **Pendente:** Fase E (testes automatizados dos critérios de aceite em Vitest; por
  ora só há verificação manual de RLS no banco). Nada aplicado em staging/prod.
- **Ajuste 2026-07-30 (aba Agenda + cards clicáveis):** a tela ganhou uma 3ª aba
  **Agenda**, que monta o calendário compartilhado (ADR 0010) com escopo pessoal:
  camadas **Disciplinas** e **Tarefas** (togláveis), Mês/Semana/Agenda, mini-mês.
  Empresa só-Gestão vê só a camada Tarefas. Clicar numa tarefa abre o detalhe
  (diálogo, `readOnly` para papel de leitura); clicar numa disciplina abre o
  projeto. Nas listas, o card virou clicável (tarefa → detalhe, disciplina →
  projeto) e o botão "Nova tarefa" desabilitado passou a explicar o porquê
  (acesso de leitura). Nome "Meu trabalho" mantido (padrão de mercado).
- **Ajuste 2026-07-30 (independência de módulos):** a aba de disciplinas agora só
  renderiza se a empresa tem o módulo Projetos (`can('projetos')`) e foi renomeada de
  "Projetos" para **"Minhas disciplinas"** (mata a ambiguidade com o módulo Projetos).
  Empresa só-Gestão vê "Meu trabalho" = apenas Tarefas, autocontido. A pauta maior
  (vender módulos como SKUs independentes) está sob análise de painel; ver a decisão
  que resultar em `docs/strategy/`.

## Decisões e riscos

- **Nova tabela quebra o "zero tabela nova" da Gestão-como-view.** A decisão
  (`docs/strategy/DECISAO_PILARES_E_AGENTES_2026-07-25.md`) previa Gestão só como
  agregação. A parte derivada de projeto continua zero-tabela; a tabela `tarefas`
  existe só para a demanda avulsa, que é o gap que o dono e o design partner
  apontaram. Aberto conscientemente, escopo mínimo.
- **Risco de virar Monday.** Mitigado por esquema fixo e pelos itens de "Fora de
  escopo". Se no futuro pedirem colunas/estruturas configuráveis, isso é decisão
  transversal e vira **ADR** antes de codar, não crescimento silencioso desta tabela.
- **Persona.** O pedido veio de um design partner fora do ICP (construtora). O que
  entra aqui é a interseção que também serve o ICP (engenheiro vendo o próprio dia e
  o da equipe); o que era anti-persona (board por departamento) ficou fora.
- **Encaixe com captura de horas.** Esta tabela é o gancho natural do gate 2:
  concluir uma disciplina/tarefa é o gesto que depois dispara o lançamento de hora.
  Projetar os campos pensando nisso, sem implementar horas agora.

## Relacionados

- `docs/strategy/DECISAO_PILARES_E_AGENTES_2026-07-25.md` (Gestão como view; sequência de gates)
- `research/aec/monday-com-benchmark-2026.md` (por que o board genérico é armadilha)
- `docs/specs/001-shell-3-pilares.md` (pilar `gestao` no shell)
- Memória: reunião Angola 2026-07-24
