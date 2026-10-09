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

| Métrica                            | Target                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| **RTO** (Recovery Time Objective)  | 4 horas (drill real: dump 2min + restore 1-2s — o gargalo é humano, não técnico)     |
| **RPO** (Recovery Point Objective) | 24 horas (backup noturno via GitHub Actions, ver abaixo — **não é PITR de verdade**) |
| **Disponibilidade alvo**           | 99.9% (43min downtime/mês)                                                           |

## Backups

### Banco de dados (Supabase)

- **Automático:** nenhum (plano free). PITR desligado.
- **Mitigação atual:** `.github/workflows/backup-nightly.yml`, cron diário (03:00 BRT),
  um por ambiente (Staging e Production). Gera a pasta `backup/` com:
  - `roles.sql` (`supabase db dump --role-only`)
  - `schema.sql` (`supabase db dump`)
  - `data.sql` (`supabase db dump --data-only --use-copy`, inclui `auth` e `storage`,
    sem as tabelas internas da plataforma listadas no workflow)
  - `manifesto.json` (linhas por tabela, `scripts/backup/manifesto.mjs`; o job falha se
    `auth.users`, `empresas` ou `profiles` vierem vazias)

  Empacotado e criptografado com `openssl` (AES-256-CBC, `BACKUP_ENCRYPTION_KEY`),
  artifact `backup-<Ambiente>-<run>` com retenção de 30 dias.
  **Limitação honesta:** RPO de até 24h, não recovery point-in-time.

- **Até 2026-10-09 o backup não tinha dados.** O workflow rodava só `supabase db dump`,
  que exporta apenas o schema. Os artifacts anteriores a essa data não servem para
  recuperar dado de cliente.
- **Verificação mensal automática:** `.github/workflows/drill-restore-mensal.yml` (dia 1)
  baixa o último backup de produção, restaura num Supabase vazio no runner (Postgres 17)
  e compara cada tabela com o manifesto, além de RLS e funções de segurança
  (`scripts/backup-restore-test.sh`). Falha abre issue.

### Código

- GitHub é source of truth.

### Storage (arquivos dos buckets)

O dump do banco guarda a tabela `storage.objects`, não os bytes dos arquivos
(logos, fotos de obra, templates de proposta, entregas do portal).

- **Backup:** desde 2026-10-07, o mesmo `backup-nightly.yml` baixa todos os buckets
  com `scripts/storage-backup.mjs` (API REST do Storage, sem dependência), gera
  `manifest.json` (bucket, público, limites, arquivos), empacota, criptografa com a
  mesma `BACKUP_ENCRYPTION_KEY` e guarda como artifact `storage-<Ambiente>-<run>`
  (30 dias). Roda depois do upload do dump: falha no Storage não custa o backup do
  banco. Tamanho em 07/10: ~6 MB em produção, cópia completa por noite.
- **Credencial:** `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` no environment do
  cron; o script busca a service key na Management API e mascara no log. Sem o par,
  o passo falha e o `notify-cron-failure` abre issue.
- **Restore:** ver "Restore do Storage" no runbook abaixo. Repõe só o que sumiu;
  recria bucket apagado com a mesma configuração.
- **Limitação:** mesmo RPO do banco (até 24h). Arquivo enviado e apagado no mesmo dia
  não volta.

### Secrets

- GitHub Environments (Staging/Production) + `gh secret set`. Sem cópia externa
  ainda (1Password mencionado antes nunca foi configurado — não afirmar isso
  como se existisse).

## Runbook de restore

### Cenário 1 — Corrupção de tabela única

```bash
# 1. Identificar timestamp antes da corrupção via audit_logs
# 2. Baixar o backup noturno mais recente:
#      gh run download <run_id> -n backup-Production-<run_id>
# 3. Decriptar e extrair (gera a pasta backup/):
#      openssl enc -d -aes-256-cbc -pbkdf2 -in backup-Production.tar.gz.enc \
#        -k "$BACKUP_ENCRYPTION_KEY" | tar -xzf -
# 4. Restaurar num Supabase VAZIO primeiro (NUNCA em prod direto). Local:
#      mkdir /tmp/drill && cd /tmp/drill && supabase init --force
#      (major_version = 17 e portas livres no config.toml) && supabase start
#      ./scripts/backup-restore-test.sh backup "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
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
#    b. Restaurar o último backup noturno no projeto novo, vazio (roles + schema + dados):
#         psql --single-transaction -v ON_ERROR_STOP=1 -f backup/roles.sql -f backup/schema.sql \
#           -c 'SET session_replication_role = replica' -f backup/data.sql "<db-url do projeto novo>"
#       O schema do backup já traz o estado de todas as migrations; não rodar db push antes.
#    c. Conferir com o manifesto: ./scripts/backup-restore-test.sh faz isso num banco vazio
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

### Restore do Storage

```bash
# 1. Baixar o artifact storage-Production-<run_id> do run do backup-nightly
gh run download <run_id> -n storage-Production-<run_id>

# 2. Decifrar e extrair
openssl enc -d -aes-256-cbc -pbkdf2 -in storage-Production.tar.gz.enc \
  -k "$BACKUP_ENCRYPTION_KEY" | tar -xzf -

# 3. Repor (só o que sumiu; --sobrescrever volta tudo para o estado do backup)
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service key> \
  node scripts/storage-backup.mjs restore storage-backup
```

Testado em 2026-10-07 contra o Supabase local: arquivo apagado voltou, bucket
apagado foi recriado com o arquivo, segunda execução não duplicou nada.

## Drill de restore — resultados reais (17/08)

Primeiro drill de verdade, contra dump de staging (674KB, schema completo):

| Etapa                                     | Tempo |
| ----------------------------------------- | ----- |
| `supabase db dump` (staging)              | ~117s |
| Restore em `supabase/postgres:17.6.1.054` | 1-2s  |
| Criptografar/decriptar (openssl)          | < 1s  |

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
  deram 0 no drill. Na época isso foi lido como "staging tem pouco dado".
  **Correção (2026-10-09):** era o backup sem dados (só schema). O drill mensal
  agora compara com o manifesto e falha nesse caso.

## Drill de restore completo (2026-10-09)

Backup completo do banco local (roles + schema + dados) restaurado num Supabase vazio
com Postgres 17: 138 tabelas e 667 linhas conferidas contra o manifesto, RLS e funções
de segurança presentes, restore em 1 s. O mesmo script acusou um backup só com schema
("Backup sem dados nas tabelas essenciais") e uma linha faltando ("public.projetos: 22
linhas, manifesto diz 23").

## Comunicação durante outage

- **Status page:** https://status.pilarsoft.com.br (Better Stack, fora da nossa infra,
  ADR 0047). Queda é detectada pelos monitores por componente (3 min) e pelo
  `monitor-producao.yml` (10 min, login real); ver `monitoring/`.
- **Template:** "Estamos investigando instabilidade em [serviço]. Updates em
  [link]. ETA: [X min]." Atualizar a cada 30 min mesmo sem novidade.

## Pós-restore

- Rodar `audit_log_verify_chain()` pra confirmar integridade
- Comparar contagens de registros com último ponto conhecido bom
- Notificar clientes afetados
- Post-mortem em até 7 dias
