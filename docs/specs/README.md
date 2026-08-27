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

| Spec                                                                | Feature                                                                                                                                      | Status           |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| [001](./001-shell-3-pilares.md)                                     | Shell dos 3 pilares                                                                                                                          | Entregue         |
| [002](./002-header-padrao.md)                                       | Header padrão (`PageHeader`)                                                                                                                 | Entregue         |
| [003](./003-design-system.md)                                       | Design system                                                                                                                                | Entregue         |
| [004](./004-margem-confiavel.md)                                    | Margem confiável                                                                                                                             | —                |
| [005](./005-fim-do-dashboard.md)                                    | Fim do dashboard                                                                                                                             | Entregue         |
| [006](./006-financeiro-padrao-e-breadcrumb.md)                      | Financeiro no header padrão + breadcrumb global                                                                                              | Em implementação |
| [007](./007-mesa-de-trabalho-agentes.md)                            | Mesa de trabalho dos agentes (inbox-first)                                                                                                   | Proposta         |
| [008](./008-gestao-meu-trabalho.md)                                 | Gestão — "Meu trabalho" (lista de tarefas do dia)                                                                                            | Em implementação |
| [015](./015-obras-mvp.md)                                           | Obras — MVP (timeline + diário/RDO + frentes)                                                                                                | Em implementação |
| [016](./016-conta-da-obra-e-prestacao-de-contas.md)                 | Conta da obra + prestação de contas (administração)                                                                                          | Draft            |
| [018](./018-cotacoes-na-obra.md)                                    | Cotações na obra (registrar, comparar, decidir)                                                                                              | Entregue         |
| [019](./019-estoque-da-obra.md)                                     | Estoque da obra (compra unificada, fase 4)                                                                                                   | Draft            |
| [020](./020-cronograma-da-obra.md)                                  | Cronograma da obra (frentes na linha do tempo)                                                                                               | Em implementação |
| [022](./022-funil-comercial-no-leads.md)                            | Funil comercial no Leads (proposta dentro do card)                                                                                           | Em implementação |
| [026](./026-inteligencia-do-fornecedor.md)                          | Inteligência do fornecedor (página com histórico)                                                                                            | Em implementação |
| [027](./027-cronograma-obra-dois-niveis.md)                         | Cronograma da obra em dois níveis (frente + passos)                                                                                          | Em implementação |
| [029](./029-central-de-notificacoes.md)                             | Central de notificações in-app (por destinatário)                                                                                            | Draft            |
| [030](./030-obra-no-portal-do-cliente.md)                           | Obra no portal do cliente (acompanhamento + contas)                                                                                          | Draft            |
| [035](./035-controle-de-features-por-modulo-e-em-massa.md)          | Controle de features por módulo (3 pilares) + sub-features + ação em massa no ultra admin                                                    | Draft            |
| [040](./040-obra-inteligente-cronograma-diario-clima.md)            | Obra inteligente: diário reporta contra o cronograma (avanço automático) + alerta de clima em tarefa sensível                                | Em implementação |
| [043](./043-marketing-site-separado.md)                             | Site de marketing separado do app (`apps/marketing`), Fase 1 da auditoria de performance                                                     | Draft            |
| [044](./044-financeiro-dashboard-e-listagens-server-side.md)        | Dashboard financeiro e listagens de Despesas/Receitas server-side (RPC, sem full-scan)                                                       | Draft            |
| [047](./047-redesign-landing-page.md)                               | Redesign da landing page: 9→6 sections, produto animado (Framer Motion)                                                                      | Entregue         |
| [048](./048-consentimento-cookies.md)                               | Consentimento de cookies (banner + gate no analytics), ADR 0022                                                                              | Em implementação |
| [049](./049-aceite-termos-de-uso-onboarding.md)                     | Aceite explícito dos Termos de Uso em /cadastro e /profile-setup, tabela terms_acceptances                                                   | Em implementação |
| [050](./050-planos-termos-privacidade-no-marketing.md)              | Planos, Termos e Privacidade (texto) migram para apps/marketing; ações LGPD para o SettingsDialog                                            | Em implementação |
| [051](./051-duracao-por-etapa-fluxo-prazo-cascata.md)               | Fluxo de disciplinas: prazo em cascata, grafo visual (estilo pipeline CI) e checklist por etapa                                              | Entregue         |
| [052](./052-features-universais-por-empresa-capacidade-de-plano.md) | Features universais por empresa (fim do toggle por plano); capacidade (max_projetos) vira o limitador real                                   | Em implementação |
| [053](./053-pix-automatico-e-regua-de-inadimplencia.md)             | Pix Automático como método padrão do MRR e régua de inadimplência (aviso, suspensão, recuperação), ADR 0028                                  | Draft            |
| [054](./054-policies-to-authenticated.md)                           | Migrar ~180 policies de `TO PUBLIC` para `TO authenticated`; fecha o grant de anon nos helpers de RLS e prepara o fix de `auth_rls_initplan` | Draft            |
| [057](./057-webhook-asaas-resolucao-tenant.md)                      | Corrige resolução de tenant no webhook Asaas (coluna `webhook_token` removida, achado ao cifrar a api_key)                                   | Draft            |
| [055](./055-status-page-publica.md)                                 | Status page pública (`/status`), incidentes declarados manualmente via `/ultra-admin`, sem uptime check automático                           | Entregue         |
| [056](./056-feedback-bug-e-sugestao-feature.md)                     | Feedback do usuário: modal único (bug via Sentry `sendFeedback`, sugestão só no banco, triagem no ultra-admin)                               | Entregue         |
| [058](./058-acesso-por-role-observabilidade-total-mfa-opcional.md)  | Acesso é role + módulo da empresa (features por usuário saem), erro de fronteira sempre no Sentry, MFA opcional                              | Em implementação |
| [060](./060-soft-delete-por-rpc.md)                                 | Soft delete por RPC nas 17 tabelas cuja policy de SELECT esconde deletado; formaliza as policies de `clientes` que não vinham de migration   | Em implementação |
| [059](./059-consentimento-cookies-unificado.md)                     | Consentimento de cookies unificado: cookie de domínio pai + tabela `cookie_consents` por conta; banner só na landing, ADR 0032               | Em implementação |
| [062](./062-diario-efetivo-por-fornecedor-impedimento-visita.md)    | Diário de obra: efetivo por fornecedor, impedimento tipado (sem foto no MVP), visita ligada ao cadastro (estende 015/040/042)                | Em implementação |
| [063](./063-curva-s-da-obra.md)                                     | Curva S da obra: planejado × realizado acumulado, derivado de tarefas/RDO, sem tabela nova (estende 027/040)                                 | Em implementação |
| [064](./064-fila-cotacoes-pendentes-cross-obra.md)                  | Fila de cotações pendentes cruzando todas as obras, seção na página /obras existente, sem rota nova (estende 018)                            | Em implementação |
| [065](./065-avanco-como-contexto-dos-marcos-faturamento.md)         | Avanço da obra como contexto junto aos marcos de faturamento (OBR-3 Opção A, decisão de fechar o gate D2)                                    | Draft            |
| [066](./066-desembolso-realizado-por-periodo.md)                    | Desembolso realizado por período: despesas acumuladas mês a mês × orçamento total previsto, na Conta da obra (OBR-6, sem tabela nova)        | Em implementação |
