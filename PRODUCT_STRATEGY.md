# Pilar — Estratégia de Produto

> Análise completa: features, concorrentes e landing page  
> Data: Abril 2026

---

## Sumário

1. [Features Ativas vs Ocultas](#1-features-ativas-vs-ocultas)
2. [Avaliação do Produto (visão SaaS senior)](#2-avaliação-do-produto)
3. [Análise de Concorrentes](#3-análise-de-concorrentes)
4. [Diagnóstico da Landing Page](#4-diagnóstico-da-landing-page)
5. [Reescrita Completa da Landing](#5-reescrita-completa-da-landing)
6. [Roadmap Estratégico](#6-roadmap-estratégico)
7. [Posicionamento Final](#7-posicionamento-final)

---

## 1. Features Ativas vs Ocultas

### Features ativas (em uso)

- Dashboard
- Projetos
- Propostas
- Leads
- Clientes
- Financeiro
- Pessoas
- Mapa
- Relatórios

### Features ocultas no código (já implementadas, não expostas)

#### Operacional avançado

- Timesheet
- Capacidade / simulação de capacidade
- Metas (financeiras / pessoais / projetos)
- Templates de projeto (fases + disciplinas)
- Disciplinas estruturadas
- Burn rate
- WIP (work in progress)
- Rentabilidade por projeto

#### Comercial avançado

- Geração de proposta (DOCX)
- Templates de proposta
- Conversão lead → proposta → projeto (encadeamento completo)
- Tracking de motivo de perda

#### Cliente / Portal

- Convite de cliente para portal
- Reset de senha
- Envio de e-mail via edge function
- Estrutura de portal autenticado

#### Financeiro avançado

- DRE
- Aging de recebíveis
- Projeção de caixa
- Folha de pagamento
- Categorias estruturadas
- Fornecedores

> **Conclusão:** O Pilar não é um produto simples — é um produto subutilizado e mal "empacotado" ainda.

---

## 2. Avaliação do Produto

### Pontos muito fortes

- **Encadeamento completo:** lead → proposta → projeto → financeiro → cliente. Isso é raro. Concorrentes costumam ter esses módulos separados.
- **Base de rentabilidade real:** WIP, burn rate, DRE, fluxo de caixa integrado.
- **Portal do cliente:** poucos players menores fazem bem essa parte.
- **Arquitetura moderna:** React + Supabase = velocidade de evolução.
- **Flexibilidade:** sem legado, pode inovar rápido.

### Pontos médios

- CRM e leads: funcional, mas ainda pipeline básico. Falta cadência, SLA, win/loss analytics.
- Metas, timesheet, mapa: módulos promissores, mas não são o centro do produto ainda.

### Pontos mais fracos (para arquitetura)

- Briefing e programa de necessidades
- Fases conceituais (anteprojeto, executivo, legal)
- Revisões e aprovações de entregáveis
- Gestão de reuniões e atas
- Contratos, aditivos e change orders
- Controle de revisão de documentos

### Posicionamento correto

> ❌ Sistema de gestão  
> ❌ ERP  
> ❌ CRM  
> ✅ **Sistema de performance para escritórios de projeto**

---

## 3. Análise de Concorrentes

### Principais players no nicho A/E

- **Monograph** (arquitetura, EUA)
- **Deltek Ajera / Vantagepoint**
- **BQE CORE**
- **Jetpack Workflow**

### O que eles têm que ainda faltamos

| Feature                                 | Concorrentes | Pilar         |
| --------------------------------------- | ------------ | ------------- |
| Resource Planning unificado             | ✅           | Parcial       |
| Contracts / Change Orders               | ✅           | ❌            |
| Workflow de entregáveis e aprovações    | ✅           | ❌            |
| UX extremamente focada (poucos módulos) | ✅           | Pode melhorar |
| Onboarding e narrativa clara            | ✅           | ❌            |

### O que temos que eles não têm

| Feature                                                       | Pilar | Concorrentes |
| ------------------------------------------------------------- | ----- | ------------ |
| Encadeamento lead → proposta → projeto → financeiro → cliente | ✅    | ❌           |
| WIP + burn rate + DRE integrados                              | ✅    | Parcial      |
| Portal do cliente                                             | ✅    | Raramente    |
| Flexibilidade de stack moderna                                | ✅    | ❌ (legado)  |

### Onde perdemos hoje

- **Resource planning:** temos as peças, falta o painel mestre
- **UX consolidada:** muitos módulos dispersos vs produto coeso
- **Contratos e aditivos:** ponto de perda de dinheiro para o cliente, não temos
- **Narrativa de valor:** concorrentes vendem resultado, nós ainda vendemos features

---

## 4. Diagnóstico da Landing Page

### Conteúdo atual

```
Hero:
"O pilar fundamental da sua gestão"
"Simplifique o controle financeiro, gestão de projetos e operação..."

Seções:
- Tudo em um só lugar
- Features: Financeiro, Leads, Projetos, Pessoas, Metas, Relatórios
- "Construído para quem constrói o futuro"
- CTA: "Pronto para transformar sua gestão?"
```

### Problemas críticos

| Problema                                    | Impacto                    |
| ------------------------------------------- | -------------------------- |
| Headline genérica ("gestão", "simplifique") | Igual a qualquer SaaS      |
| Foco em features, não em resultado          | Não converte               |
| Não fala de dinheiro, lucro ou risco        | Não ativa dor real         |
| Sem seção de problema                       | Comprador não se reconhece |
| Sem diferenciação vs planilhas/concorrentes | Sem razão de compra        |
| CTA fraco ("transformar sua gestão")        | Baixa urgência             |

### O gap central

> A landing vende **organização**.  
> O produto entrega **controle + lucro + previsibilidade**.  
> Você está **subvendendo** seu próprio produto.

---

## 5. Reescrita Completa da Landing

### HERO

**Headline atual:**

> O pilar fundamental da sua gestão

**Headline nova:**

> Tenha controle total dos seus projetos e aumente o lucro do seu escritório

**Subheadline nova:**

> Do primeiro contato ao faturamento, gerencie leads, propostas, projetos e financeiro em um único sistema — com visão clara de margem, produtividade e previsibilidade.

**CTAs:**

> Começar gratuitamente · Ver demonstração

---

### SEÇÃO DE PROBLEMA (adicionar — hoje não existe)

**Título:**

> Seu escritório está perdendo dinheiro sem perceber

**Conteúdo:**

- Projetos estouram prazo e orçamento
- Você não sabe quais projetos são realmente lucrativos
- A equipe trabalha sem visibilidade de capacidade
- Propostas são feitas no feeling, sem base em dados
- O financeiro não conversa com a operação

---

### SEÇÃO DE SOLUÇÃO

**Título:**

> Um sistema pensado para performance, não só gestão

**Conteúdo:**

Com o Pilar, você:

- Tem controle real da rentabilidade de cada projeto
- Planeja a capacidade da sua equipe com precisão
- Converte mais propostas com dados, não feeling
- Ganha previsibilidade de faturamento
- Centraliza toda operação em um fluxo único

---

### FEATURES (reestruturadas por valor)

**Atual:** lista de módulos  
**Novo:** organizado por resultado

| Bloco          | O que entrega                                                 |
| -------------- | ------------------------------------------------------------- |
| **Comercial**  | Controle de leads e propostas com pipeline visual e histórico |
| **Operação**   | Projetos por etapas e disciplinas com acompanhamento real     |
| **Financeiro** | Fluxo de caixa integrado, visão de receitas, custos e lucro   |
| **Pessoas**    | Produtividade, estrutura e desempenho da equipe               |
| **Gestão**     | Dashboards e relatórios para decisões em tempo real           |

---

### DIFERENCIAL (adicionar)

**Título:**

> Mais do que um sistema de gestão

| Feature                                  | Pilar | Planilhas | Sistemas genéricos |
| ---------------------------------------- | ----- | --------- | ------------------ |
| Integra comercial, projetos e financeiro | ✅    | ❌        | ❌                 |
| Mostra lucro por projeto                 | ✅    | ❌        | ❌                 |
| Dá previsibilidade de faturamento        | ✅    | ❌        | ❌                 |
| Pensado para engenharia e arquitetura    | ✅    | ❌        | ❌                 |

---

### FLUXO DO PRODUTO

**Título:**

> Do primeiro contato ao faturamento

1. Capture e organize seus leads
2. Gere propostas com base em dados
3. Converta em projetos organizados
4. Acompanhe execução e produtividade
5. Controle financeiro integrado
6. Entregue com transparência ao cliente

---

### SOBRE (reescrito)

**Atual:**

> simplificar gestão financeira e operacional

**Novo:**

> O Pilar foi criado para resolver um problema comum em escritórios de engenharia e arquitetura: falta de controle sobre operação e rentabilidade.
>
> Nossa missão é dar visibilidade completa da sua empresa — para que você tome decisões melhores, aumente sua margem e cresça com previsibilidade.

---

### CTA FINAL

**Atual:**

> Pronto para transformar sua gestão?

**Novo:**

> Comece a ter controle real dos seus projetos hoje

---

## 6. Roadmap Estratégico

### Prioridade 1 — Resource Planning unificado

Juntar capacidade + timesheet + projetos + disciplinas em um painel único.  
Responde: quem está sobrecarregado? quando vai faltar mão de obra? qual projeto está consumindo mais do que deveria?

### Prioridade 2 — Command Center (dashboard executivo)

Um painel que responde diariamente:

- Estou lucrando?
- Quais projetos estão em risco?
- Quem está sobrecarregado?
- O que vai atrasar?
- Quanto vou faturar este mês?

### Prioridade 3 — Contracts / Change Orders

- Contrato base
- Aditivos
- Mudanças de escopo com aprovação do cliente
- Impacto em prazo e valor
- Trilha de auditoria

### Prioridade 4 — Proposal Intelligence

- Cálculo de fee por disciplina
- Margem esperada por projeto
- Comparação orçamento vendido vs esforço previsto
- Prazo sugerido com base em capacidade

### Prioridade 5 — Portal do cliente premium

- Timeline clara de entregas
- Pendências que dependem do cliente
- Entregáveis para aprovação
- Financeiro simplificado
- Documentos e histórico

### Prioridade 6 — Admin Portal

Bloco de controle e governança da plataforma:

- Gestão de usuários, cargos, times e permissões
- Configuração de disciplinas, templates e categorias
- Parâmetros da empresa (branding, dados fiscais, padrões)
- Logs de ações críticas
- Visão de uso e onboarding
- Feature flags por plano

---

## 7. Posicionamento Final

### Mensagem central

> O Pilar ajuda escritórios de engenharia e arquitetura a aumentar lucro e ter controle total da operação — do primeiro contato ao faturamento.

### Estrutura de produto recomendada

| Bloco          | Objetivo                    |
| -------------- | --------------------------- |
| **Comercial**  | Gerar receita previsível    |
| **Operação**   | Entregar com eficiência     |
| **Financeiro** | Maximizar lucro por projeto |
| **Cliente**    | Experiência premium         |
| **Gestão**     | Decisão baseada em dados    |

### Para crescer para arquitetura sem perder engenharia

**Core comum** (serve os dois):
CRM · Propostas · Projetos · Financeiro · Capacidade · Timesheet · Portal · Relatórios

**Camada engenharia:**
Disciplinas técnicas · Marcos de faturamento · WIP · Rentabilidade por disciplina · Mapa

**Camada arquitetura:**
Briefing/programa · Fases conceitual/anteprojeto/legal/executivo · Gestão de revisões · Aprovação do cliente · Contratos e aditivos · Portal com entregáveis

### O que NÃO fazer agora

> Adicionar mais features.

O produto já tem features demais. O que falta é:

- **Consolidar** o que existe
- **Conectar** os módulos de forma mais evidente
- **Simplificar** a narrativa
- **Priorizar** profundidade nas features que fecham o loop de valor
