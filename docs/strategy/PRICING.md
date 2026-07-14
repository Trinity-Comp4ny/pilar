# Pricing — Modelo de Cobrança do Pilar

> Rascunho **v1** · 2026-07-13 · números indicativos para validação com o design partner — **não** é tabela final de preço.
> Versão visual (para apresentar): artifact "Como o Pilar vai cobrar".

## TL;DR

Modelo **híbrido em 3 camadas**, não modelo único:

1. **Assinatura** por faixa de **projetos ativos** (feature-flags definem o pacote de cada tier) — ativar agora.
2. **Créditos** para os agentes de IA (1 crédito = 1 ação concluída; cota no plano + pacote extra) — quando a IA subir.
3. **Outcome** (por resultado, ex.: orçamento aprovado sem edição) — só depois de instrumentar a telemetria.

Racional de fundo em [SAAS_IS_DEAD_ANALISE_PILAR.md](./SAAS_IS_DEAD_ANALISE_PILAR.md) e [ICP_E_PLANO_DESIGN_PARTNER_2026-05.md](./ICP_E_PLANO_DESIGN_PARTNER_2026-05.md); tendência de mercado em `research/themes/pricing.md`.

---

## ⚠️ Estado real vs proposto (verificado em produção 2026-07-13)

Um red team verificou este modelo contra o banco de produção. **Os números abaixo, nas seções seguintes, são PROPOSTA — não é o que o sistema cobra hoje.** Reconciliar antes de qualquer conversa de preço.

| Item | Proposto neste doc | Cobrado/estado HOJE (produção) |
|---|---|---|
| Preço mensal | R$ 297 / 497 / 897 | **R$ 97 / 197 / 397** (`pilar_subscription_plans`) |
| Preço anual | — | R$ 970 / 1.970 / 3.970 |
| Nome do 3º plano | "Plus" | **`enterprise`** (o "Plus" não existe) |
| Limite do Pro | até 30 projetos | **50 projetos + 10 usuários** (limita por ambos, não só projeto) |
| Métrica de cota | projetos ativos | por **usuário E projeto** (`max_usuarios` + `max_projetos`) |
| Tiering aplicado | feature-flags por plano | **NÃO aplicado** — as 5 empresas têm as mesmas 13 features ligadas por default; **0 assinaturas** em `pilar_subscriptions`; trocar de plano não muda acesso |
| Créditos de IA | 20 / 100 / 500 + medição | `ai_usage_logs` existe mas tem **0 linhas** (IA nunca rodou em prod); não há ledger de créditos |

**Decisões pré-requisito (do CEO), antes de fixar preço:**
1. Qual régua vale — subir o banco para a proposta (297/497/897) ou ajustar a proposta ao banco (97/197/397)? Os docs de estratégia sugerem que 197 está subvalorizado.
2. A cota é por projeto, por usuário, ou ambos? (hoje o banco usa ambos; este doc propunha só projeto).
3. Só então: ligar o elo plano→features e unificar os mapas divergentes (ver "Dependências técnicas").

---

## Por que NÃO por usuário (seat)

Quase todo concorrente cobra por assento (ver comparativo abaixo). Na era da IA, o valor escala com **o trabalho que o software executa**, não com o número de pessoas. Cobrar por seat penaliza justamente a automação que se vende — coloca a empresa "torcendo para o cliente não usar o produto" (a16z, `research/a16z/ai-is-upending-saas-pricing.md`). **Projeto ativo** é a métrica que o escritório já entende e que mantém o custo previsível.

---

## Camada 1 — Assinatura por faixa de projetos ativos

Preço **flat/mês**. A faixa é o gatilho de upgrade — passou da cota, sobe de plano (não cobra por unidade extra).

> **Preço PROPOSTO abaixo ≠ cobrado hoje.** Ver "Estado real" no topo: o banco cobra R$ 97/197/397 e o 3º plano se chama `enterprise`. A coluna "hoje" mostra o vigente.

| Plano (slug) | Projetos | Preço HOJE | Preço PROPOSTO | Módulos incluídos | Créditos IA/mês |
|---|---|---|---|---|---|
| **`starter`** | até 10 (3 usuários) | R$ 97 | R$ 297 | Projetos+escopos, Financeiro, Propostas, Leads, Clientes, Relatórios, Mapa, Portal cliente | 20 |
| **`pro`** *(popular)* | até 50 (10 usuários) | R$ 197 | R$ 497 | Tudo do Starter + **margem real por projeto**, Timesheet, Capacidade, alerta de prejuízo, Portal premium (aprovar+pagar) | 100 |
| **`enterprise`** | ilimitado | R$ 397 | R$ 897 | Tudo do Pro + IA Hub completo, Templates, Relatórios avançados, usuários ilimitados, suporte prioritário | 500 |

**Definição de "projeto ativo":** projeto não-arquivado e não-concluído. Arquivar libera a cota. Essa é a métrica de cobrança — a definição precisa ficar cristalina na UI para o cliente confiar nela.

**Nota:** os feature-flags que já existem no código são o mecanismo que liga/desliga o pacote de cada tier — **não** se vende feature avulsa (à la carte). Ver dependências técnicas abaixo.

---

## Camada 2 — Créditos para os agentes de IA

O cliente **nunca vê "token"**. Vê **crédito por ação concluída** — a unidade que ele entende. O token é o COGS interno (escondido).

| Ação do agente | Custo p/ o cliente | Custo interno (inferência) | Margem |
|---|---|---|---|
| Orçamento / proposta gerada | 1 crédito | ~R$ 0,30–0,50 | alta |
| Relatório executivo mensal | 1 crédito | ~R$ 0,40–0,60 | alta |
| Diagnóstico de precificação / risco | 1 crédito | ~R$ 0,30–0,50 | alta |

- **Cota inclusa** no plano (20/100/500 créditos/mês).
- **Pacote extra:** R$ 49 por 50 créditos (~R$ 0,98/crédito).
- **Margem no crédito extra:** ~60% (preço ≈ 2,5× o custo). IA é pass-through de custo — margem AI-native fica em 50–60%, não 80% (`research/a16z/the-new-business-of-ai-economics.md`). Precificar o crédito como defesa de margem, não 1:1.

**Pré-requisito técnico (corrigido 2026-07-13):** a tabela `ai_usage_logs` **já existe e loga** `tokens_input`/`tokens_output` (COGS) via `_shared/ai-client.ts` — mas em produção tem **0 linhas** (a IA nunca rodou). O que falta NÃO é a tabela: é (a) *uso real* para medir o custo por ação, e (b) o **ledger de créditos** (contador de ações, cota 20/100/500 por plano, decremento, item extra no Asaas) — nada disso existe. Logar token ≠ metrificar e cobrar crédito.

---

## Camada 3 — Outcome (futuro)

"Pague pelos orçamentos aprovados sem edição." É o modelo com maior correlação com crescimento (`research/a16z/ai-is-driving-shift-to-outcome-based-pricing.md`), mas exige medir a **taxa de aprovação** antes de cobrar. **Não vender no escuro** — só após a telemetria da Camada 2 provar alta aprovação.

---

## Comparativo de concorrentes (2026-07)

Câmbio de referência ~R$ 5,50/US$. Confiança: ✅ fonte primária · 🟡 estimativa de review (G2/Capterra/ITQlick) · 🔒 sem preço público.

| Produto | Modelo | Preço de referência | Público? |
|---|---|---|---|
| **Pilar** (proposto) | **flat / projetos** | R$ 297–897/mês (time todo) | ✅ sim |
| Vobi (BR) | assinatura | ~R$ 103/mês 🟡 | 🔒 convite |
| Monograph (US) | por assento | US$ 25–55/seat ✅ (≈ R$ 138–303/pessoa) | ✅ sim |
| BQE Core (US) | assento + módulos | US$ 40–60/seat 🟡 (≈ R$ 220–330) | 🔒 cotação |
| Deltek Ajera (US) | por assento | ~US$ 200/seat 🟡 (≈ R$ 1.100) | 🔒 oculto |
| Deltek Vantagepoint (US) | assento + módulos | US$ 75–200/seat 🟡 | 🔒 oculto |
| Sienge / Prevision (BR) | custom | — | 🔒 oculto |

**Leitura:** só a **Monograph** publica preço, e **todos cobram por assento**. Um escritório de 7 pessoas paga ~R$ 1.700/mês na Monograph (7 × R$ 248); no Pilar cabe no **Pro por R$ 497 flat**. Preço transparente + flat por projeto é diferencial real no mercado AEC.

Detalhe da concorrência em [ANALISE_COMPETITIVA_VOBI.md](./ANALISE_COMPETITIVA_VOBI.md).

---

## O que validar antes de fechar os números

Pricing certo se acha iterando com 1–3 clientes reais, não na planilha. Perguntas para o design partner:

1. **Quantos projetos ativos ele tem hoje?** — valida as faixas (10/30/∞).
2. **Quanto pagaria pelo Pro?** — R$ 497 pode estar subvalorizado vs. o valor de "saber se o projeto dá lucro". Testar willingness-to-pay.
3. **Quantos orçamentos/propostas por mês?** — calibra a cota de créditos e o preço do pacote extra.
4. **Ancorar contra o quê?** — a hora do sócio/orçamentista, não a planilha grátis. Esse é o value gap.

---

## Dependências técnicas (o que o modelo assume no código)

Estado atual verificado no código (2026-07-13):

1. **Motor de feature-flags: existe e funciona.** `src/lib/permissions.ts` (`canDo`), `src/hooks/usePermissions.ts`, `src/components/FeatureRoute.tsx`; colunas `empresas.features` / `profiles.features` / `convites.features` (migration `20260425000001_features_columns_and_rls.sql`). **Manter** — é o que empacota os tiers.
2. **Elo plano → features: FALTA ligar — e o vazamento está confirmado em produção.** As features são setadas por um objeto **hardcoded fixo** na criação da empresa; `pilar-subscription-manage` **não** toca `empresas.features` e `canDo` **nunca lê o plano**. Prova (prod, 2026-07-13): as **5 empresas têm as mesmas 13 features ligadas** (incl. portal_cliente, relatorios, mapa, timesheet, metas, planejamento — que o doc queria vender como Pro/Enterprise), e há **0 assinaturas** em `pilar_subscriptions`. Ou seja: todo mundo já tem quase tudo de graça; downgrade não tira, upgrade não dá. Falta (a) `subscription-manage` escrever `empresas.features := getFeaturesForPlan(slug)`, e (b) `canDo` consultar o plano.
3. **Três mapas divergentes a unificar:** `src/lib/planFeatures.ts` (código morto, `TODO(billing)`) vs `src/lib/features.ts` (`includedInPlans`) vs `supabase/migrations/*seed_plan_features.sql` — contradizem-se sobre o que cada plano inclui, e nenhum bate com este doc.
4. **Ultra-admin: manter** (`src/pages/ultra-admin/`) — backoffice cross-empresa, necessário para provisionar features enquanto o elo acima não existe. Não é legado.
5. **`ai_usage_logs`: JÁ existe** (`20260514200003_ai_usage_logs.sql`), loga tokens/COGS, mas com **0 uso em prod**. O que falta é o **ledger de créditos** (cota/decremento/cobrança), não a tabela — ver Camada 2.
6. **Preços do banco (`027_pilar_saas_subscriptions.sql`): R$ 97/197/397**, com limites `max_usuarios` (3/10/∞) e `max_projetos` (10/50/∞). Divergem da proposta 297/497/897 — reconciliar (ver "Estado real" no topo).

---

## Referências

- `research/themes/pricing.md` — teoria de pricing SaaS/AI (4 modelos, tendências 2025-26).
- `research/a16z/ai-is-upending-saas-pricing.md`, `research/a16z/ai-is-driving-shift-to-outcome-based-pricing.md`, `research/a16z/how-to-price-and-package-gen-ai.md`, `research/a16z/the-new-business-of-ai-economics.md`.
- `research/techstars-500/iconiq-state-of-ai-growth.md`, `research/techstars-500/high-alpha-2025-saas-benchmarks.md`, `research/techstars-500/bessemer-vertical-saas-playbook.md`.
- [ICP_E_PLANO_DESIGN_PARTNER_2026-05.md](./ICP_E_PLANO_DESIGN_PARTNER_2026-05.md), [ESTRATEGIA_PRODUTO.md](./ESTRATEGIA_PRODUTO.md), [SAAS_IS_DEAD_ANALISE_PILAR.md](./SAAS_IS_DEAD_ANALISE_PILAR.md).
