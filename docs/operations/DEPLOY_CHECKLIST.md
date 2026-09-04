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
- [x] `TURNSTILE_SECRET_KEY` = (copiar de Cloudflare após criar widget) (17/08)
- [ ] `ASAAS_WEBHOOK_TOKEN` = fallback global (opcional; por empresa já tem)
- [ ] `RESEND_API_KEY` = chave do Resend (staging e prod têm chaves distintas)
- [ ] `RESEND_FROM` = `Pilar <no-reply@pilarsoft.com.br>` (formato "Nome <endereco>")
- [ ] `RESEND_REPLY_TO` = caixa real que recebe resposta dos e-mails de plataforma (só depois do MX, ver E-mail abaixo)
- [ ] `RESEND_WEBHOOK_SECRET` = o `whsec_...` que o Resend mostra ao criar o webhook (ver seção E-mail)
- [ ] `APP_URL` = `https://app.pilarsoft.com.br`; `PUBLIC_SITE_URL` = `https://www.pilarsoft.com.br` (assets e fontes do e-mail vêm daqui)
- [ ] NUNCA `EMAIL_DRY_RUN` em staging/prod (só no `.env` local: sem ele e sem chave, `sendEmail` lança de propósito)

### Database → Backups

- [ ] Confirmar **daily backup ON** (Pro plan)
- [ ] Configurar **retention 7 dias** PITR
- [ ] Script mensal de dump para S3/Backblaze (ver `./DISASTER_RECOVERY.md`)

---

## 🟠 Vercel Dashboard

### Project Settings → Environment Variables (Production)

- [ ] `VITE_SUPABASE_URL` = URL do projeto prod
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` = anon key
- [ ] `VITE_SENTRY_DSN` = DSN do projeto Sentry
- [ ] `VITE_SENTRY_ENV` = `production`
- [ ] `VITE_SENTRY_TRACES_SAMPLE_RATE` = `0.1`
- [ ] `SENTRY_AUTH_TOKEN` = auth token com escopo `project:releases` (build-time, sem prefixo VITE_ — não vai pro bundle)
- [ ] `SENTRY_ORG` = `trinity-company`
- [ ] `SENTRY_PROJECT` = slug do projeto React no Sentry
- [x] `VITE_TURNSTILE_SITE_KEY` = site key Cloudflare (17/08)

### Project Settings → Security

- [ ] **Deployment Protection:** preview authenticated
- [ ] **Vercel Firewall / Attack Challenge Mode:** enable para login endpoints
- [ ] **Log Drains:** configurar → Axiom/Datadog

---

## 🟡 Cloudflare (Turnstile + WAF opcional)

### Turnstile

- [x] Criar site para `pilarsoft.com.br` (17/08)
- [x] **Mode:** Managed
- [x] Copiar site key → `VITE_TURNSTILE_SITE_KEY`
- [x] Copiar secret key → `TURNSTILE_SECRET_KEY` no Supabase

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

### Environments → Secrets (deploy automatizado)

O deploy do backend é feito por `.github/workflows/deploy-supabase.yml` (CD).
Configurar os Environments `staging` e `production` conforme
[`STAGING_SETUP.md`](./STAGING_SETUP.md):

- [ ] Environment `staging`: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, `E2E_TEST_EMAIL/PASSWORD`
- [ ] Environment `production`: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` (prod), `SUPABASE_DB_PASSWORD` (prod) + **Required reviewers** ON

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

## 📧 E-mail (SPEC 095 / 096, ADR 0039)

Checklist por ambiente, na ordem. Tudo aqui é fora do repo; o código já espera cada item.

### Resend

- [ ] Domínio `pilarsoft.com.br` verificado no Resend (SPF/DKIM do subdomínio `send.` já existem)
- [ ] Webhook criado em **Resend → Webhooks** apontando para `https://<project-ref>.supabase.co/functions/v1/resend-webhook`,
      eventos `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`.
      Copiar o signing secret para `RESEND_WEBHOOK_SECRET` e redeployar a function.
- [ ] Testar: mandar um e-mail para `bounce@resend.dev` (endereço de teste do Resend) e conferir
      `email_envios.status = 'bounce'` e a linha em `email_supressoes`.

### DNS (deliverability; hoje o apex não tem MX nem DMARC, ver gate de lançamento de 28/08)

- [ ] SPF no apex: `v=spf1 include:amazonses.com ~all` (o `send.` do Resend já tem o dele)
- [ ] DMARC: `_dmarc.pilarsoft.com.br TXT "v=DMARC1; p=none; rua=mailto:dmarc@pilarsoft.com.br"`.
      Depois de 2 semanas de relatório limpo, subir para `p=quarantine`.
- [ ] MX: Cloudflare Email Routing (gratuito) encaminhando `contato@`, `privacidade@` e `dmarc@` para
      uma caixa real. Só então preencher `RESEND_REPLY_TO`: reply-to que não recebe é pior que nenhum.

### Banco (uma vez por ambiente, SQL Editor)

- [ ] `ALTER DATABASE postgres SET app.supabase_url = 'https://<project-ref>.supabase.co';`
- [ ] `ALTER DATABASE postgres SET app.service_role_key = '<service_role_key>';`
      (os crons de e-mail chamam a edge function com esses dois; sem eles, `notificacoes_email_disparar()`
      pula com NOTICE e nenhum e-mail de notificação sai)
- [ ] Conferir `SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'notificacoes-email-%';`
      → `*/5 * * * *` (imediato) e `0 11 * * 1` (semanal, segunda 08:00 BRT)
- [ ] Sentry → Crons: monitores `notificacoes-email-imediato` e `notificacoes-email-semanal` aparecem no
      primeiro check-in (ADR 0036)

### Verificação ponta a ponta em staging

- [ ] `npm run email:preview` local bate com o que chega: mandar um de cada (auth, cobrança, notificação)
      e abrir no Gmail web, Gmail Android, Apple Mail e Outlook. Geist só aparece nos Apple/Outlook Mac
      (esperado); a faixa de morros carrega de `www.pilarsoft.com.br/email/wave-v1.png`.
- [ ] Criar uma notificação `high` numa empresa de teste, esperar 5 minutos sem ler, receber o e-mail
      imediato, e conferir `notificacoes.email_enviado_em` preenchido e `email_envios.tipo = 'notificacao_imediata'`.
- [ ] Rodar o semanal na mão: `SELECT public.notificacoes_email_disparar('semanal');` e receber o resumo.
- [ ] Clicar em "Gerenciar notificações por e-mail" no rodapé → app abre o diálogo de preferências.
- [ ] Empresa sem e-mail cadastrado tentando enviar cobrança → 422 com a mensagem certa no toast.

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

O deploy do backend é **automático** (push → CI → `Deploy Supabase`). Não rode
`db push` / `functions deploy` à mão — deixe o CD fazer. Após o merge:

```bash
npm run gen:types   # regenerar tipos após migration (local)
git add -A && git commit -m "chore: regen types" && git push
```

> Se precisar de deploy manual de emergência (CD fora do ar), os `verify_jwt`
> já vivem em `config.toml`, então basta `supabase db push` + `supabase functions deploy`
> (sem `--no-verify-jwt`).

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
