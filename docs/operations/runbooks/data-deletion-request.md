# Runbook: Pedido de exclusão de dados (LGPD Art. 18 IV)

## Severidade

**LGPD** — não é incidente, é processo regulatório. Prazo legal: **15 dias**
para resposta inicial, conclusão "em prazo razoável".

## Sintomas

- Linha nova em `data_deletion_requests` com `status = 'pending'`.
- Edge function `send-data-deletion-notification` disparou email pro DPO
  (`LGPD_DPO_EMAIL`).
- Usuário pediu pelo portal (`/conta/excluir`) ou via email/WhatsApp.

## Diagnóstico (passo-a-passo)

1. **Ler o pedido:**
   ```sql
   SELECT id, user_id, empresa_id, motivo, requested_at, notes
   FROM data_deletion_requests
   WHERE status = 'pending'
   ORDER BY requested_at;
   ```
2. **Identificar o usuário:**
   ```sql
   SELECT u.email, p.first_name, p.last_name, p.empresa_id, p.role
   FROM auth.users u
   JOIN profiles p ON p.id = u.id
   WHERE u.id = '<user_id>';
   ```
3. **Avaliar se há motivo legal para REJEITAR:**
   - Obrigação fiscal (lançamentos financeiros do ano corrente — guardar 5 anos).
   - Processo judicial em curso.
   - Usuário é o **único admin** de uma empresa ativa com outros usuários.
   - Se rejeitar: `status='rejected'`, `notes='motivo legal: ...'`,
     responder ao titular com a justificativa.

## Mitigação imediata

N/A — não é incidente. Marcar `status='in_progress'`:

```sql
UPDATE data_deletion_requests
SET status = 'in_progress', processed_by = auth.uid(),
    notes = 'Iniciado processamento'
WHERE id = '<request_id>';
```

## Solução definitiva (processo de exclusão)

> ⚠️ **Tudo abaixo via `service_role` no SQL editor**, nunca via cliente.
> Sempre dentro de **uma única transação** se possível.

### 1. Anonimizar dados que NÃO podem ser apagados

Lançamentos financeiros, notas fiscais e auditoria devem ser preservados
por obrigação fiscal/contábil — apenas anonimizamos PII:

```sql
BEGIN;
-- Profiles: nullificar PII, preservar id (FK)
UPDATE profiles
SET first_name = 'Usuário',
    last_name = 'Excluído (LGPD)',
    avatar_url = NULL,
    phone = NULL,
    cpf = NULL
WHERE id = '<user_id>';

-- Audit logs: manter o registro (LGPD permite log de operações),
-- só remover dados pessoais do payload se houver
UPDATE audit_logs
SET payload = jsonb_set(payload, '{user_email}', '"redacted@lgpd"')
WHERE actor_id = '<user_id>';
COMMIT;
```

### 2. Apagar dados que PODEM ser apagados

```sql
BEGIN;
DELETE FROM notification_logs WHERE user_id = '<user_id>';
DELETE FROM cliente_portal_accounts WHERE user_id = '<user_id>';
DELETE FROM lgpd_consents_audit WHERE user_id = '<user_id>'
  AND created_at < now() - interval '6 months';
-- adicione outras tabelas com PII conforme catálogo
COMMIT;
```

### 3. Apagar conta auth (último passo)

```bash
# Via SQL não dá, precisa Admin API
curl -X DELETE \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/auth/v1/admin/users/<user_id>"
```

Ou via dashboard → Authentication → Users → ... → Delete user.

### 4. Marcar pedido como concluído

```sql
UPDATE data_deletion_requests
SET status = 'completed',
    processed_at = now(),
    processed_by = auth.uid(),
    notes = COALESCE(notes,'') || E'\nConcluído em ' || now()::text
WHERE id = '<request_id>';
```

### 5. Confirmação ao titular

Enviar email manual (template em [Comunicação](#comunicação)).

## Comunicação

- **Recebimento (em até 48h):** confirmar recebimento ao titular.
- **Conclusão:** email com confirmação e link para a Política de Privacidade.

Template (PT-BR):

```
Assunto: [Pilar] Confirmação de exclusão de dados

Olá <nome>,

Confirmamos a exclusão dos seus dados pessoais do Pilar em conformidade
com a LGPD (Art. 18, IV), conforme solicitado em DD/MM/AAAA.

Informamos que mantivemos, de forma anonimizada, os seguintes registros
por obrigação legal:
- Lançamentos financeiros (Lei 10.406/02 — 5 anos)
- Logs de auditoria (LGPD Art. 37 — 6 meses)

Sua conta foi removida. Caso queira voltar a usar o serviço, será
necessário criar uma nova conta.

Atenciosamente,
DPO — Labrynth AI
dpo@labrynth.ai
```

## Pós-mortem

N/A — registrar no `data_deletion_requests.notes`. Auditoria periódica
trimestral pra checar SLA de 15 dias.
