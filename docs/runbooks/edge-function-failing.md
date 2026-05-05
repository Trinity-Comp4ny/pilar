# Runbook: Edge Function retornando 500 recorrente

## Severidade

**P1** — funcionalidade quebrada para parte dos usuários (depende da função).

> Funções existentes em `supabase/functions/`: `invite-user`, `delete-user`,
> `asaas-webhook`, `pilar-checkout-*`, `send-*`, `ai-*`, etc.

## Sintomas

- Usuários reportam falha em ação específica (convidar usuário, enviar
  email, gerar cobrança, IA não responde).
- Sentry: issue concentrada em `edge:function-name`, taxa de erro > 5%.
- Frontend recebe `{ error: "..." }` ou status 500/502/504.
- Logs Supabase → Edge Functions → tab da função mostram stack trace.

## Diagnóstico (passo-a-passo)

1. **Identificar a função:** Sentry → tag `edge.function` ou nome no path.
2. **Abrir Supabase Dashboard → Edge Functions → [função] → Logs.**
   Filtrar últimas 1h, buscar `ERROR`/`Uncaught`.
3. **Quando começou?**
   ```bash
   git log --oneline --since="6 hours ago" -- supabase/functions/<nome>
   ```
   Se há deploy recente → suspeito #1.
4. **Env vars:** Dashboard → Project Settings → Edge Functions → Secrets.
   Conferir se `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
   `ASAAS_PLATFORM_API_KEY`, `GEMINI_API_KEY`, `SENTRY_DSN`, etc., estão presentes.
5. **Dependência externa fora?** (Resend, Asaas, Gemini, Stripe, Turnstile) —
   ver runbook específico ou status page do provedor.
6. **Rate limit interno:** funções usam `_shared/rate-limit.ts`. Ver se
   tabela `edge_function_rate_limits` está rejeitando legitimamente.
7. **Reproduzir local:**
   ```bash
   supabase functions serve <nome> --env-file supabase/.env.local
   curl -X POST http://localhost:54321/functions/v1/<nome> \
     -H "Authorization: Bearer $TOKEN" -d '{...}'
   ```

## Mitigação imediata

- **Se é deploy ruim:** redeploy versão anterior:
  ```bash
  git checkout <SHA-bom> -- supabase/functions/<nome>
  supabase functions deploy <nome> --no-verify-jwt   # se aplicável
  ```
- **Se é env var ausente:** repor secret:
  ```bash
  supabase secrets set CHAVE=valor
  ```
  (não precisa redeploy — funções leem em runtime).
- **Se é dependência externa:** comentar bloco e retornar fallback graceful;
  ou habilitar circuit breaker se já existir.
- **Se é alta carga:** subir limite no rate limiter ou adicionar `Retry-After`.

## Solução definitiva

- Hotfix com testes em `supabase/functions/<nome>/__tests__/` (Vitest).
- `npm run typecheck` antes de deploy.
- Adicionar Sentry breadcrumb na linha onde quebrou pra debug futuro.
- Se for dependência flaky: implementar retry com backoff (já temos helper
  em `_shared/`).

## Comunicação

- Funções de **convite/criação de usuário** quebradas → notificar admins
  afetados ("convite indisponível, retorna em ~30 min").
- Funções de **pagamento** (`asaas-*`, `pilar-checkout-*`) → ver runbook
  [`asaas-integration-down`](./asaas-integration-down.md) e abrir P1
  separado se cobranças foram perdidas.
- Status page: opcional para P1, obrigatório se >30 min.

Template Slack interno:

```
:rotating_light: P1 — edge function `<nome>` falhando
Sintoma: <descrição>
Início: HH:MM
Mitigação: <ação>
Owner: @<você>
```

## Pós-mortem

- Apenas se P1 durou > 1h ou afetou financeiro/auth.
- Action item obrigatório: **adicionar teste que pega o cenário do bug**.
