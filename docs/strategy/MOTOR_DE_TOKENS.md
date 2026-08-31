# Motor de Tokens: o modelo econômico do Pilar como vertical AI

> **Data:** 2026-08-31 · **Status:** Plano aprovado pelo CEO, em execução por fases
> **Fundado por:** decisão de 2026-08-31 em [DECISOES.md](./DECISOES.md) (token vira a unidade
> exposta, supera a doutrina "ação de IA" do PRICING.md 17/08)
> **Arquitetura:** [ADR 0035](../architecture/adr/0035-ledger-de-tokens-fonte-unica-de-uso-de-ia.md)
> **Primeira fase implementável:** [SPEC 074](../specs/074-motor-de-tokens-ledger-saldo-e-debito.md)

---

## 1. Tese

O Pilar está virando um produto AI-native: os agentes (propostas, cotações, importação
financeira, chat, e os que vêm com Obras) deixam de ser acessório e passam a ser parte central
do valor entregue. Nesse desenho, **token é o eixo econômico da camada de IA**:

- Todo plano inclui uma **cota mensal de tokens**.
- O cliente **vê o consumo e o saldo em tokens**, pelo nome (decisão 31/08).
- Quem precisa de mais **compra pacote de tokens avulso**, opt-in, nunca cobrança surpresa.
- Token é ao mesmo tempo a unidade de venda (cliente) e a unidade de COGS (interno):
  uma régua só, sem camada de tradução.

O que NÃO muda: a base do pricing continua sendo o plano flat por faixa de projetos ativos
(PRICING.md, decisão 2026-08-10). Token é a **Camada 2**, ortogonal à base. "Por uso cru" no
coração do sistema continua rejeitado: a mensalidade é previsível, o token tem teto claro,
e estourar a cota nunca gera cobrança automática (bloqueia e oferece o pacote).

## 2. Princípios (o contrato de confiança)

1. **Previsibilidade primeiro.** O ICP é conservador com conta variável. Cota inclusa
   generosa, teto duro, compra sempre explícita. Zero overage automático.
2. **Transparência total do consumo.** Extrato por evento: qual agente, quem usou, quando,
   quantos tokens. O cliente audita o próprio consumo; sem isso, token vira caixa-preta e
   atrito de renovação.
3. **Uma fonte de verdade.** Todo token que entra ou sai passa pelo ledger (ADR 0035).
   Nenhum contador paralelo: a classe de bug do `ai_usage`/`increment_ai_usage` (contador
   dessincronizado falhando em silêncio) morre por design.
4. **Margem defendida por dado, não por chute.** Pacote extra precificado a ~2,5x o COGS
   medido (margem ~60%, referência a16z para AI-native). O painel interno (Fase 5) mostra
   margem real por empresa e por agente antes de qualquer ajuste de preço.
5. **Bloquear a próxima chamada, nunca a corrente.** O custo no provider já ocorreu quando o
   total de tokens é conhecido; overdraft de uma chamada é aceito e o gate barra a seguinte.

## 3. Modelo econômico

### Dois baldes, débito em cascata

| Balde | Origem | Expira? | Ordem de débito |
|---|---|---|---|
| **Tokens do plano** | Crédito automático na virada do ciclo de cobrança | Sim, zera na renovação (use-or-lose) | 1º |
| **Tokens comprados** | Pacote avulso pago via Asaas (ADR 0028) | Não expira no ciclo | 2º |

Regras:

- Débito consome primeiro o balde do plano; só então o comprado. Protege o token pago do
  cliente ("meu pacote não pode ser engolido pelo reset mensal").
- Saldo zerado nos dois baldes: chamadas de IA bloqueadas com mensagem clara (o que houve +
  próximo passo: esperar a renovação ou comprar pacote). O resto da plataforma segue intacto.
- Compra de pacote: item avulso no Asaas, crédito no ledger na confirmação do webhook,
  idempotente pelo id do pagamento.

### Números (hipóteses, calibrar na Fase 0)

As cotas por plano e o preço do pacote **não se fixam antes de medir**. A tabela v3 do
PRICING.md previa 40/150/500 "ações"; a conversão disso para tokens depende do custo médio
real por operação de cada agente, que a Fase 0 mede em produção. Ordem de grandeza inicial
(marcada como chute, não promessa):

| Plano | Cota de tokens/mês (hipótese) |
|---|---|
| Essencial | ~500 mil |
| Profissional | ~2 milhões |
| Escala | ~8 milhões |
| Enterprise | sob consulta |
| Pacote extra | ~R$ 49 por bloco (tamanho do bloco = f(COGS medido, margem 2,5x) |

Nada disso entra em copy, LP ou proposta comercial antes do fim da Fase 0 e do ok de Pricing.

## 4. Estado real do código (verificado 2026-08-31)

O que já existe e é aproveitado:

- `agent_runs` (PR #251, mergeado): os 14 agentes `ai-*` unificados, cada run com
  `tokens_input/output`, `agent_type`, `created_by` (usuário) e `model`.
- `ai_usage_logs`: log granular por chamada, mas **sem `user_id`** e sem vínculo com run.
- `ai_usage`: agregado mensal por empresa com teto de **requests** (não tokens); já foi
  dropada por engano uma vez e recriada (migration `20260841000000`), histórico que motiva
  o princípio 3.
- Gate atual (`_shared/ai-client.ts`): janela curta de 30 chamadas/60s + teto mensal de
  requests. Nenhum gate por token.
- Asaas: `asaas-config`, `asaas-criar-cobranca`, `asaas-webhook` prontos no backend
  (ADR 0028), UI zero. O fluxo de compra reusa essa fronteira.
- `pilar_subscription_plans`: sem coluna de cota de tokens (entra na Fase 2).
- IA Hub: maior parte atrás de flag de early access. O motor mede o que roda; reativar
  agentes dormentes é programa separado (aumenta o consumo que o motor fatura, mas não é
  pré-requisito de nenhuma fase daqui).

## 5. Arquitetura alvo (resumo; detalhe no ADR 0035)

```
chamada LLM (edge function ai-*)
   └─ ai-client.ts
        ├─ pré-gate: saldo > 0? (leitura O(1) em ai_token_saldo)
        ├─ chamada ao provider → usage real (tokens in/out)
        └─ RPC debitar_tokens(idempotency_key, ...)
             └─ INSERT em ai_token_ledger  ── trigger ──▶ ai_token_saldo (cascata plano→comprado)

renovação de ciclo (pg_cron) ──▶ INSERT plan_grant no ledger (recarrega saldo_plano)
webhook Asaas (pagamento) ────▶ INSERT purchase no ledger (soma saldo_comprado)

breakdown por usuário / agente / empresa / mês = views SQL sobre o ledger
COGS = tokens × preço vigente do modelo (tabela ai_model_precos, snapshot por evento)
```

- `ai_token_ledger`: append-only, fonte única (uso, crédito de plano, compra, ajuste, estorno).
- `ai_token_saldo`: cache O(1) por empresa, mantido só por trigger do ledger.
- `ai_usage_logs` e `ai_usage`: migram para o ledger e saem de circulação (passo final,
  com backfill; nunca drop antes de nada ler delas).

## 6. Programa por fases

Cada fase tem critério de saída verificável. Nenhuma fase seguinte começa sem a anterior fechada.

### Fase 0 · Instrumentação e verdade dos dados

Medir antes de cobrar. Sem isso, cota e preço são chute.

- Query direta em produção: volume real em `ai_usage_logs` e `agent_runs` por `feature_key`/
  `agent_type` (o PRICING.md pede isso desde 07/2026 e nunca foi feito).
- Garantir que **toda** chamada LLM registra tokens + usuário + agente (hoje `ai_usage_logs`
  não tem `user_id`).
- Criar `ai_model_precos` (preço por modelo, com vigência) e validar o cálculo de COGS.
- **Saída:** 30 dias de dado com 100% das chamadas atribuídas (empresa, usuário, agente,
  tokens, custo estimado) e custo médio por operação de cada agente conhecido.

### Fase 1 · Ledger + saldo (SPEC 074)

A fundação contábil, em shadow mode (mede, não bloqueia).

- `ai_token_ledger`, `ai_token_saldo`, RPC `debitar_tokens` idempotente, trigger de saldo,
  views de breakdown, backfill do histórico.
- **Saída:** saldo cacheado bate com o SUM do ledger em produção por 14 dias, divergência zero.

### Fase 2 · Enforcement (cota por plano)

- Coluna `tokens_mensais` em `pilar_subscription_plans`; `plan_grant` na virada do ciclo
  (pg_cron; lembrar que o agendamento é manual por ambiente, mesmo gap dos alertas ambient).
- Gate do `ai-client.ts` passa a bloquear por saldo, com erro tipado que o front traduz
  (o que houve + próximo passo, padrão de mensagem de erro da casa).
- **Saída:** empresa com saldo zero é bloqueada em staging com a mensagem certa; empresa com
  saldo segue sem atrito; teste automatizado do débito em cascata e da corrida (idempotência).

### Fase 3 · Compra de tokens (Asaas)

- SKU "pacote de tokens" via `asaas-criar-cobranca`; `asaas-webhook` credita o ledger na
  confirmação (idempotente por id de pagamento).
- **Saída:** compra→crédito→consumo de ponta a ponta em staging, incluindo replay de webhook
  sem crédito duplicado.

### Fase 4 · Superfícies de cliente

- Saldo (plano + comprado) nas Configurações da empresa; extrato de consumo (DataTable,
  filtro por período/agente/usuário); alerta de saldo baixo pela central de notificações
  (spec 029); fluxo de compra na UI.
- Copy: consultar `brand/voice-tone.md`; "token" pelo nome, sem jargão inflado.
- **Saída:** design partner enxerga saldo, extrato e compra sem explicação por chamada.

### Fase 5 · Painel interno (COGS e margem)

- Ultra-admin: uso por empresa/agente/usuário cross-tenant, COGS real vs receita de token,
  margem por plano, tendência.
- **Saída:** decisão de calibração de cota/preço tomada com esse painel, não com query manual.

### Fase 6 · Pricing GA

- Números finais (cota por plano, preço do pacote) fixados com dado das Fases 0-5;
  PRICING.md v4; copy de LP e página de planos; material de venda.
- **Saída:** tabela pública de planos com tokens no ar, reconciliada com o que o sistema
  de fato aplica (fecha o gap histórico "copy de venda sem enforcement").

## 7. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| ICP conservador rejeita conta variável (motivo da doutrina anterior) | Base flat intocada; token com teto duro; compra opt-in; zero cobrança automática. Validar reação do design partner na Fase 4, antes do GA |
| Token vira caixa-preta ("gastei com o quê?") | Extrato por evento desde a Fase 4; princípio 2 |
| Dupla contabilidade volta (agent_runs vs ledger) | Regra de código: escrita de token só via `debitar_tokens`; revisão barra insert direto |
| Corrida/retry duplica débito ou crédito | `idempotency_key` no débito; unique em `reference_id` no crédito de compra |
| Margem esmagada por mudança de preço do provider | COGS snapshot por evento + `ai_model_precos` com vigência; painel Fase 5 alerta |
| Drop acidental de tabela de billing (já aconteceu com `ai_usage`) | Ledger é módulo ativo documentado aqui; deprecações só na ordem backfill→leitura→drop |
| Cota mal calibrada (cliente bate teto no 1º mês) | Fase 0 obrigatória antes de fixar número; shadow mode da Fase 1 mede sem punir |

## 8. Métricas do motor

- **Consumo:** tokens/mês por empresa, por agente, por usuário; % da cota consumida (mediana e p90).
- **Receita:** MRR de pacotes extras; taxa de conversão saldo-zerado→compra.
- **Margem:** COGS total vs receita atribuível à camada de IA; margem por agente.
- **Confiabilidade:** divergência ledger vs saldo (deve ser zero); débitos duplicados (zero).
- **Adoção (North Star da camada):** % de empresas ativas que consomem IA no mês.

## 9. Pendências que este plano NÃO resolve (registrar, não esquecer)

- Enforcement de `max_projetos`/`max_obras` (eixo de capacidade da base flat) continua sem
  wiring; é a mesma dívida apontada no PRICING.md item 7, fora do escopo do motor de tokens.
- Reativação/reparo dos agentes dormentes do IA Hub: programa próprio.
- Trial de 14 dias não expira (gate aberto conhecido): quando fechar, definir cota de token
  do trial (sugestão: cota pequena única, não renovável, decidir na Fase 2).
