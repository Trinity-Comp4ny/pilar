# Disaster Recovery — Pilar

RTO e RPO, backups, runbook de restore.

## Objetivos

| Métrica                            | Target                            |
| ---------------------------------- | --------------------------------- |
| **RTO** (Recovery Time Objective)  | 4 horas                           |
| **RPO** (Recovery Point Objective) | 24 horas (Supabase backup diário) |
| **Disponibilidade alvo**           | 99.9% (43min downtime/mês)        |

## Backups

### Banco de dados (Supabase)

- **Automático:** snapshot diário retido 7 dias (plan Pro)
- **PITR:** Point-in-Time Recovery até 7 dias (Supabase Pro)
- **Manual mensal:** `pg_dump` exportado + armazenado em S3/Backblaze com criptografia
- **Verificação:** restore de teste trimestral em projeto Supabase dev

### Código

- GitHub é source of truth
- Backup adicional: mirror em GitLab (opcional)

### Storage (Supabase Storage — portal-entregas)

- Replicação Supabase automática
- **Backup manual:** script mensal exporta bucket → S3 com lifecycle rules

### Secrets

- Vercel Env Vars + backup cifrado em 1Password Vault compartilhado do time

## Runbook de restore

### Cenário 1 — Corrupção de tabela única

```bash
# 1. Identificar timestamp antes da corrupção via audit_logs
# 2. Supabase Dashboard → Database → Backups → PITR
# 3. Restaurar em projeto staging primeiro (NÃO em prod direto)
# 4. Validar
# 5. Se OK: restaurar prod ou copiar tabela específica
```

### Cenário 2 — Projeto Supabase offline completo

```bash
# 1. Abrir ticket P0 com Supabase
# 2. Monitorar status.supabase.com
# 3. Se SLA estourado (> 4h):
#    a. Criar novo projeto em região alternativa
#    b. Aplicar migrations em ordem
#    c. Restaurar último dump manual
#    d. Atualizar VITE_SUPABASE_URL no Vercel
#    e. Redirecionar DNS
```

### Cenário 3 — Deploy defeituoso

```bash
# Rollback Vercel: vercel rollback
# Rollback Supabase edge functions: redeploy tag anterior
# Rollback migration: criar migration de reversão (NÃO rodar DROP direto)
```

## Teste de restore (trimestral)

1. Primeiro sábado do trimestre, 10:00 BRT
2. Criar projeto Supabase dev temporário
3. Aplicar último backup PITR
4. Validar: contagem de registros vs prod, rodar pgTAP, smoke test manual
5. Documentar tempo real de restore + eventuais problemas em `docs/RESTORE_TESTS.md`
6. Deletar projeto temporário

## Comunicação durante outage

- **Status page:** https://status.pilarsoft.com.br (criar com Better Uptime)
- **Template tweet/email:** "Estamos investigando instabilidade em [serviço]. Updates em [link]. ETA: [X min]."
- Atualizar a cada 30 min mesmo sem novidade.

## Pós-restore

- Rodar `audit_log_verify_chain()` pra confirmar integridade
- Comparar contagens de registros com último ponto conhecido bom
- Notificar clientes afetados
- Post-mortem em até 7 dias
