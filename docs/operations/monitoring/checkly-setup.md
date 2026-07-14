# Checkly — Synthetic Monitoring

Checkly roda checks (browser + API) de fora pra dentro, em múltiplas regiões. Cobre o que `/health` não cobre: experiência real do usuário (TTFB, render, JS errors) e regressões de produção.

## Free tier

- 10k API check runs/mês
- 1.5k browser check runs/mês
- 5 alert channels

Suficiente pra Pilar com a config atual: ~43k API runs/mês (`/health` 1x/min × 30 dias) — passa do free, ajustar pra 5min se quiser ficar grátis, ou upgrade Team Plan ($80/mês).

## Setup inicial

1. Criar conta em https://app.checklyhq.com (free, sem cartão).
2. Criar API key: Account Settings → API Keys → Create.
3. Localmente:

   ```bash
   npm i -D checkly @playwright/test
   npx checkly login
   ```

4. Configurar env vars (`.env` local ou no shell):

   ```
   CHECKLY_ACCOUNT_ID=...
   CHECKLY_API_KEY=...
   PILAR_BASE_URL=https://app.pilarsoft.com.br
   PILAR_HEALTH_URL=https://<project-ref>.supabase.co/functions/v1/health
   PILAR_TURNSTILE_VERIFY_URL=https://<project-ref>.supabase.co/functions/v1/turnstile-verify
   ALERT_EMAIL=ops@labrynth.ai
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...   # opcional
   ```

5. Validar config local:

   ```bash
   npx checkly test
   ```

6. Deploy:

   ```bash
   npx checkly deploy
   ```

## O que monitora

| Check                    | Tipo    | Frequência | Locations            |
| ------------------------ | ------- | ---------- | -------------------- |
| `/health`                | API     | 1min       | us-east-1, sa-east-1 |
| `turnstile-verify` smoke | API     | 5min       | us-east-1            |
| Login screen renders     | Browser | 5min       | sa-east-1            |
| Landing page loads       | Browser | 5min       | sa-east-1            |
| Dashboard route (unauth) | Browser | 10min      | sa-east-1            |
| Login flow real          | Browser | 12h        | sa-east-1            |

## Alert channels

- **Email**: `ALERT_EMAIL` — todos os checks.
- **Slack**: `SLACK_WEBHOOK_URL` — opcional, recomendado pra críticos (db down, login quebrado).
- **PagerDuty/Opsgenie**: configure no dashboard se houver rotação on-call.

Política sugerida: alerta dispara após **2 falhas consecutivas** (evita falso positivo de 1 região).

## CI/CD

Deploy de checks via GitHub Actions a cada merge em `main`:

```yaml
- name: Deploy Checkly
  run: npx checkly deploy --force
  env:
    CHECKLY_API_KEY: ${{ secrets.CHECKLY_API_KEY }}
    CHECKLY_ACCOUNT_ID: ${{ secrets.CHECKLY_ACCOUNT_ID }}
```

## Dashboard

- Overview: https://app.checklyhq.com/dashboard
- MTTR/MTBF por check em "Reporting".
- Heatmap por region/hour mostra problemas regionais (CDN, AWS region issues).
