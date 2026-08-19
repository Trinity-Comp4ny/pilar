# SPEC: Features universais por empresa, capacidade vira o limitador de plano

**Data:** 2026-08-18  
**Status:** Em implementação (fases 1 e 2 entregues, ver nota abaixo)  
**Autor:** Matheus  
**Módulo:** plataforma / ultra-admin / billing

> **Nota de implementação (18/08):** entregue nesta rodada: requisitos 1-7 e 10
> (catálogo `universal`, `isFeatureEnabledForCompany`, `handle_new_user` não
> tocado por segurança, ver abaixo, ultra-admin/self-serve só com toggle de
> early access, `invite-user` sincronizado + teste de sincronia, bypass de
> `universal` em `user_has_feature`/`_validate_features_payload`/
> `tg_validate_features_subset`/`tg_validate_convite_features_subset`).
> **Fase 2 (19/08):** requisito 8 entregue (colunas `max_projetos_override`/
> `max_usuarios_override` em `empresas`, card "Capacidade" no detalhe da
> empresa no ultra-admin mostrando plano + limite efetivo, override editável
> em "Editar empresa"). **Adiado, não entregue:** requisito 9 (enforcement de
> `max_projetos` em `create_projeto_completo`: o override fica visível e
> editável, mas ainda não bloqueia nada na prática) e requisito 11 (backfill
> de plano das 4 empresas legadas). Motivo do requisito 9: `create_projeto_completo` tem **3 overloads**
> ativos em produção hoje (achado ao investigar); mexer nele com segurança
> exige isolar qual overload o front realmente chama e um DROP+CREATE
> explícito (ver `feedback_supabase_function_overload` na memória do projeto),
> risco desproporcional pro valor desta rodada. Fica como spec/PR seguinte,
> focado só nisso. Não fiz a migration de limpeza do JSONB `empresas.features`
> em si (remover as chaves universais antigas e a chave morta `planejamento`
> das empresas existentes): não é mais bloqueada tecnicamente (ver achado do
> cascade abaixo, já corrigido), só não é urgente, é higiene, fica pra quando
> alguém for mexer ali de novo.
>
> **Achados de uma revisão de RLS (agente `rls-auditor`) rodada antes de
> fechar, não mapeados na spec original:**
> 1. Além de `tg_validate_features_subset`/`tg_validate_convite_features_subset`,
>    existe uma segunda linhagem de validação ativa em paralelo:
>    `tg_validate_profile_features`/`tg_validate_convite_features` chamando
>    `_validate_features_payload()`, fazendo o mesmo tipo de checagem de forma
>    redundante. As duas precisaram do mesmo bypass de `universal` (migration
>    `20260845000000`). Não consolidei as duas linhagens em uma só: risco
>    maior, fora do escopo motivador (o convite da Mawe).
> 2. **Achado real, corrigido nesta rodada (migration `20260846000000`):**
>    `tg_cascade_feature_revocation` (trigger em `empresas.features`, não
>    tocado pela migration original) ainda revogava em cascata o grant de
>    `profiles.features` de todo mundo na empresa quando uma feature
>    universal era removida do JSONB, por exemplo via a ação em massa
>    `PUT /ultra-admin-empresas?action=bulk-feature`. Isso anulava a promessa
>    do ADR 0026 nesse caminho específico (não era brecha de acesso, era
>    revogação indevida). O endpoint `bulk-feature` também ganhou uma
>    validação server-side (`UNIVERSAL_FEATURES`, com teste de sincronia),
>    já que antes só a UI restringia a lista de features elegíveis.
> 3. **Suspeita levantada, não investigada nesta rodada:** `handle_new_user()`
>    cria toda empresa nova com `timesheet` já `true`/`editor` (é addon
>    dormente, `universal: false`); se alguma RLS futura checar
>    `user_has_feature('timesheet', ...)`, todo cliente novo já nasceria com
>    acesso liberado a um módulo que a política do projeto trata como "não
>    usar em features novas sem avisar". Vale investigar à parte.

## Problema

Hoje o acesso de uma empresa a um módulo do Pilar depende de alguém, manualmente, ligar a feature dela no ultra-admin, desconectado do plano contratado. Isso já causou um quase-incidente real: convidar um usuário para a Mawe Arquitetos quase deixou "Obras" de fora do convite, porque o mecanismo de proteção (toggle por empresa + whitelist hardcoded da edge function `invite-user`) está desalinhado do catálogo atual.

A decisão de negócio já existe desde 10/08 (`docs/strategy/PRICING.md`, reforçada na v3 de 17/08): **uma plataforma, todo plano tem tudo; o que muda por plano é capacidade (projetos ativos, ações de IA), nunca o conjunto de telas.** O código nunca fechou esse elo. Uma auditoria em produção (18/08) confirma o drift: das 8 empresas reais, nenhuma tem uma relação coerente entre plano e features; `max_projetos` existe na tabela de planos mas não bloqueia nada; há três catálogos divergentes do que cada plano "inclui", e nenhum é lido pelo controle de acesso real (`canDo`).

## Objetivo

Toda empresa passa a ter, automaticamente e sem toggle, acesso a todo módulo maduro (o que hoje já está ao vivo em produção). O ultra-admin para de ser o mecanismo de "lembrar de ligar feature X pra empresa Y" e passa a controlar **capacidade** (plano, limite de projetos, override negociado) e **early access** só para o que ainda não está pronto pra ninguém. `max_projetos` sai de número decorativo para limite aplicado de verdade.

**Fora de escopo:**

- **`max_obras` (segundo eixo de capacidade) e o ledger de ações de IA.** O próprio `PRICING.md` já registra isso como esforço maior, pendente de instrumentação (contagem real de obras ativas, ~60 dias de `ai_usage_logs`). Esta spec prepara o campo (nullable, sem enforcement) mas não fecha o eixo. Fica para spec própria.
- **Mudar o preço ou a tabela de planos em si.** Não mexe em `preco_mensal`/`preco_anual`, só em quais features cada plano libera (todas) e em como `max_projetos` é aplicado.
- **RBAC por usuário (`profiles.features`, viewer/editor).** Continua existindo exatamente como hoje; o convite continua deixando o admin escolher o nível de cada feature para a pessoa convidada. O que muda é só o nível "empresa".
- **Limpeza das contas de teste em produção** ("Teste", "TESTE - Claude (pode apagar)"). Mencionado como achado, não é objeto desta spec.

## Requisitos

Funcionais:

1. `FeatureDefinition` (`src/lib/features.ts`) ganha o campo `universal: boolean`. As features hoje ao vivo em produção (`dashboard`, `relatorios`, `leads`, `propostas`, `clientes`, `projetos`, `mapa`, `financeiro`, `pessoas`, `metas`, `portal_cliente`, `ai_chat`, `meu_trabalho`, `obras` e as sete sub-features `obras_*`) recebem `universal: true`. `ai_hub`, `capacidade`, `templates`, `timesheet` (hoje `dormant: true`) recebem `universal: false` e continuam como estão.
2. `includedInPlans` sai do catálogo (campo e todo uso). Nenhuma tela de venda ou copy volta a listar "o que cada plano inclui" por feature; capacidade (`max_projetos` etc.) é o único diferencial entre planos daqui pra frente.
3. `isFeatureEnabledForCompany` retorna `true` para toda feature com `core: true` OU `universal: true`, sem consultar `companyFeatures`. Para features `universal: false`, o comportamento atual (parent + JSONB da empresa) não muda.
4. `handle_new_user()` (as duas ramificações que criam empresa: trial self-serve e checkout pago) para de gravar o catálogo hardcoded de ~13 chaves. `empresas.features` deixa de ser gravado com chaves universais na criação (o código já as trata como sempre ligadas); só grava o que for `universal: false` caso a empresa já nasça com early access de algo dormant (hoje, nunca).
5. Toda empresa existente ganha acesso às features universais imediatamente após o deploy, sem precisar de migração de dados: o flag `universal` no código ignora o conteúdo de `empresas.features`. Confirmar isso é um critério de aceite (não é suposição).
6. `CompanyFeatureToggles` (ultra-admin, card de detalhe da empresa) e `FeaturesEmpresaTab` (self-serve em Admin › Features da Empresa) passam a listar só as features com `universal: false` (as quatro dormant). O agrupamento por módulo (Gestão/Projetos/Obras) da spec 035 deixa de fazer sentido para um conjunto que não tem mais nada em Obras nem em Gestão: a lista vira uma única seção "Acesso antecipado".
7. `BulkFeatureManager` (ação em massa) continua existindo, com o mesmo escopo reduzido às quatro features dormant.
8. Novo card **"Capacidade"** no detalhe da empresa no ultra-admin, substituindo o antigo "Features da empresa" na função de controlar o essencial do plano:
   - Trocar o `plano` (slug) da empresa.
   - Sobrescrever, só para essa empresa, `max_projetos` e `max_usuarios` (override nullable: `null` = usa o padrão do plano).
   - Dois campos preparados e desabilitados nesta fase, com tooltip "em preparação": `max_obras`, `cota_acoes_ia` (ver "Fora de escopo").
9. `create_projeto_completo` (RPC) passa a checar, antes de criar, se a empresa já está no limite `max_projetos` efetivo (override da empresa, senão o do plano, senão sem limite). Ultrapassar bloqueia com mensagem clara nomeando o limite e o plano atual. Projeto arquivado ou concluído não conta na contagem (mesma régua "arquivar libera a cota" do `PRICING.md`).
10. A edge function `invite-user` para de manter `FEATURE_KEYS` como um `Set` hardcoded solto. Passa a aceitar qualquer chave presente no catálogo compartilhado (ou, se o boundary Deno/Node impedir import direto, ganha um teste que falha se `FEATURE_KEYS` divergir de `FEATURES_BY_KEY`), incluindo `obras` e as sete sub-features que faltavam hoje.
11. As 4 empresas em produção sem `pilar_subscriptions` (BM3, VRZ, Trinity, CBSP) recebem uma linha de assinatura antes do requisito 9 (enforcement) ir ao ar, senão ficam sem limite nenhum por acidente (join nulo). Decisão de qual plano: ver "Decisões e riscos", não assumido aqui.

Não-funcionais:

- **Segurança / RLS:** nenhuma policy muda. A fronteira de dado continua em `empresa_id`; `universal` só afeta a checagem em app-level (`canDo`/`isFeatureEnabledForCompany`) e RBAC de usuário, que já eram app-level.
- **Multi-tenant:** o override de capacidade no ultra-admin escreve só na empresa-alvo (mesmo padrão de `handleChangeFeatures` hoje).
- **Retrocompat:** empresas com `empresas.features` carregando chaves universais antigas (o catálogo hardcoded de hoje, incluindo a chave morta `planejamento`) não quebram: o campo simplesmente para de ser lido para essas chaves. Uma migration de limpeza (remover chaves universais e `planejamento` do JSONB de todas as empresas) é desejável por higiene, mas não é bloqueante, porque nada mais lê essas chaves depois desta spec.
- **Performance:** o check de `max_projetos` em `create_projeto_completo` é um `count(*)` por `empresa_id` com filtro de status, mesma ordem de grandeza de índice que já existe para listar projetos ativos.

## Critérios de aceite

- [ ] Dado o deploy desta spec, quando abro o convite de um usuário em qualquer empresa, então "Obras" e as sete sub-features aparecem na lista de acesso disponível, independentemente de qualquer toggle prévio no ultra-admin.
- [ ] Dado uma empresa que nunca teve `obras: true` em `empresas.features` (ex.: BM3, hoje sem a chave), quando um usuário dela abre a sidebar, então o módulo Obras aparece normalmente (não depende de backfill de dados).
- [ ] Dado o card de features no ultra-admin, quando abro o detalhe de qualquer empresa, então só vejo os quatro toggles dormant (IA Hub, Capacidade, Templates, Timesheet); nenhum toggle de Financeiro/Projetos/Obras/etc. aparece mais ali.
- [ ] Dado o novo card "Capacidade", quando troco o plano de uma empresa de Essencial para Profissional, então `max_projetos` efetivo dela muda para o do novo plano (sem override).
- [ ] Dado um override de `max_projetos = 5` numa empresa específica, quando essa empresa tenta criar o 6º projeto ativo, então a criação é bloqueada com mensagem citando o limite; o plano padrão dela (com limite maior) não é usado nesse caso, o override vence.
- [ ] Dado uma empresa no limite de projetos ativos, quando arquiva um projeto e tenta criar outro, então a criação é permitida (a cota libera imediatamente).
- [ ] Dado uma empresa sem nenhuma linha em `pilar_subscriptions` (caso das 4 legadas, se ainda não resolvido no deploy), quando tenta criar um projeto, então não é bloqueada (limite nulo = sem limite; comportamento seguro por padrão, não é a intenção final, mas não regride).
- [ ] Teste de sincronia: a lista de chaves aceitas em `invite-user`/`FEATURE_KEYS` bate 1:1 com `Object.keys(FEATURES_BY_KEY)` do catálogo do front (menos as que não fazem sentido convidar, se houver).
- [ ] Caso de borda: convite de admin (`role: "admin"`) continua sem nenhuma seleção de feature (admin já tem bypass total), este fluxo não muda.

## Dados e contratos

- **`src/lib/features.ts`:** adicionar `universal: boolean` a `FeatureDefinition`; marcar as 15 chaves maduras; remover `includedInPlans` do tipo e de todo uso (`FEATURES`, `PlanCard`, `usePlans`). Remover `src/lib/planFeatures.ts` (já é código morto, zero import).
- **Migration:** `handle_new_user()` (`CREATE OR REPLACE FUNCTION`, DROP+CREATE se overload) para de gravar o catálogo hardcoded de features universais no INSERT de `empresas`. Migration de limpeza opcional: `UPDATE empresas SET features = features - 'planejamento' - 'dashboard' - ...` removendo as chaves universais e a chave morta de todas as linhas existentes (higiene, não bloqueante).
- **`pilar_subscription_plans`:** duas colunas novas nullable, `max_obras integer` e `cota_acoes_ia integer` (sem enforcement nesta spec, só o campo existir para o card de Capacidade ter onde gravar quando a próxima spec ligar o enforcement). Considerar se cabe aqui ou se adia para a spec do eixo de obras (decisão em aberto, ver riscos).
- **`empresas`:** duas colunas novas nullable para override, `max_projetos_override integer` e `max_usuarios_override integer` (limite efetivo = `coalesce(empresa.max_projetos_override, plano.max_projetos)`).
- **RPC `create_projeto_completo`:** adicionar check de limite antes do INSERT; contagem de "projeto ativo" = não-arquivado e não-concluído (mesma definição do `PRICING.md`).
- **Edge function `invite-user`:** `FEATURE_KEYS` deixa de ser um `Set` literal solto; vira gerado ou testado contra o catálogo (ver requisito 10).
- **Ultra-admin (`ultra-admin-empresas` edge function / RPC):** novo verbo ou campo para setar plano + overrides de capacidade da empresa (reaproveita o padrão de auditoria já existente em `admin_audit_logs`).

## Plano de implementação

Preenchido em plan mode e aprovado antes de gerar código. Fases:

1. **Catálogo (`features.ts`).** Campo `universal`, marcar as 15 chaves, remover `includedInPlans` e `planFeatures.ts`, atualizar `isFeatureEnabledForCompany`.
2. **`handle_new_user()`.** Migration nova removendo o catálogo hardcoded do INSERT de `empresas.features` nos dois cenários (trial e checkout pago).
3. **Ultra-admin.** `CompanyFeatureToggles`/`FeaturesEmpresaTab` filtram só `universal: false`; novo card "Capacidade" (plano + overrides); `BulkFeatureManager` mantém escopo reduzido.
4. **Enforcement de `max_projetos`.** Colunas de override em `empresas`; check na RPC `create_projeto_completo`; UI de erro clara no formulário de projeto.
5. **Convite.** `FEATURE_KEYS` sincronizado com o catálogo real + teste de sincronia.
6. **Backfill de produção.** Decisão de plano para as 4 empresas sem `pilar_subscriptions` (ver riscos) antes de a fase 4 ir ao ar; migration de limpeza do JSONB (opcional, item de higiene).
7. **`docs/strategy/PRICING.md`.** Atualizar a seção "Dependências técnicas" marcando os itens 2 e 6 como resolvidos; deixar claro que `max_obras`/ações de IA continuam pendentes (fase própria).

## Decisões e riscos

- **ADR desta spec:** [ADR 0026](../architecture/adr/0026-feature-madura-universal-toggle-vira-capacidade.md). Supersede o [ADR 0019](../architecture/adr/0019-features-como-controle-de-rollout-nao-de-plano.md).
- **Decisão pendente: qual plano atribuir às 4 empresas legadas (BM3, VRZ, Trinity, CBSP) sem `pilar_subscriptions`.** Recomendação: `enterprise` sem limite, por serem contas provisionadas manualmente/design partner anteriores ao modelo de plano atual; formalizar com Vendas antes de qualquer cobrança real. Não assumir no código sem essa confirmação.
- **Risco: `max_obras`/`cota_acoes_ia` como colunas "preparadas mas inertes" pode confundir quem olhar o schema depois.** Mitigado por comentário SQL explícito e por esta spec documentar que o enforcement é fase futura, não bug.
- **Risco: teste de sincronia entre `invite-user`/`FEATURE_KEYS` e `FEATURES_BY_KEY` cruza o boundary Deno (edge function) / Vite (front).** Se não der para importar direto, o teste roda em Node lendo os dois arquivos-fonte como texto/AST simples, não precisa executar o código Deno.
- **Suposição:** nenhuma RLS policy depende hoje de `empresas.features` conter as chaves universais (a fronteira real é `empresa_id`, não a feature). Confirmar isso lendo as ~35 policies que usam `user_has_feature()` antes de rodar a migration de limpeza do JSONB (fase 6); se alguma policy checar a chave da empresa diretamente (não via `profiles.features`), a limpeza precisa esperar essa policy ser ajustada primeiro.
