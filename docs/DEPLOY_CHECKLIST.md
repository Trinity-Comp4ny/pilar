# Deploy Checklist — Pilar

Todas as ações que **precisam** ser feitas manualmente (config de dashboards) pra atingir 10/10 em segurança.

---

## 🔴 Supabase Dashboard

### Authentication → Providers → Email

- [ ] **Password Requirements:** Min length 12
- [ ] **Minimum password strength:** Strong
- [ ] **HIBP check (Have I Been Pwned):** Enabled
- [ ] **Disable "Enable new users to sign up":** yes (signup controlado por convite)

### Authentication → MFA

- [ ] **TOTP:** Enabled
- [ ] **Phone:** Disabled (SMS é vulnerável)

### Authentication → Sessions

- [ ] **JWT expiry:** 3600s (1h)
- [ ] **Refresh token rotation:** ON
- [ ] **Refresh token reuse interval:** 10s
- [ ] **Inactivity timeout:** 7 days (hard cap)

### Authentication → Rate Limits

- [ ] **Password sign-in:** 10/h per IP (default é 30)
- [ ] **Password reset:** 4/h per IP
- [ ] **Email sign-up:** 4/h per IP

### Database → Extensions

- [ ] **pgcrypto:** Enabled
- [ ] **pg_cron:** Enabled
- [ ] **pgsodium:** Enabled (para cifrar api_key Asaas)
- [ ] **pgtap:** Enabled (para testes CI)

### Edge Functions → Secrets

- [ ] `SUPER_ADMIN_KEY` = `openssl rand -hex 32`
- [ ] `ALLOWED_ORIGINS` = `https://pilarsoft.com.br,https://app.pilarsoft.com.br`
- [ ] `TURNSTILE_SECRET_KEY` = (copiar de Cloudflare após criar widget)
- [ ] `ASAAS_WEBHOOK_TOKEN` = fallback global (opcional; por empresa já tem)

### Database → Backups

- [ ] Confirmar **daily backup ON** (Pro plan)
- [ ] Configurar **retention 7 dias** PITR
- [ ] Script mensal de dump para S3/Backblaze (ver `docs/DISASTER_RECOVERY.md`)

---

## 🟠 Vercel Dashboard

### Project Settings → Environment Variables (Production)

- [ ] `VITE_SUPABASE_URL` = URL do projeto prod
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` = anon key
- [ ] `VITE_SENTRY_DSN` = DSN do projeto Sentry
- [ ] `VITE_SENTRY_ENV` = `production`
- [ ] `VITE_SENTRY_TRACES_SAMPLE_RATE` = `0.1`
- [ ] `VITE_TURNSTILE_SITE_KEY` = site key Cloudflare

### Project Settings → Security

- [ ] **Deployment Protection:** preview authenticated
- [ ] **Vercel Firewall / Attack Challenge Mode:** enable para login endpoints
- [ ] **Log Drains:** configurar → Axiom/Datadog

---

## 🟡 Cloudflare (Turnstile + WAF opcional)

### Turnstile

- [ ] Criar site para `pilarsoft.com.br`
- [ ] **Mode:** Managed
- [ ] Copiar site key → `VITE_TURNSTILE_SITE_KEY`
- [ ] Copiar secret key → `TURNSTILE_SECRET_KEY` no Supabase

### WAF (se usar Cloudflare Pro)

- [ ] Rate limit `/login` e `/cliente/login`: 10 req/min por IP
- [ ] Bot Fight Mode: ON
- [ ] Security Level: Medium
- [ ] Challenge passage: 30 min

---

## 🟢 Sentry

- [ ] Criar projeto **React** em sentry.io
- [ ] Copiar DSN → Vercel env var
- [ ] **Alerts → New Alert:**
  - [ ] Critical errors → Slack #security
  - [ ] P95 latency > 5s → Slack #engineering
- [ ] **Integrations → Slack:** conectar workspace
- [ ] **Data Scrubbing:** confirmar rules padrão + custom (nosso código já scrubs)

---

## 🟢 Monitoring externo

### Better Uptime (ou alternativa)

- [ ] Heartbeat check em `https://app.pilarsoft.com.br`
- [ ] Heartbeat em `https://app.pilarsoft.com.br/api/health` (criar endpoint)
- [ ] Alert → Slack / SMS
- [ ] Status page pública: `status.pilarsoft.com.br`

### Status page

- [ ] Better Uptime Status Page ou statuspage.io
- [ ] Componentes: App, API (Supabase), Edge Functions, Portal Cliente
- [ ] Automatic incidents on downtime

---

## 🔵 GitHub

### Repository Settings → Secrets

- [ ] `VITE_SUPABASE_URL` (para E2E em CI)
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` (projeto **staging**, não prod)
- [ ] `SUPABASE_ACCESS_TOKEN` (para `supabase db push` via CI, se usar)

### Settings → Branch Protection (main)

- [ ] Require PR review (1 approver)
- [ ] Require status checks: `lint-test-build`, `audit`, `secrets-scan`, `pgtap`, `e2e`
- [ ] Require signed commits (recomendado)
- [ ] Require linear history

### Settings → Code security

- [ ] Dependabot alerts ON
- [ ] Dependabot security updates ON
- [ ] Secret scanning ON
- [ ] Push protection ON

---

## 🟣 Asaas (quando ativar integração)

- [ ] Criar conta sandbox → api_key
- [ ] Cadastrar webhook: `https://<supabase>.functions.supabase.co/asaas-webhook`
- [ ] Copiar webhook_token → admin UI
- [ ] Testar fluxo end-to-end em staging antes de prod

---

## 🕐 Edge Functions — Agendamentos (Cron)

### trial-expiry-cron

A edge function `trial-expiry-cron` expira trials vencidos e envia emails de aviso (7d, 3d, 1d).
A migration `20260514300002_setup_trial_expiry_cron.sql` tenta criar o job via `pg_cron` automaticamente.
Se `pg_cron` não estiver disponível, configure manualmente:

**Opção A — Supabase Dashboard (recomendado)**

1. Acessar **Supabase Dashboard → Edge Functions → trial-expiry-cron**
2. Aba **Schedule**
3. Cron expression: `0 7 * * *` (07:00 UTC = 04:00 BRT)
4. Method: `POST`
5. Body: `{}`
6. Headers: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`

**Opção B — pg_cron manual via SQL Editor**

```sql
-- Configurar variáveis de runtime (uma única vez, usuário postgres)
ALTER DATABASE postgres SET app.supabase_url = 'https://<project-ref>.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = '<service_role_key>';

-- Criar job
SELECT cron.schedule(
  'trial-expiry-daily',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url        := current_setting('app.supabase_url') || '/functions/v1/trial-expiry-cron',
    headers    := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body       := '{}'::jsonb
  );
  $$
);
```

**Variáveis de ambiente obrigatórias na Edge Function**

- [ ] `RESEND_API_KEY` — chave da Resend para envio de emails
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — gerado automaticamente pelo Supabase (já disponível em Edge Functions)
- [ ] `SUPABASE_URL` — gerado automaticamente pelo Supabase (já disponível em Edge Functions)
- [ ] `ALLOWED_ORIGINS` — ex: `https://app.pilarsoft.com.br` (para montar billingUrl no email)

**Validação**

- [ ] Invocar manualmente via Dashboard: body `{}`, header `Authorization: Bearer <service_role_key>`
- [ ] Checar resposta `{ "processed": N, "expired": N, "warned": N }`
- [ ] Verificar `admin_audit_logs` para entradas de `trial_expired` / `trial_warning_sent_d*`

---

## 🧪 Validação final

Após tudo acima, rodar:

```bash
supabase db push
supabase functions deploy create-company-owner invite-user invite-cliente-portal reset-cliente-portal-password asaas-webhook turnstile-verify upload-portal-entrega
npm run gen:types
git add -A && git commit -m "feat(security): hardening 10/10"
git push
```

Smoke test:

- [ ] Login com senha fraca → bloqueado
- [ ] Login 11x com senha errada → bloqueado (rate limit)
- [ ] Admin sem MFA → redirect pra `/profile` com toast
- [ ] MFA enroll → backup codes gerados
- [ ] Signup sem convite → bloqueado
- [ ] Upload arquivo .exe renomeado pra .pdf → magic bytes detecta e bloqueia
- [ ] `SELECT audit_log_verify_chain()` → 0 tampered
- [ ] Sentry recebe evento de teste (`throw` em componente dev)
- [ ] CSP não quebra nenhuma feature em staging
- [ ] Idle 30 min admin → sessão expira
- [ ] Reset de senha → revoga todas sessões
