# Segurança — Pilar

Documento resumo das medidas de segurança implementadas e dos processos operacionais.

## Reporte de vulnerabilidades

Para reportar vulnerabilidades, envie email para **security@labrynth.ai** com:

- Descrição da vulnerabilidade
- Passos para reproduzir
- Impacto potencial
- (Opcional) sugestão de fix

**Não** abra issue pública. Retornamos em até **72h úteis**.

Não oferecemos bounty monetário no momento, mas reconhecemos publicamente com anuência do reporter.

## Escopo

- Aplicação web: https://app.pilarsoft.com.br
- Portal cliente: https://app.pilarsoft.com.br/cliente
- Edge functions: `*.functions.supabase.co`

**Fora de escopo:** engenharia social, DoS volumétrico, scanners automatizados sem validação manual.

## Stack de segurança implementado

| Camada           | Controle                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| **Transport**    | TLS 1.3, HSTS 2 anos preload                                                                             |
| **Headers**      | CSP strict, X-Frame-Options DENY, COOP same-origin, Permissions-Policy                                   |
| **Auth**         | Supabase Auth + MFA (TOTP) obrigatório + backup codes + rate limit por email e IP                        |
| **Sessão**       | JWT 1h (admin), refresh rotation, idle timeout 15/30/60min por role, revogação global em password change |
| **Multi-tenant** | RLS por `empresa_id` em todas tabelas, RPCs SECURITY DEFINER com `empresa_id` check                      |
| **Signup**       | Bloqueado sem convite server-side (tabela `convites` + trigger)                                          |
| **Secrets**      | pgsodium (opt-in) para api_key Asaas, `.env` em Vercel Env vars, rotação manual                          |
| **Rate limit**   | 10/15min login por email, 30/15min por IP, 20/h convites, 3/h reset senha                                |
| **Storage**      | Bucket privado, file size limit 50MB, mime allowlist, magic bytes validation server-side                 |
| **Audit**        | `audit_logs` append-only com hash chaining, retention 5 anos, mascaramento de campos sensíveis           |
| **Monitoring**   | Sentry com PII scrubber, alerts Slack em eventos críticos                                                |
| **CI**           | Lint, typecheck, vitest, npm audit, gitleaks, pgTAP RLS, Playwright E2E                                  |

## Ações de segurança do usuário

- **Ativar MFA:** obrigatório para admin. Perfil → Segurança → Configurar MFA.
- **Backup codes:** gerar 10 códigos ao ativar MFA, salvar em gerenciador de senhas.
- **Senha forte:** mínimo 12 chars, maiúscula, minúscula, número, símbolo.
- **Não compartilhe conta:** crie convite pra cada membro.
- **Logout em dispositivos públicos.**

## Incidente detectado?

Ver `../operations/INCIDENT_RESPONSE.md`.
