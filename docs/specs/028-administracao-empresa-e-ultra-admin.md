# 028 — Administração: Admin da Empresa e Ultra Admin

Status: Draft (análise + plano, ainda não codado)
Data: 2026-08-12
Dono: Matheus

> Análise de fundo antes de abrir specs de execução. O objetivo é organizar as
> duas camadas de administração do Pilar: o **admin da empresa** (dono/gestor
> do tenant) e o **ultra admin** (você, dono da plataforma). Cada bloco de
> execução vira uma spec própria depois.

---

## 0. TL;DR

A maior parte do que você descreveu **já existe no banco e nas RPCs**. O que
falta é UI, consolidação e resolver uma inconsistência estrutural. Concretamente:

- **Ligar/desligar módulo por empresa** (obras que a empresa não quer): já
  funciona. Estado em `empresas.features` (JSONB), editado por
  `update_company_features` (só admin/ultra_admin), e o módulo some da sidebar e
  das rotas. Obras é o caso-modelo.
- **Usuário vê financeiro, outro não**: já funciona. Nível por usuário em
  `profiles.features` (`viewer`/`editor`/ausente), editado no Admin Portal ›
  Usuários, com RLS em todas as tabelas financeiras via `user_has_feature`.
- **Ver logs / o que cada um faz / erros**: os dados já são gravados
  (`admin_audit_logs` cross-tenant, `audit_logs` de mutação, `agent_runs`,
  `ai_usage_logs`, `impersonation_sessions`), mas **nenhuma tela os mostra**.
  Erros de runtime vivem no Sentry (front+edge, ligado via secret), não no banco.

O trabalho real são três frentes:

1. **Resolver o modelo duplo de roles** (bug estrutural que hoje gera divergência
   front/back). Pré-requisito de tudo.
2. **Reorganizar o Admin da Empresa** numa base coerente (contas, acessos,
   módulos, auditoria da própria empresa).
3. **Construir o Ultra Admin de verdade** (dashboard + empresas + usuários +
   atividade/logs + saúde/erros), consumindo tabelas que já existem.

---

## 1. Como o acesso funciona hoje (o modelo mental correto)

Existem **três eixos independentes** de controle de acesso. Confundi-los é a
origem de metade da bagunça atual.

### Eixo A — Módulo ligado por empresa (tenant)

- **Onde**: `empresas.features` JSONB `{ feature_key: boolean }`.
- **Quem edita**: admin ou ultra_admin, via RPC `update_company_features`
  (sanitiza contra o catálogo `_feature_catalog()`).
- **Efeito**: se a feature não é `core` e está `false`, `canDo()` retorna false →
  módulo some do switcher da sidebar e as rotas redirecionam (`FeatureRoute`).
- **Catálogo canônico** vive em DOIS lugares que precisam ficar em sincronia:
  `src/lib/features.ts` (front) e a função SQL `_feature_catalog()` (banco).
  Feature nova sem entrada nos dois é rejeitada na escrita.
- **Flag `dormant`**: módulos como Timesheet, IA Hub, Capacidade, Templates têm
  `dormant: true` → o toggle fica **travado em OFF**, ninguém liga. É assim que
  os dormentes ficam escondidos (não é rota comentada).
- **Obras**: `core: false`, `includedInPlans: []`, NÃO dormant → o admin
  consegue ligar/desligar livremente. É exatamente o comportamento que você quer.

### Eixo B — Nível de acesso por usuário (dentro do módulo ligado)

- **Onde**: `profiles.features` JSONB `{ feature_key: "viewer" | "editor" }`
  (ausência = sem acesso).
- **Quem edita**: admin/ultra_admin, via RPC `update_user_access`, na tela Admin
  Portal › Usuários › `FeatureAccessGrid` (grid Sem acesso / Viewer / Editor por
  módulo).
- **Efeito**: só vale para `role = user`. A RLS de cada tabela chama
  `user_has_feature('financeiro', 'viewer'|'editor')` — barreira real no banco,
  não só na UI.
- **É aqui que mora o "esse usuário vê financeiro, esse não"**. Já resolvido.

### Eixo C — Papel global (autoridade)

- **Onde**: `profiles.role` (enum `user_role`).
- **Valores em uso pela UI**: `user` (granular via Eixo B), `admin` (bypass
  dentro da empresa), `ultra_admin` (bypass total, cross-empresa; concedido
  **só via SQL**, nenhuma UI promove).

**Resumindo a sua pergunta do financeiro**: não precisa inventar nada. Um
usuário `user` com `profiles.features.financeiro` ausente não vê financeiro em
lugar nenhum (sidebar, rota, e RLS bloqueia a query). Um `user` com
`financeiro: "viewer"` vê mas não edita. O dono/admin vê tudo. Isso hoje se
configura no Admin Portal › Usuários.

---

## 2. O problema estrutural nº 1: dois modelos de role convivendo

Este é o item que precisa ser decidido **antes** de qualquer tela nova, porque
toda a UI de gestão de acesso depende dele.

O enum `user_role` tem duas gerações misturadas:

| Modelo         | Valores                               | Quem usa                                                 | Quem concede                                          |
| -------------- | ------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| Conta (atual)  | `user`, `admin`, `ultra_admin`        | toda a UI de gestão, `canDo()`                           | Admin Portal / SQL                                    |
| Contrato (ICP) | `owner`, `coordenador`, `colaborador` | algumas **rotas** (`RequireRole owner`) e helpers de RLS | **ninguém** (só `set_access_profile` via SQL, sem UI) |

Consequências reais medidas no código:

- As rotas `/financeiro`, `/metas`, `/equipe` exigem `RequireRole owner`, mas
  nenhuma UI concede `owner`. Só não quebram porque `RequireRole` deixa roles
  legados (`user`/`admin`/`ultra_admin`) passarem direto.
- `canDo()` (front) **não** dá bypass a `owner`; o `user_has_feature` (RLS) dá.
  Um `owner` com `features={}` passaria na RLS mas seria barrado pela sidebar/rota.
- `admin` tem bypass no front mas cai na regra granular na RLS (funciona só
  porque `update_user_access` zera as features do admin).
- `src/constants/index.ts` ainda lista roles extintos (`financeiro`, `marketing`,
  `operacional`).

### Recomendação (decisão sua)

**Colapsar para UM modelo: conta (`user`/`admin`/`ultra_admin`) como autoridade,
e `owner`/`coordenador`/`colaborador` como PRESETS de `profiles.features`, não
como roles de gate.**

Por quê:

- Os presets de contrato (owner = tudo, coordenador = sem financeiro/folha,
  colaborador = sem dinheiro) são exatamente o que o ICP entende, mas eles
  descrevem **conjuntos de features**, não uma nova dimensão de autoridade. A RPC
  `set_access_profile` já aplica esses presets — falta só um botão na UI.
- Elimina a divergência front/back: troca os `RequireRole owner` das rotas por
  `FeatureRoute feature="financeiro"` (que já é a verdade da RLS).
- Mantém a linguagem do ICP na tela ("aplicar perfil Coordenador") sem carregar
  duas máquinas de estado.

Alternativa: adotar owner/coord/colab de verdade em toda a UI e aposentar
user/admin. É mais "limpo" no papel, mas obriga a reescrever `invite-user`,
`update_user_access`, `canDo` e o Admin Portal inteiro, e ainda perde a
granularidade por módulo que já existe. Não recomendo.

---

## 3. Admin da Empresa — organização proposta

Hoje o Admin Portal (`/admin`, gated por `admin_portal` + MFA/AAL2) tem abas
Usuários e Features. A base é boa; falta acabamento e uma terceira aba.

### 3.1 Aba "Equipe & acessos" (evolui a atual Usuários)

Uma tabela de contas da empresa com, por linha: avatar/nome/email, tipo de conta
(Usuário/Admin), status (ativo/convite pendente), último acesso, e ação.

Ao editar um usuário:

- Seletor de tipo de conta: **Usuário** (mostra o grid granular) ou **Admin da
  empresa** (acesso total, grid desabilitado). ultra_admin aparece como
  "Protegido".
- **Atalhos de perfil** (os presets de contrato como um clique): "Dono",
  "Coordenador (sem financeiro/folha)", "Colaborador (sem dinheiro)",
  "Personalizado". Preenchem o grid; o admin ajusta fino depois.
- Grid `FeatureAccessGrid` por módulo (Sem acesso / Ver / Editar), mostrando só
  os módulos que a empresa tem ligados.
- Convidar, reenviar, cancelar convite, remover (não pode remover a si mesmo).

Isso resolve seu caso do financeiro de forma legível: o admin escolhe
"Coordenador" e o financeiro já sai desligado, ou marca módulo a módulo.

### 3.2 Aba "Módulos" (evolui a atual Features)

Cartões de módulo (Comercial, Financeiro, Projetos, Obras, ...) com toggle
liga/desliga por empresa. Cada cartão: nome, o que é, quem é afetado, e badge
de plano (Incluso / Add-on) quando o Eixo plano estiver ligado (ver §6).

- Módulos `dormant` aparecem como "Em breve", travados.
- Guard: desligar um módulo em uso deveria avisar quantos usuários/telas serão
  afetados (hoje o toggle é seco).
- É aqui que a empresa desliga Obras. O admin reativa no mesmo lugar.

### 3.3 Aba "Atividade" (nova — auditoria da própria empresa)

Feed lendo `audit_logs` (mutações: quem criou/editou/apagou o quê, com diff) +
`admin_audit_logs` filtrado pela empresa (convites, mudança de acesso). Filtro
por usuário, ação e período. Dá ao dono a sensação de controle sem precisar de
você. RLS já garante que o admin só vê a própria empresa.

---

## 4. Ultra Admin — organização proposta

Hoje é uma página só, centrada em empresas. A proposta é virar um portal com
navegação própria (abas ou sub-rotas sob `/ultra-admin`), aproveitando que
`ultra_admin` já tem bypass de RLS e as tabelas já existem.

### 4.1 Dashboard (novo — a home do ultra admin)

Visão da plataforma inteira, não de uma empresa:

- KPIs: nº de empresas (ativas/suspensas/canceladas), nº de usuários, novas
  empresas no período, empresas sem login recente (churn iminente).
- Consumo de IA por período (`ai_usage_logs`: tokens in/out, custo estimado),
  ranking de empresas por uso.
- Saúde: status do `/health` (db/asaas/resend) + link pro Sentry.
- Feed recente de atividade administrativa (`admin_audit_logs`).

### 4.2 Empresas (evolui a lista atual)

Mantém a tabela + criar/editar/arquivar empresa e o toggle de features
cross-empresa. Adicionar: coluna de plano, último acesso, uso de IA, e um botão
"entrar como" (impersonation, que já existe: `impersonation_sessions` +
`log-impersonation` + `ImpersonationContext`).

### 4.3 Usuários (separar da empresa — o que você pediu)

Uma visão de **usuários cross-empresa** (hoje a gestão de usuário só existe
aninhada dentro do detalhe da empresa). Tabela global: nome, email, empresa,
role, status, último acesso. Ações: revogar acesso, remover usuário, reenviar
convite, promover a admin da empresa. A edge `ultra-admin-usuarios` já faz
PUT/DELETE/POST cross-empresa; falta a tela dedicada.

### 4.4 Atividade & Logs (novo — "ver o que cada um está fazendo")

- **Auditoria administrativa** cross-tenant: `admin_audit_logs` (ultra_admin já
  lê tudo). Quem criou empresa, mudou acesso, impersonou, mexeu em billing.
- **Atividade de IA**: `agent_runs` + `agent_actions` (realtime já habilitado) —
  o que a IA de cada empresa executou, confiança, tokens, e **falhas**
  (`status='failed'` + coluna `error`). Este é o mais próximo de "ver bugs" que
  vive no banco.
- **Impersonation**: `impersonation_sessions` — quem entrou como quem, quando.

### 4.5 Erros & Saúde (novo — "erros, bugs")

Importante ser honesto sobre onde o dado mora:

- **Erros de runtime (front + edge) estão no Sentry, não no banco.** Não há
  tabela SQL de exceções. O caminho certo é **embutir/linkar o Sentry** (dá pra
  puxar via MCP/Sentry API os issues por release/empresa, já que
  `monitoring.setUser` anexa `empresa_id` e `role` a cada evento). Reinventar
  isso no banco seria retrabalho.
- **Saúde**: `/functions/v1/health` (público) + Checkly já configurado. O
  dashboard mostra o último status e histórico.
- **Falhas de IA e webhooks** (`agent_runs.error`, `asaas_webhook_logs`,
  `pilar_checkout_webhook_logs`) esses sim são consultáveis por SQL e cabem num
  painel de "o que quebrou".

---

## 5. Sobre "liberar tudo agora, sem distinção de módulos"

O mecanismo de gate por módulo já existe e custa zero manter ligado. Não vale a
pena removê-lo para "liberar tudo" e depois reconstruí-lo quando você quiser
cobrar por módulo/plano. Recomendação:

- **Default de empresa nova = tudo ligado, exceto os `dormant`.** Ajusta-se o
  backfill/seed de `empresas.features` para vir com Comercial, Financeiro,
  Projetos e (opcionalmente) Obras em `true`.
- A empresa desliga o que não quer (Obras) na aba Módulos; o admin dela reativa
  no mesmo lugar. Exatamente o seu fluxo.
- Quando você quiser amarrar features a plano (Starter/Pro/Enterprise), o
  esqueleto já existe (`planFeatures.ts`, `pilar_subscription_plans.features`) —
  é só ligar `planIncludesFeature` no `canDo`. Fica pra depois (§6).

Ou seja: "liberar tudo" vira uma decisão de **default**, não de arquitetura.

---

## 6. Fora de escopo agora (registrar e adiar)

- **Plano → features amarrado ao gate** (`planFeatures` no `canDo`). Hoje plano é
  só rótulo/billing. Ligar quando houver decisão de pricing por módulo.
- **Deletar acesso a funcionalidades granular além do que já existe** (você
  mesmo disse "fica pra depois").
- **Billing consolidado no ultra admin** (MRR, inadimplência via Asaas).

---

## 7. Sequência sugerida (cada item = uma spec)

1. **Unificar o modelo de role** (§2). Migration + ajuste de `canDo`/rotas +
   presets na UI. Pré-requisito, sem tela nova vistosa mas destrava o resto.
2. **Admin da Empresa: Equipe & acessos + Módulos** (§3.1, §3.2). Acabamento do
   que já existe + presets de perfil.
3. **Ultra Admin: Dashboard + Usuários cross-empresa** (§4.1, §4.3).
4. **Atividade & Logs** (empresa §3.3 e ultra §4.4) — reusa o mesmo componente
   de feed sobre `audit_logs`/`admin_audit_logs`.
5. **Erros & Saúde** (§4.5) — integração Sentry + painel de falhas SQL.

---

## 8. Decisões que preciso de você

1. **Modelo de role** (§2): colapsar para conta + presets (recomendado) ou adotar
   owner/coord/colab pra valer?
2. **Default de módulos** (§5): empresa nova nasce com tudo ligado exceto
   dormentes? Obras entra ligado ou desligado por padrão?
3. **Erros no ultra admin** (§4.5): integrar Sentry (recomendado) ou você quer
   também persistir erros numa tabela própria pra consultar por SQL?
4. **Formato de entrega**: abas dentro de `/ultra-admin` e `/admin`, ou
   sub-rotas? (recomendo abas para o admin da empresa, sub-rotas para o ultra
   admin que vai crescer).
