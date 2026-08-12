# SPEC 031: Modelo de role unificado (Frente 1 da análise 028)

**Data:** 2026-08-12
**Status:** Em implementação (código local pronto; migration SÓ LOCAL, deploy pendente)
**Autor:** Matheus
**Módulo:** administração / permissões (transversal)

> **Implementado 12/08 (desvios conscientes vs este rascunho):**
>
> - Presets NÃO viraram `accessPresets.ts` + RPC. Reusei o padrão de atalho que
>   já existia em `FeatureAccessGrid` (Comercial/Operação/Financeiro): adicionei
>   **Perfil Coordenador** e **Perfil Colaborador** (só mexem em features, role
>   segue Usuário). **Dono = tipo de conta Admin**, que o `UsersAccessManager`
>   já oferece. Menos superfície, zero RPC nova.
> - `/gestao/metas` também virou `AdminOnlyRoute` (não só `FeatureRoute`), pra
>   preservar o caráter admin-only que o item já tem em `modules.ts`.
> - Achado extra corrigido: o gate de revisão IA no chat
>   (`podeRevisar`) estava **aberto a todos** (checava role de contrato que
>   ninguém tem). Passou a exigir admin/ultra_admin.
> - `can_view_folha()` passou a exigir `financeiro` em nível **editor** (não
>   viewer) — folha é o dado mais sensível; assim a troca de gate por feature não
>   amplia quem vê salário.
> - Removidos como órfãos: `RequireRole.tsx`, `rbac.ts`, `rbac.test.ts`,
>   `useRole.ts`. Migration `20260818000000_role_model_unify_helpers.sql`.
> - Verificação: typecheck limpo; 493 testes passam (1 falha alheia em
>   `notificacoes.test.ts`, spec 029); lint dos arquivos tocados sem erro novo.
> - PENDENTE: aplicar migration no local (`dev:local`), verificar no browser
>   (login como user com/sem financeiro e como admin), depois `db:push:staging`.

> Pré-requisito das telas de admin (spec 028, §2 e §7.1). Enquanto dois modelos
> de role convivem, qualquer UI de gestão de acesso nasce em cima de uma base
> ambígua. Esta spec fecha a ambiguidade primeiro.

## Decisão a confirmar (topo, porque muda tudo abaixo)

Adotado o **Modelo A** da análise 028: a **conta** (`user` / `admin` /
`ultra_admin`) é a única autoridade; `owner` / `coordenador` / `colaborador`
deixam de ser papéis de gate e viram **presets de acesso** (templates de role +
`profiles.features`) aplicados por um clique na UI.

Se você preferir o Modelo B (adotar owner/coord/colab como autoridade real),
pare aqui: a spec muda de escopo (reescrita de `invite-user`,
`update_user_access`, `canDo`, Admin Portal). O Modelo A foi escolhido por ser
aditivo, preservar a granularidade por módulo que já existe, e eliminar a
divergência front/back com mudança pequena.

## Problema

Hoje o enum `user_role` carrega duas gerações misturadas. A UI só concede
`user`/`admin`, mas rotas e helpers de RLS gatilham em `owner`/`coordenador`/
`colaborador` que **nenhuma tela atribui**. Resultado concreto no código:

- `/financeiro`, `/equipe`, `/metas` exigem `RequireRole roles={["owner"]}`
  (`src/App.tsx:148,174,184`), mas ninguém vira `owner`; só não quebra porque
  `RequireRole` deixa roles legados passarem (`src/components/RequireRole.tsx:28`).
- `canDo()` (`src/lib/permissions.ts:60`) não dá bypass a `owner`; a RLS
  `user_has_feature` dá (`...rls_role_helpers.sql:116`). Front e banco discordam
  sobre quem vê o quê.
- `can_view_financeiro()`/`can_view_folha()` decidem por role de contrato
  (`...rls_role_helpers.sql:153,167`), inconsistente com o resto do financeiro
  que decide por feature (`user_has_feature('financeiro')`).
- `src/constants/index.ts` ainda lista roles extintos (`financeiro`,
  `marketing`, `operacional`).

## Objetivo

Um único eixo de autoridade (`user`/`admin`/`ultra_admin`), com owner/coord/colab
rebaixados a presets de UI, sem que nenhum usuário atual perca ou ganhe acesso
indevidamente. Depois desta spec, gate de rota e RLS concordam, e o admin da
empresa configura acesso por presets legíveis ("Coordenador") ou fino (grid).

**Fora de escopo:**

- Remover os valores `owner`/`coordenador`/`colaborador` do enum PG (remoção de
  valor de enum é custosa e desnecessária; ficam deprecados-em-lugar).
- Telas novas de admin (specs 028 §7.2+). Aqui só a base de role.
- Amarrar plano → features (spec futura).

## Requisitos

Funcionais:

1. As rotas `/financeiro`, `/equipe`, `/metas` deixam de usar
   `RequireRole roles={["owner"]}`. `/financeiro` e `/metas` ficam só com
   `FeatureRoute` (que já as envolve). `/equipe` (Pessoas = RH com salário) passa
   a ser admin-only via `AdminOnlyRoute` (coerente com `pessoas` ser `adminOnly`
   em `src/lib/modules.ts:71`).
2. O Admin Portal › Usuários ganha **presets de acesso** no editor de usuário:
   **Dono**, **Coordenador**, **Colaborador**, **Personalizado**. Cada preset
   preenche role + grid de features via a RPC já existente `update_user_access`:
   - Dono → `role = 'admin'` (acesso total; grid desabilitado).
   - Coordenador → `role = 'user'` + features sem `financeiro`/`folha`.
   - Colaborador → `role = 'user'` + features sem nenhum dado de dinheiro.
   - Personalizado → mantém role atual, admin edita o grid livremente.
3. Presets NÃO chamam `set_access_profile` (que grava role de contrato). São
   templates de front que resolvem para `{role, features}` e reusam
   `update_user_access`.
4. `can_view_financeiro()` e `can_view_folha()` passam a decidir por feature
   (`user_has_feature('financeiro', ...)`), com bypass de `admin`/`ultra_admin`,
   não por role de contrato. O mascaramento de salário/CPF/PIX em `pessoas_safe`
   segue o mesmo critério.
5. Backfill de segurança: qualquer `profiles.role` residual em `owner` →
   `admin`; `coordenador`/`colaborador` → `user` preservando as `features` atuais
   (não regride acesso de quem por acaso já tenha um desses).
6. `src/constants/index.ts` deixa de listar roles extintos; fonte de rótulos
   passa a ser `ROLE_LABEL` (`src/lib/permissions.ts:14`).

Não-funcionais:

- **Segurança / RLS:** a barreira real continua sendo `user_has_feature` nas
  tabelas financeiras (`receitas`, `despesas`, `contas`, `cartoes`,
  `folha_pagamento`, `faturas`, etc). A migration só reconcilia os dois helpers
  de mascaramento; não afrouxa nenhuma policy. Rodar `rls-auditor` no diff.
- **Multi-tenant:** `update_user_access` mantém escopo por empresa do caller
  (ultra_admin cruza); presets não alteram esse escopo.
- **Compat:** mudança aditiva; usuários `user`/`admin`/`ultra_admin` existentes
  não mudam de acesso (verificar via os critérios abaixo).

## Critérios de aceite

- [ ] Dado um `user` sem `financeiro` em `profiles.features`, quando abre
      `/financeiro`, então é redirecionado (FeatureRoute) e o item some/desabilita
      na sidebar, e uma query direta às tabelas financeiras retorna vazio (RLS).
- [ ] Dado um `admin`, quando abre `/financeiro` e `/equipe`, então acessa
      normalmente (comportamento inalterado vs hoje).
- [ ] Dado o admin aplicando o preset **Coordenador** a um usuário, quando salva,
      então `role='user'`, `profiles.features` sem `financeiro`/`folha`, e esse
      usuário perde o financeiro em sidebar, rota e RLS.
- [ ] Dado o admin aplicando **Dono**, quando salva, então `role='admin'` e o
      usuário passa a ter acesso total na empresa.
- [ ] Dado um não-admin (sem feature financeiro), quando lê `pessoas_safe`, então
      salário/CPF/PIX vêm mascarados (`can_view_folha` feature-based).
- [ ] Nenhuma rota em `src/App.tsx` usa `RequireRole` com role de contrato
      (grep vazio) e `/equipe` está sob `AdminOnlyRoute`.
- [ ] Caso de borda: usuário residual com `role='owner'`, após a migration, tem
      `role='admin'` e mantém acesso; com `coordenador`/`colaborador` → `user`
      com as features preservadas.
- [ ] Suite de testes de permissões (`permissions`/`rbac`) verde após ajustes.

## Dados e contratos

- **Migration (LOCAL primeiro, ADR 0007):**
  - Reescreve `can_view_financeiro()` e `can_view_folha()` para feature-based
    (`user_has_feature('financeiro', 'viewer')` + bypass admin/ultra). DROP +
    CREATE explícito (overloads silenciosos, ver memória do toolchain).
  - Backfill: `UPDATE profiles SET role='admin' WHERE role='owner'`;
    `role='user' WHERE role IN ('coordenador','colaborador')`.
  - Auditar e, se dead, simplificar o branch `owner` de `user_has_feature`
    (`...rls_role_helpers.sql:116`) — só depois de confirmar que nada mais
    depende dele.
  - `set_access_profile` fica deprecada (sem consumidor de UI); manter a função
    por ora, marcar como não usada.
- **RPC reusada:** `update_user_access(p_user_id, p_role, p_features)` — nenhuma
  assinatura nova.
- **Front:** novo `src/lib/accessPresets.ts` exportando `ACCESS_PRESETS`
  (`dono`/`coordenador`/`colaborador` → `{ role, features }`), consumido por
  `FeatureAccessGrid`/`UsersAccessManager`. Presets interseccionam com as
  features ligadas na empresa antes de gravar (evita `tg_validate_profile_features`).
- Após migration: `npm run gen:types:local` e, no fechamento, `gen:types`
  (staging) — o gate de CI de types-sync bloqueia PR fora de sync.

## Plano de implementação

Preenchido em plan mode antes de codar. Rascunho:

1. Migration local: helpers feature-based + backfill de roles residuais.
2. Auditar consumidores de `can_view_financeiro`/`can_view_folha` e do branch
   `owner`; reconciliar.
3. Front: remover os 3 `RequireRole owner`; `/equipe` → `AdminOnlyRoute`;
   remover/depreciar `RequireRole` e `rbac.ts` se ficarem órfãos.
4. `accessPresets.ts` + botões de preset no editor de usuário.
5. Limpar `src/constants/index.ts`; atualizar comentários de `ROLE_LABEL`.
6. Testes: cenários de aceite; rodar `typecheck`, `test:run`, `lint`,
   `rls-auditor` no diff da migration.
7. `gen:types`, verificar em browser (login como user/coordenador/admin).

## Decisões e riscos

- **Decisão transversal (vira ADR):** unificar autoridade de role. Abrir ADR
  curto (context: dois modelos; decision: conta + presets; consequences: owner/
  coord/colab deprecados-em-lugar, presets no front). Linkar aqui.
- **Risco:** algum consumidor de `can_view_financeiro`/`owner` que a auditoria
  não pegue afrouxar acesso. Mitigação: `rls-auditor` + teste explícito de
  mascaramento de folha.
- **Suposição (verificar no Gate 0):** nenhum usuário em produção/staging tem
  role `owner`/`coordenador`/`colaborador` hoje. Rodar `SELECT role, count(*)
FROM profiles GROUP BY role` nos dois ambientes antes da migration; se houver,
  o backfill vira migração de dados consciente, não só rede de segurança.
