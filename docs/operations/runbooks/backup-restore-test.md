# Runbook: Teste trimestral de restore de backup (DR drill)

## Severidade

**Não é incidente** — exercício planejado. Frequência: **trimestral**
(jan, abr, jul, out — primeira semana).

## Por que fazer

Backup que nunca foi restaurado **não é backup, é torcida**. A LGPD e
qualquer auditoria SOC2-like exigem evidência de DR drill.

## Pré-requisitos

- Acesso ao Supabase Dashboard com permissão de criar projeto.
- `psql` 15+ instalado local (`brew install libpq`).
- Dump recente do projeto prod (PITR snapshot ou `pg_dump`).

## Procedimento

### 1. Gerar dump recente

Via Supabase Dashboard → Database → Backups → "Download backup" (Pro tier).
Ou via CLI (substitua `<PROJECT_REF>`):

```bash
supabase db dump --project-ref <PROJECT_REF> -f backups/prod-$(date +%F).sql
```

### 2. Criar projeto Supabase de teste

- Dashboard → New Project → Name: `pilar-dr-test-YYYY-Q[1-4]`.
- Plano Free serve para teste.
- Anotar `host`, `password`, `db` para montar `TEST_DB_URL`.

Formato:

```
postgresql://postgres.<project_ref>:<senha>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

### 3. Rodar o script de teste

```bash
chmod +x scripts/backup-restore-test.sh   # uma vez só
./scripts/backup-restore-test.sh \
    backups/prod-$(date +%F).sql \
    "$TEST_DB_URL"
```

O script:

1. Valida que o dump existe e não está vazio.
2. Restaura via `psql` (com `ON_ERROR_STOP=1`).
3. Conta linhas em `profiles`, `empresas`, `projetos`, `lancamentos`.
4. Verifica que RLS está habilitado em tabelas críticas.
5. Reporta `OK` (todos checks passaram) ou `FAIL` com diff.

### 4. Validações manuais adicionais

- Logar com `service_role` da prod e bater contagens (deve dar números próximos).
- Rodar `npm run gen:types` apontando para a TEST_DB_URL e diffar contra
  `src/integrations/supabase/types.ts` — schema deve bater 100%.
- Rodar uma query crítica (ex.: `SELECT * FROM v_lancamentos LIMIT 5`).

### 5. Limpeza

- Após sucesso, **deletar o projeto de teste** (Supabase → Settings → General → Delete).
- Salvar log do script em `docs/dr-drills/YYYY-Q[1-4]-restore.log` (criar quando precisar).

## Critérios de sucesso

| Métrica                                  | Esperado                |
| ---------------------------------------- | ----------------------- |
| Tempo total do restore                   | < 30 min para DB < 5GB  |
| Contagem `profiles` na restore           | ≥ contagem em prod − 1% |
| RLS habilitado em todas tabelas críticas | 100%                    |
| Script termina com exit code 0           | sim                     |

## Em caso de falha do drill

- **TRATAR COMO P1** (não é incidente prod, mas é crítico).
- Issue no GitHub: `[DR] Backup restore falhou — Q?-YYYY`.
- Solução em até 14 dias.
- Escalar para CTO/Founder.

## Comunicação interna

Após cada drill (sucesso ou não), post no Slack `#engineering`:

```
:floppy_disk: DR drill Q?/YYYY — <OK|FAIL>
Dump: <data>
Tamanho: <MB>
Tempo de restore: <min>
Notas: <observações>
```

## Pós-mortem

Apenas se FAIL. Plano de remediação em até 14 dias.
