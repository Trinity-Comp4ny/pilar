# Pricing — Modelo de Cobrança do Pilar

> Rascunho **v2** · atualizado 2026-08-10 (v1 em 2026-07-13) · números indicativos para validação com o design partner — **não** é tabela final de preço.
> Versão visual (para apresentar): artifact "Como o Pilar vai cobrar".

---

## Decisão 2026-08-10 — plataforma única + eixo de cobrança (prevalece)

Painel de 5 vozes (pricing, produto, red team, ICP, vendas) fechou o modelo de cobrança. Isto prevalece sobre o texto v1 abaixo onde houver divergência.

**1. Uma plataforma, um plano. Nunca vender módulo separado nem SKU por produto.** Confirma e radicaliza a [decisão de 2026-07-30](./DECISAO_MODULOS_INDEPENDENTES_2026-07-30.md): não há à la carte nem SKU por produto pago. Vender junto protege a North Star — margem só existe com receita + custo + horas no mesmo lugar. O tier muda **o quanto** (projetos, créditos), nunca **o quê** (a plataforma é inteira em todo plano).

**2. Eixo de cobrança = faixa de projetos ativos.** É a métrica que o escritório já pensa ("quantos projetos tenho rodando") e a que escala com o valor (mais projetos = mais margem em risco = mais valor entregue). Na conversa de venda, o pitch é **flat por empresa** ("R$690, a firma inteira, sem cobrar por cabeça nem por clique"); a faixa de projetos é o degrau de upgrade silencioso, não se menciona na primeira conversa.

**3. Seat (por usuário): rejeitado como régua.** Usuários **ilimitados** em todos os planos. Cobrar por assento faz o dono economizar assento e deixar estagiário/colaborador de fora — justamente quem lança a hora que faz o projeto estourar. Seat trava a captura de horas, que é o dado que sustenta a margem. Um teto de seats pode existir só como **limite de fair-use** (evitar o escritório de 40 pessoas no plano de entrada), nunca como base de cobrança.

**4. "Por uso" cru: rejeitado na base.** Conta variável assusta o ICP conservador (caixa apertado, financeiro na planilha) e não há infra de medição (`ai_usage_logs` com 0 linhas, sem ledger de créditos). Uso entra **só** como créditos de IA opcionais, com teto claro, ortogonais à base — nunca no coração do sistema.

**5. Packaging por maturidade (o que "a plataforma inteira" significa hoje):**
- **Incluído (vende como valor central):** tudo que está vivo — Projetos+Escopos+Aditivos, Financeiro (Visão/Fluxo/Mensal/Folha/Faturas/Contas), Propostas, Leads, Clientes, Pessoas, Mapa, Relatórios, Portal cliente.
- **"Em breve", incluído sem custo extra:** Obras (usar o badge `emBreve`/feature-flag que já existe em `src/lib/modules.ts`, off por default). Mostra a direção, não fatura, não promete data.
- **Fora do material de venda até ter uso real:** IA Hub (11 `ai-*`) e sub-financeiros dormentes (Projeção de caixa, Aging, DRE, Rentabilidade, WIP), atrás de flag desligada. **Nunca** prometer IA nem Asaas para fechar — queima o design partner.

**6. Próximo passo (custo R$0 de código):** mandar a proposta de R$690 por escrito à VRZ e colher a resposta. Os números das faixas abaixo são **hipótese de ancoragem até a VRZ responder** — pricing se acha iterando com cliente real, não na planilha. Só depois: ligar o elo plano→features (esforço S, ver Dependências técnicas).

## TL;DR

Modelo **híbrido em 3 camadas**, não modelo único:

1. **Assinatura** por faixa de **projetos ativos** (feature-flags definem o pacote de cada tier) — ativar agora.
2. **Créditos** para os agentes de IA (1 crédito = 1 ação concluída; cota no plano + pacote extra) — quando a IA subir.
3. **Outcome** (por resultado, ex.: orçamento aprovado sem edição) — só depois de instrumentar a telemetria.

Racional de fundo em [SAAS_IS_DEAD_ANALISE_PILAR.md](./SAAS_IS_DEAD_ANALISE_PILAR.md) e [ICP_E_PLANO_DESIGN_PARTNER_2026-05.md](./ICP_E_PLANO_DESIGN_PARTNER_2026-05.md); tendência de mercado em `research/themes/pricing.md`.

---

## ⚠️ Estado real vs proposto (verificado em produção 2026-07-13)

Um red team verificou este modelo contra o banco de produção. **Os números abaixo, nas seções seguintes, são PROPOSTA — não é o que o sistema cobra hoje.** Reconciliar antes de qualquer conversa de preço.

| Item | Proposto neste doc (v2) | Cobrado/estado HOJE (produção) |
|---|---|---|
| Preço mensal | R$ 490 / 690 / 1.290 (âncora R$ 690) | **R$ 97 / 197 / 397** (`pilar_subscription_plans`) |
| Preço anual | — | R$ 970 / 1.970 / 3.970 |
| Nomes dos planos | Essencial / Profissional / Escala | slugs `starter` / `pro` / `enterprise` |
| Limite por faixa | até 15 / até 40 / ∞ projetos | **10 / 50 / ∞ projetos + 3 / 10 / ∞ usuários** (limita por ambos) |
| Métrica de cota | **projetos ativos** (usuários ilimitados) | por **usuário E projeto** (`max_usuarios` + `max_projetos`) — remover o teto de usuários |
| Tiering aplicado | feature-flags por plano | **NÃO aplicado** — as 5 empresas têm as mesmas 13 features ligadas por default; **0 assinaturas** em `pilar_subscriptions`; trocar de plano não muda acesso |
| Créditos de IA | 20 / 100 / 500 + medição | `ai_usage_logs` existe mas tem **0 linhas** (IA nunca rodou em prod); não há ledger de créditos |

**Decisões pré-requisito (do CEO), antes de fixar preço:**
1. ✅ **Resolvido na v2 (2026-08-10):** a régua é subir o preço para o valor (âncora R$ 690), não ajustar ao banco. Número final pende da resposta escrita da VRZ.
2. ✅ **Resolvido na v2:** a cota é por **projeto ativo** só; remover o teto de usuários do banco (usuários ilimitados). Ver a decisão no topo.
3. Só então: ligar o elo plano→features e unificar os mapas divergentes (ver "Dependências técnicas").

---

## Por que NÃO por usuário (seat)

Quase todo concorrente cobra por assento (ver comparativo abaixo). Na era da IA, o valor escala com **o trabalho que o software executa**, não com o número de pessoas. Cobrar por seat penaliza justamente a automação que se vende — coloca a empresa "torcendo para o cliente não usar o produto" (a16z, `research/a16z/ai-is-upending-saas-pricing.md`). **Projeto ativo** é a métrica que o escritório já entende e que mantém o custo previsível.

O argumento decisivo, porém, não é margem, é **adoção**: se cobra por cabeça, o dono compra só os assentos dos sócios e deixa estagiário e engenheiro de execução de fora. Mas são eles que lançam a hora que faz o projeto estourar. Sem eles dentro, o dado de horas nunca é capturado, e sem horas não existe margem real — que é o motivo do produto existir. Seat trava a base que alimenta a própria promessa. Por isso: usuários ilimitados, e um eventual teto de seats só como **limite de fair-use**, nunca como régua de cobrança.

---

## Camada 1 — Assinatura por faixa de projetos ativos

Preço **flat/mês**, a plataforma inteira em todo plano. A faixa de **projetos ativos** é o único gatilho de upgrade — passou da cota, sobe de plano (não cobra por unidade extra). **Usuários ilimitados em todos os planos.**

> **Faixas hipótese (v2, 2026-08-10), âncora R$690 no plano do meio.** Números indicativos até a VRZ responder por escrito. O que muda vs. o banco: remove o teto de usuários como régua e sobe o preço para o valor. Ver "Estado real" no topo: o banco cobra R$ 97/197/397 hoje.

| Plano | Projetos ativos | Preço/mês (hipótese) | Usuários | Créditos IA/mês | Perfil |
|---|---|---|---|---|---|
| **Essencial** | até 15 | R$ 490 | ilimitado | 30 | escritório pequeno (5–8 pessoas), não trava na entrada |
| **Profissional** *(âncora)* | até 40 | **R$ 690** | ilimitado | 100 | centro do ICP — VRZ (7 pessoas, ~20 projetos) entra com folga |
| **Escala** | ilimitado | R$ 1.290 | ilimitado | 300 | escritório maior / multi-equipe |

Todo plano tem a plataforma inteira (Projetos, Financeiro, Propostas, Leads, Clientes, Portal, Relatórios, Mapa, Pessoas; Obras entra como "em breve" sem custo extra). O salto de plano é por **capacidade** (projetos ativos), nunca por feature.

**Definição de "projeto ativo":** projeto não-arquivado e não-concluído. Arquivar libera a cota, na hora e de graça. Essa é a métrica de cobrança — a definição e o contador precisam ficar cristalinos na UI para o cliente confiar (senão a régua vira atrito). É o contrato de confiança do modelo.

**Nota:** os feature-flags que já existem no código são o mecanismo que liga/desliga o pacote — **não** se vende feature avulsa (à la carte). O flag serve para o packaging por maturidade (esconder dormente), não para diferenciar tier. Ver dependências técnicas abaixo.

---

## Camada 2 — Créditos para os agentes de IA

O cliente **nunca vê "token"**. Vê **crédito por ação concluída** — a unidade que ele entende. O token é o COGS interno (escondido).

| Ação do agente | Custo p/ o cliente | Custo interno (inferência) | Margem |
|---|---|---|---|
| Orçamento / proposta gerada | 1 crédito | ~R$ 0,30–0,50 | alta |
| Relatório executivo mensal | 1 crédito | ~R$ 0,40–0,60 | alta |
| Diagnóstico de precificação / risco | 1 crédito | ~R$ 0,30–0,50 | alta |

- **Cota inclusa** no plano (30/100/300 créditos/mês).
- **Pacote extra:** R$ 49 por 50 créditos (~R$ 0,98/crédito), com teto claro para o cliente prever a conta.
- **Margem no crédito extra:** ~60% (preço ≈ 2,5× o custo). IA é pass-through de custo — margem AI-native fica em 50–60%, não 80% (`research/a16z/the-new-business-of-ai-economics.md`). Precificar o crédito como defesa de margem, não 1:1.

**Pré-requisito técnico (corrigido 2026-07-13):** a tabela `ai_usage_logs` **já existe e loga** `tokens_input`/`tokens_output` (COGS) via `_shared/ai-client.ts` — mas em produção tem **0 linhas** (a IA nunca rodou). O que falta NÃO é a tabela: é (a) *uso real* para medir o custo por ação, e (b) o **ledger de créditos** (contador de ações, cota 30/100/300 por plano, decremento, item extra no Asaas) — nada disso existe. Logar token ≠ metrificar e cobrar crédito.

---

## Camada 3 — Outcome (futuro)

"Pague pelos orçamentos aprovados sem edição." É o modelo com maior correlação com crescimento (`research/a16z/ai-is-driving-shift-to-outcome-based-pricing.md`), mas exige medir a **taxa de aprovação** antes de cobrar. **Não vender no escuro** — só após a telemetria da Camada 2 provar alta aprovação.

---

## Comparativo de concorrentes (2026-07)

Câmbio de referência ~R$ 5,50/US$. Confiança: ✅ fonte primária · 🟡 estimativa de review (G2/Capterra/ITQlick) · 🔒 sem preço público.

| Produto | Modelo | Preço de referência | Público? |
|---|---|---|---|
| **Pilar** (proposto) | **flat / projetos** | R$ 490–1.290/mês (time todo, usuários ilimitados) | ✅ sim |
| Vobi (BR) | assinatura | ~R$ 103/mês 🟡 | 🔒 convite |
| Monograph (US) | por assento | US$ 25–55/seat ✅ (≈ R$ 138–303/pessoa) | ✅ sim |
| BQE Core (US) | assento + módulos | US$ 40–60/seat 🟡 (≈ R$ 220–330) | 🔒 cotação |
| Deltek Ajera (US) | por assento | ~US$ 200/seat 🟡 (≈ R$ 1.100) | 🔒 oculto |
| Deltek Vantagepoint (US) | assento + módulos | US$ 75–200/seat 🟡 | 🔒 oculto |
| Sienge / Prevision (BR) | custom | — | 🔒 oculto |

**Leitura:** só a **Monograph** publica preço, e **todos cobram por assento**. Um escritório de 7 pessoas paga ~R$ 1.700/mês na Monograph (7 × R$ 248); no Pilar cabe no **Profissional por R$ 690 flat, com usuários ilimitados**. Preço transparente + flat por projeto + não cobrar por cabeça é diferencial real no mercado AEC.

Detalhe da concorrência em [ANALISE_COMPETITIVA_VOBI.md](./ANALISE_COMPETITIVA_VOBI.md).

---

## O que validar antes de fechar os números

Pricing certo se acha iterando com 1–3 clientes reais, não na planilha. Perguntas para o design partner:

1. **Quantos projetos ativos ele tem hoje?** — valida os cortes das faixas (15/40/∞).
2. **R$ 690 é teto ou tem folga?** — o Profissional pode estar subvalorizado vs. o valor de "saber se o projeto dá lucro". Testar o topo (topa R$ 690? topa R$ 890?).
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
