# Documentação do Pilar — Índice Mestre

> Mapa de toda a documentação, organizada por tema. Ponto de partida para humanos e agentes.
> Convenção: cada subpasta tem um `README.md` com o índice do tema. Comece pelo tema, depois abra o arquivo.

## Meta

- 🤖 [`AGENTS_TEAM.md`](./AGENTS_TEAM.md) — blueprint da equipe de agentes (organograma CEO→VP Ops→Heads→especialistas, roster e núcleo a contratar)

## Começe aqui

📋 **[BACKLOG.md](./BACKLOG.md)** — índice único do que falta fazer (bugs, produto,
design system, agentes, engavetados com gatilho). Cada item linka o doc com o detalhe.

## Temas

| Tema | Pasta | O que contém |
|---|---|---|
| 🎯 **Estratégia & Produto** | [`strategy/`](./strategy/) | Posicionamento, ICP, roadmap, pricing, concorrência |
| 🔒 **Segurança & Compliance** | [`security/`](./security/) | Segurança, LGPD/compliance, auditoria de banco, rotação de segredos |
| 🛠️ **Operações** | [`operations/`](./operations/) | Deploy, disaster recovery, incident response, runbooks, monitoring, load/versionamento de API |
| 🏛️ **Arquitetura** | [`architecture/`](./architecture/) | ADRs (decisões arquiteturais registradas) |
| 📐 **Specs** | [`specs/`](./specs/) | Especificações de feature (Spec Driven Development): quê/porquê antes de codar |
| 🎨 **Design system** | [`design/`](./design/) | Contrato visual da UI ([`PILAR_DESIGN_SYSTEM.md`](./design/PILAR_DESIGN_SYSTEM.md)): componentes, tokens, padrões e catálogo de deriva |
| 🧪 **QA** | [`qa/`](./qa/) | Rodadas de QA: catálogos de teste, matriz RLS, achados e status das correções |
| ⚖️ **Legal** | [`legal/`](./legal/) | Política de privacidade e documentos legais |

## Fora de `docs/` (referência rápida)

| Onde | O que é |
|---|---|
| `research/` | Base viva de inteligência de mercado (YC/a16z/Sequoia/Bessemer…), indexada em `research/INDEX.md` |
| `brand/` | Marca: voz/tom, visual, mensagens, personas (`brand/BRAND.md` é o índice) |
| `CLAUDE.md` | Contexto do projeto para agentes (stack, padrões, módulos) |
| `CONTRIBUTING.md` | Como contribuir com o código |
| `README.md` (raiz) | Setup técnico do projeto |
| `src/styles/tokens.css` | Fonte de verdade de cores/tokens de design |

## Atalhos por pergunta

- **"Como o Pilar cobra?"** → [`strategy/PRICING.md`](./strategy/PRICING.md)
- **"Quem é o cliente e qual o plano de go-to-market?"** → [`strategy/ICP_E_PLANO_DESIGN_PARTNER_2026-05.md`](./strategy/ICP_E_PLANO_DESIGN_PARTNER_2026-05.md)
- **"Qual a estratégia de produto atual?"** → [`strategy/STRATEGY_V2.md`](./strategy/STRATEGY_V2.md) (substitui `PRODUCT_STRATEGY.md`)
- **"O que a concorrência faz?"** → [`strategy/ANALISE_COMPETITIVA_VOBI.md`](./strategy/ANALISE_COMPETITIVA_VOBI.md)
- **"O que melhorar em config/admin/super-admin?"** → [`strategy/TODO_CONFIG_ADMIN_2026-07-14.md`](./strategy/TODO_CONFIG_ADMIN_2026-07-14.md)
- **"Está tudo seguro?"** → [`security/SECURITY.md`](./security/SECURITY.md) + [`security/AUDITORIA_BANCO_2026-05-19.md`](./security/AUDITORIA_BANCO_2026-05-19.md)
- **"Deu incidente, e agora?"** → [`operations/INCIDENT_RESPONSE.md`](./operations/INCIDENT_RESPONSE.md) + [`operations/runbooks/`](./operations/runbooks/)
- **"Por que decidimos X na arquitetura?"** → [`architecture/adr/`](./architecture/adr/) (template em [`adr/TEMPLATE.md`](./architecture/adr/TEMPLATE.md))
- **"Vou construir uma feature, por onde começo?"** → [`specs/`](./specs/) (template em [`specs/TEMPLATE.md`](./specs/TEMPLATE.md))
- **"O que falta fazer / qual o próximo passo?"** → [`BACKLOG.md`](./BACKLOG.md)
