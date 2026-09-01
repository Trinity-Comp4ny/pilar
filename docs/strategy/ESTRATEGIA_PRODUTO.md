# Estratégia de Produto — Pilar

> Documento gerado em 2026-05-13 com base em análise de mesa redonda com 10+ agentes especializados.

---

## ICP (Ideal Customer Profile)

**Escritórios de projeto técnico** — engenharia multidisciplinar (civil + estrutural + MEP/HVAC) e arquitetura (desde 2026-09-01, ver `DECISOES.md`).
Excluídos: construtoras/incorporadoras.

### Tamanho
Horizontal — funciona para qualquer porte. Não segmentar por tamanho agora.

### Dor principal
> *"O dono não sabe se o projeto está dando lucro antes de terminar."*

Sintomas:
- Horas lançadas depois da entrega (ou nunca)
- Escopo vira proposta, proposta nunca vira orçamento de horas
- Financeiro separado do operacional — reunião mensal pra descobrir o óbvio
- Margem calculada em planilha, depois que o mal já foi feito

### Dores secundárias
1. Controle de recebíveis — saber quem deve e quanto
2. Visibilidade de carga da equipe — quem tem capacidade, quem está sobrecarregado
3. Emissão de cobranças — boleto/PIX direto do sistema

---

## Posicionamento

**Tagline:**
> *"Saiba se cada projeto está dando lucro antes de terminar."*

**Diferenciação:**
- Não é planilha, não é Excel, não é BI genérico
- Integra proposta → projeto → horas → financeiro em um único fluxo
- Específico para engenharia — terminologia certa, fluxos certos
- Multi-empresa / multi-escritório desde o dia 1

**Anti-posicionamento (o que não somos):**
- Não somos ERP de construção (não gerenciamos obra, RH, estoque)
- Não somos ferramenta de arquitetura (sem renderização, sem BIM)
- Não somos contabilidade (sem SPED, sem obrigações fiscais)

---

## Modelo de Negócio

| Plano | Público | Limite | Posicionamento |
|-------|---------|--------|----------------|
| Starter | Freelancer / solo | ≤3 usuários | Gratuito ou simbólico |
| Pro | Escritório médio | ≤15 usuários | Recorrência mensal |
| Enterprise | Grupo / filiais | Ilimitado | Contrato anual + onboarding |

Trial: 14 dias com acesso Pro completo.

---

## Roadmap Estratégico

### Fase 1 — Estabilização (entregue 2026-05)
- Bugs críticos corrigidos (22 mapeados, maioria resolvido)
- Segurança: RLS, rate limiting, webhook guards
- Performance: índices parciais, lazy loading, code splitting

### Fase 2 — Visibilidade de Lucro (prioridade máxima)
- **Timesheet** — registro de horas por projeto (módulo a construir do zero)
- **Budget vs Actual** — horas estimadas vs realizadas por disciplina
- **Rentabilidade em tempo real** — card na tela do projeto, sempre visível
- RPC `get_financial_chart_data` conectada ao frontend

### Fase 3 — Monetização
- Trial 14 dias com expiração e e-mails D-7/D-3/D-0
- Limite `max_usuarios` enforçado (backend pronto)
- Asaas UI MVP — config + "Gerar cobrança" no faturamento
- `PLAN_FEATURES` mapping plano → features habilitadas

### Fase 4 — Diferenciação
- AI Hub ativado (11 edge functions Gemini prontas, UI zero)
- Portal Cliente: aprovar + pagar fluxo
- Relatório semanal automatizado por e-mail

### Fase 5 — Escala
- Multi-empresa / grupos de escritórios
- Integração contábil (exportação)
- App mobile (PWA primeiro)

---

## Concorrentes Mapeados

| Produto | Segmento | Fraqueza deles | Nossa vantagem |
|---------|----------|----------------|----------------|
| Toggl Track | Timesheet genérico | Sem financeiro integrado | Fluxo completo proposta→lucro |
| Harvest | Freelancer | Sem multi-projeto + margem | Margem por projeto, visível |
| Omie | ERP genérico BR | Complexo, não é para engenharia | Terminologia e fluxo certos |
| Sienge | Construção | Pesado, caro, obra-focado | Leve, engenharia de projeto |
| Planilha | "Gratuito" | Não consolida, não é tempo real | Dashboard unificado |

---

## Métricas de Sucesso

- **North Star:** % de projetos com margem calculada antes da entrega
- **Ativação:** proposta convertida em projeto com orçamento de horas
- **Retenção:** DAU/MAU de lançamento de horas (Timesheet)
- **Receita:** MRR, churn, CAC payback
