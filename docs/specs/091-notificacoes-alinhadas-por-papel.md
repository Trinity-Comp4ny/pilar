# SPEC: Notificações alinhadas por papel (coordenador, financeiro, obra)

**Data:** 2026-09-02
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** notificações / obras / financeiro
**Depende de:** [ADR 0015 — Notificações por destinatário](../architecture/adr/0015-notificacoes-por-destinatario.md), [SPEC 029 — Central de notificações](029-central-de-notificacoes.md)

<!-- Origem: auditoria pedida pelo CEO ("o que cada perfil recebe de notificação, o que falta")
sobre gerar_notificacoes_ambient() (última definição em 20260889000000), as RPCs de projeto/
disciplina (20260848000000) e o roteamento em _notif_gestao/_notif_ve_financeiro
(20260817000100). Achou 4 gaps concretos, priorizados aqui pelo CEO com "melhore tudo isso".
Um 5º gap (categoria 'sistema' morta, nenhum evento a usa) e um 6º (spec 089, notificação de
menção, pronta mas não commitada) também levantados na auditoria; este spec cobre o 5º
(front-only) e deixa o 6º só documentado — é trabalho de outra sessão, este spec não o move. -->

## Problema

O roteamento de `gerar_notificacoes_ambient()` e da RPC de evento pontual
(`rpc_notificar_proxima_etapa`) ficou dessincronizado de decisões já tomadas no produto:

1. **RLS de tarefas trata coordenador como gestão** (`has_role('admin', 'coordenador')`, migration
   `tarefas_coordenador_ve_tudo`), mas o roteamento de notificação (`_notif_gestao`) só inclui
   `owner`/`admin`. Coordenador vê tudo na tela e não é avisado de nada que não seja
   responsabilidade direta dele.
2. **`orcamento_excedido` vaza valor de orçamento pra quem não pode ver financeiro.** É categoria
   `financeiro`, mas o destinatário inclui `_notif_resp_projeto()` sem filtrar por
   `can_view_financeiro()` — um colaborador responsável de disciplina recebe "despesas já passam
   do orçado (R$ X de R$ Y)", o dado que essa mesma função existe pra esconder dele em toda a
   tela de Financeiro.
3. **Liberação de próxima etapa não avisa gestão**, só responsáveis da próxima disciplina —
   admin/owner/coordenador só sabem que uma etapa liberou se por acaso forem responsáveis diretos,
   o que normalmente não são. (`projeto_status_alterado`, a notificação irmã que tinha o mesmo
   problema, já não existe mais: removida em `20260894000000_remove_notificacoes_baixo_
engajamento.sql` por 0% de leitura medido em produção — achado ao levantar o histórico completo
   de migrations pra este spec, não só o estado mais recente de cada função. Não é reaberta aqui.)
4. **Obra nunca gera notificação de prazo nem de RDO em atraso.** `obras.data_fim_prevista` e
   `obras.responsavel_id` existem desde o MVP (spec 015); só o passo/tarefa vinculado à obra
   (`obra_passo_atrasado`) notifica. A obra em si (nível de execução) fica muda.

## Objetivo

O roteamento de toda notificação reflete quem hoje tem responsabilidade de gestão sobre
**operação** (prazo de projeto/disciplina/obra: owner + admin + coordenador, espelhando a RLS de
tarefas) separado de quem tem acesso a **dinheiro** (owner + admin + quem passa em
`can_view_financeiro()`, nunca coordenador/colaborador). Disciplina que libera a próxima etapa
avisa a gestão, não só quem está diretamente responsável. Obra com
prazo estourado ou sem RDO lançado há dias avisa o responsável da obra e a gestão, do mesmo jeito
que projeto/disciplina atrasados já avisam hoje.

**Fora de escopo:**

- **Frente de obra atrasada.** `obra_frente` não tem campo de prazo próprio (só `nome`/`ordem`);
  não dá pra derivar atraso sem mudança de schema. Fica para quando a frente ganhar prazo.
- **Notificar por e-mail.** Central segue só in-app (mesmo escopo da spec 029).
- **Reabrir a spec 089 (menção).** Está implementada em outra sessão/branch; este spec não a toca,
  só documenta que existe e deveria fechar no mesmo ciclo de PR.
- **Corrigir a divergência `can_view_financeiro()` (RPC) vs. `_notif_ve_financeiro()` (helper
  SQL) quanto ao bypass de `user_has_feature('financeiro','viewer')`.** Hoje o helper de
  notificação só olha `role`, a função de RLS também aceita feature flag. Na prática, com os 4
  papéis ativos (owner/admin/coordenador/colaborador) os dois concordam; a divergência só importa
  se um 5º papel com feature flag de financeiro voltar a existir. Documentado, não corrigido aqui
  para não expandir escopo além do que foi pedido.

## Requisitos

Funcionais:

1. Novo helper `_notif_gestao_operacional(p_empresa)`: `owner`, `admin`, `coordenador`. Usado em
   `projeto_atrasado`, `projeto_prazo_proximo`, `disciplina_atrasada`, `disciplina_prazo_proximo`,
   `obra_passo_atrasado`, e nos dois blocos novos de obra (item 4). `_notif_gestao` (owner+admin)
   continua reservado para o que é financeiro/negócio (`custo_nao_lancado`, `tokens_baixo`) — não
   é renomeado nem redefinido.
2. `orcamento_excedido` passa a rotear só por `_notif_ve_financeiro(empresa)` (remove
   `_notif_resp_projeto`). Quem vê financeiro já é avisado independente de ser responsável do
   projeto; quem não vê, não recebe mais o valor do orçamento por tabela.
3. `rpc_notificar_proxima_etapa` passa a unir os responsáveis de disciplina com
   `_notif_gestao_operacional(empresa)`, excluindo sempre quem disparou o evento (`auth.uid()`).
   `rpc_notificar_projeto_status` não é recriada — fica removida, como já decidido em
   `20260894000000`.
4. Dois blocos novos em `gerar_notificacoes_ambient()`:
   - `obra_atrasada`: obra com `status NOT IN ('concluida', 'paralisada')`,
     `data_fim_prevista < hoje` e `data_fim_real IS NULL`. Severidade `high`.
   - `obra_rdo_atrasado`: obra com `status = 'em_andamento'`, iniciada há mais de 3 dias
     (`data_inicio_real <= hoje - 3`) e sem `obra_rdo` lançado nos últimos 3 dias (nenhum RDO, ou
     o último tem `data < hoje - 3`). Severidade `medium`.
     Destinatários dos dois: `_notif_gestao_operacional(empresa)` + o `responsavel_id` da obra
     (via `pessoas.profile_id`, se tiver conta). Link `/obras/:id` (rota `ObraDetalhe` já existe).
5. Categoria `sistema` some do array `CATEGORIAS` em `src/lib/notificacoes.ts` — nenhum evento no
   sistema hoje cria notificação com essa categoria; o toggle em Preferências enganava o usuário
   fazendo parecer que existe algo pra controlar ali. `iconeCategoria`/`rotuloCategoria` mantêm o
   fallback (Bell / "Notificação") — se um evento de categoria `sistema` voltar a existir no
   banco no futuro, a notificação em si continua renderizando normal, só não aparece mais como
   toggle nas preferências até alguém religar a categoria de propósito.

Não-funcionais:

- **RLS/segurança:** nenhuma policy nova; os helpers `_notif_*` já são `SECURITY DEFINER`,
  `REVOKE ALL FROM PUBLIC` (padrão de `20260817000100`). O novo helper segue o mesmo padrão.
- **Multi-tenant:** todo destinatário novo resolvido dentro do `empresa_id` do registro de origem,
  igual aos blocos existentes.
- **Dedup:** de graça via `public.notificar()` (já ignora nova linha se existir uma não lida com
  mesmo destinatário+tipo+referência) — vale para `obra_atrasada`/`obra_rdo_atrasado` do mesmo
  jeito que já vale para `projeto_atrasado`.
- **Performance:** os dois blocos novos são `FOR ... LOOP` simples sobre `obras`, mesmo padrão dos
  blocos de projeto/disciplina já existentes (sem N+1 novo: uma subquery de `MAX(data)` por obra
  dentro do `SELECT` do loop, não uma query por iteração fora dele).

## Critérios de aceite

- [ ] Dado um projeto atrasado, quando o gerador roda, então o coordenador da empresa recebe
      `projeto_atrasado` mesmo sem ser responsável direto (antes só owner/admin recebiam).
- [ ] Dado um projeto com escopo estourado (`orcamento_excedido`), quando o gerador roda, então um
      colaborador responsável pela disciplina **não** recebe a notificação, mesmo sendo
      responsável do projeto.
- [ ] Dada uma disciplina cuja etapa libera a próxima, quando `rpc_notificar_proxima_etapa` roda,
      então o admin da empresa recebe `proxima_etapa_liberada` mesmo sem ser responsável de
      nenhuma disciplina.
- [ ] Dada uma obra com `data_fim_prevista` no passado e `data_fim_real` nula, quando o gerador
      roda, então o responsável da obra e a gestão operacional recebem `obra_atrasada`.
- [ ] Dada uma obra `em_andamento` iniciada há 5 dias sem nenhum RDO lançado, quando o gerador
      roda, então o responsável da obra recebe `obra_rdo_atrasado`; dada uma obra iniciada há 1
      dia sem RDO, então **não** recebe (ainda dentro da janela de tolerância).
- [ ] Dado que o gerador roda duas vezes seguidas, então nenhum dos dois tipos novos duplica
      notificação não lida.
- [ ] A tela de Preferências de notificação não lista mais "Sistema" como categoria.
- [ ] `npm run typecheck` e `npm run test:run` passam sem regressão.

## Dados e contratos

Migrations (sem mudança de schema, só função):

- `20260901000000_notif_gestao_operacional_e_roteamento.sql`: cria `_notif_gestao_operacional`;
  redefine `gerar_notificacoes_ambient()` (reproduzida por inteiro a partir da versão vigente em
  `20260889000000_fix_guardiao_escopo_fonte_orcamento.sql`, trocando só os destinatários dos
  blocos de projeto/disciplina/obra_passo, o roteamento de `orcamento_excedido`, e acrescentando
  os dois blocos novos de obra).
- `20260902000000_notif_gestao_em_status_e_proxima_etapa.sql`: redefine `rpc_notificar_
proxima_etapa` (a partir de `20260848000000`, já sem `rpc_notificar_projeto_status` — removida
  em `20260894000000`) unindo `_notif_gestao_operacional`. Numeração 901/902 (não 898/899, usados
  neste PR originalmente): renumerado no rebase pra `origin/staging` porque `20260898000000` e
  `20260899000000` já tinham sido ocupados por `tarefas_rls_multi_responsavel` e
  `tarefas_coordenador_ve_tudo` quando esse trabalho foi commitado por outra sessão.

Front:

- `src/lib/notificacoes.ts`: remove `"sistema"` de `CATEGORIAS`.

Sem migration de tipos nova (nenhuma tabela/coluna muda) — `gen:types` não é necessário, mas roda
mesmo assim antes do PR por hábito do checklist do repo.

## Plano de implementação

1. Migration do roteamento operacional: `_notif_gestao_operacional` + `gerar_notificacoes_ambient()`
   redefinida (itens 1, 2 e 4 dos requisitos).
2. Migration das RPCs de projeto/disciplina (item 3).
3. Front: remover `sistema` de `CATEGORIAS` (item 5).
4. Verificação: `npm run typecheck`, `npm run test:run`. Migrations validadas em transação com
   rollback contra o Postgres local (sem persistir); aplicação real e conferência manual em
   `dev:local` com conta de coordenador ficam para o merge deste PR.
5. PR para `staging` (#421). Rebase feito contra `origin/staging` depois que `tarefas_rls_multi_
responsavel`/`tarefas_coordenador_ve_tudo` (outra sessão) e a spec 089 (menção) já tinham
   mergeado lá — o risco de colisão de numeração previsto abaixo se confirmou e foi resolvido
   nesse rebase (migrations renumeradas de 898/899 para 901/902).

## Decisões e riscos

- **Dois helpers de gestão, não um só.** `_notif_gestao` (owner+admin) e
  `_notif_gestao_operacional` (+coordenador) coexistem de propósito: “quem administra a empresa”
  e “quem administra a operação” são conjuntos diferentes desde que coordenador ganhou RLS de
  tarefa. Colapsar num só reabriria o vazamento financeiro que o item 2 corrige.
- **Risco de numeração de migration, confirmado.** Este branch nasceu de `origin/staging` antes do
  RLS multi-responsável/coordenador e da spec 089 mergearem lá; quando mergearam, ocuparam
  exatamente os números `20260898000000`/`20260899000000` que este PR também usava. Resolvido no
  rebase: migrations deste PR renumeradas para `20260901000000`/`20260902000000` (mesmo
  procedimento já usado no commit "fix(migrations): resolve version collision at
  20260896000000") — sem conflito de conteúdo, só de nome, já que as duas frentes mexem em
  funções diferentes.
- **`projeto_status_alterado` não volta.** Achado tarde no processo (só ao investigar o histórico
  completo pra montar este spec, depois de uma primeira versão da migration já ter recriado a
  função por engano): foi removida de propósito em `20260894000000` por 0% de leitura em
  produção. Lição pra próxima vez que alguém mexer numa função de notificação — checar se existe
  `DROP FUNCTION` dela em alguma migration posterior à que a criou, não só ler a última
  `CREATE OR REPLACE`.
- **RDO em atraso é heurística, não regra de negócio formal.** 3 dias sem lançar RDO numa obra em
  andamento foi escolhido por ser o mesmo intervalo de tolerância que outros alertas de prazo
  usam (`v_em7`/7 dias pra prazo de entrega, aqui mais curto porque RDO é diário). Sem pedido
  explícito de qual o intervalo certo; ajustável sem migração de schema se o número não servir.
