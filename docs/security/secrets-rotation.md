# Rotação de Secrets — Pilar

Política e procedimento para rotacionar credenciais. **Padrão: 90 dias.**
Rotação imediata em caso de suspeita de exposição.

## Inventário de secrets

| Secret                             | Onde vive                                                           | Frequência                  | Quem rotaciona   | Notas                                       |
| ---------------------------------- | ------------------------------------------------------------------- | --------------------------- | ---------------- | ------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`        | Supabase Project Settings → API; Vercel env; Edge Functions secrets | **90d**                     | Tech Lead        | Ao rotacionar, redeploy de tudo             |
| `SUPABASE_ANON_KEY`                | Mesmo lugar                                                         | **180d** ou nunca (público) | Tech Lead        | Pode ficar mais tempo                       |
| `SUPABASE_URL`                     | —                                                                   | nunca                       | —                | Não é secret, mas listado por completude    |
| `SUPER_ADMIN_KEY`                  | Edge Functions secrets (`ultra-admin-*`)                            | **90d**                     | CTO/Founder      | Restringe quem invoca admin functions       |
| `ASAAS_PLATFORM_API_KEY`           | Edge Functions secrets                                              | **90d**                     | Owner financeiro | Painel Asaas → Integrações → Gerar nova key |
| `ASAAS_PLATFORM_WEBHOOK_TOKEN`     | Edge Functions secrets + painel Asaas (webhook)                     | **90d**                     | Owner financeiro | Atualizar nos dois lados juntos             |
| `ASAAS_WEBHOOK_TOKEN`              | Edge Functions secrets                                              | **90d**                     | Owner financeiro | Token alternativo                           |
| `ASAAS_PLATFORM_ENV`               | Edge Functions secrets                                              | nunca                       | —                | `sandbox` ou `production`                   |
| `RESEND_API_KEY`                   | Edge Functions secrets                                              | **90d**                     | Tech Lead        | Painel Resend → API Keys                    |
| `RESEND_FROM`                      | Edge Functions secrets                                              | nunca                       | —                | Email remetente                             |
| `GEMINI_API_KEY`                   | Edge Functions secrets                                              | **90d**                     | Tech Lead        | Painel Google AI Studio                     |
| `TURNSTILE_SECRET_KEY`             | Edge Functions secrets                                              | **180d**                    | Tech Lead        | Cloudflare → Turnstile                      |
| `SENTRY_DSN`                       | Edge + frontend env                                                 | **180d**                    | Tech Lead        | Sentry → Project Settings → Client Keys     |
| `AUTH_HOOK_SEND_EMAIL_SECRET`      | Supabase Auth Hooks + Edge function                                 | **90d**                     | Tech Lead        | Validar request entre Auth e edge           |
| `DATA_DELETION_NOTIFY_SECRET`      | Edge Functions secrets + DB trigger config                          | **90d**                     | DPO/Tech Lead    | Notificação LGPD                            |
| `LGPD_DPO_EMAIL`                   | Edge Functions secrets                                              | quando muda DPO             | Compliance       | Não é secret, mas centralizado              |
| `ALLOWED_ORIGINS`                  | Edge Functions secrets                                              | quando domínios mudam       | Tech Lead        | CORS allowlist                              |
| `APP_URL` / `PUBLIC_SITE_URL`      | Edge + Vercel                                                       | quando muda                 | Tech Lead        | URL canônica                                |
| Vercel deploy token                | Vercel account                                                      | **180d**                    | Tech Lead        | Settings → Tokens                           |
| GitHub Actions secrets (se houver) | Repo Settings → Secrets                                             | **180d**                    | Tech Lead        | —                                           |
| DB password (Postgres)             | Supabase managed                                                    | gerada pelo Supabase        | —                | Resetar via dashboard se vazar              |

## Calendário sugerido

- **Q1 (jan):** Asaas + Resend + Gemini + Auth hook
- **Q2 (abr):** Service role + Super admin + Data deletion secret
- **Q3 (jul):** Asaas + Resend + Gemini + Auth hook
- **Q4 (out):** Service role + Super admin + Data deletion secret + Sentry/Turnstile

(Defasar metades pra não rotacionar tudo no mesmo dia.)

## Procedimento padrão (90d planned rotation)

1. **T-7 dias:** abrir issue `chore(security): rotate <secret> — YYYY-MM`.
2. **No dia:** gerar nova credencial no provedor.
3. **Atualizar destinos** (todos antes de invalidar a antiga, se possível):
   - Supabase Edge Functions:
     ```bash
     supabase secrets set NOME=novo_valor
     ```
   - Vercel:
     ```bash
     vercel env rm NOME production
     vercel env add NOME production    # cole o novo
     vercel --prod                      # redeploy
     ```
4. **Smoke test** — exercitar funcionalidade que usa o secret (ex.: criar
   cobrança Asaas, enviar email Resend, chamar IA).
5. **Revogar credencial antiga** no provedor.
6. **Registrar no audit log:**
   ```sql
   INSERT INTO audit_logs(action, actor_id, target_type, payload)
   VALUES('secret_rotation', auth.uid(), 'secret',
          jsonb_build_object('secret','NOME','rotated_at',now()));
   ```
7. **Fechar issue** com link para o smoke test.

## Procedimento de emergência (suspeita de vazamento)

1. **Revogar antiga IMEDIATAMENTE** (não esperar substituta).
2. Aceitar downtime curto da feature afetada.
3. Gerar nova, propagar (passos 3-4 acima).
4. Auditar uso da chave nas últimas **48h**:
   - `audit_logs WHERE created_at > now() - '48 hours'`
   - Logs de Edge Function
   - Painel do provedor (Asaas → API logs, Resend → Logs)
5. Se houve uso suspeito → escalar para `INCIDENT_RESPONSE.md` como **P0**.

## Princípios

- **Nunca** comitar secret em git. Pre-commit hook `gitleaks` recomendado.
- **Nunca** logar secret (incluindo em Sentry breadcrumb).
- `service_role` **nunca** entra em código frontend.
- Rotação é registrada — sem registro, não houve rotação.

## Validação de aderência

Auditoria trimestral: tabela acima vs `secrets_rotated_at` (criar coluna
no log se quiser automatizar). Resultado em `docs/security/audit-YYYY-Q?.md`.
