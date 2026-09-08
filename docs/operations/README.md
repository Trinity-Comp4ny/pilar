# Operações

Deploy, resposta a incidentes, runbooks e monitoramento. ← [voltar ao índice](../README.md)

| Documento                                                                          | O que é                                                                                                           |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [EMAILS.md](./EMAILS.md)                                                           | **Catálogo de e-mails**: todo disparo, quem recebe cada um, onde aparece valor em R$ e as regras de roteamento    |
| [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md)                                       | Checklist de hardening de deploy (Supabase/Vercel/Cloudflare/Sentry)                                              |
| [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)                                     | **Fonte de verdade** para severidade, comunicação e resposta a incidentes                                         |
| [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md)                                     | Plano de recuperação de desastres (PITR, restore, RTO/RPO)                                                        |
| [load-testing.md](./load-testing.md)                                               | Estratégia de teste de carga, quando rodar, baseline                                                              |
| [api-versioning.md](./api-versioning.md)                                           | Estratégia de versionamento de API das edge functions                                                             |
| [STAGING_SETUP.md](./STAGING_SETUP.md)                                             | Setup do ambiente de staging (2º projeto Supabase)                                                                |
| [PLANO_ENGENHARIA_2026-07.md](./PLANO_ENGENHARIA_2026-07.md)                       | Gap de CI/CD, secrets, migrations e ambientes contra o padrão dos repos AWS da Labrynth, com plano em 5 fases     |
| [AUDITORIA_ATIVACAO_ASAAS_2026-09-01.md](./AUDITORIA_ATIVACAO_ASAAS_2026-09-01.md) | Duas integrações Asaas distintas (cliente vs plataforma); checklist pra ligar a cobrança de assinatura em sandbox |

## Subpastas

- [`runbooks/`](./runbooks/) — procedimentos passo-a-passo de incidente (DB down, edge function falhando, Asaas down, etc.). Índice em [`runbooks/README.md`](./runbooks/README.md).
- [`monitoring/`](./monitoring/) — setup de Checkly, status page e testes sintéticos.
