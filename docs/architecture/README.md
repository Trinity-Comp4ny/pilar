# Arquitetura

Decisões arquiteturais registradas (ADRs). ← [voltar ao índice](../README.md)

Um ADR documenta uma decisão técnica relevante, seu contexto e consequências. Ordem cronológica.

| ADR | Decisão |
|---|---|
| [0001](./adr/0001-arquitetura-multi-tenant.md) | Arquitetura multi-tenant via RLS por `empresa_id` |
| [0002](./adr/0002-mfa-totp-backup-codes.md) | MFA com TOTP + backup codes |
| [0003](./adr/0003-audit-log-append-only.md) | Audit log append-only com hash chaining |
| [0004](./adr/0004-edge-function-observability.md) | Observabilidade de edge functions via HTTP Envelope |
| [0005](./adr/0005-permissoes-feature-flags.md) | Modelo de permissões em dois níveis (role + features) |

## Guias de reúso

- [`REUSO_LABRYNTH.md`](./REUSO_LABRYNTH.md) — o que adaptar dos repos internos da Labrynth (segurança/tenancy, frontend, RBAC, design system, IA), com caminhos-fonte e esforço de porte.

> **Novo ADR?** Copie [`adr/TEMPLATE.md`](./adr/TEMPLATE.md), numere sequencialmente e siga o formato (contexto → decisão → consequências). Registre na tabela acima.

Para especificar uma feature antes de codar, veja [`../specs/`](../specs/) (Spec Driven Development).
