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

## Por que NÃO por usuário (seat)

Quase todo concorrente cobra por assento (ver comparativo abaixo). Na era da IA, o valor escala com **o trabalho que o software executa**, não com o número de pessoas. Cobrar por seat penaliza justamente a automação que se vende — coloca a empresa "torcendo para o cliente não usar o produto" (a16z, `research/a16z/ai-is-upending-saas-pricing.md`). **Projeto ativo** é a métrica que o escritório já entende e que mantém o custo previsível.

---

## Camada 1 — Assinatura por faixa de projetos ativos

Preço **flat/mês**. A faixa de projetos é o gatilho de upgrade — passou da cota, sobe de plano (não cobra por unidade extra).

| Plano | Projetos ativos | Preço/mês | Módulos incluídos | Créditos IA/mês |
|---|---|---|---|---|
| **Starter** | até 10 | R$ 297 | Projetos+escopos, Financeiro, Propostas, Leads, Clientes, Relatórios, Mapa, Portal cliente | 20 |
| **Pro** *(popular)* | até 30 | R$ 497 | Tudo do Starter + **margem real por projeto**, Timesheet, Capacidade, alerta de prejuízo, Portal premium (aprovar+pagar) | 100 |
| **Plus** | ilimitado | R$ 897 | Tudo do Pro + IA Hub completo, Templates, Relatórios avançados, usuários ilimitados, suporte prioritário | 500 |

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

**Pré-requisito técnico:** a tabela `ai_usage_logs` (pendência P2 crítica em [PLANO_MELHORIAS_2026-05.md](./PLANO_MELHORIAS_2026-05.md)) precisa existir para medir consumo. Sem medir, não há como cobrar uso.

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
2. **Elo plano → features: FALTA ligar.** Hoje o plano escolhido no checkout define só o **preço** (Asaas); as features são setadas por um objeto **hardcoded fixo** na criação da empresa e ajustadas na mão (Admin tab Features ou Ultra-Admin). `pilar-subscription-manage` **não** toca `empresas.features`. Para cobrança por tier automática, falta (a) o webhook/subscription-manage escrever `empresas.features` a partir do slug do plano, e (b) `canDo` consultar o plano ativo.
3. **Dois mapas divergentes a unificar:** `src/lib/planFeatures.ts` (código morto, tem `TODO(billing)`) vs `src/lib/features.ts` (`includedInPlans`). Contradizem-se sobre o que cada plano inclui.
4. **Ultra-admin: manter** (`src/pages/ultra-admin/`) — é o backoffice cross-empresa do operador do SaaS, necessário para provisionar features enquanto o elo acima não existe. Não é legado.
5. **`ai_usage_logs`: construir** — pré-requisito da Camada 2.

---

## Referências

- `research/themes/pricing.md` — teoria de pricing SaaS/AI (4 modelos, tendências 2025-26).
- `research/a16z/ai-is-upending-saas-pricing.md`, `research/a16z/ai-is-driving-shift-to-outcome-based-pricing.md`, `research/a16z/how-to-price-and-package-gen-ai.md`, `research/a16z/the-new-business-of-ai-economics.md`.
- `research/techstars-500/iconiq-state-of-ai-growth.md`, `research/techstars-500/high-alpha-2025-saas-benchmarks.md`, `research/techstars-500/bessemer-vertical-saas-playbook.md`.
- [ICP_E_PLANO_DESIGN_PARTNER_2026-05.md](./ICP_E_PLANO_DESIGN_PARTNER_2026-05.md), [ESTRATEGIA_PRODUTO.md](./ESTRATEGIA_PRODUTO.md), [SAAS_IS_DEAD_ANALISE_PILAR.md](./SAAS_IS_DEAD_ANALISE_PILAR.md).
