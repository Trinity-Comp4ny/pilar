# Arquitetura

Decisões arquiteturais registradas (ADRs). ← [voltar ao índice](../README.md)

Um ADR documenta uma decisão técnica relevante, seu contexto e consequências. Ordem cronológica.

| ADR                                                                              | Decisão                                                                                              |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [0001](./adr/0001-arquitetura-multi-tenant.md)                                   | Arquitetura multi-tenant via RLS por `empresa_id`                                                    |
| [0002](./adr/0002-mfa-totp-backup-codes.md)                                      | MFA com TOTP + backup codes                                                                          |
| [0003](./adr/0003-audit-log-append-only.md)                                      | Audit log append-only com hash chaining                                                              |
| [0004](./adr/0004-edge-function-observability.md)                                | Observabilidade de edge functions via HTTP Envelope                                                  |
| [0005](./adr/0005-permissoes-feature-flags.md)                                   | Modelo de permissões em dois níveis (role + features)                                                |
| [0006](./adr/0006-soft-delete-restrito-por-filhos-financeiros.md)                | Bloquear soft delete de projeto/cliente com filhos financeiros vivos                                 |
| [0007](./adr/0007-ambiente-explicito-em-comando-destrutivo.md)                   | Exigir ambiente explícito em todo comando que muta banco ou funções                                  |
| [0008](./adr/0008-design-system-fonte-unica.md)                                  | Design system com fonte única: variants nomeadas, promoção por uso, lint contra estilo ad-hoc        |
| [0009](./adr/0009-breadcrumb-como-navegacao-de-contexto.md)                      | Breadcrumb no `PageHeader` como navegação de contexto (prop opcional `breadcrumbs`)                  |
| [0010](./adr/0010-calendario-compartilhado-por-camadas.md)                       | Calendário compartilhado por camadas togláveis, escopado por quem o monta                            |
| [0011](./adr/0011-reabrir-obras-como-fase-de-execucao-do-projeto.md)             | Reabrir Obras (gatilho atingido) como a fase de execução de um projeto, sem duplicar entidade        |
| [0012](./adr/0012-obra-sem-projeto-obrigatorio-e-local-proprio.md)               | Obra não exige projeto (vínculo opcional) e tem localização própria (CEP → clima) — amenda o 0011    |
| [0013](./adr/0013-financeiro-de-obra-por-administracao-dois-bolsos-uma-lente.md) | Financeiro de obra por administração: dois bolsos (escritório + conta da obra) e uma lente (projeto) |
| [0014](./adr/0014-filtros-padronizados-em-componentes-compartilhados.md)         | Filtros padronizados em componentes compartilhados (sem filter-builder genérico)                     |
| [0015](./adr/0015-notificacoes-por-destinatario.md)                              | Notificações por destinatário (uma linha por usuário, leitura individual)                            |
| [0016](./adr/0016-rotas-aninhadas-por-modulo.md)                                 | Rotas aninhadas por módulo (/&lt;modulo&gt;/&lt;aba&gt;), com redirects de compat                    |
| [0017](./adr/0017-lancamentos-pagina-server-side.md)                             | Página de Lançamentos server-side (view + RPCs de paginação/resumo)                                  |
| [0018](./adr/0018-onboarding-guiado-checklist-e-tour.md)                         | Onboarding guiado: checklist derivado de dados + tour por página com driver.js                       |
| [0019](./adr/0019-features-como-controle-de-rollout-nao-de-plano.md)             | Features como controle de rollout por módulo (não paywall); sub-features flat; revisa o 0005         |
| [0020](./adr/0020-headless-sim-widget-estilizado-nao.md)                         | Adotar biblioteca headless, recusar widget estilizado (Gantt/Kanban custom, tabela via TanStack)     |
| [0021](./adr/0021-marketing-site-separado-do-app.md)                             | Separar o site de marketing (`apps/marketing`) do app autenticado, deploy Vercel próprio             |
| [0022](./adr/0022-consentimento-cookies-client-side.md)                          | Consentimento de cookies client-side (banner + localStorage), sem CMP de terceiro                    |
| [0023](./adr/0023-framer-motion-no-site-de-marketing.md)                         | Adotar Framer Motion para animações do site de marketing                                             |
| [0024](./adr/0024-react-router-em-marketing.md)                                  | Adotar react-router-dom em apps/marketing para rotas internas (Produto/Soluções)                     |
| [0025](./adr/0025-planos-termos-privacidade-para-marketing.md)                   | Mover Planos/Termos/Privacidade (texto) para apps/marketing; ações LGPD para o SettingsDialog do app |

## Guias de reúso

- [`REUSO_LABRYNTH.md`](./REUSO_LABRYNTH.md) — o que adaptar dos repos internos da Labrynth (segurança/tenancy, frontend, RBAC, design system, IA), com caminhos-fonte e esforço de porte.

> **Novo ADR?** Copie [`adr/TEMPLATE.md`](./adr/TEMPLATE.md), numere sequencialmente e siga o formato (contexto → decisão → consequências). Registre na tabela acima.

Para especificar uma feature antes de codar, veja [`../specs/`](../specs/) (Spec Driven Development).
