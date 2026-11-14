# SPEC: Escritório de exemplo e modelos que ensinam

**Data:** 2026-11-10
**Status:** Draft (precisa de decisão do CEO antes de codar)
**Autor:** Matheus Rezende
**Módulo:** onboarding
**Relacionada:** [SPEC 149](149-onboarding-empresa-usuario-e-primeira-semana.md) (onboarding), `docs/operations/MODULOS_DORMENTES.md` (Templates), pesquisa [profissionalizacao-saas-referencias](../../research/themes/profissionalizacao-saas-referencias.md) (Linear e Notion: aprender usando)

## Problema

Conta nova abre vazia: Início sem número, funil sem lead, Financeiro sem lançamento. A pessoa
não vê o Pilar funcionando antes de cadastrar tudo, e o checklist da SPEC 149 pede trabalho
antes de mostrar valor.

## Objetivo

No primeiro acesso, a pessoa pode explorar um escritório de exemplo com dados realistas do
pilar escolhido (Gestão, Projetos ou Obras) e apagar tudo com um clique quando quiser começar.

## Por que não foi codado nesta rodada

Mexe em quase todas as tabelas de dados do escritório (clientes, leads, propostas, projetos,
disciplinas, receitas, despesas, contas). Erro aqui mistura dado falso com dado real no
Financeiro e nos relatórios, que é exatamente a confiança no número que o Pilar vende. Pede
três decisões antes:

1. **Onde mora o exemplo.** (a) uma empresa de exemplo separada, que a pessoa visita e depois
   sai (zero risco de mistura, custo: trocar de empresa); ou (b) dados marcados `exemplo = true`
   na própria empresa (mais natural, custo: todo relatório, KPI, export e agente precisa filtrar).
   **Recomendação: (a)**, reaproveitando o mecanismo de impersonação somente leitura que já existe.
2. **Templates dormente.** O módulo Templates está oculto (1 uso real). Modelo de projeto por
   tipo de escritório (estrutural, MEP, arquitetura) pode nascer como "Fluxos" de disciplinas,
   que já está vivo, em vez de reativar Templates.
3. **Quem mantém o conteúdo.** Dados de exemplo envelhecem com o produto; precisam de dono e de
   teste que monta o exemplo do zero a cada PR.

## Requisitos (para quando houver decisão)

1. No fim do cadastro e no checklist: "Explorar um escritório de exemplo".
2. O exemplo mostra o pilar escolhido com 5 a 10 registros por módulo e um mês de Financeiro.
3. Faixa fixa "Você está no escritório de exemplo · Voltar ao meu escritório".
4. Nada do exemplo entra em métricas da plataforma (ativação, funil, NPS).

## Critérios de aceite (rascunho)

- [ ] Dado do exemplo nunca aparece na empresa real, em relatório, export ou resposta de agente.
- [ ] Teste monta o exemplo do zero e confere as contagens.
