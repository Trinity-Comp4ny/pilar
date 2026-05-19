# ICP Afiado e Plano de 4 Semanas — Design Partner

**Data**: 2026-05-19
**Contexto**: Refinamento do ICP a partir de dados reais do design partner. Complementa [ESTRATEGIA_PRODUTO.md](./ESTRATEGIA_PRODUTO.md) e [SAAS_IS_DEAD_ANALISE_PILAR.md](./SAAS_IS_DEAD_ANALISE_PILAR.md).

---

## ICP refinado (nível 2)

`ESTRATEGIA_PRODUTO.md` já define ICP como "engenharia multidisciplinar". Este doc afia a granularidade.

**Subvertical AEC**: Escritório de projetos multidisciplinar atendendo PF que constrói casa residencial.

### Perfil concreto (validado com design partner)

| Atributo | Valor |
|---|---|
| Colaboradores | 5-15 (design partner: 7) |
| Projetos ativos simultâneos | 15-40 (design partner: 20) |
| Ticket médio por projeto | R$5k-R$30k (design partner: R$10k) |
| Cliente final | Pessoa Física construindo casa residencial |
| Disciplinas | Estrutural + Elétrico + Hidráulico + Arquitetônico |
| Ferramenta atual | Excel + WhatsApp |
| Controle de hora | **Zero** — apenas estimativa mental |
| Faturamento estimado | R$400k-R$800k/ano |

### Por que esse fit é forte

- Produto atual (Projetos, Propostas, Financeiro, Portal) bate ~80% das necessidades
- Falta crítica: Timesheet ativo + Asaas UI integrado
- Concorrentes grandes (Sienge, Vobi) miram construtora/incorporadora — não esse perfil
- Janela de mercado aberta

### Anti-ICP (não atender ainda)

- Construtora (precisa medição, diário de obra, físico-financeiro)
- Incorporadora (precisa CRM de unidade, VGV)
- Arquitetura puramente decorativa (já atendida por Vobi/concorrentes)
- Cliente final B2B (construtora contratando projetista) — adjacente, atender depois

---

## Dor central do ICP

> "Aceitei o projeto por R$10k achando que dava margem. No fim, gastei 3x mais horas porque o cliente PF pediu mudança 4 vezes sem aditivo. Meu lucro virou prejuízo e só descobri 3 meses depois."

**Pilar resolve isso** com 3 features killer:

1. **Cobrança parcelada Asaas** — PF não paga R$10k à vista. Padrão: entrada + parcelas por entrega.
2. **Timesheet + margem real por projeto** — hora gasta vs orçada, alerta antes de virar prejuízo.
3. **Portal cliente PF-friendly** — PF leigo aprova entregas, vê o que falta, paga.

---

## Estado real do código (auditado 2026-05-19)

### Asaas — quase tudo pronto

| Componente | Estado |
|---|---|
| Hook `useAsaas.ts` (142 linhas) | ✅ |
| `AsaasConfigForm.tsx` | ✅ |
| `AsaasCobrancaButton.tsx` | ✅ |
| Edge function `asaas-criar-cobranca` | ✅ |
| Webhook + idempotência | ✅ |
| **Botão plugado em Faturas** | ❌ |
| **Tela de Integrações expondo config** | ❌ confirmar |

**Gap real**: integração nas telas, não construção.

### Timesheet — muito mais pronto do que `PLANO_MELHORIAS_2026-05.md` registra

`PLANO_MELHORIAS_2026-05.md` listou Timesheet como "MVP a construir do zero". **Desatualizado.** Estado real:

| Componente | Estado |
|---|---|
| Migration `20260514200000_timesheet.sql` (tabela `timesheet_lancamentos` + RLS) | ✅ Aplicada |
| `pages/Timesheet.tsx` (284 linhas) | ✅ |
| `components/LancarHorasDialog.tsx` (185 linhas) | ✅ |
| `hooks/useTimesheet.ts` (158 linhas) | ✅ |
| Rota `/timesheet` em App.tsx | ✅ |
| Sidebar com feature flag `timesheet` | ✅ |
| View `v_budget_vs_actual` | ✅ |
| `BudgetActualCard` | ✅ |
| **Feature flag ativada** | ❌ |
| **UX validada em produção** | ❌ |
| **Custo/hora por pessoa** | ❌ confirmar |
| **Integração com margem de projeto** | ❌ |

**Diagnóstico**: ativação + integração + polimento. Não construção.

---

## Plano de 4 Semanas

### Semana 1 — Asaas UI no fluxo de faturas

**Objetivo**: design partner cobra PF via PIX/boleto direto do Pilar.

- Plugar `AsaasCobrancaButton` na lista de Faturas + detalhe de Fatura
- Tela "Integrações" expondo `AsaasConfigForm`
- Fluxo end-to-end: fatura criada → clique → cobrança Asaas → link enviado pro cliente
- Webhook Asaas → atualizar status fatura (paga/inadimplente)
- Smoke test com sandbox Asaas

**Entregável**: 1 fatura real cobrada via Asaas pelo design partner.

### Semana 2 — Timesheet ativado e usável

**Objetivo**: 7 engenheiros do design partner lançando hora diariamente.

- Ativar feature flag `timesheet` para design partner
- Auditar UX: lançamento de hora <10s (atalho, projetos recentes no topo)
- Campo `custo_hora_padrao` em Pessoas
- Validar RLS: engenheiro vê próprias horas, gestor vê todas
- Onboarding presencial de 1h com design partner

**Entregável**: 5 dias úteis com >70% de adesão.

### Semana 3 — Margem real por projeto

**Objetivo**: design partner descobre qual projeto está dando prejuízo.

- Plugar `BudgetActualCard` no detalhe de projeto
- Card "Margem real": Receita - (horas × custo/hora) - despesas diretas
- Alerta visual: >80% das horas consumidas com <80% do escopo entregue
- Dashboard global: "Top 5 projetos com risco de prejuízo"

**Entregável**: relatório de margem dos 20 projetos ativos do design partner.

### Semana 4 — Cliente zero pagante + material de venda

**Objetivo**: formalizar pagante #1, gerar prova social.

- Contrato + Asaas: design partner paga R$297 via próprio Pilar (eat your own dog food)
- Feedback estruturado: o que economiza tempo? o que descobriu sobre lucro?
- Case study 1 página: "Como Escritório X descobriu que N projetos estavam dando prejuízo"
- Landing focada: headline + 3 dores PF-residencial + case + CTA trial
- Pedir 3 indicações de escritórios parecidos

**Entregável**: 1 pagante confirmado + 3 leads qualificados.

---

## Pricing recomendado

NÃO cobrar por usuário. Cobrar por **projetos ativos** = alinha com valor entregue.

| Plano | Limite | Preço |
|---|---|---|
| Starter | até 10 projetos ativos | R$297/mês |
| Pro | até 30 projetos ativos | R$497/mês |
| Plus | ilimitado | R$897/mês |

**Justificativa**: time pequeno (7 pessoas) com 20 projetos. Cobrar por usuário trava expansão. Cobrar por projeto = cliente paga mais quando ganha mais.

---

## Sizing do mercado

| Métrica | Valor |
|---|---|
| TAM estimado (escritórios projetistas PF-residencial BR) | 5k-15k |
| ARR por cliente | R$3,6k-R$10,8k |
| Clientes para R$1M ARR | 170-280 |
| Horizonte realista | 24-36 meses |

---

## Riscos

1. **Webhook Asaas em produção**: testar idempotência com cuidado. Cobrança duplicada em cliente PF é desastre.
2. **Adoção do Timesheet**: se UX de lançamento travar, vira Excel de novo. Atalho de teclado + lista de projetos recentes é crítico.
3. **Custo/hora inicial**: design partner não sabe o custo real. Começar com chute (engenheiro pleno ≈ R$80/h) e refinar.
4. **Privacidade do lançamento de horas**: engenheiros podem resistir a "ser vigiados". Posicionar como transparência de margem do escritório, não controle individual.
5. **Design partner love ≠ PMF**: ele aceita coisas que cliente frio rejeita. Validação real só vem do cliente #5+.

---

## Decisões pendentes (responder pra destravar Semana 1)

1. **Conta Asaas**: única do escritório (mais simples) ou cada cliente Pilar com a sua (mais escalável)?
2. **Custo/hora**: campo livre por pessoa OU faixas por cargo (Júnior/Pleno/Sênior)?
3. **Início da mensalidade do design partner**: Semana 1 (commit imediato) ou Semana 4 (após valor entregue)?

---

## Referências

- [SAAS_IS_DEAD_ANALISE_PILAR.md](./SAAS_IS_DEAD_ANALISE_PILAR.md) — racional estratégico de fundo
- [ESTRATEGIA_PRODUTO.md](./ESTRATEGIA_PRODUTO.md) — ICP nível 1, posicionamento, planos
- [PLANO_MELHORIAS_2026-05.md](./PLANO_MELHORIAS_2026-05.md) — backlog (nota: Timesheet mais avançado do que registrado lá)
- [ANALISE_COMPETITIVA_VOBI.md](./ANALISE_COMPETITIVA_VOBI.md) — concorrência

---

## Notas sobre o memory auto-recorded

Sinais relevantes do memory pra cruzar:
- Pilar Live State: IA Hub OFF, WIP OFF — não vender como diferencial agora
- Plano Melhorias 2026-05: confirma backlog de Asaas UI e Timesheet
- Análise Competitiva Vobi: Vobi tem 3 agentes IA em prod — gap. Mas Pilar pode vencer em **nicho mal-atendido (projetista PF-residencial)** antes de brigar em IA.
