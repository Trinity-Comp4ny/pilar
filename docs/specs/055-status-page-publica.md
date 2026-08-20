# SPEC: Status page pública

**Data:** 2026-08-19
**Status:** Entregue
**Autor:** Matheus Rezende
**Módulo:** plataforma (transversal, não por empresa) / ultra-admin

## Problema

Quando um componente da Pilar (app, portal do cliente, edge functions, banco)
fica degradado ou fora do ar, não existe canal público pra avisar "sabemos, tá
em progresso, resolvido às X". Design partners e futuros clientes descobrem o
problema sozinhos e perguntam por WhatsApp/e-mail, sem contexto.

## Objetivo

Página pública `/status`, sem autenticação, mostrando o status atual de cada
componente monitorado e o histórico de incidentes declarados manualmente pelo
time (hoje: só o Matheus). Gerenciada por uma tela nova em `/ultra-admin`.

**Fora de escopo (v1):**

- Uptime check automático (ping HTTP periódico). Os incidentes são declarados
  à mão; não há monitor rodando sozinho.
- Assinatura de notificação (e-mail/SMS/webhook) quando o status muda.
- SLA público ou histórico de uptime em %.
- Multi-tenant: o status é da plataforma inteira, não por empresa.

## Requisitos

1. A página `/status` lista todos os componentes monitorados com um indicador
   visual do status atual: operacional, degradado, parcial, fora do ar.
2. A página `/status` lista incidentes em ordem cronológica reversa (mais
   recente primeiro), cada um com: título, componente(s) afetado(s),
   severidade, timeline de atualizações (texto + timestamp), status do
   incidente (investigando → identificado → monitorando → resolvido).
3. Um admin (super admin, via `/ultra-admin`) pode criar um incidente,
   associá-lo a um ou mais componentes, e postar atualizações de timeline até
   marcar como resolvido.
4. Ao criar/atualizar um incidente, o admin escolhe se o status dos
   componentes afetados muda junto (ex.: declarar "fora do ar" no financeiro
   also seta o componente `financeiro` pra `outage`).
5. Sem incidente ativo, todo componente aparece como operacional por padrão
   (não exige um registro "tudo ok" pra cada dia).
6. A lista de componentes monitorados é fixa e editável só via migration (não
   precisa de UI de CRUD de componente em v1: app, portal do cliente, API/edge
   functions, banco de dados).

Requisitos não-funcionais:

- **Segurança / RLS:** `status_components` e `status_incidents` +
  `status_incident_updates` com `SELECT` liberado pra `anon` e `authenticated`
  (página é pública). `INSERT`/`UPDATE`/`DELETE` só pra quem tem
  `is_super_admin()` (mesma checagem usada em `/ultra-admin` hoje). Sem
  `empresa_id`: estas tabelas não são multi-tenant.
- **Performance:** a página pública não pode depender de sessão nem de
  round-trip autenticado; client Supabase anônimo, cache de poucos minutos
  aceitável.
- **Disponibilidade:** a própria página de status não pode depender da mesma
  infra que ela está reportando de forma acoplada (ex.: se o banco cair, a
  página deveria ainda conseguir dizer "não conseguimos carregar o status
  agora", não quebrar em branco). Tratar erro de fetch com fallback textual.

## Critérios de aceite

- [ ] Dado nenhum incidente ativo, quando um visitante anônimo abre `/status`,
      então vê todos os componentes como "operacional" e nenhuma seção de
      incidente.
- [ ] Dado um super admin logado em `/ultra-admin`, quando ele cria um
      incidente associado ao componente "financeiro" com severidade "parcial",
      então o componente "financeiro" passa a aparecer como degradado em
      `/status` para um visitante anônimo, sem precisar dar refresh forçado
      (revalidação normal de query).
- [ ] Dado um incidente aberto, quando o admin adiciona uma atualização de
      timeline, então ela aparece em `/status` na ordem certa (mais recente no
      topo da timeline do incidente).
- [ ] Dado um incidente, quando o admin marca como "resolvido", então o(s)
      componente(s) afetado(s) voltam a "operacional" (a menos que outro
      incidente ativo ainda os afete).
- [ ] Dado um usuário sem `is_super_admin()`, quando ele tenta inserir em
      `status_incidents` via client (não pela UI), então a RLS rejeita.
- [ ] Caso de borda: dois incidentes ativos afetando o mesmo componente com
      severidades diferentes, então o componente reflete a pior severidade
      entre os dois até ambos serem resolvidos.

## Dados e contratos

Novas tabelas (migration + `npm run gen:types`):

- `status_components`: `id`, `slug` (ex. `app`, `portal_cliente`, `api`,
  `banco`), `nome_exibicao`, `ordem`. Seed inicial via migration com os 4
  componentes do requisito 6.
- `status_incidents`: `id`, `titulo`, `severidade`
  (`degradado`|`parcial`|`outage`), `status`
  (`investigando`|`identificado`|`monitorando`|`resolvido`), `created_at`,
  `resolved_at`, `created_by` (uuid do admin).
- `status_incident_components`: tabela ponte `incident_id` × `component_id`.
- `status_incident_updates`: `id`, `incident_id`, `mensagem`, `created_at`,
  `created_by`.

Front consome uma view ou RPC `status_current` que já resolve "status efetivo
de cada componente" (pior severidade entre incidentes ativos que o afetam),
pra não recalcular isso no client.

## Plano de implementação

Preenchido junto com o agente (plan mode) e aprovado antes de gerar código.

1. Migration: 4 tabelas + seed dos componentes + RLS (`anon`/`authenticated`
   select; `is_super_admin()` write) + RPC/view `status_current`.
2. `npm run gen:types:local` depois de rodar a migration local.
3. Rota pública `/status` (fora do `AppShell` autenticado, sem sidebar) usando
   `PilarPage` no modo público ou um layout mínimo próprio se `PilarPage`
   assumir sessão (confirmar em `docs/design/PILAR_DESIGN_SYSTEM.md`).
4. Tab nova "Status" dentro de `/ultra-admin` (ou rota própria
   `/ultra-admin/status` se o arquivo único `ultra-admin/index.tsx`, já com
   60K, não deveria crescer mais, decidir no plano) pra CRUD de incidente e
   timeline.
5. Testes: RLS (anon não escreve, super admin escreve), cálculo de severidade
   efetiva com incidentes sobrepostos.

## Decisões e riscos

- Decisão: status custom no app (não Upptime/Instatus), pra manter no domínio
  e reaproveitar RLS/design system existentes. Trade-off aceito: sem uptime
  check automático de verdade em v1, incidente é 100% manual.
- Risco: como só o Matheus declara incidente, se ele estiver indisponível
  durante um outage a página fica desatualizada. Aceitável no estágio atual
  (mesma leitura do plantão único em `INCIDENT_RESPONSE.md`).
- Risco: página pública sem rate limit pode ser scrapeada/hammered; como é só
  leitura e sem dado sensível, baixo risco, mas vale considerar cache/CDN se
  virar alvo de tráfego.
