# SPEC: Controle de features por módulo e em massa (portal ultra admin)

**Data:** 2026-08-13  
**Status:** Em implementação  
**Autor:** Matheus  
**Módulo:** plataforma / ultra-admin

> **Entrega no PR #203, em 2 commits.** Commit 1: reagrupamento por módulo +
> sub-features de Obra + gate com herança pai→filho + dropdown no
> `CompanyFeatureToggles` + migration do catálogo + testes (fases 1–5, req. 1–5).
> Commit 2: aba "Funcionalidades" com ação em massa (`BulkFeatureManager`) +
> backend `PUT ?action=bulk-feature` na edge function + audit (req. 6–9). O
> preview de contagem é feito no cliente a partir da lista de empresas (que já
> traz `features`), sem endpoint de preview.

## Problema

O portal ultra admin ("Gestão Pilar", `/ultra-admin`) ainda organiza as features
da empresa pelas categorias antigas do enum visual `FeatureGroup`
(Comercial / Visão / Operação / ...), que não correspondem aos 3 módulos em que
o produto foi de fato dividido: **Gestão, Projetos, Obras** (`src/lib/modules.ts`).
Três lacunas hoje:

1. **Desalinhamento visual:** o admin liga features numa taxonomia (grupos) que
   não é a que o usuário final vê (módulos + switcher da sidebar).
2. **Sem granularidade dentro do módulo:** todas as telas de Obra (Obras,
   Fornecedores, Clima) e todas as abas do detalhe da obra (RDO, Cronograma,
   Cotações, Estoque, Conta) usam **uma única** feature key `obras`. Não há como
   desligar só "Clima" ou só "Estoque" para uma empresa.
3. **Sem controle em massa:** ligar/desligar uma feature exige abrir empresa por
   empresa. Com muitas empresas isso não escala.

Contexto estratégico que muda a natureza do problema: a decisão de pricing é
**entregar todas as features a todos e cobrar por uso** (usage-based), não mais
por feature (ver [PRICING.md](../strategy/PRICING.md) e o ADR desta spec). Logo o
gate de feature deixa de ser paywall e passa a ser **controle operacional de
rollout**: liberar Obra para o design partner enquanto amadurece, esconder uma
aba meia-pronta, desligar algo com problema. Isso reforça a necessidade de
granularidade e de ação em massa, e enterra a ideia de "features por plano".

## Objetivo

O ultra admin passa a ligar/desligar features **agrupadas pelos 3 módulos reais**,
**descendo até as abas internas** (piloto em Obras), e a **aplicar uma feature em
massa** a todas as empresas de uma vez, com filtro e confirmação.

**Fora de escopo:**

- Novo modelo de dados hierárquico (árvore módulo→feature→subfeature). Mantemos o
  JSONB flat `empresas.features` + convenção de nome `modulo_subfeature`.
- A migração de pricing em si (tirar os planos, cobrança por uso). Esta spec só
  assume que features não são mais paywall.
- O segundo sistema de flags (`feature_flags` + PostHog, `useFeatureFlag.ts`).
  Continua separado; não é tocado aqui.
- Sub-features como **fronteira de segurança de dados**. Desligar "Estoque"
  esconde a aba; a proteção de dados permanece no nível do módulo (`obras`) +
  `empresa_id`. Ver "Decisões e riscos".

## Requisitos

Funcionais:

1. No detalhe da empresa, o card "Features da empresa" agrupa os toggles pelos
   módulos **Gestão / Projetos / Obras**, na ordem de `MODULE_ORDER`, derivando o
   módulo de cada feature a partir de `src/lib/modules.ts` (não mais de
   `FeatureGroup`).
2. Cada módulo é uma linha com um **macro-switch** (liga/desliga o módulo inteiro)
   e um **expansor** (dropdown/disclosure) que revela as sub-features.
3. O macro-switch em "on parcial" (módulo ligado, algumas sub-features off)
   mostra estado indeterminado. Ligar o macro liga o módulo e todas as
   sub-features não-dormentes; desligar o macro desliga o módulo (as sub-features
   ficam irrelevantes enquanto o módulo está off).
4. Sub-features de Obra disponíveis para toggle independente:
   - Telas da sidebar: `obras_fornecedores`, `obras_clima`
   - Abas do detalhe da obra: `obras_diario` (RDO), `obras_cronograma`,
     `obras_cotacoes`, `obras_estoque`, `obras_conta`
   - A visão base da obra (timeline) e a lista de obras seguem `obras` (não têm
     sub-feature própria: são o "esqueleto" do módulo).
5. Uma sub-feature só pode estar ligada se o módulo-pai (`obras`) estiver ligado.
   Desligar o pai oculta/ignora as sub-features na UI da empresa.
6. Nova aba **"Funcionalidades"** no portal ultra admin (ao lado de Empresas /
   Usuários / Atividade) que lista todas as features/sub-features e permite, por
   feature, uma **ação em massa**: ligar ou desligar para um conjunto de empresas.
7. A ação em massa aceita filtro do conjunto-alvo: **todas as empresas** ou
   **apenas as que já têm o módulo-pai ligado** (para sub-features). Antes de
   aplicar, exibe **quantas empresas serão afetadas** e pede confirmação.
8. Toda mudança de feature (individual ou em massa) grava em `admin_audit_logs`
   com quem, quando, feature, valor anterior→novo e alcance (empresa única ou N).
9. A aba "Funcionalidades" mostra, por feature, **quantas empresas a têm ligada**
   (contagem), para dar visibilidade antes de agir.

Não-funcionais:

- **Segurança / RLS:** a ação em massa roda com `service_role` na edge function
  `ultra-admin-empresas` (ou RPC dedicada), guardada por checagem de
  `ultra_admin`. Nenhuma rota nova exposta a não-ultra-admin. A fronteira de
  dados dos módulos permanece nas policies existentes por `empresa_id` + feature
  de módulo; sub-features **não** criam policy nova nesta fase.
- **Catálogo sincronizado:** as novas keys `obras_*` entram em **três lugares** e
  precisam bater: `src/lib/features.ts` (`FeatureKey` + `FEATURES`), a função SQL
  `public._feature_catalog()` (migration nova) e o mapeamento em
  `src/lib/modules.ts`. O CI `types-sync` não pega divergência de catálogo, então
  há um teste que valida os três em sincronia (req. de aceite).
- **Multi-tenant:** ação em massa itera empresas mas nunca vaza dado entre elas;
  só escreve o JSONB `features` de cada uma.
- **Performance:** a ação em massa em N empresas é um único UPDATE em lote
  (reusar a base da RPC `batch_features`, `20260424010000_batch_features.sql`),
  não N round-trips.

## Critérios de aceite

- [ ] Dado o card de features de uma empresa, quando abro, então vejo os toggles
      agrupados em Gestão / Projetos / Obras (não mais Comercial/Visão/Operação).
- [ ] Dado o módulo Obras ligado, quando expando a linha, então vejo switches
      independentes para Fornecedores, Clima, RDO, Cronograma, Cotações, Estoque
      e Conta.
- [ ] Dado o módulo Obras ligado e todas as sub-features on, quando desligo só
      "Clima" e salvo, então `empresas.features` fica com `obras: true` e
      `obras_clima: false` (explícito), e a empresa deixa de ver a tela Clima. As
      demais sub-features, ausentes do JSONB, seguem ligadas (herdam o pai).
- [ ] Dado o módulo Obras desligado, quando o usuário da empresa acessa
      `/obras/clima`, então é redirecionado para `/sem-acesso` (o pai off já
      barra), independentemente de `obras_clima`.
- [ ] Dado o macro-switch de Obras, quando ligo com o módulo antes off, então
      `obras` vira true e as sub-features não-dormentes vêm ligadas por padrão.
- [ ] Dado a aba Funcionalidades, quando escolho "ligar Obras para todas as
      empresas", então vejo a contagem de afetadas, confirmo, e todas passam a
      ter `obras: true`; um registro em `admin_audit_logs` descreve a ação.
- [ ] Dado uma ação em massa "desligar Estoque nas empresas que têm Obras",
      quando confirmo, então só as empresas com `obras: true` são tocadas.
- [ ] Caso de borda: ação em massa sobre 0 empresas (filtro não casa nenhuma) →
      botão desabilitado / mensagem "nenhuma empresa neste filtro", sem escrita.
- [ ] Teste de catálogo: as keys `obras_*` existem em `features.ts`,
      `_feature_catalog()` e no mapa de `modules.ts`; o teste falha se faltar em
      qualquer um.

## Dados e contratos

- **Sem coluna nova.** Sub-features são chaves adicionais no JSONB
  `empresas.features` já existente (`{ feature_key: boolean }`).
- **Migration:** estende `public._feature_catalog()` para incluir as novas keys
  `obras_fornecedores`, `obras_clima`, `obras_diario`, `obras_cronograma`,
  `obras_cotacoes`, `obras_estoque`, `obras_conta` (padrão dos DROP+CREATE do
  catálogo, ver `20260730170000_feature_catalog_add_obras.sql`). Rodar
  `npm run gen:types` depois? O catálogo é função, não muda `types.ts`; mas as
  policies/colunas não mudam, então `types.ts` deve ficar igual. Confirmar no CI.
- **Front — `features.ts`:** adicionar as keys a `FeatureKey`, entradas em
  `FEATURES` com `group` derivável do módulo, `parent: "obras"`, flag opcional
  `dormant` para as ainda cruas. Novo helper `subFeaturesOf(moduleId)` e
  `moduleOf(featureKey)`.
- **Front — `modules.ts`:** cada `ModuleMenuItem` e cada aba de obra ganha (ou
  passa a referenciar) a sub-feature correta em vez de só `obras`.
- **Contrato da ação em massa** (edge function `ultra-admin-empresas`, novo verbo
  ou RPC `ultra_admin_bulk_feature`):
  ```
  POST bulk-feature
  { feature: string, value: boolean, scope: "all" | "has_parent",
    parent?: string }
  → { affected: number }
  ```
  Antes de aplicar, um GET/preview retorna `affected` para a confirmação.
- **Gate de UI/rota:** `FeatureRoute` e a sidebar passam a checar a sub-feature
  quando o item a declara; `can()`/`isFeatureEnabledForCompany` ganham a regra
  "sub-feature exige o pai ligado".

## Plano de implementação

Preenchido em plan mode e aprovado antes de gerar código. Rascunho de fases:

1. **Catálogo e modelo (front + migration).** Adicionar keys `obras_*`,
   `parent`, helpers `moduleOf`/`subFeaturesOf`; migration do `_feature_catalog()`;
   teste de sincronia dos três lugares.
2. **Regra de gate.** `isFeatureEnabledForCompany`/`canDo` respeitam pai→filho;
   `FeatureRoute` e abas de Obra passam a checar sub-feature.
3. **UI do card por módulo.** `CompanyFeatureToggles` agrupa por `ModuleId`, com
   macro-switch + disclosure e estado indeterminado.
4. **Aba Funcionalidades (bulk).** Nova aba no `ultra-admin/index.tsx`, contagem
   por feature, ação em massa com preview/confirmação, sobre RPC de lote.
5. **Auditoria.** Registrar as ações em `admin_audit_logs` (individual e massa).

## Decisões e riscos

- **ADR desta spec:** [ADR 0019 — Features como controle de rollout, não de
  plano](../architecture/adr/0019-features-como-controle-de-rollout-nao-de-plano.md).
  Revisa a premissa comercial do [ADR 0005](../architecture/adr/0005-permissoes-feature-flags.md).
- **Decisão — sub-feature é gate de experiência, não de dado.** Desligar
  "Estoque" esconde a aba; os dados de estoque continuam protegidos por `obras` +
  `empresa_id` no RLS. Não criamos policy por sub-feature nesta fase. **Risco:**
  alguém supor que desligar a sub-feature "tranca" o dado. Documentar no ADR e no
  tooltip do toggle.
- **Risco — catálogo em três lugares.** `features.ts`, `_feature_catalog()` e
  `modules.ts` precisam bater e não há gate de CI para isso. Mitigação: teste de
  sincronia (aceite acima). Candidato futuro a fonte única de catálogo.
- **Risco — ação em massa é destrutiva.** "Desligar para todas" sobrescreve
  escolhas manuais de empresas. Mitigação: preview com contagem + confirmação +
  audit log. Não há undo em massa nesta fase (registrar como limitação).
- **Suposição:** a extensão do `_feature_catalog()` não altera `types.ts`. Se
  alterar, rodar `npm run gen:types` e commitar (gate `types-sync`).
