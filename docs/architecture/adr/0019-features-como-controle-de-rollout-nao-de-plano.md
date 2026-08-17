# ADR 0019: Features como controle de rollout por módulo, não como paywall de plano

**Data:** 2026-08-13  
**Status:** Proposed

## Contexto

O [ADR 0005](./0005-permissoes-feature-flags.md) estabeleceu o modelo de
autorização em dois níveis (role + features) partindo da premissa de que
**"diferentes planos habilitam módulos diferentes"** — ou seja, feature era o
mecanismo de paywall comercial. Duas forças mudam isso agora:

1. **Pricing v2** decide entregar **todas as features a todos** e cobrar por
   **uso** (projetos ativos, créditos de IA), não por feature. Ver
   [PRICING.md](../../strategy/PRICING.md). Feature deixa de separar quem-pagou-o-quê.
2. **Os 3 módulos** (Gestão, Projetos, Obras — `src/lib/modules.ts`) são a
   taxonomia real do produto, mas o portal ainda agrupa features pelo enum visual
   antigo `FeatureGroup`, e não há granularidade abaixo do módulo (todo o Obras é
   uma única key `obras`). Ligar Obra só para o design partner enquanto amadurece
   é uma necessidade **operacional**, não comercial.

O que continua verdadeiro do ADR 0005: o mecanismo role + features por
usuário/empresa e o enforcement em RLS. O que muda é o **significado** da flag de
empresa e a **granularidade**.

Opções consideradas para a granularidade:

- **Árvore módulo→feature→subfeature (novo shape).** Expressivo, mas mexe em
  catálogo, triggers, RLS e no JSONB. Overengineering para o volume atual.
- **JSONB flat + convenção de nome `modulo_subfeature`.** Sub-feature é só mais
  uma key (`obras_estoque`) com um `parent` declarado no catálogo do front.
  Reusa todo o mecanismo atual. Custo: catálogo em três lugares.

## Decisão

**1. Feature de empresa (`empresas.features`) é controle de rollout operacional,
não paywall.** Não há mais vínculo "plano habilita feature". `includedInPlans`
em `features.ts`, se mantido, significa apenas **provisionamento padrão** (o que
uma empresa nova recebe ligado), desacoplado de cobrança.

**2. O portal ultra admin agrupa features pelos 3 módulos** (`ModuleId =
gestao | projetos | obras`), derivando o grupo de `src/lib/modules.ts`. O enum
visual `FeatureGroup` sai do fluxo de toggles por empresa.

**3. Sub-features vivem no mesmo JSONB flat, por convenção de nome
`modulo_subfeature`**, com o `parent` declarado no catálogo do front:

```ts
// src/lib/features.ts (ilustrativo)
{ key: "obras_estoque", parent: "obras", group: "obras", dormant: false }
```

Regra de gate: uma sub-feature só vale se o módulo-pai estiver ligado.
`isFeatureEnabledForCompany("obras_estoque")` ⇒ `obras === true && obras_estoque !== false`.

**4. Sub-feature é gate de experiência (UI + rota), não fronteira de dados.** A
proteção de dados permanece no nível do módulo (`obras`) + `empresa_id` nas RLS
existentes. Não criamos policy por sub-feature. Desligar "Estoque" esconde a aba;
não tranca a tabela.

**5. Ação em massa** (ligar/desligar uma feature para muitas empresas) roda com
`service_role` na edge function ultra admin / RPC de lote, guardada por
`ultra_admin`, com preview de contagem, confirmação e registro em
`admin_audit_logs`.

## Consequências

**Positivas:**

- Portal fala a mesma língua do produto (3 módulos), fim do desalinhamento
  Comercial/Visão/Operação vs Gestão/Projetos/Obras.
- Rollout fino: liberar/esconder uma aba por empresa sem deploy nem código.
- Ação em massa escala para muitas empresas (um lote, não empresa-a-empresa).
- Reusa o modelo atual (JSONB + role + features + RLS por módulo); nada de RBAC
  novo nem shape hierárquico.

**Negativas:**

- **Catálogo em três lugares** (`features.ts`, `_feature_catalog()` SQL,
  `modules.ts`) sem gate de CI. Mitigado por teste de sincronia; dívida a
  resolver com fonte única no futuro.
- Sub-feature **não** protege dado. É preciso comunicar isso (tooltip/doc) para
  não virar falsa sensação de segurança.
- Ação em massa é destrutiva e sem undo nesta fase; mitigada por preview +
  confirmação + audit log.
- `includedInPlans` fica com semântica ambígua no período de transição do
  pricing (era paywall, vira default de provisionamento). Revisar quando os
  planos por feature saírem de fato.

## Decisões relacionadas

- Revisa a premissa comercial do [ADR 0005](./0005-permissoes-feature-flags.md)
  (planos habilitam features) — mantém o mecanismo role + features, muda o
  significado da flag e adiciona sub-features.
- [ADR 0016 — rotas aninhadas por módulo](./0016-rotas-aninhadas-por-modulo.md):
  os módulos que agora também organizam as features.
- [SPEC 035 — controle de features por módulo e em massa](../../specs/035-controle-de-features-por-modulo-e-em-massa.md).
- [PRICING.md](../../strategy/PRICING.md): pricing por uso que motiva a mudança.
