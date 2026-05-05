# Runbook: Database (Supabase) indisponível

## Severidade

**P0** — produção fora do ar para todos os tenants.

## Sintomas

- Usuários veem tela branca, "Network error", spinner infinito.
- Healthcheck (`/api/health` ou ping ao Supabase) falhando.
- Sentry: rajada de `PostgrestError`, `FetchError: Failed to fetch`,
  `connection refused`, `relation "..." does not exist` em massa.
- Edge functions retornando 503/500 com `Connection terminated unexpectedly`.
- `#oncall` lotado de prints de erro.

## Diagnóstico (passo-a-passo)

1. **Confirmar escopo** — abrir <https://status.supabase.com/> e ver se
   a região do projeto (`sa-east-1` / `us-east-1`, conferir no dashboard)
   está marcada como degraded/down.
2. **Pingar projeto direto:**
   ```bash
   curl -sS -o /dev/null -w "%{http_code}\n" \
     "$SUPABASE_URL/rest/v1/?apikey=$SUPABASE_ANON_KEY"
   ```

   - 200 → Postgrest ok, problema é de app/RLS, **não use este runbook**.
   - 5xx ou timeout → segue.
3. **Verificar dashboard Supabase** → Database → Reports → CPU / Disk / Connections.
   - Connection saturation? Disk 100%? CPU travado em 100% por query?
4. **Verificar deploy recente** — `git log --since="2 hours ago"` e Vercel
   deploys. Migration ruim? Função `SECURITY DEFINER` infinita?
5. **Logs:** Supabase Dashboard → Logs → Postgres / API. Procurar
   `FATAL`, `out of memory`, `too many connections`.

## Mitigação imediata

- **Ativar página de manutenção** (status: pendente — sugerimos um arquivo
  estático em Vercel que responde 503 quando feature flag `MAINTENANCE=1` ligada).
  Roteiro sugerido:
  ```bash
  vercel env add MAINTENANCE production   # value=1
  vercel --prod                            # redeploy
  ```
- **Se for connection storm:** matar conexões idle em paralelo:
  ```sql
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle' AND state_change < NOW() - INTERVAL '5 minutes';
  ```
- **Se for query rogue:** identificar e matar:
  ```sql
  SELECT pid, now() - query_start AS duration, query
  FROM pg_stat_activity
  WHERE state = 'active' ORDER BY duration DESC LIMIT 10;
  -- pg_terminate_backend(<pid>);
  ```
- **Se Supabase confirmou outage:** nada a fazer no DB; foco em comunicação.
- **Se deploy ruim:** rollback Vercel (`vercel rollback`) + reverter migration
  (`supabase db reset` em branch ou `DROP`/`ALTER` reverso manual).

## Solução definitiva

- **Outage Supabase:** aguardar resolução, ativar PITR se houve perda de dados
  (ver `docs/DISASTER_RECOVERY.md`).
- **Connection saturation:** subir pool no Supabase (Pro ↑), revisar
  edge functions sem `await client.from(...).limit()`, adicionar PgBouncer.
- **Disk cheio:** `VACUUM FULL` em tabelas grandes (`audit_logs`,
  `notification_logs`, `lgpd_consents_audit`), revisar política de retenção.
- **Migration ruim:** hotfix migration na branch `hotfix/db-recovery`,
  testar em projeto staging, aplicar via `supabase db push`.

## Comunicação

- **Imediato (T+5min):** atualizar status page (BetterStack / UptimeRobot —
  recomendamos BetterStack pelo bom free tier e integração Slack).
  Texto: _"Estamos investigando lentidão / indisponibilidade no acesso
  ao Pilar. Próxima atualização em 15 min."_
- **T+15min:** post no Slack `#status-clientes` + email para clientes pagantes
  via Resend (template abaixo).
- **T+30min / resolvido:** update final, RTO/RPO real.

Template email cliente (PT-BR):

```
Assunto: [Pilar] Indisponibilidade — atualização

Olá,

Entre HH:MM e HH:MM (BRT) o Pilar ficou indisponível devido a [causa
neutra: instabilidade no provedor de banco / manutenção emergencial].

Impacto: [acesso geral / módulo X].
Dados: [nenhum dado foi perdido / restauramos via PITR ao ponto HH:MM].
Status: serviço normalizado.

Pedimos desculpas pelo transtorno. RCA completo em até 7 dias úteis.

— Time Pilar
```

## Pós-mortem

- Issue de RCA: criar em `docs/postmortems/YYYY-MM-DD-database-down.md`.
- Incluir: timeline, causa raiz (5 whys), RTO/RPO efetivos, action items.
- Compartilhar internamente em < 7 dias.
