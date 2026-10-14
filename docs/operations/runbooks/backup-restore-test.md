# Runbook: drill de restore do backup

## Severidade

Não é incidente: exercício. **Automático todo mês** (dia 1, workflow
`drill-restore-mensal.yml`). Rodar na mão depois de mudança no backup ou antes de uma
auditoria.

## Por que fazer

Backup que nunca foi restaurado é suposição. Até 2026-10-09 o backup noturno guardava só
o schema, e o drill manual de agosto leu as contagens zeradas como "pouco dado em
staging". O drill compara com o manifesto do próprio backup justamente para que isso não
se repita.

## Automático

GitHub → Actions → **Drill de restore (mensal)** → Run workflow. O job:

1. Baixa o último artifact `backup-Production-<run>` de um run **agendado na `main`** do
   `backup-nightly.yml` (run disparado de outra branch não vale: o artifact é tratado como
   dado não confiável) e extrai fora do workspace, aceitando só os quatro arquivos esperados.
2. Descriptografa com `BACKUP_ENCRYPTION_KEY` (environment `production-automation`).
3. Sobe um Supabase vazio no runner (Postgres 17).
4. Roda `scripts/backup-restore-test.sh`: restaura roles, schema e dados, compara cada
   tabela com `manifesto.json`, confere RLS e funções de segurança.

Resultado no resumo do job (só contagens). Falha abre a issue "Cron falhando: Drill de
restore (mensal)".

## Manual (máquina local)

```bash
# 1. Backup
gh run download <run_id> -n backup-Production-<run_id>
openssl enc -d -aes-256-cbc -pbkdf2 -in backup-Production.tar.gz.enc \
  -k "$BACKUP_ENCRYPTION_KEY" | tar -xzf -          # cria a pasta backup/

# 2. Supabase vazio, fora do repositório, em portas livres
mkdir /tmp/drill && cd /tmp/drill && supabase init --force
# no supabase/config.toml: major_version = 17, project_id e portas diferentes do dev
supabase start -x studio,imgproxy,inbucket,mailpit,realtime,edge-runtime,logflare,vector,supavisor,postgres-meta

# 3. Restore e conferência (de volta na raiz do repo)
./scripts/backup-restore-test.sh backup "postgresql://postgres:postgres@127.0.0.1:<porta db>/postgres"

# 4. Limpar: o dado de produção não fica na máquina
cd /tmp/drill && supabase stop --no-backup && rm -rf /tmp/drill <pasta>/backup*
```

## Validações manuais (opcionais)

- Logar no app apontado para o banco restaurado com um usuário conhecido.
- `SELECT public.audit_log_verify_chain();` confirma a cadeia do audit log.

## Se falhar

- "Backup sem dados nas tabelas essenciais": o dump perdeu os dados. Ver o passo
  "Dump do banco" do `backup-nightly.yml`.
- "<tabela>: N linhas, manifesto diz M": restore incompleto. O log do job tem o erro do
  `psql`.
- Erro de permissão numa tabela interna (`storage.*`, `supabase_*`): entrou tabela nova
  da plataforma no dump; somar à lista `EXCLUIR` do workflow de backup.
