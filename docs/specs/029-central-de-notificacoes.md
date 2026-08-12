# SPEC: Central de notificações in-app

**Data:** 2026-08-12
**Status:** Draft
**Autor:** Matheus Rezende
**Módulo:** transversal (Empresa)
**Depende de:** [ADR 0015 — Notificações por destinatário](../architecture/adr/0015-notificacoes-por-destinatario.md), [ADR 0005 — permissões role + features](../architecture/adr/0005-permissoes-feature-flags.md)

> Renumerada de 028 → 029 (028 ficou com "Obra no portal do cliente").
>
> **Revisão de design (12/08):** a central não é uma página. É um **sino no rodapé
> da sidebar** (ao lado do perfil) que abre um popover com duas abas — **Inbox**
> (não arquivadas) e **Arquivadas** — e ações "marcar todas como lidas" e "arquivar
> todas". Isso adiciona o conceito de **arquivar** (`notificacoes.arquivada_em`,
> migration `20260817000200`). A rota `/notificacoes`, o item de menu e o sino do
> header foram removidos. As preferências abrem por uma engrenagem no popover.

## Problema

O sistema já avisa por dois canais mancos:

- **E-mail transacional** (Resend): convite, recuperação de senha, próxima etapa,
  cobrança. Sai do produto e não deixa rastro dentro dele.
- **Sino de alertas** (`AlertsBell` + tabela `alertas` + `gerar_alertas_ambient()`
  no cron): existe e funciona, mas é **por empresa**. O estado de leitura é global
  (um marca lido, some para todos) e não há destinatário. Todo mundo vê tudo,
  inclusive um colaborador vendo alerta financeiro.

Falta o óbvio: o usuário abrir o sistema e ver **o que é dele** — "esta tarefa foi
atribuída a você", "a disciplina que você toca está estourando o prazo", "a parcela
tal vence em 3 dias" — com leitura individual e sem receber ruído que não lhe diz
respeito.

## Objetivo

Uma central de notificações **por usuário**: cada pessoa com conta vê um sino com
as suas notificações, marca como lida individualmente, clica e vai direto ao item.
Os avisos nascem de eventos de domínio (atribuição) e de varreduras diárias
(prazo, financeiro, obra), roteados por **responsabilidade + gestão** — ninguém
recebe o que não é seu. O usuário controla, numa tela de preferências, quais
categorias quer receber. O sino atualiza em **tempo real**.

Depois desta feature, ao ser atribuído a uma tarefa o usuário vê o aviso aparecer
na hora, sem recarregar; e o dono, ao abrir o sistema de manhã, vê as parcelas a
vencer e os projetos em risco que são responsabilidade dele.

**Fora de escopo (v1):**

- **E-mail** de notificação (digest diário ou por evento crítico). A infra Resend
  já existe e a coluna `email` já nasce em preferências, mas o disparo é fase
  posterior.
- Push do browser / mobile.
- Notificação vinda dos agentes de escrita (`agent_runs`) — eles continuam na
  inbox de revisão (`/agentes`). Só o agente ambient (varredura) alimenta o sino.
- Agrupar/silenciar por item ("mutar esta tarefa"). Preferência é por **categoria**,
  não por objeto individual.

## Requisitos

Funcionais:

1. **Destinatário e leitura por usuário.** Cada notificação tem um destinatário
   (`profiles.id`) e `lido_em` próprio. Só o destinatário vê e marca a sua. Marcar
   lida não afeta ninguém.
2. **Sino unificado no header.** O `AlertsBell` passa a ler `notificacoes` (não
   `alertas`). Badge com a contagem de não lidas do usuário; popover com as últimas;
   "marcar todas como lidas"; clicar numa notificação marca lida e navega para o
   `link`. Empty state orienta ("nenhuma notificação por aqui").
3. **Central completa (página).** Item novo no grupo Empresa da navegação abrindo
   `/notificacoes`: lista paginada de todas as notificações do usuário, filtro por
   categoria e por lida/não lida, ações marcar lida / marcar todas.
4. **Tempo real.** O sino e a página assinam Supabase Realtime na tabela
   `notificacoes` filtrando por `destinatario_id`, no padrão já usado nos agentes
   (`useAgentRuns`). Notificação nova aparece sem recarregar; badge atualiza.
5. **Evento — tarefa atribuída.** Ao atribuir uma pessoa a uma tarefa (inclui a
   ponte `tarefa_responsaveis`), gerar notificação `tarefa_atribuida` para o usuário
   daquela pessoa (`pessoas.profile_id`, se não nulo). Não notificar quem atribuiu a
   si mesmo. O texto nomeia a tarefa; o `link` abre "Meu trabalho" no item.
6. **Varreduras diárias (roteadas).** O gerador ambient passa a inserir em
   `notificacoes` com fan-out por destinatário. Tipos e roteamento:
   - `projeto_atrasado` e `projeto_prazo_proximo` (≤7 dias): responsáveis do projeto
     - gestão (admin/owner).
   - `disciplina_atrasada` e `disciplina_prazo_proximo` (≤7 dias): responsáveis da
     disciplina (`projeto_disciplina_responsaveis`) + gestão.
   - `parcela_vencida` / `parcela_vence` (≤7 dias, despesa e receita),
     `marco_proximo`, `margem_baixa`, `recebimento_baixo`: **só quem pode ver
     financeiro** (`can_view_financeiro()` — exclui coordenador/colaborador) + gestão.
   - `cronograma_obra_atrasado`: responsáveis dos passos/frentes da obra + gestão.
7. **Preferências por usuário.** Tela onde o usuário liga/desliga notificação por
   **categoria** (tarefa, projeto, disciplina, financeiro, obra, sistema). Default:
   tudo ligado in-app. O roteamento respeita a preferência: não insere a linha para
   quem desligou a categoria. A coluna de canal e-mail aparece desabilitada com nota
   "em breve".
8. **Dedup e retenção.** Não recriar notificação não lida para a mesma
   `(destinatario_id, tipo, referencia_id)` — rodar o gerador N vezes não empilha.
   `expires_at` opcional para expirar avisos que perderam sentido.

Não-funcionais:

- **Segurança / RLS (ADR 0015):** SELECT/UPDATE só do próprio (`destinatario_id =
auth.uid()`); INSERT/DELETE não expostos ao authenticated comum — inserção só via
  funções `SECURITY DEFINER` (trigger + gerador), e admin para aviso manual
  `sistema`. Preferências: tudo por `user_id = auth.uid()`. Grants só `authenticated`.
- **Multi-tenant (ADR 0001):** `empresa_id NOT NULL`; o fan-out nunca cruza empresa.
- **Roteamento por papel (ADR 0005):** `has_role('admin')`/owner = gestão;
  `can_view_financeiro()` guarda a categoria financeiro.
- **Performance:** índice `(destinatario_id, lido_em, created_at desc)` para o
  contador e a lista. O fan-out roda no cron (varredura) ou num trigger leve
  (atribuição), nunca em loop no front.
- **Realtime:** adicionar `notificacoes` à publication `supabase_realtime`
  (migration no padrão de `20260730000000_agent_runs_actions_realtime.sql`).

## Critérios de aceite

- [ ] Dado que outro usuário me atribui a uma tarefa, então vejo a notificação
      `tarefa_atribuida` aparecer no sino em tempo real, sem recarregar.
- [ ] Dado que eu me atribuo a uma tarefa, então não recebo notificação de mim mesmo.
- [ ] Dada uma pessoa sem conta (`profile_id` nulo) atribuída a uma tarefa, então
      nenhuma notificação é gerada para ela (não quebra).
- [ ] Dado que marco uma notificação como lida, então ela sai da minha contagem e
      continua visível (lida) para mim, sem afetar nenhum outro usuário.
- [ ] Dado um colaborador, quando o gerador roda com uma parcela a vencer, então ele
      **não** recebe a notificação financeira; o admin/owner recebe.
- [ ] Dado um coordenador responsável por uma disciplina atrasada, então ele recebe
      `disciplina_atrasada` mesmo sem acesso ao financeiro.
- [ ] Dado que o gerador roda duas vezes no mesmo dia, então não há notificação
      duplicada para o mesmo (destinatário, tipo, referência) não lida.
- [ ] Dado que desliguei a categoria "financeiro" nas preferências, então não recebo
      novas notificações financeiras (as antigas permanecem).
- [ ] Dado que clico numa notificação de projeto, então sou levado ao projeto
      referenciado e ela é marcada como lida.
- [ ] Sem permissão para uma tela de destino, o `link` degrada para a home sem erro.
- [ ] RLS: um usuário não consegue ler nem alterar notificação de outro (teste com
      `auth.uid()` de dois usuários da mesma empresa).

## Dados e contratos

Migrations (ver ADR 0015 para o schema completo):

- **`notificacoes`** — nova tabela, uma linha por (evento, destinatário), RLS por
  `destinatario_id = auth.uid()`.
- **`notificacao_preferencias`** — `(user_id, empresa_id, categoria, in_app, email)`,
  `unique(user_id, categoria)`, RLS por `user_id`.
- **`public.notificar(p_empresa_id, p_destinatarios uuid[], p_tipo, p_categoria,
p_severidade, p_titulo, p_mensagem, p_ref_tipo, p_ref_id, p_link)`** — `SECURITY
DEFINER`, insere uma linha por destinatário respeitando dedup e preferências.
- **Trigger** `AFTER INSERT ON tarefa_responsaveis` (e caminho equivalente do
  `responsavel_id` primário) chamando `notificar(...)` para `tarefa_atribuida`.
- **`gerar_notificacoes_ambient()`** — porta os blocos de `gerar_alertas_ambient()`
  (prazo/financeiro/marco) para o modelo por destinatário, adiciona
  `*_prazo_proximo` de projeto/disciplina e `cronograma_obra_atrasado`, e resolve
  destinatários por responsabilidade + papel. Reagendar o cron para chamar esta;
  `gerar_alertas_ambient()` fica deprecada (tabela `alertas` dormente, não deletar).
- Publication realtime: adicionar `notificacoes`.

Front:

- `src/hooks/useNotificacoes.ts` — no molde de `useAlertas.ts`, mas com
  destinatário implícito (RLS), assinatura Realtime (padrão `useAgentRuns.ts`),
  `useNotificacoes`, `useNotificacoesNaoLidas`, `useMarcarLida`, `useMarcarTodasLidas`.
  `useAlertas.ts` é substituído (não coexiste no front).
- `src/components/AlertsBell.tsx` — passa a consumir `useNotificacoes`; ganha
  `categoria`→ícone, `link`→navegação. (Renomear para `NotificationsBell` opcional.)
- `src/pages/notificacoes/index.tsx` — a central (lista + filtros).
- Preferências: aba/tela nova (em Configurações/Perfil) consumindo
  `notificacao_preferencias`.
- Navegação: item novo em `EMPRESA_ITEMS` (`src/lib/modules.ts`) apontando para
  `/notificacoes`; rota em `App.tsx`.
- `src/lib/notificacoes.ts` — funções puras testáveis: mapa
  categoria→ícone/rótulo, e o `link` por `referencia_tipo`/`referencia_id`.

## Plano de implementação

Aprovado antes de gerar código. Fases (cada uma verificável de ponta a ponta):

1. **Fundação de dados + evento de atribuição.** Migrations: `notificacoes`,
   `notificacao_preferencias`, RLS, índices, `notificar(...)`, trigger de
   `tarefa_responsaveis`, publication realtime. `gen:types:local`. Testes de RLS e
   de dedup. Entrega já verificável: atribuir tarefa gera notificação para o
   destinatário certo.
2. **Sino + central + realtime (front).** `useNotificacoes` com Realtime;
   `AlertsBell` lendo `notificacoes` com navegação por `link`; página
   `/notificacoes` com filtros; item de menu e rota. Testes das funções puras de
   `lib/notificacoes.ts`. Verificação no browser (`dev:local`) com dois usuários.
3. **Varreduras roteadas.** `gerar_notificacoes_ambient()` portando prazo/financeiro
   - `*_prazo_proximo` + cronograma de obra, com roteamento por responsabilidade e
     papel; reagendar o cron; deprecar `gerar_alertas_ambient()`. Testes cobrindo o
     roteamento (colaborador não recebe financeiro; responsável de disciplina recebe).
4. **Preferências.** Tela por categoria; roteamento passa a respeitar
   `notificacao_preferencias` (canal e-mail visível e desabilitado).
5. Gates: `npm run test:run`, `npm run typecheck`, `npm run lint`. Deploy por
   ambiente explícito (ADR 0007): migrations no local primeiro; `db:push:staging` e
   `gen:types` (staging) como passos posteriores.

Fase posterior (fora do v1): **e-mail** — digest diário e/ou por evento crítico,
reusando `_shared/email.ts` (Resend) e a coluna `email` de preferências.

## Decisões e riscos

- **Nova tabela por destinatário, não estender `alertas`** — ver ADR 0015. `alertas`
  fica dormente com dados históricos; o cron aponta só para o novo gerador.
- **Só quem tem conta recebe** (`pessoas.profile_id not null`). Pessoa cadastrada sem
  login não é notificada; correto para central in-app, documentado.
- **Preferência por categoria, não por objeto.** "Mutar esta tarefa específica" é
  granularidade que ninguém pediu e infla o modelo; categoria cobre a dor real.
- **Financeiro atrás de `can_view_financeiro()`.** Evita vazar margem/recebimento a
  coordenador/colaborador — mesmo critério de acesso já usado nas telas.
- **Risco — duplicação com a inbox de agentes.** O sino cobre eventos de domínio +
  varredura; a fila de revisão (`agent_runs`) cobre ações de agente pendentes de
  aprovação. São coisas distintas; não fundir para não misturar "aviso" com
  "aprovação".
- **Risco — volume/ruído.** Fan-out por destinatário pode gerar muitos itens.
  Mitigação: dedup por não lida, `expires_at`, e preferências por categoria já no v1.
