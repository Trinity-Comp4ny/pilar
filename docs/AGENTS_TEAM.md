# Equipe de Agentes do Pilar — Blueprint

> Desenho da "startup de agentes" que trabalha com o Matheus. **Este é o mapa; a folha de pagamento começa enxuta.**
> Status: design aprovado 2026-07-13. Materializar apenas o **núcleo de 6** primeiro (ver seção "Contratar agora").

## Filosofia (como um CEO contrata)

1. **Contrate contra a dor, não contra o organograma.** O Matheus é dev frontend — não há dor de "sênior software". Há dor de *priorização, voz do cliente, vendas, e furos no plano*.
2. **Todo agente precisa de 3 coisas** ou não deve existir: (a) um **cérebro** (pasta de docs), (b) **ferramentas** certas, (c) um **trabalho recorrente que você realmente delega**.
3. **Enxuto vence.** Um exército de agentes que você não usa é ruído e custo (tokens + manutenção). O maior risco não é a tecnologia — é virar gerente de agentes em vez de enviar produto.
4. **O uso desenha o organograma.** Crie o núcleo, use por 2 semanas, demita quem não chamou, contrate o que faltou.

## Organograma

```
                          👤 CEO — Matheus
                              │
                    ┌─────────────────────┐
                    │  🎯 VP of Operations │  ← orquestrador-mestre
                    │  (roteia + sintetiza)│
                    └─────────────────────┘
          ┌───────────────┬──────────────┬──────────────┐
     ┌─────────┐    ┌──────────┐   ┌──────────┐   ┌──────────┐
     │ CPO     │    │ CMO/CRO  │   │ CTO      │   │ Head      │
     │ Produto │    │ Mercado &│   │ Engenh.  │   │ Confiança │
     │         │    │ Cresc.   │   │          │   │ & Ops     │
     └─────────┘    └──────────┘   └──────────┘   └──────────┘

              🔴 O Crítico / Red Team  →  serve o CEO e o VP direto
              📊 Intel estratégico (accelerator-intel) → staff do VP
```

## Como o acionamento funciona na prática (Claude Code)

O organograma tem 3 níveis conceituais, mas o Claude Code tem **limite de aninhamento** de subagentes (um subagente não dispara livremente outra cadeia profunda). Por isso a implementação é:

- **VP of Operations = o Claude do chat principal** (roteando) **ou um Workflow** de orquestração. É quem recebe o pedido do CEO, decide os times, delega e **sintetiza uma resposta única**.
- **Heads = camada de orquestração** (papéis dentro do VP/Workflow que agrupam especialistas) — não precisam ser um agente separado no dia 1.
- **Especialistas = agentes reais** (`.claude/agents/*.md`), acionados em **1 nível de fan-out** (paralelo quando independentes).
- **Cross-team** (ex.: "lançar plano novo" toca Produto + Mercado + Eng): o VP coordena o fan-out entre times e junta.

Fluxo: `CEO → VP Ops → [fan-out especialistas dos times relevantes] → VP sintetiza → CEO`.

---

## Roster completo

Legenda de status: **🟢 contratar agora (núcleo)** · ⚪ banco de talentos (sob demanda) · 🔁 já existe.

### 🎯 CPO — Produto  ("o que construir e por quanto")

| Agente | Propósito | Cérebro (docs) | Ferramentas | Status |
|---|---|---|---|---|
| **Product Manager** | Prioriza, corta escopo, mantém roadmap. Árbitro do "construir agora vs depois" | `strategy/PLANO_MELHORIAS`, `STRATEGY_V2`, `ESTRATEGIA_PRODUTO` + código (o que já existe) | Read, Grep, Glob, Write | 🟢 |
| **Engenheiro do ICP** | Simula a voz do cliente AEC (civil/estrutural/MEP) para validar decisões rápido | `brand/personas.md`, `strategy/ICP_E_PLANO_DESIGN_PARTNER`, `ESTRATEGIA_PRODUTO` | Read, Grep, Glob | 🟢 |
| **Pricing & Packaging** | Modelo de cobrança, tiers, créditos, calibragem | `strategy/PRICING.md`, `research/themes/pricing.md`, `research/a16z/*pricing*` | Read, Grep, Glob, WebSearch, WebFetch, Write | 🟢 |
| **Analytics** | North Star, ativação, churn, MRR — lê a métrica que ninguém acompanha | `strategy/ESTRATEGIA_PRODUTO` + código (eventos/queries) | Read, Grep, Glob | ⚪ |
| **User Researcher** | Conduz/analisa pesquisa real (entrevistas, JTBD). Complementa o Engenheiro do ICP | pesquisa coletada + `strategy/` | Read, Write, WebSearch | ⚪ |

### 📣 CMO/CRO — Mercado & Crescimento  ("trazer e manter clientes")

| Agente | Propósito | Cérebro (docs) | Ferramentas | Status |
|---|---|---|---|---|
| **Vendas** | Discovery com design partner, objeções, follow-up, fechar 1º pagante | `strategy/ICP_E_PLANO_DESIGN_PARTNER`, `PRICING.md`, `brand/messaging.md` | Read, WebSearch, WebFetch, Write | 🟢 |
| **Market Scout AEC** | Tendências e oportunidades no vertical engenharia; o que os SaaS AEC lançam; normas/regulação | `research/`, `strategy/ANALISE_COMPETITIVA_VOBI` → escreve notas em `research/` | Read, Grep, Glob, WebSearch, WebFetch, Write | 🟢 |
| **Marketing** | Posicionamento, funil, campanhas | `strategy/`, `brand/`, `research/themes/gtm.md` | Read, Grep, Glob, WebSearch, Write | ⚪ |
| **Brand** | Guardião da marca — consistência de voz e visual | `brand/BRAND.md`, `voice-tone.md`, `visual.md` | Read, Grep, Glob | ⚪ |
| **Copy** | Executa textos na voz da marca (braço do Brand) | `brand/voice-tone.md`, `messaging.md`, `src/styles/tokens.css` | Read, Grep, Glob, Edit | ⚪ |
| **Growth/SEO/Conteúdo** | Loops de aquisição, máquina de conteúdo (moat da Vobi) | `brand/`, `research/themes/gtm.md` | Read, WebSearch, WebFetch, Write | ⚪ |

### ⚙️ CTO — Engenharia  ("construir com qualidade")

| Agente | Propósito | Cérebro (docs) | Ferramentas | Status |
|---|---|---|---|---|
| **Arquitetura/Qualidade** | Decisões técnicas + 2º par de olhos (une "tech" e "software") | `architecture/adr/`, `CLAUDE.md` + código | Read, Grep, Glob, Bash | ⚪ |
| **Sênior IA** | Agentes, LLM, IA Hub, custo de inferência | código `ai-*`, `strategy/PRICING.md` (créditos) | Read, Grep, Glob, Bash, WebSearch | ⚪ |
| **QA/Testes** | Prioriza e escreve testes (ponto fraco medido: ~4,6% cobertura) | código + `CONTRIBUTING.md` | Read, Grep, Glob, Bash, Edit | ⚪ |
| **Data/DB** | Migrations, RLS, performance de query (full-scans financeiros) | `supabase/`, `security/AUDITORIA_BANCO` | Read, Grep, Glob, Bash | ⚪ |
| UX/Design | Auditoria e padrões de UX | design system + telas | — | 🔁 família `ux-*` |
| Code Review | Revisão de PR | diff | — | 🔁 `code-reviewer` |

### 🔒 Head de Confiança & Ops  (fase 2)

| Agente | Propósito | Cérebro (docs) | Ferramentas | Status |
|---|---|---|---|---|
| Segurança/RLS | Audita policies RLS | `supabase/migrations/` | — | 🔁 `rls-auditor` |
| **Compliance/LGPD** | Fecha os TODOs de compliance de negócio | `security/COMPLIANCE.md`, `legal/` | Read, Grep, Glob, Write | ⚪ |
| SRE/Runbooks | Incidentes, operação | `operations/runbooks/` | — | ⚪ |

### Transversais (servem o CEO/VP direto)

| Agente | Propósito | Cérebro | Ferramentas | Status |
|---|---|---|---|---|
| 🔴 **O Crítico / Red Team** | Único trabalho: **discordar**. Acha o furo, estressa o plano antes do gasto. Antídoto da câmara de eco do founder solo | acesso a tudo (`docs/`, código, `research/`) | Read, Grep, Glob, Bash | 🟢 |
| **VP of Operations** | Orquestrador: roteia, delega, sintetiza, coordena cross-team | todos os índices (`docs/README.md`) | orquestração (chat principal ou Workflow) | 🟢 |
| Intel estratégico YC/VC | Tese, GTM, fundraising, benchmarks de mercado | `research/` | — | 🔁 `accelerator-intel` |

---

## Contratar AGORA — o núcleo de 6

Estes cobrem os gaps reais do founder solo. Materializar primeiro:

1. **Product Manager** — prioriza (maior gap)
2. **Engenheiro do ICP** — voz do cliente
3. **Pricing & Packaging** — já há investimento (`PRICING.md`)
4. **Vendas** — chegar no 1º pagante
5. **Market Scout AEC** — oportunidades no vertical
6. 🔴 **O Crítico / Red Team** — protege do erro caro

O **VP of Operations** é o 7º, mas vive na camada de orquestração (chat principal ou Workflow), não como `.claude/agents/*.md` no dia 1.

Todo o resto = **banco de talentos**: contratar quando a dor aparecer.

## Regra anti-inchaço — o teste das 2 semanas

Depois de criar o núcleo, por 2 semanas anote **quantas vezes chamou cada agente**:
- Chamou muito → mantém, refina.
- Não chamou → demite (era contratação errada).
- Quis e não tinha → é a próxima contratação do banco.

Deixe o **uso** desenhar o organograma, não o inverso.

## Próximos passos

1. Matheus revisa este blueprint e ajusta o núcleo.
2. Materializar os 6 como `.claude/agents/*.md` (system prompt + cérebro/docs + ferramentas).
3. Definir o acionamento do VP Ops: chat principal roteando **ou** um Workflow "vp-ops" que faz fan-out por time.
4. Rodar o teste das 2 semanas; revisar o roster.
