# SPEC: Migrar policies de `TO PUBLIC` para `TO authenticated`

**Data:** 2026-08-19
**Status:** Draft
**Autor:** —
**Módulo:** banco (transversal, toda tabela com RLS no schema `public`)

## Problema

Hoje **todas as ~180 policies do schema `public` são `TO PUBLIC`**, não `TO authenticated`
(confirmado por consulta direta ao catálogo em produção e staging, 2026-08-19). Isso
tem duas consequências que hoje são compensadas por gambiarra em vez de resolvidas
na raiz:

1. **Postgres avalia a expressão de policy para `anon` também**, não só para
   `authenticated`. Toda policy que chama `get_user_empresa_id()`,
   `user_has_feature()`, `has_role()` etc. precisa que essas funções sejam
   executáveis por `anon`, senão consulta anônima em qualquer tabela vira erro de
   permissão (500 no PostgREST) em vez de lista vazia. É por isso que existem 15
   funções `SECURITY DEFINER` com `EXECUTE` concedido a `anon` hoje (ver
   `supabase/tests/anon_function_grants.sql`), incluindo helpers que não têm
   nenhum motivo de negócio para responder a quem não autenticou.
2. **Postgres precisa considerar a policy `TO PUBLIC` mesmo quando quem consulta é
   `authenticated`**, porque `PUBLIC` inclui todo mundo. Isso é parte do que
   produz os 22 casos de `auth_rls_initplan` (chamada de `auth.uid()`/`auth.jwt()`
   sem subselect avaliada por linha) que o advisor de performance aponta: o
   planner tem menos margem pra otimizar quando a policy não está escopada ao
   role que de fato importa.

A migration `20260849000000` já fechou o hardening seguro de grants em tabela
sem policy e de `search_path`, e documentou explicitamente que **não** mexeu
nisso, porque é passe maior que merece spec própria. Esta é essa spec.

## Objetivo

Toda policy do schema `public` que hoje é `TO PUBLIC` passa a ser
`TO authenticated`, exceto as que têm motivo de negócio real para responder a
`anon` (nenhuma identificada até agora: os fluxos que precisam de acesso
pré-sessão — portal, campo, convite — usam RPC `SECURITY DEFINER` dedicada, não
policy de tabela). Como consequência mensurável:

- O grant de `EXECUTE` a `anon` nos 15 helpers de RLS deixa de ser necessário
  (Postgres não avalia policy `TO authenticated` para `anon`) e pode ser
  revogado.
- `anon` chamando qualquer endpoint PostgREST direto (sem passar pela RPC
  dedicada) recebe `permission denied` de tabela, não resposta vazia — mais
  explícito e mais barato de auditar do que hoje.
- Base pronta pra fechar (num passe futuro, fora do escopo desta spec) os 22
  casos de `auth_rls_initplan`, porque com a policy escopada a
  `authenticated` fica mais simples confirmar cada `(select auth.uid())`
  isoladamente sem o ruído do caminho `anon`.

**Fora de escopo:**

- Trocar `auth.uid()` direto por `(select auth.uid())` nas policies (é a
  correção dos 22 casos de `auth_rls_initplan`, spec própria depois desta).
- Consolidar as ~189 ocorrências de `multiple_permissive_policies`.
- Mexer nas 27 funções de trigger com grant a `anon` (inertes, dívida de
  prioridade baixa registrada na baseline de `scripts/audit-security.mjs`).
- Qualquer mudança de comportamento visível ao usuário. Este passe é
  invisível por design: usuário autenticado continua vendo exatamente o
  mesmo dado.

## Requisitos

1. Toda policy `TO PUBLIC` de tabela com RLS habilitada no schema `public` é
   recriada como `TO authenticated`, preservando a expressão `USING`/`WITH
CHECK` exatamente como está.
2. As 3 tabelas de `pilar_subscription_plans` (`plans_public_read`) e
   qualquer outra policy que hoje é `TO PUBLIC` **de propósito** (leitura de
   dado genuinamente público, sem sessão) ficam de fora da migração e entram
   numa allowlist explícita, com o motivo documentado por linha — mesmo
   padrão de allowlist já usado em `supabase/tests/anon_function_grants.sql`.
3. Depois da migração das policies, revogar `EXECUTE` de `anon` nos 15
   helpers de RLS listados em `scripts/audit-security.mjs` e em
   `supabase/tests/anon_function_grants.sql`, e remover ambas as entradas
   dessas allowlists.
4. Atualizar `scripts/audit-security-baseline.json`: `anon_chamavel`
   continua invariante em 0 (agora por não precisar mais do grant, não por
   allowlist), e adicionar um novo check `policy_to_public_nao_revisada`
   (invariante 0) espelhando a allowlist do requisito 2.
5. `supabase/tests/anon_function_grants.sql` perde as 15 entradas de helper
   da allowlist (a lista de motivo por que cada uma precisava estar lá deixa
   de fazer sentido) e ganha um teste novo equivalente ao do requisito 4,
   pra travar contra regressão (policy nova nascendo `TO PUBLIC` sem entrar
   na allowlist).

Requisitos não-funcionais:

- **Segurança / RLS:** é uma migração de RLS em ~180 policies de ~90
  tabelas. Cada `ALTER POLICY ... TO authenticated` é reversível
  isoladamente (basta reverter pra `TO PUBLIC`), mas o volume pede rollout
  em staging com o teste completo de RLS + E2E autenticado rodando antes de
  ir pra produção, não só o pgTAP.
- **Compatibilidade:** nenhum client (app, portal, campo) faz consulta
  PostgREST direta como `anon` hoje fora dos fluxos já cobertos por RPC
  dedicada — confirmar isso é o primeiro passo do plano abaixo, antes de
  escrever a migration, porque se existir algum eu não encontrei ainda.
- **Multi-tenant:** sem mudança de comportamento para usuário autenticado;
  isolamento por `empresa_id` continua exatamente como está, só muda o role
  a que a policy responde.

## Critérios de aceite

- [ ] Dado um usuário autenticado normal, quando ele acessa qualquer tela do
      app hoje coberta por E2E, então o comportamento é idêntico ao de antes
      da migração (specs autenticadas do Playwright passam sem alteração).
- [ ] Dado o role `anon`, quando ele faz `SELECT` direto via PostgREST numa
      tabela que não está na allowlist de público, então recebe
      `permission denied for table X` (não mais um resultado vazio
      silencioso).
- [ ] Dado o role `anon`, quando ele chama uma RPC de fluxo pré-sessão
      (`portal_login`, `campo_login`, `guard_login_attempt`, etc.), então
      continua funcionando exatamente como hoje, porque RPC `SECURITY
    DEFINER` não depende de policy de tabela.
- [ ] Dado o script `scripts/audit-security.mjs`, quando rodado em staging
      pós-migração, então `anon_chamavel` continua 0 e nenhum outro check
      piora.
- [ ] Caso de borda: dado `pilar_subscription_plans` (leitura pública real,
      usada pela página `/planos` do marketing sem sessão), quando a
      migração roda, então essa policy específica permanece `TO PUBLIC` e
      está listada explicitamente na allowlist do requisito 2, não
      esquecida por engano dentro do escopo geral.
- [ ] Caso de borda: dado que alguém tente criar uma policy nova `TO PUBLIC`
      fora da allowlist depois desta spec entregue, então o teste pgTAP do
      requisito 5 falha no CI.

## Dados e contratos

- Nenhuma tabela ou coluna nova. Só `ALTER POLICY` em policies existentes
  (troca de `TO PUBLIC` para `TO authenticated`) e `REVOKE EXECUTE` nas 15
  funções auxiliares.
- Sem mudança de assinatura de RPC nem de shape de retorno.
- `npm run gen:types` não deveria gerar diff (RLS não aparece em `types.ts`),
  mas rodar mesmo assim por hábito do gate de sincronia.

## Plano de implementação

Preenchido junto com o agente (plan mode) e aprovado antes de gerar código.

1. Levantar a lista completa das ~180 policies `TO PUBLIC` por consulta ao
   catálogo (`pg_policy.polroles = '{0}'`), gerando o `ALTER POLICY` de cada
   uma programaticamente a partir do nome e da tabela, para não transcrever
   180 comandos à mão.
2. Confirmar, por grep em `src/` e `supabase/functions/`, que nenhum client
   faz `fetch`/`supabase-js` com a chave anônima direto contra uma tabela
   fora dos fluxos já cobertos por RPC dedicada. `apps/marketing` já é
   suspeito conhecido (lê `pilar_subscription_plans` direto): confirmar que
   é a única exceção real.
3. Migration única com todos os `ALTER POLICY ... TO authenticated`, mais o
   `REVOKE EXECUTE` das 15 funções, mais os comentários de tabela/função
   registrando a mudança — seguindo o formato de
   `20260849000000_hardening_grants_e_search_path.sql`.
4. Atualizar as duas allowlists (script e teste pgTAP) removendo os 15
   helpers e adicionando a allowlist de policy pública legítima.
5. Rodar em staging: suíte pgTAP completa, `scripts/audit-security.mjs
staging`, E2E autenticado completo, e um teste manual do fluxo de
   `/planos` sem sessão (marketing) pra confirmar que a única policy
   deixada pública ainda funciona.
6. Só promover pra produção depois do staging rodando limpo por pelo menos
   um dia normal de uso (não só a suíte de teste), dado o volume de
   policies tocadas.

## Decisões e riscos

- **Risco principal:** eu assumi, sem ter verificado exaustivamente, que
  nenhum client faz consulta PostgREST direta como `anon` fora dos fluxos
  de RPC dedicada, exceto `apps/marketing` lendo `pilar_subscription_plans`.
  O passo 2 do plano existe justamente para não deixar essa suposição
  furar em produção. Se aparecer outro caso, ele entra na allowlist do
  requisito 2 em vez de virar exceção não documentada.
- **Decisão de arquitetura:** isto não muda o modelo de tenancy nem o de
  RLS (ADR 0001), só o role a que a policy responde. Não abre ADR novo por
  esse motivo, mas se o levantamento do passo 1 encontrar padrão
  inesperado (por exemplo, policy `TO PUBLIC` com expressão diferente do
  padrão `empresa_id = get_user_empresa_id()`), isso pode virar achado que
  merece ADR à parte antes de prosseguir.
- **Por que não é enfileirada com a migration de hardening anterior:** o
  volume (180 policies) e a superfície (toda tabela do produto) tornam
  qualquer erro de digitação num nome de policy um incidente de
  disponibilidade, não de segurança. Merece PR isolado, review próprio, e
  o rollout escalonado do passo 6, em vez de ir junto com uma migration de
  seis linhas de revogação de grant.
