# Runbook: Usuário/Admin bloqueado

## Severidade

**P2** (admin de empresa bloqueado) — **P1** se for o único admin de um
tenant pagante e a empresa não consegue operar.

## Sintomas

- Usuário não consegue logar: senha esquecida, email trocado, perdeu MFA,
  conta marcada `banned_until`, ou trocou de celular e perdeu o autenticador.
- Suporte recebe pedido por email/WhatsApp.

## Diagnóstico (passo-a-passo)

1. **Validar identidade do solicitante** — não dá bypass por email não-verificado.
   Aceitos:
   - Email corporativo do domínio da empresa cliente, batendo com o cadastrado.
   - Vídeo-chamada com documento.
   - Owner/CEO da empresa autorizar por escrito.
2. **Localizar usuário:**
   ```sql
   SELECT u.id, u.email, u.banned_until, u.last_sign_in_at,
          u.confirmed_at, p.empresa_id, p.role,
          (u.raw_app_meta_data->>'mfa_enabled')::bool AS mfa
   FROM auth.users u
   LEFT JOIN profiles p ON p.id = u.id
   WHERE u.email ILIKE '<email>';
   ```
3. **Diagnóstico por categoria:**
   - `banned_until > now()` → conta banida (rate limit / brute force).
   - `mfa = true` e usuário diz que perdeu app → bypass de MFA.
   - Usuário trocou de email → atualizar `auth.users.email`.

## Mitigação imediata

### Caso A — senha esquecida (caminho normal)

1. Pedir para usar "Esqueci minha senha" no `/login`.
2. Se email não chega: ver runbook `edge-function-failing` na função
   de auth/email hook ou Resend.

### Caso B — banido (`banned_until`)

```sql
UPDATE auth.users
SET banned_until = NULL
WHERE email = '<email>';
-- justificativa em audit log
INSERT INTO audit_logs(action, actor_id, target_type, target_id, payload)
VALUES('admin_unban', auth.uid(), 'auth.users', '<user_id>',
       jsonb_build_object('reason','validated identity, see ticket #<n>'));
```

### Caso C — MFA perdido (bypass controlado)

> **Justificativa obrigatória.** Sem ticket de suporte com prova de
> identidade, **não execute**.

```bash
# Listar fatores MFA
curl -sS -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/auth/v1/admin/users/<user_id>/factors" | jq

# Remover cada factor
curl -X DELETE \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/auth/v1/admin/users/<user_id>/factors/<factor_id>"
```

Registrar:

```sql
INSERT INTO audit_logs(action, actor_id, target_type, target_id, payload)
VALUES('mfa_bypass', auth.uid(), 'auth.users', '<user_id>',
       jsonb_build_object(
         'reason','user lost device',
         'ticket','#<n>',
         'verified_via','video_call',
         'verified_by','<seu_nome>'
       ));
```

Pedir ao usuário para **reativar MFA imediatamente** após o login.

### Caso D — email trocado / perdeu acesso ao email

```sql
-- via Admin API é o caminho correto
```

```bash
curl -X PUT \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"novo@empresa.com","email_confirm":true}' \
  "$SUPABASE_URL/auth/v1/admin/users/<user_id>"
```

### Caso E — único admin perdeu acesso

1. Recuperar acesso (cases A-D).
2. **Imediatamente** orientar a criar segundo admin: requisito de
   continuidade. Documentar no contrato/onboarding.

## Solução definitiva

- Forçar MFA em **todos os admins** (já é política — ver `auth.config`).
- Recovery codes obrigatórios no enrollment de MFA (configurar no Supabase
  se ainda não estiver).
- Rotina mensal: alertar empresas com 1 admin único.

## Comunicação

- Resposta ao usuário em < 4h em horário comercial.
- Template:
  ```
  Olá, sua conta foi reativada / MFA resetado / email atualizado.
  Faça login em https://app.pilar... e configure novamente seu MFA.
  Por segurança, troque sua senha.
  Tudo foi registrado em audit log conforme LGPD.
  ```

## Pós-mortem

- Apenas se foi engenharia social bem-sucedida → P1, post-mortem.
- Caso normal: arquivar ticket.
