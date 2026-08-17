# Disaster Recovery — Pilar

RTO e RPO, backups, runbook de restore.

## Estado real (atualizado 17/08, Semana 4 do hardening pré-lançamento)

A organização Supabase está no **plano free**: sem backup automático, sem PITR
(`pitr_enabled: false`, confirmado via API de billing). Upgrade pra Pro
(~$25/mês) + PITR 7 dias (~$100/mês) foi avaliado e **adiado por decisão
consciente** — ver `project_producao_sem_backup_free_tier_2026-08-17` na
memória do projeto. Isso muda os targets abaixo: sem PITR, RPO não pode ser
melhor que o intervalo do backup manual.

## Objetivos

| Métrica                            | Target                                                     |
| ----------------------------------- | ----------------------------------------------------------- |
| **RTO** (Recovery Time Objective)  | 4 horas (drill real: dump 2min + restore 1-2s — o gargalo é humano, não técnico) |
| **RPO** (Recovery Point Objective) | 24 horas (backup noturno via GitHub Actions, ver abaixo — **não é PITR de verdade**) |
| **Disponibilidade alvo**           | 99.9% (43min downtime/mês)                                   |

## Backups

### Banco de dados (Supabase)

- **Automático:** nenhum (plano free). PITR desligado.
- **Mitigação atual:** `.github/workflows/backup-nightly.yml` — cron diário
  (03:00 BRT) via `supabase db dump`, criptografado com `openssl` (AES-256-CBC,
  `BACKUP_ENCRYPTION_KEY` nos secrets do repo) e guardado como GitHub Actions
  artifact (retenção 30 dias), um por ambiente (Staging e Production).
  **Limitação honesta:** dá RPO de até 24h, não recovery point-in-time.
  Perda de dado entre backups (até 24h) não é recuperável até fazer upgrade.
- **Verificação:** `scripts/backup-restore-test.sh <dump> <test-db-url>` —
  restaura o dump num banco de teste e valida contagens + RLS + funções
  críticas. Rodar contra um Postgres **compatível com Supabase** (a imagem
  `supabase/postgres:<versão>`, não um Postgres vanilla — o dump inclui
  `auth`/`storage`/`pgsodium`/`pg_cron`/etc, que só existem nessa imagem).

### Código

- GitHub é source of truth.

### Storage (Supabase Storage — portal-entregas)

- Replicação Supabase automática.
- Sem backup manual adicional configurado ainda.

### Secrets

- GitHub Environments (Staging/Production) + `gh secret set`. Sem cópia externa
  ainda (1Password mencionado antes nunca foi configurado — não afirmar isso
  como se existisse).

## Runbook de restore

### Cenário 1 — Corrupção de tabela única

```bash
# 1. Identificar timestamp antes da corrupção via audit_logs
# 2. Baixar o backup noturno mais recente (aba Actions → backup-nightly → artifact)
# 3. Decriptar: openssl enc -d -aes-256-cbc -pbkdf2 -in dump-Production.sql.enc \
#      -out dump.sql -k "$BACKUP_ENCRYPTION_KEY"
# 4. Restaurar em banco de TESTE primeiro (NUNCA em prod direto):
#      ./scripts/backup-restore-test.sh dump.sql "<test-db-url>"
# 5. Validar manualmente o que o script não cobre (dado específico do incidente)
# 6. Se OK: copiar só a tabela/linhas afetadas pra prod via INSERT ... SELECT,
#    NUNCA um restore completo por cima de prod (perde tudo criado desde o backup)
```

### Cenário 2 — Projeto Supabase offline completo

```bash
# 1. Abrir ticket P0 com Supabase
# 2. Monitorar status.supabase.com
# 3. Se SLA estourado (> 4h):
#    a. Criar novo projeto em região alternativa
#    b. Aplicar migrations em ordem (supabase db push, histórico completo em supabase/migrations/)
#    c. Restaurar último backup noturno (ver Cenário 1, passos 2-3)
#    d. Atualizar VITE_SUPABASE_URL no Vercel
#    e. Redirecionar DNS
```

### Cenário 3 — Deploy defeituoso

```bash
# Rollback Vercel: vercel rollback (ou dashboard → Deployments → ... → Promote to Production
# num deployment anterior). Feature padrão da plataforma, disponível em qualquer plano.
# Rollback Supabase edge functions: redeploy do commit anterior (supabase functions deploy
# roda a partir do estado do checkout, então um `git checkout <sha-anterior>` + redeploy resolve).
# Rollback de migration: NUNCA editar/reverter a migration já aplicada — criar uma migration
# CORRETIVA nova. Drill real (17/08): ADD COLUMN ... NOT NULL sem DEFAULT falha atomicamente
# contra tabela com dado (nada é escrito, a transação inteira aborta) — a correção é uma
# migration nova com DEFAULT ou backfill antes do NOT NULL. check-migration-safety.mjs agora
# avisa (não bloqueia) esse padrão antes do PR.
```

## Drill de restore — resultados reais (17/08)

Primeiro drill de verdade, contra dump de staging (674KB, schema completo):

| Etapa                          | Tempo   |
| ------------------------------- | ------- |
| `supabase db dump` (staging)    | ~117s   |
| Restore em `supabase/postgres:17.6.1.054` | 1-2s |
| Criptografar/decriptar (openssl)| < 1s    |

Achados do drill:
- O dump só restaura limpo (0 erros) contra a imagem `supabase/postgres`
  (que já vem com `auth`/`storage`/`pgsodium`/`pg_cron`/roles `anon`/
  `authenticated`/`service_role`) — um Postgres vanilla gera ~1200 erros em
  cascata por falta desses schemas/extensões/roles. Documentado acima.
- `scripts/backup-restore-test.sh` tinha um bug real: usava `declare -A`
  (array associativo, só existe a partir do bash 4), e o bash padrão do macOS
  é o 3.2 — o script quebrava exatamente na hora de validar o restore, no
  meio de um incidente de verdade. Corrigido pra usar arrays indexados
  (compatível com bash 3.2+).
- O mesmo script checava RLS em `lancamentos`, que virou VIEW (spec 033,
  17/08) — `relrowsecurity` de view é sempre falso, gerando falso-negativo
  permanente. Corrigido pra checar as tabelas de origem (`receitas`/`despesas`).
- As contagens de linha (`profiles`/`empresas`/`projetos`/`lancamentos`)
  deram 0 no drill porque staging tem pouquíssimo dado real hoje — não é
  falha do restore. Repetir este drill quando houver dado de produção real
  vai validar as contagens de verdade.

## Comunicação durante outage

- **Status page:** ainda não existe (ver item "Checkly/BetterStack" do plano
  de lançamento — depende de você criar a conta).
- **Template:** "Estamos investigando instabilidade em [serviço]. Updates em
  [link]. ETA: [X min]." Atualizar a cada 30 min mesmo sem novidade.

## Pós-restore

- Rodar `audit_log_verify_chain()` pra confirmar integridade
- Comparar contagens de registros com último ponto conhecido bom
- Notificar clientes afetados
- Post-mortem em até 7 dias
