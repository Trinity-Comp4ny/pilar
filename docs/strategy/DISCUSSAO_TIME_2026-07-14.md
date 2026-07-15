# Discussão aberta do time — estratégia de produto

**Data:** 2026-07-14 · **Formato:** discussão multi-agente em duas rodadas
**Participantes:** Head de Produto, Radar de Mercado AEC, Intel de Aceleradoras, Pricing, Vendas (founder-led), voz do ICP, Crítico/Red Team
← [voltar ao índice](./README.md)

> Registro de uma discussão aberta sobre produto, nicho, features, novas funcionalidades e expansão de mercado. Não é um plano assinado: é o debate cru, com as vozes preservadas, a contradição que apareceu e o desfecho que o time chegou. As decisões operacionais devem ser confirmadas antes de virar backlog.

---

## Como a discussão correu

Duas rodadas. Na **rodada 1**, seis especialistas deram seu diagnóstico em paralelo. Na **rodada 2**, o Crítico atacou o consenso que emergiu (foi ao SQL e achou um furo estrutural) e o Head de Produto arbitrou a saída. O ponto de virada foi uma contradição que ninguém tinha resolvido: a feature must-win apoiada num comportamento que o cliente jurou que nunca terá.

---

## Rodada 1 — as vozes

### Head de Produto
Estamos a **zero pagante** e a North Star ("% de projetos com margem calculada antes da entrega") ainda é ficção técnica: depende de custo real, que depende do Timesheet, que está dormente (`horas_reais = 0`). Enquanto isso, a branch `feat/ai-chat-consultivo` cresceu de "chat read-only" para **10 migrations de agentes que gravam dinheiro**. É o risco do founder-dev se materializando: polir a escrita agêntica sobre o mais irreversível (dinheiro) antes de um cliente pedir.

- **Pronto e vendável:** Projetos/Escopos/Aditivos, Financeiro operacional, Propostas, Clientes, Portal. Junta operação + dinheiro na mesma base, o que nenhum concorrente BR do nicho faz.
- **Fumaça:** IA Hub (11 `ai-*`, `ai_usage_logs = 0`), WIP/Rentabilidade/DRE/Aging, Timesheet/Capacidade. Asaas **foi removido** (commit `f1e4462`).
- **Movimentos de maior alavancagem:** (1) ligar plano→feature no servidor (existe em `features.ts`, não é enforced); (2) tornar a margem real antes da entrega; (3) subir só o chat consultivo read-only; (4) fechar A1/A2 de segurança.
- **Maior risco:** construir a coisa errada bem-feita. Sem custo real, a promessa central mente.

### Radar de Mercado AEC
O setor virou **"IA preditiva, não reativa"** em 2026. Concorrência:
- **Vobi** (YC, 70k users): Vobi Pay, mobile, 3 agentes IA, mas todos nível 1-2 (bookkeeping reativo). Não prevê nem alerta margem. Foco obra/arquitetura.
- **Sienge/Prevision:** o mais avançado em antecipação de custo, mas construção-cêntrico e enterprise.
- **Deltek Dela** (US): único com monitor proativo de margem explícito. Caro, US, govcon. Prova que o conceito vende.
- **Monograph/BQE** (US, A&E SMB): reativo, sem push.

**Janela aberta:** agente proativo de margem por projeto para engenharia multidisciplinar SMB no Brasil não tem dono. A janela fecha, a Vobi lança rápido.
**Expansão:** aprofundar no vertical (consultoria, ambiental, elétrica, MEP), não ir para arquitetura (core da Vobi) nem construtora (território Sienge).

### Intel de Aceleradoras
Pilar em **L0→L1, pre-PMF, founder solo**. Uma coisa importa: achar o *pull*. Consenso YC/a16z: **vender o trabalho (system of action), não responder**. Mas a ponte é HITL, não autonomia: o análogo é **Harvey.ai**, que venceu numa profissão regulada por **confiança** (expor raciocínio, citar fonte), não por capacidade.

- Read-only não é fase menor: é o degrau de confiança e o instrumento de PMF (medir taxa de aprovação-sem-edição).
- Preço: ancorar alto, outcome-based por orçamento aprovado; AI abaixo de US$50/mês tem retenção suicida (ChartMogul).
- **Alerta honesto:** a dor pode ser "Hard Fact" resignado (Sequoia ARC), não "Hair on Fire". Validar em entrevista antes de escalar.

### Pricing
O modelo v1 (3 camadas) está superdimensionado para 0 pagante. Só a Camada 1 importa agora.
- **Divergência que trava a conversa:** o banco cobra 97/197/397, o doc propõe 297/497/897, e o elo plano→feature não está ligado. Hoje, tecnicamente, ninguém consegue ser cobrado corretamente.
- **IA:** inclusa e ilimitada "justa" na fase design partner (objetivo é adoção + telemetria), créditos como add-on só depois de medir o custo real por ação.
- **Primeiro preço:** "Pro" R$ 690/mês, design partner com 50% por 6 meses. Não ancorar no 97/197/397 (vira teto psicológico).

### Vendas (founder-led)
Vender hoje = Projetos/Escopos/Aditivos, Financeiro, Propostas, Portal. IA e Asaas: não prometer.
- **Design partner mais quente já existe** (o escritório de 7 pessoas). Fechá-lo primeiro.
- **Aha moment:** sentar com o dado real dele e mostrar "Top 5 projetos em risco de prejuízo". No momento em que ele aponta a tela e diz "não sabia que esse estava no vermelho", a venda está feita.
- **Mínimo para vender:** custo/hora + card de margem real + alerta no dashboard + preço reconciliado.

### Voz do ICP (sócio-engenheiro, 15 pessoas)
- **Dor 1:** não saber se o projeto está no lucro enquanto corre. **Dor 2:** aditivo que não cobrei.
- **CRM/leads erra o alvo:** meu funil são 5 clientes recorrentes e indicação.
- **A frase que virou a discussão:** *"Meus engenheiros nunca vão apontar hora religiosamente. Se a rentabilidade depende de timesheet, o número vai estar errado e eu paro de confiar."*
- **IA:** confio para responder se ela mostrar a conta ("margem 12%, caiu porque a estrutural gastou 40h a mais"). Para executar financeiro, só com aprovar-antes-de-gravar e desfazer.
- **Pagaria** R$ 400 a 800/mês pela ferramenta toda. Por usuário assusta. Precisa rodar com meus dados reais num piloto de 30 dias.

---

## Rodada 2 — o Crítico ataca, o Produto arbitra

### Crítico / Red Team: a contradição não é opinião, está no SQL
Existem dois motores de margem no Pilar e os dois morrem sem digitação manual que o ICP já disse que não fará:

- **Motor A (WIP)**, `005_orcamento_marcos_faturas.sql` (~linha 925): `v_custo = v_horas × v_custo_hora_medio`, com `v_horas = SUM(timesheets aprovados)`. Sem timesheet, custo = 0 e a margem aparece como **100%**. O card do aha moment mostraria margem fantasia.
- **Motor B (Rentabilidade)**, `000_base_schema.sql:1607+`: `margem = receitas − despesas_diretas`, e **não inclui folha**. Para uma firma cujo maior custo é o engenheiro assalariado, isso infla a margem para 70-90%.

> "Margem real antes da entrega" não é uma feature que falta ligar. São dois motores que exigem exatamente o comportamento que o comprador já jurou que não terá. O time confundiu "a tabela existe" com "o dado existe", e correu pro Timesheet porque a tabela dormente estava ali (custo afundado).

**A premissa mais frágil:** 0 conversão depois de meses + "meus engenheiros nunca vão apontar hora" pode ser o mercado dizendo que a dor é **Hard Fact resignado, não Hair on Fire**. Firmas tocam projeto no prejuízo há décadas e sobrevivem.

**O teste barato:** pegar um projeto real de um prospect, carregar os números à mão numa planilha, mostrar o card. Se ele reconhece e pagaria, há sinal. **Se arrancar os números dele levar três semanas, essa demora é a resposta sobre a dor.**

**Onde o Crítico concorda:** congelar os 10 write-agents está certo. Escrita agêntica sobre dinheiro irreversível, pre-PMF, seria suicídio.

### Head de Produto: o desfecho
**Mata-se o Timesheet como pré-requisito de rentabilidade.** Mecanismo: **custo por alocação planejada, ajustável.** Cada Pessoa já tem custo mensal (Folha). O gestor define, por projeto, o **% de dedicação** de cada pessoa ("Ana 40% no Projeto X"). Custo do projeto = soma dos custos mensais rateados pelo %, acumulado no tempo. Reaproveita `rateio_centros_custo` (migration 20260504000004) e `AlocacaoVsReal` (Capacidade). O gestor arrasta um slider mensal, o engenheiro não aponta nada. Timesheet vira **calibrador opcional**, nunca o gate.

Antecipando o Crítico: o risco vira "e se o gestor não mantiver o slider?". Mitigação: alocação muda em escala de mês e por decisão do dono, não por evento diário; e o alerta de risco cria o loop de retorno que o apontamento nunca teve. Se nem isso ele mantém, a métrica única expõe na Etapa B, antes de qualquer investimento em IA.

---

## O que o time decidiu

### Sequência dos 90 dias (com gates)
1. **Etapa A (sem. 1-3) — Fundação de margem.** Custo por alocação em Pessoas + Projetos; card "margem real vs orçada"; alerta "Top 5 em risco de prejuízo"; reconciliar preço no banco; ligar plano→feature.
   **Gate:** design partner olha o dado real dele e reconhece a margem como verdadeira.
2. **Etapa B (sem. 4-8) — Ativação e pull.** Design partner rodando semanalmente, abrindo o alerta de risco sozinho ≥1x/semana.
   **Gate:** ele puxa sem cutucão E aceita virar pagante. Sem pull, não se constrói agente.
3. **Etapa C (sem. 9-13) — Copiloto com HITL.** Ligar o chat consultivo read-only, medindo aprovação-sem-edição. Escrita atrás de "aprovar antes de gravar" e do gate de role no `aprovar_orcamento_agente` (furo A1 aberto).

### Preço (fechado)
**R$ 690/mês, plano único "Pro", tudo incluso, por empresa (não por usuário).** IA inclusa agora para medir custo. Design partner: 50% por 6 meses (R$ 345). Fim do 97/197/397.

### Corte final (não se faz nos 90 dias, por nome)
Timesheet como base de rentabilidade · as 10 migrations `agent_write_*` (congeladas até o gate B) · Asaas UI · WIP/DRE/Aging/Projeção/Metas/Planejamento · créditos de IA como SKU · expansão para arquitetura/construtora · mobile.

### Métrica única
**% de projetos ativos do design partner com margem real calculada e visível antes da entrega.**

---

## Pergunta aberta (não resolvida)
A dor é **Hair on Fire** ou **Hard Fact resignado**? O time preferiu não cravar. O teste barato do Crítico (carregar um projeto real à mão e medir quanto tempo o prospect leva para entregar os números) resolve isso **antes** da Etapa A, custa uma reunião, e pode economizar 90 dias.

---

## Referências de código citadas na discussão
- `src/lib/features.ts` — elo plano→feature não enforced; `ai_chat` ativo
- `supabase/migrations/005_orcamento_marcos_faturas.sql` (~linha 900-960) — Motor A (WIP), margem 100% sem timesheet
- `supabase/migrations/000_base_schema.sql:1607+` — Motor B (Rentabilidade), sem folha
- `supabase/migrations/20260504000004_rateio_centros_custo.sql` — base do custo por alocação
- `src/pages/capacidade/components/AlocacaoVsReal.tsx` — UI de alocação (dormente)
- `supabase/migrations/*_agent_write_*.sql` — 10 write-agents congelados
- `docs/security/ACHADOS_SEGURANCA_AGENTES_2026-07-13.md` — furos A1/A2/A3
- `docs/strategy/VISAO_AGENTICA_PRODUTO.md` — diferencial = margem proativa
- `docs/strategy/PRICING.md` — modelo a reconciliar
