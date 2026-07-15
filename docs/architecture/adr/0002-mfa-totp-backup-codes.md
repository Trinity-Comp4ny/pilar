# ADR 0002: MFA com TOTP + backup codes

**Data:** 2026-04-24
**Status:** Accepted

## Contexto

Admin tem acesso a dados financeiros e clientes de todas empresas da plataforma. Senha sozinha não basta.

## Decisão

- **MFA obrigatório** para role = admin (aplicado via RLS em asaas_config e RPCs sensíveis)
- **TOTP** via Supabase Auth (compatível com Google Authenticator, Authy, 1Password)
- **Backup codes:** 10 códigos one-time em bcrypt, gerados após enroll
- **Fluxo de recuperação:** perdeu celular → usa backup code → gera novos códigos + reenroll

## Alternativas consideradas

1. **SMS OTP:** vulnerável a SIM swap. Rejeitado.
2. **Email OTP:** se email comprometido, MFA quebra. Complementar, não primário.
3. **WebAuthn/Passkey:** UX melhor mas requer hardware key ou biometria. Adicionar no Q3/2026 como opção.
4. **Magic link:** não é MFA verdadeiro (só 1 fator).

## Consequências

### Positivas

- Supabase Auth já tem TOTP nativo (sem implementar do zero)
- Backup codes previnem lockout permanente
- Rate limit 5 tentativas/15min em `mfa_consume_backup_code` previne brute force

### Negativas

- UX extra passo no login
- User precisa salvar backup codes em gerenciador de senha
- Suporte: users que perdem tudo (celular + backup codes) → admin reset manual

## Mitigações

- UI guia passo-a-passo (MfaHelpModal)
- Toast de warning em "Trocar autenticador" — desvincula dispositivos antigos
- RPC admin pra reset MFA em caso de lockout permanente (com audit log)
