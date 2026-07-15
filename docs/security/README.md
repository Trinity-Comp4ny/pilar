# Segurança & Compliance

Postura de segurança, LGPD/compliance e auditorias. ← [voltar ao índice](../README.md)

| Documento | O que é |
|---|---|
| [SECURITY.md](./SECURITY.md) | Postura de segurança implementada (auth, MFA, RLS, criptografia, CI de segurança); canal de report |
| [COMPLIANCE.md](./COMPLIANCE.md) | Estado de LGPD, SOC2, ISO 27001; TODOs abertos e roadmap |
| [AUDITORIA_BANCO_2026-05-19.md](./AUDITORIA_BANCO_2026-05-19.md) | Auditoria do banco (health score, achados P0–P3, isolamento multi-tenant) |
| [secrets-rotation.md](./secrets-rotation.md) | Procedimento de rotação de segredos |
| [ACHADOS_SEGURANCA_AGENTES_2026-07-13.md](./ACHADOS_SEGURANCA_AGENTES_2026-07-13.md) | 🔴 Furos de autorização/custo nos fluxos de agente de IA (RPC sem gate de role, service_role sem RLS) |

**Decisões arquiteturais relacionadas:** [`../architecture/adr/`](../architecture/adr/) (multi-tenant, MFA, audit log append-only, permissões).
