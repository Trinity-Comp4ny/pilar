# ADR 0026: Feature madura é universal por empresa; toggle vira capacidade de plano, não módulo

**Data:** 2026-08-18  
**Status:** Accepted

## Contexto

O [ADR 0005](./0005-permissoes-feature-flags.md) tratava `empresas.features` como paywall por plano. O [ADR 0019](./0019-features-como-controle-de-rollout-nao-de-plano.md) (13/08) corrigiu a premissa comercial, a decisão de pricing v2 já era "todas as features a todos, cobrar por uso", mas manteve o toggle por empresa como controle de **rollout operacional**: seguir ligando Obras só para o design partner "enquanto amadurece".

Isso já não reflete nem o estado do produto nem a prática real, por cinco motivos:

1. **Obras deixou de ser experimental.** Desde a spec 015 (30/07) o módulo cresceu (RDO, cronograma, cotações, estoque, conta da obra) e hoje tem duas empresas usando de verdade (VRZ e, agora, Mawe Arquitetos, ligada manualmente). Segurar atrás de um toggle manual por empresa gerou exatamente o problema que motivou esta revisão: convidar um usuário para a Mawe quase deixou "Obras" de fora do convite, porque o mecanismo de proteção (toggle por empresa + whitelist do backend de convite) está desalinhado do catálogo real.
2. **O catálogo hardcoded em `handle_new_user()` já trata a maior parte das features como universais na prática.** Toda empresa nova (self-serve ou paga) recebe o mesmo conjunto fixo de ~13 chaves, sem ligação nenhuma com o plano escolhido. `obras` e `ai_chat` são as únicas exceções que ainda dependem de alguém lembrar de ligar manualmente no ultra-admin.
3. **Auditoria em produção (18/08) confirma o drift.** Quatro empresas antigas (BM3, VRZ, Trinity, CBSP) carregam a chave `planejamento`, que nem existe mais no catálogo atual, e não têm nenhuma linha em `pilar_subscriptions`. Três empresas (entre elas LTS Engenharia, um trial real, não é conta de teste) ficaram com `features: {}` vazio, resíduo de um bug de signup anterior nunca reconciliado no nível da empresa. Nenhuma das oito empresas em produção hoje tem uma relação coerente entre plano e features.
4. **O limitador real da v3 de pricing não é aplicado em lugar nenhum.** `max_projetos` existe na tabela de planos, mas hoje só alimenta um contador de exibição (`useUsoEmpresa`, tela "Uso"); nenhuma RPC bloqueia passar do limite. `max_obras` e o ledger de ações de IA nem existem no schema.
5. **Três catálogos divergentes do que cada plano inclui**, nenhum lido por `canDo`: `src/lib/features.ts` (`includedInPlans`, só copy visual), `src/lib/planFeatures.ts` (código morto, zero import em todo o repo, com um `TODO(billing)` do próprio autor dizendo que nunca foi ligado), e `pilar_subscription_plans.features` (só alimenta a lista de bullets do `PlanCard` na página de planos).

Opções consideradas:

- **Manter o toggle por empresa para tudo, só consertar o catálogo e o bug do convite.** Resolve o sintoma (Mawe), mas não fecha o "elo plano → features" que o próprio `docs/strategy/PRICING.md` já registra como pendência desde a v2, e mantém o ultra-admin fazendo à mão, empresa por empresa, o que deveria ser automático.
- **Remover `empresas.features` inteiramente.** Simplifica, mas tira o único mecanismo hoje disponível para segurar um módulo ainda quebrado ou não validado atrás de acesso controlado (IA Hub tem 10 de 14 funções mortas hoje, ver memória de auditoria de 17/08).
- **Separar em duas categorias com semânticas distintas (escolhida).** Feature madura e ao vivo (Dashboard, Financeiro, Projetos, Leads, Propostas, Clientes, Pessoas, Metas, Portal Cliente, Mapa, Relatórios, Meu trabalho, Agentes/`ai_chat`, Obras e as sete sub-features) fica **universal**: toda empresa tem, sem toggle, sem depender de alguém lembrar de ligar. Feature ainda não pronta pra ninguém (IA Hub, Capacidade, Templates, Timesheet, hoje marcadas `dormant`) continua atrás de um toggle, só que deixa de ter qualquer pretensão de virar paywall: é early access controlado pelo ultra-admin.

## Decisão

**1. `FeatureDefinition` ganha o campo `universal: boolean`, distinto de `core`.** `core` continua reservado a Dashboard e Meu Trabalho (o usuário sempre vê, mesmo sem entrada em `profiles.features`, isso é nível de acesso individual). `universal` é sobre a empresa: `true` significa "toda empresa tem, o toggle não existe pra essa chave". `isFeatureEnabledForCompany` passa a checar `feature.core || feature.universal` antes de olhar `companyFeatures`:

```ts
// src/lib/features.ts (ilustrativo)
{ key: "financeiro", universal: true, /* ... */ }
{ key: "obras", universal: true, /* ... */ }
{ key: "obras_estoque", universal: true, parent: "obras", /* ... */ }
{ key: "ai_hub", universal: false, dormant: true, /* ... */ } // continua atrás do toggle
```

**2. `includedInPlans` sai do catálogo.** Não existe mais "plano inclui feature X": todo plano tem toda feature `universal`. O que muda por plano é só capacidade (`max_projetos`, e futuramente `max_obras`, ações de IA), nunca o conjunto de telas.

**3. `handle_new_user()` para de gravar um catálogo hardcoded fixo.** Como o código já retorna `true` incondicionalmente para toda feature `universal`, o insert em `empresas.features` deixa de ser fonte de verdade para essas chaves; sobra só como metadado histórico (ou é removido, ver spec). Elimina de quebra a chave morta `planejamento`.

**4. `empresas.features` (JSONB) e o toggle no ultra-admin (`CompanyFeatureToggles`) continuam existindo, mas só listam as features `dormant` (Categoria B).** A ação em massa (`BulkFeatureManager`, spec 035) idem: só faz sentido pra early access de módulo não pronto, escopo reduzido de ~19 chaves pra 4.

**5. Ultra-admin ganha um card "Capacidade" no lugar do que hoje é "Features da empresa"**: trocar o plano da empresa (slug) e sobrescrever, por empresa, os limites que o plano define (`max_projetos`, `max_usuarios`), para caso negociado fora da tabela padrão. `max_obras` e cota de ações de IA entram como campos preparados (nullable, sem enforcement ainda); a ligação completa fica para uma spec própria (ver "Consequências").

**6. `max_projetos` passa a ser aplicado de verdade** na RPC `create_projeto_completo`, não só exibido. Ultrapassar o limite do plano bloqueia a criação com mensagem clara, mesma régua de "arquivar libera a cota, na hora e de graça" já documentada no `PRICING.md`.

**7. A whitelist `FEATURE_KEYS` da edge function `invite-user` para de ser uma lista hardcoded desalinhada.** O convite continua permitindo o admin dar nível viewer/editor por feature ao usuário convidado (RBAC dentro da empresa, ortogonal ao plano), mas a lista de chaves aceitas ganha um teste de sincronia contra `FEATURES_BY_KEY`, o mesmo tipo de dívida que a spec 035 já registrava como risco aceito ("catálogo em três lugares, sem gate de CI"), agora coberta num quarto lugar.

## Consequências

**Positivas:**

- Fecha o "elo plano → features" que `docs/strategy/PRICING.md` já registra como pendência desde a v2 (10/08), reusando `core`/`isFeatureEnabledForCompany`, que já existem, em vez de inventar mecanismo novo.
- Elimina a classe inteira de bug "esqueceram de ligar a feature pra essa empresa" (o motivo direto desta revisão).
- Ultra-admin deixa de fazer manualmente, empresa por empresa, o que deveria ser automático; o que sobra pra ele fazer (early access a módulo quebrado, override de capacidade negociado) é trabalho que de fato exige um humano decidindo.
- `max_projetos` sai de número decorativo para limite de verdade, dando substância real à régua de cobrança que a v3 do pricing propõe.
- Nenhuma empresa existente precisa de backfill de `features` para ganhar as chaves universais: o flag `universal` ignora o JSONB, então o efeito é imediato na troca de código, sem migração de dados obrigatória para este passo.

**Negativas:**

- Backfill ainda é necessário, só que num lugar diferente: 4 empresas sem `pilar_subscriptions` (BM3, VRZ, Trinity, CBSP) precisam de uma decisão de plano antes de `max_projetos` virar enforcement de verdade (fase 2), senão qualquer uma delas fica sem limite nenhum (join nulo = sem limite, seguro por padrão, mas não é a intenção).
- `max_obras` e o ledger de ações de IA continuam sem enforcement; a v3 do pricing já não vende esses eixos por número fixo hoje, então não é regressão, mas o modelo fica com dois eixos "no papel, não no código" até uma spec própria fechar isso.
- Categoria B (dormant) mantém um toggle por empresa que não é mais rollout comercial nem paywall, é só early access. Precisa ficar claro no tooltip/copy do ultra-admin, para não reintroduzir a confusão que o próprio ADR 0019 já tentou resolver.

## Decisões relacionadas

- Supersede o [ADR 0019](./0019-features-como-controle-de-rollout-nao-de-plano.md): mantém a premissa de que feature não é paywall, mas separa "feature madura" (universal, sem toggle) de "feature não pronta" (toggle de early access), em vez de tratar as duas com o mesmo mecanismo de rollout.
- Revisa novamente o [ADR 0005](./0005-permissoes-feature-flags.md) (permissões em dois níveis: role + features): o nível "empresa" deixa de ser paywall e de ser rollout genérico, vira só early access de módulo não pronto. O nível "usuário" (viewer/editor) não muda.
- Ver [SPEC 052](../../specs/052-features-universais-por-empresa-capacidade-de-plano.md) (implementação) e [`PRICING.md`](../../strategy/PRICING.md) (o modelo de negócio que motiva isto).
