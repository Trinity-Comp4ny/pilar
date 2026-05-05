# Runbooks Operacionais — Pilar

Guias passo-a-passo para responder a incidentes em produção. Cada runbook é
auto-contido: severidade, sintomas, diagnóstico, mitigação, solução,
comunicação e pós-mortem.

> Para o **processo geral** de incident response (papéis, fluxo, LGPD),
> ver [`docs/INCIDENT_RESPONSE.md`](../INCIDENT_RESPONSE.md).
> Para **disaster recovery** (PITR, backup), ver
> [`docs/DISASTER_RECOVERY.md`](../DISASTER_RECOVERY.md).

## Índice

| Runbook                                               | Severidade | Quando usar                                                           |
| ----------------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| [database-down](./database-down.md)                   | P0         | Supabase indisponível, healthcheck falhando, queries timeout em massa |
| [edge-function-failing](./edge-function-failing.md)   | P1         | Erro 5xx recorrente em uma edge function (Sentry, Supabase logs)      |
| [asaas-integration-down](./asaas-integration-down.md) | P1         | Webhook Asaas não chegando, cobranças falhando, status travado        |
| [sentry-spike](./sentry-spike.md)                     | P2         | Aumento súbito de erros no Sentry após release ou sem causa óbvia     |
| [data-deletion-request](./data-deletion-request.md)   | LGPD       | Pedido de eliminação de dados (Art. 18 IV) na fila                    |
| [user-locked-out](./user-locked-out.md)               | P2         | Admin perdeu acesso por MFA / esqueceu senha / e‑mail trocado         |
| [backup-restore-test](./backup-restore-test.md)       | trimestral | Teste de restore de backup (DR drill)                                 |

## Quando abrir um runbook

1. **Sentry/Slack alertou** → identifique o sintoma → escolha o runbook acima.
2. **Cliente reportou** → confirme se é incidente (mais de 1 cliente? cai healthcheck?) → abra runbook.
3. **Em dúvida** → trate como **P1** até provar o contrário.

## Escalonamento

| Severidade | Quem chama                   | SLA de resposta | Status page           |
| ---------- | ---------------------------- | --------------- | --------------------- |
| **P0**     | IC + Tech Lead + CEO/Founder | < 15 min        | Atualizar imediato    |
| **P1**     | IC + Tech Lead               | < 1 h           | Atualizar em < 30 min |
| **P2**     | Oncall                       | < 4 h           | Opcional              |
| **P3**     | Backlog                      | < 24 h          | Não                   |

Contatos:

- Oncall: ver `#oncall` no Slack
- Security: `security@labrynth.ai`
- DPO (LGPD): `dpo@labrynth.ai`

## Convenção de severidade

- **P0** — produção fora do ar para todos ou subset crítico; perda/vazamento de dados.
- **P1** — funcionalidade importante quebrada (financeiro, auth, integrações de pagamento).
- **P2** — funcionalidade secundária quebrada; degradação perceptível.
- **P3** — bug cosmético, edge case, sem impacto operacional.

## Política de retenção de evidências

- **Logs Supabase / edge functions:** 30 dias (default Supabase).
- **Sentry:** 90 dias (plano atual).
- **`audit_logs` no Postgres:** 1 ano (LGPD).
- **Pós‑mortem markdown** em `docs/postmortems/YYYY-MM-DD-titulo.md` — **permanente**.
- **Evidências de incidentes P0/P1** (screenshots, dumps redatados): 5 anos
  em pasta privada (Drive `Pilar/Incidents/`).

## Pós-mortem

Todo P0/P1 gera pós-mortem em até **D+7**, mesmo sem culpa. Template:
[INCIDENT_RESPONSE.md §7](../INCIDENT_RESPONSE.md).
