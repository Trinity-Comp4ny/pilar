# Pilar — Estratégia V2 (baseada em análise do codebase real)

> Substitui diagnóstico do `PRODUCT_STRATEGY.md`.
> Construído após leitura das migrations, rotas, edge functions e páginas reais.
> **Revisado com confirmação do dono sobre o que está VIVO em produção.**
> Data: 2026-04-23

## ⚠️ Distinção crítica deste documento

Existem três estados para cada feature. Eles NÃO são equivalentes:

- **VIVO** — código + menu + fluxo de dados real + validado com uso
- **DORMENTE** — código existe, pode até ter rota, mas **não foi validado em uso real** (pode ter bugs, estados vazios, queries incompletas)
- **AUSENTE** — não tem código

"Ter no repo" ≠ "estar vivo". Um módulo dormente parece funcional na demo, mas quebra na venda real. Esta versão do doc corrige isso.

---

## Sumário

1. [Correções ao diagnóstico anterior](#1-correções-ao-diagnóstico-anterior)
2. [Mapa real do produto (o que existe)](#2-mapa-real-do-produto)
3. [Ativos escondidos (valor não explorado)](#3-ativos-escondidos)
4. [Quick wins — 2 semanas](#4-quick-wins--2-semanas)
5. [Nicho, ICP e posicionamento](#5-nicho-icp-e-posicionamento)
6. [Concorrentes — análise precisa](#6-concorrentes--análise-precisa)
7. [Landing page — reescrita baseada no produto real](#7-landing-page--reescrita-baseada-no-produto-real)
8. [Roadmap 90 dias (priorizado)](#8-roadmap-90-dias)
9. [O que NÃO construir](#9-o-que-não-construir)
10. [Riscos e débitos técnicos](#10-riscos-e-débitos-técnicos)

---

## 1. Correções ao diagnóstico anterior

| PRODUCT_STRATEGY.md disse                      | Realidade no código                                                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| "Contracts / Change Orders: ❌ não temos"      | Tabelas `escopos` + `escopo_itens` criadas, `ai-aditivo-copilot` pronta. Falta só UI                                               |
| "Resource Planning: temos peças, falta painel" | Já existe `/capacidade` com matriz 12 semanas × pessoa + heatmap. Falta conectar timesheet                                         |
| "Financeiro tem DRE, WIP, aging" (genérico)    | Financeiro tem **12 abas completas** — nível Deltek. É ativo estratégico, não commodity                                            |
| "Não vou entrar em IA ainda"                   | **11 edge functions de IA rodando em produção.** Já há features de IA ativas                                                       |
| "Portal do cliente (um)"                       | Portal tem **2 versões duplicadas** (token público + autenticado). Débito técnico                                                  |
| "Stack moderna"                                | Stack confirmada: React 18 + TanStack Query + Zod + React Hook Form + Supabase + 17 edge functions + 11 migrations. Nível produção |
| "Admin Portal = prioridade"                    | Multi-tenant já funciona (`empresa_id` + RLS + 5 roles). Não precisa construir do zero                                             |

### Principal correção

> **O produto está 60-70% mais maduro do que o .md reconhece.**
> O problema NÃO é falta de features. É **packaging, exposição, UX consolidada e narrativa**.

---

## 2. Mapa real do produto

### 🟢 Em produção (menu + funcional)

| Módulo         | Estado                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Dashboard      | KPIs reais, alertas, pipeline, vencimentos                                                                        |
| Projetos       | Kanban + detalhe com 5 abas (info, disciplinas, pagamentos, docs, timeline)                                       |
| Propostas      | CRUD + DOCX real + conversão para projeto + templates                                                             |
| Leads          | Kanban CRM + motivo de perda + conversão                                                                          |
| Clientes       | CRUD + contas bancárias + portal invite + reset senha                                                             |
| Financeiro     | **12 abas** (Visão, Fluxo, Resumo, Lançamentos, Folha, Faturas, Contas, Projeção, Aging, DRE, WIP, Rentabilidade) |
| Pessoas        | CRUD + salário + M² + horas semanais                                                                              |
| Mapa           | Leaflet + cluster + geocode edge function                                                                         |
| Relatórios     | PDF export + gráficos                                                                                             |
| Portal Cliente | Duas versões (token + autenticado) — precisa consolidar                                                           |

### 🔒 Construído mas oculto do menu (rota existe, sidebar não)

| Módulo          | Estado                                                              | O que fazer                       |
| --------------- | ------------------------------------------------------------------- | --------------------------------- |
| `/timesheet`    | Completo: registro + grid semanal + 3 abas (meu, equipe, aprovação) | **Expor**                         |
| `/capacidade`   | Matriz 12 semanas × pessoas com heatmap                             | **Expor + conectar ao timesheet** |
| `/templates`    | CRUD de templates de projeto com fases JSONB                        | **Expor**                         |
| `/metas`        | 4 abas (dashboard, financeiras, pessoais, projetos) — 30%           | Finalizar antes de expor          |
| `/ai`           | Hub com 11 features de IA + histórico de insights                   | **Expor como módulo premium**     |
| `/projetos/:id` | Detalhe com 5 abas                                                  | Já linkado pelo kanban            |

### 🚧 Parciais

- **Metas** (~30%) — estrutura pronta, dados não fluem
- **Portal Entregas/Timeline** (~40%) — PortalTimeline.tsx existe, sem entregáveis ligados
- **TimesheetApproval** — UI parcial, fluxo de aprovação incompleto

### ⚙️ Backend pronto, UI zerada

- **Aditivos / Change Orders** — tabelas `escopos` + `escopo_itens` (migration 007) + edge function `ai-aditivo-copilot`
- **Asaas** — tabelas + webhook + criar cobrança + config. **Nenhuma tela**

### ❌ Não existe nem backend

- Briefing / programa de necessidades
- Entregáveis com workflow de aprovação (apenas timeline view)
- Contratos formais (separados de escopo)
- Gestão de reuniões/atas (tem `ai-pauta-reuniao` mas sem módulo próprio)

---

## 3. Ativos escondidos

Cinco pepitas que o produto tem e ninguém vê:

### 💎 1. AI Hub (11 features)

Lista real já funcionando via edge functions:

- Fechamento Mensal
- Co-piloto de Proposta
- Previsão de Atraso por projeto
- Radar de Clientes (risco)
- Relatório Executivo (semanal/mensal)
- Gerador de Documentos (atas, relatórios, termos)
- Co-piloto de Aditivo
- Pauta de Reunião
- Planejador de Contratação
- Simulação de Impacto (cenários)
- Diagnóstico de Precificação

**Valor de mercado:** concorrentes BR praticamente não têm IA contextualizada. Monograph/Deltek estão começando agora. Isso é **premium tier natural**.

### 💎 2. Integração Asaas (PIX/boleto automático)

- Backend 100% pronto. Edge functions: `asaas-webhook`, `asaas-criar-cobranca`, `asaas-config`
- Faltam 3-5 telas para virar **diferencial brutal no Brasil** — recebíveis automáticos no portal do cliente, baixa automática de faturas

### 💎 3. Matriz de Capacidade (Resource Planning)

- `/capacidade` já tem 12 semanas × pessoas com heatmap verde/amarelo/vermelho
- Falta plugar com `timesheets` + `projeto_disciplinas` → vira Resource Planning de verdade (= Monograph/BQE core feature)

### 💎 4. WIP + Rentabilidade por Disciplina

- Ninguém no segmento BR entrega isso. É **Deltek-grade**
- Precisa ser headline da landing, não tab #11 do financeiro

### 💎 5. Geração de DOCX real com templates

- `docxtemplater + pizzip` → documentos personalizados por cliente
- Proposta sai formatada. Isso é peça de venda, não feature genérica

---

## 4. Quick wins — 2 semanas

Retorno altíssimo, esforço baixo. Ordem de execução:

### Semana 1

1. **Expor 4 rotas no menu** (Timesheet, Capacidade, Templates, AI Hub)
   - Editar `src/components/AppSidebar.tsx`
   - Proteger por role onde faz sentido (AI Hub = admin/operacional)
   - Tempo: 2h

2. **Matar portal duplicado**
   - Escolher entre `/portal/:token` (público) vs `/cliente/*` (autenticado)
   - Recomendação: manter **autenticado** como padrão, `/portal/:token` vira fallback somente para clientes sem conta
   - Tempo: 1 dia

3. **Destravar Aditivos (UI sobre tabelas existentes)**
   - Tabelas `escopos` + `escopo_itens` prontas
   - Criar dialog: novo aditivo → impacto (R$/prazo) → aprovação cliente no portal
   - Tempo: 2-3 dias

### Semana 2

4. **Conectar Capacidade ↔ Timesheet**
   - Matriz lê `timesheets.horas_registradas` por pessoa/semana
   - Adiciona linha "alocado" (projetos ativos) + "realizado" (timesheet)
   - Vira Resource Planning real
   - Tempo: 2 dias

5. **Ativar Asaas MVP**
   - Tela de config (já tem edge function `asaas-config`)
   - Botão "Gerar cobrança" em `/faturas`
   - Webhook baixa fatura automaticamente
   - Tempo: 3 dias

6. **Landing page nova (seção 7 deste doc)**
   - Tempo: 1 dia

**Resultado em 2 semanas:** produto parece 3x mais robusto sem construir nada novo.

---

## 5. Nicho, ICP e posicionamento

### ICP primário (foco imediato)

**Escritórios brasileiros de engenharia consultiva multidisciplinar, 5–30 pessoas.**

- Estruturas, instalações, hidráulica, elétrica, geotecnia, regularização, laudos
- Vendem projeto sob encomenda, faturam por marcos
- Usam planilha + WhatsApp + ERP genérico hoje
- Dor #1: **não sabem se estão lucrando**

**Por que esse ICP primeiro:**

- Produto já é nativo nesse fluxo (disciplinas, marcos, rentabilidade)
- Sem concorrente BR forte (Deltek é caro demais; Bitrix/Omie são genéricos)
- Ticket justificável: R$ 400-1200/mês por escritório

### ICP secundário (6 meses)

**Escritórios de arquitetura 3–20 pessoas.**

- Residencial de alto padrão, corporativo, interiores, retrofit
- Hoje usam Monograph (EUA, USD, UX em inglês) ou planilha
- Exigem: briefing, fases (EP/AP/EX/LEG), entregáveis com aprovação
- **Gap: precisa construir camada de arquitetura** (ver roadmap)

### ICP terciário (não perseguir agora)

- Grandes escritórios (50+) → Deltek Vantagepoint domina
- Obras pesadas / construtoras → outro produto, outro ciclo
- Autônomos solo → ticket baixo, churn alto

### Posicionamento — frase de 1 linha

> **"O sistema operacional do escritório técnico brasileiro — do lead ao recebimento, com lucro por projeto em tempo real."**

Três vetores que **nenhum concorrente BR junta**:

1. Operação + financeiro integrados (não é CRM, não é ERP)
2. Específico para A/E (disciplinas, marcos, WIP, rentabilidade)
3. IA contextual + Asaas nativo (vantagem BR)

---

## 6. Concorrentes — análise precisa

### Benchmarking real

| Player                        | Origem | Força                       | Fraqueza                                    | Você vs ele                           |
| ----------------------------- | ------ | --------------------------- | ------------------------------------------- | ------------------------------------- |
| **Monograph**                 | EUA    | UX linda, resource planning | USD, sem BR, sem financeiro brasileiro      | Você: BR-native + financeiro profundo |
| **Deltek Ajera/Vantagepoint** | EUA    | Completo, enterprise        | Caríssimo, UX datada, complexo              | Você: moderno + 1/10 do preço         |
| **BQE CORE**                  | EUA    | Time tracking + billing     | Caro, setup longo                           | Você: onboarding mais leve + IA       |
| **Bitrix24**                  | Rússia | CRM + projetos grátis       | Genérico, não A/E                           | Você: vertical, fluxo nativo          |
| **Omie/Conta Azul**           | BR     | ERP/financeiro BR           | Sem operação de projeto, sem disciplinas    | Você: operação + projeto              |
| **Pipefy/Runrun.it**          | BR     | Workflow                    | Sem financeiro integrado, sem rentabilidade | Você: loop completo                   |
| **Trello/Notion**             | —      | Flexível                    | Zero estrutura vertical                     | Você: estrutura + inteligência        |

### O que concorrentes fortes têm e você AINDA não

| Feature                      | Monograph | Deltek  |   BQE   |           Pilar           |
| ---------------------------- | :-------: | :-----: | :-----: | :-----------------------: |
| Resource Planning unificado  |    ✅     |   ✅    |   ✅    | 🟡 (existe, desconectado) |
| Timesheet aprovação completa |    ✅     |   ✅    |   ✅    |       🟡 (parcial)        |
| Billing automation           |    ✅     |   ✅    |   ✅    | 🟡 (Asaas pronto, sem UI) |
| Fee proposal calculator      |    ✅     |   ✅    |   ✅    |            ❌             |
| Contracts + amendments       |  parcial  |   ✅    |   ✅    | 🟡 (tabelas sim, UI não)  |
| Deliverables workflow        |    ❌     | parcial | parcial |            ❌             |

### O que VOCÊ tem que concorrentes raramente têm

| Feature                                                                |                 Pilar                 |
| ---------------------------------------------------------------------- | :-----------------------------------: |
| Loop completo lead→proposta→projeto→financeiro→cliente numa mesma base |               ✅ (raro)               |
| WIP + rentabilidade por disciplina em tempo real                       | ✅ (enterprise-only nos concorrentes) |
| AI Hub com 11 features contextualizadas                                |      ✅ (ninguém no segmento BR)      |
| Asaas nativo (PIX/boleto BR)                                           |      🟡 (pronto, precisa expor)       |
| Portal do cliente autenticado                                          |         ✅ (raro nos menores)         |
| Multi-tenant RLS-enforced                                              |                  ✅                   |
| DOCX proposta personalizado                                            |                  ✅                   |
| Mapa geográfico de obras                                               |    ✅ (nicho útil para engenharia)    |

### Gaps realmente críticos (top 3)

1. **Fee calculator inteligente na proposta** — todos concorrentes têm, você quase tem (edge function `ai-diagnostico-precificacao` já existe)
2. **Aprovação de entregáveis no portal** — diferencial claro
3. **Workflow de aditivos visível** (aproveitar tabelas já criadas)

---

## 7. Landing page — reescrita baseada no produto real

A V1 do `.md` estava bem encaminhada mas **genérica**. Agora que sabemos o que o produto tem, dá para escrever copy **específica e provável**.

### Hero

**Headline:**

> Do primeiro lead ao recebimento — com lucro por projeto em tempo real.

**Subheadline:**

> Plataforma de gestão para escritórios de engenharia e arquitetura.
> Projetos, propostas, disciplinas, timesheet, financeiro, portal do cliente e IA — conectados.

**CTAs:**

> Ver demonstração · Começar grátis

**Prova visual:** screenshot do dashboard **com o gráfico de WIP/rentabilidade**, não um KPI genérico. Esse é o diferencial.

### Seção de problema (adicionar)

**Título:** Sem visibilidade, projeto que parece bom vira prejuízo.

- Projetos estouram orçamento e você descobre no fim
- Disciplinas atrasam e ninguém vê até virar crise
- Proposta vai sem margem-alvo, contratação vira WhatsApp
- Financeiro vive em planilha, fatura atrasa, caixa surpreende
- Cliente liga pedindo status que podia estar visível

### Seção "como o Pilar resolve" — fluxo visual

```
LEAD → PROPOSTA → PROJETO → TIMESHEET → FATURA → RECEBIMENTO
         (IA)    (disciplinas)  (capacidade)  (Asaas)  (portal)
                 (marcos)        (aprovação)
                 (aditivos)      (WIP)
```

Cada etapa com 1-liner específico:

- **Lead** — Pipeline visual, motivo de perda, conversão em 1 clique
- **Proposta** — Disciplinas estimadas, DOCX pronto, co-piloto de IA sugere preço
- **Projeto** — Kanban + disciplinas + marcos de faturamento + mapa
- **Timesheet** — Registro semanal, aprovação, alocação vs capacidade real
- **Fatura** — Gera automaticamente dos marcos, cobrança PIX/boleto via Asaas
- **Portal** — Cliente vê andamento, financeiro e entregas sem ligar

### Seção "o que torna o Pilar diferente"

Reescrever como **três promessas verificáveis**:

**1. Lucro por projeto visível desde o dia 1**
WIP, rentabilidade por disciplina, DRE. Você sabe exatamente qual projeto te paga.

**2. Operação conectada ao dinheiro**
Timesheet alimenta custo real. Marco fatura. Asaas cobra. Portal baixa. Sem retrabalho.

**3. IA que entende seu escritório**
Previsão de atraso, diagnóstico de preço, radar de cliente em risco, co-piloto de proposta e aditivo.

### Comparação (tabela)

|                       | Planilha | CRM genérico | Omie/ContaAzul | Pilar |
| --------------------- | :------: | :----------: | :------------: | :---: |
| Loop lead→recebimento |    ❌    |   parcial    |       ❌       |  ✅   |
| Lucro por projeto     |    ❌    |      ❌      |       ❌       |  ✅   |
| Resource planning     |    ❌    |      ❌      |       ❌       |  ✅   |
| PIX/boleto nativo     |    ❌    |      —       |       ✅       |  ✅   |
| IA contextual A/E     |    ❌    |      ❌      |       ❌       |  ✅   |
| Portal do cliente     |    ❌    |      ❌      |       ❌       |  ✅   |

### Prova social (mesmo cru)

Se não há clientes ainda:

- Mostrar **product screenshots ricos** (dashboard WIP, matriz de capacidade, kanban disciplinas)
- "Construído com 30+ escritórios-piloto" (se tiver beta)
- Stack logos: React · Supabase · Anthropic Claude · Asaas

### CTA final

> Sua próxima proposta devia sair com margem-alvo, não no feeling.
> **Comece agora — setup em 15 minutos.**

### Footer — adicionar

- Changelog / roadmap público (constrói confiança em SaaS)
- Status page
- Documentação

---

## 8. Roadmap 90 dias

Priorizado por **impacto comercial × esforço**, baseado no que já existe.

### 🔥 Mês 1 — Revelar valor escondido (sem construir nada novo grande)

| #   | Item                                                   | Por quê                 | Esforço |
| --- | ------------------------------------------------------ | ----------------------- | ------- |
| 1   | Expor Timesheet, Capacidade, Templates, AI Hub no menu | Produto parece 3x maior | XS      |
| 2   | Consolidar portal cliente (matar duplicação)           | Débito técnico + UX     | S       |
| 3   | UI de Aditivos (tabelas existem)                       | Fecha gap crítico       | M       |
| 4   | Capacidade ↔ Timesheet conectados                      | Resource Planning real  | M       |
| 5   | Asaas MVP (config + gerar cobrança + webhook)          | Diferencial BR          | M       |
| 6   | Landing page nova (seção 7)                            | Conversão               | S       |
| 7   | Dashboard Command Center (consolidar KPIs que existem) | Home vira decisão       | M       |

### 🏗 Mês 2 — Profundidade comercial

| #   | Item                                                           | Por quê                             | Esforço |
| --- | -------------------------------------------------------------- | ----------------------------------- | ------- |
| 8   | Fee calculator na proposta (usa `ai-diagnostico-precificacao`) | Fecha gap vs Monograph/BQE          | M       |
| 9   | Entregáveis como objeto de 1ª classe + aprovação no portal     | Diferencial + fecha gap arquitetura | L       |
| 10  | Win/loss analytics + próxima ação em leads                     | CRM sério                           | M       |
| 11  | Onboarding guiado por tipo de escritório                       | Conversão trial                     | M       |
| 12  | Expor AI Hub com pricing (feature premium)                     | Monetização                         | S       |

### 🚀 Mês 3 — Verticalização arquitetura + scale

| #   | Item                                                             | Por quê                | Esforço |
| --- | ---------------------------------------------------------------- | ---------------------- | ------- |
| 13  | Camada arquitetura: briefing/programa + fases EP/AP/EX/LEG       | ICP secundário         | L       |
| 14  | Contratos formais (separados de escopo) + template por tipologia | Dor real               | M       |
| 15  | Plano/pricing + feature flags por tier                           | Necessário para vender | M       |
| 16  | Changelog público + roadmap público                              | Confiança SaaS         | S       |
| 17  | Benchmark: "margem média do seu porte de escritório"             | Retenção               | L       |
| 18  | Integração com contabilidade (Conta Azul/Omie export)            | Remove objeção         | M       |

**Esforço:** XS=horas · S=1-2 dias · M=3-5 dias · L=1-2 semanas

---

## 9. O que NÃO construir

Lista do que vai parecer tentador mas é armadilha:

- ❌ **Mobile nativo** — web-first. PWA resolve. Mobile nativo = equipe extra
- ❌ **Marketplace de plugins** — early demais, distrai
- ❌ **Editor de documentos tipo Notion** — você já gera DOCX, cliente edita no Word. Não compete com Google Docs
- ❌ **CRM super completo** (calls, emails, automações Zapier-like) — seu CRM serve o loop do projeto, não é HubSpot
- ❌ **BIM / CAD / 3D viewer** — não é seu jogo. Integrar com CAD/BIM se pedido, nunca hospedar
- ❌ **Chat interno / mensageria** — WhatsApp ganhou. Não brigar
- ❌ **Refatorar tudo para arquitetura perfeita** — feature-based seria mais limpo, mas não é bloqueador. Fazer por feature nova, não big bang
- ❌ **Tirar features para "simplificar"** — o problema é **packaging**, não volume. Esconder atrás de plan tier > deletar

---

## 10. Riscos e débitos técnicos

Identificados no código, para entrar no backlog consciente:

### Débitos técnicos com impacto comercial

1. **Portal cliente duplicado** (token + autenticado)
   - Confunde venda, dobra superfície de bug
   - Fix: migration path — clientes com token migram para conta autenticada

2. **Rotas órfãs sem feature flag**
   - `/ai`, `/capacidade`, `/timesheet`, `/templates`, `/metas`
   - Qualquer pessoa com URL direta acessa
   - Fix: role check + sidebar

3. **Metas (~30%)** ocupando rota sem entregar valor
   - Esconder até estar 80%+

4. **Gen:types com project id hardcoded** (`vepnsonbnsimqcsfcagm`)
   - Se abrir open source ou multi-ambiente, vaza
   - Fix: `.env` + script parametrizado

### Riscos de produto

5. **Dashboard pode ser enganoso** se valores forem mock/parciais — validar todos os KPIs estão com query real
6. **WIP/Rentabilidade** dependem de custo real (timesheet × salário). Se timesheet não for usado, esses dashboards mentem. Onboarding precisa reforçar isso
7. **Asaas tem custo por transação** — precificação precisa absorver isso ou repassar

### Riscos de escala

8. **RLS em multi-tenant** — revisar policies com `rls-auditor` antes de abrir para 10+ clientes
9. **Edge functions sem rate limit visível** — AI functions consomem tokens. Adicionar budget por empresa em `ai_usage`
10. **Testes baixos** — só 2 test files. Não precisa cobertura 80%, mas fluxo crítico (proposta→projeto, fatura, timesheet) deveria ter teste de integração

---

## Fechamento

O produto está mais maduro do que a narrativa atual reconhece.

**Em 2 semanas** (quick wins): parece 3x mais robusto.
**Em 30 dias:** tem Resource Planning + Aditivos + Asaas + landing nova.
**Em 90 dias:** vira categoria própria no mercado BR de A/E.

A pergunta estratégica não é mais "o que construir". É:

1. Qual ICP validar primeiro (sugestão: engenharia multidisciplinar 5–30 pessoas)
2. Qual pricing/plano (free trial? freemium? direto pago? 3 tiers?)
3. Quando ativar o AI Hub como tier premium
4. Quando construir camada arquitetura

Próximo passo sugerido: decidir ICP + pricing, depois executar Mês 1 do roadmap.
