# Specs

Especificações de feature (Spec Driven Development). ← [voltar ao índice](../README.md)

Antes de codar qualquer feature não-trivial, escreva uma spec. Ela diz o **quê** e o
**porquê**; o **como** vem no plano que o agente propõe e você aprova antes de gerar código.
A spec é o artefato durável e revisável; o código é descartável. Os critérios de aceite
viram os testes.

**Fluxo:** spec → plano (aprovado) → implementação → verificação (critérios de aceite).

## Como começar

1. Copie [`TEMPLATE.md`](./TEMPLATE.md) para `NNN-nome-em-kebab-case.md`.
2. Preencha problema, objetivo, requisitos e critérios de aceite.
3. Passe a spec inteira como contexto pro agente (em vez do pedido solto).
4. Registre a spec na tabela abaixo.

Decisão de arquitetura no meio do caminho vira um [ADR](../architecture/README.md); linke nos dois lados.

| Spec                                                | Feature                                             | Status           |
| --------------------------------------------------- | --------------------------------------------------- | ---------------- |
| [001](./001-shell-3-pilares.md)                     | Shell dos 3 pilares                                 | Entregue         |
| [002](./002-header-padrao.md)                       | Header padrão (`PageHeader`)                        | Entregue         |
| [003](./003-design-system.md)                       | Design system                                       | Entregue         |
| [004](./004-margem-confiavel.md)                    | Margem confiável                                    | —                |
| [005](./005-fim-do-dashboard.md)                    | Fim do dashboard                                    | Entregue         |
| [006](./006-financeiro-padrao-e-breadcrumb.md)      | Financeiro no header padrão + breadcrumb global     | Em implementação |
| [007](./007-mesa-de-trabalho-agentes.md)            | Mesa de trabalho dos agentes (inbox-first)          | Proposta         |
| [008](./008-gestao-meu-trabalho.md)                 | Gestão — "Meu trabalho" (lista de tarefas do dia)   | Em implementação |
| [015](./015-obras-mvp.md)                           | Obras — MVP (timeline + diário/RDO + frentes)       | Em implementação |
| [016](./016-conta-da-obra-e-prestacao-de-contas.md) | Conta da obra + prestação de contas (administração) | Draft            |
| [018](./018-cotacoes-na-obra.md)                    | Cotações na obra (registrar, comparar, decidir)     | Em implementação |
| [019](./019-estoque-da-obra.md)                     | Estoque da obra (compra unificada, fase 4)          | Draft            |
| [020](./020-cronograma-da-obra.md)                  | Cronograma da obra (frentes na linha do tempo)      | Em implementação |
| [022](./022-funil-comercial-no-leads.md)            | Funil comercial no Leads (proposta dentro do card)  | Em implementação |
