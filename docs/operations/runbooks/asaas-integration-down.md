# Runbook: Integração Asaas com falha

## Severidade

**P1** — pagamentos travados é dinheiro parado e churn.

> Funções envolvidas: `asaas-config`, `asaas-criar-cobranca`, `asaas-webhook`,
> `pilar-checkout-create`, `pilar-checkout-status`, `pilar-checkout-webhook`.

## Sintomas

- Cobranças criadas no Pilar não aparecem no Asaas (ou vice-versa).
- Status de fatura/lançamento travado em `pendente` mesmo após pagamento.
- Webhook não chega — `asaas_webhook_events` (se existir) sem novos registros há horas.
- Sentry: erros em `asaas-*` com 401/403 (token), 429 (rate limit) ou timeout.
- Cliente liga: "paguei e o sistema não atualizou".

## Diagnóstico (passo-a-passo)

1. **Status Asaas:** <https://status.asaas.com/> — confirmar provedor up.
2. **Confirmar token:**
   ```bash
   curl -sS -H "access_token: $ASAAS_PLATFORM_API_KEY" \
     https://api.asaas.com/v3/myAccount | jq .
   ```

   - 200 → token ok.
   - 401 → token revogado / errado / ambiente trocado (sandbox vs prod —
     ver `ASAAS_PLATFORM_ENV`).
3. **Verificar webhook config no painel Asaas:**
   - URL apontando pra `https://<projeto>.supabase.co/functions/v1/asaas-webhook`?
   - Token de validação bate com `ASAAS_PLATFORM_WEBHOOK_TOKEN` /
     `ASAAS_WEBHOOK_TOKEN`?
   - IP whitelist desligado (Asaas chama de IPs variáveis).
4. **Logs da edge `asaas-webhook`:** Supabase → Edge Functions → Logs.
   Filtrar últimas 6h. Procurar:
   - `Invalid webhook token` → token desincronizado.
   - `404 not found` → URL errada.
   - `5xx` na nossa resposta → bug nosso, Asaas vai re-tentar.
5. **Tabela de eventos:**
   ```sql
   SELECT event_type, count(*), max(created_at)
   FROM asaas_webhook_events  -- ou nome equivalente
   WHERE created_at > now() - interval '24 hours'
   GROUP BY 1 ORDER BY 2 DESC;
   ```
6. **Rate limit:** Asaas tem limites por minuto. Se rajada de 429, espaçar.

## Mitigação imediata

- **Token errado:** rotacionar via painel Asaas → atualizar secret:
  ```bash
  supabase secrets set ASAAS_PLATFORM_API_KEY=novo_token
  ```
  Validar com curl acima.
- **Webhook não chega:** no painel Asaas → Webhooks → "Reenviar" os eventos
  pendentes (Asaas guarda fila por X dias).
- **Nosso webhook está 500:** corrigir bug, deploy, e usar reenvio acima
  para reprocessar.
- **Cobranças órfãs:** rodar reconciliação manual:
  ```sql
  -- Listar lançamentos pendentes que têm asaas_charge_id
  SELECT id, asaas_charge_id, valor, status
  FROM lancamentos
  WHERE asaas_charge_id IS NOT NULL AND status = 'pendente'
    AND created_at < now() - interval '1 day';
  ```
  Para cada um, chamar API Asaas `GET /payments/{id}` e atualizar status.
- **Comunicar clientes que pagaram:** "recebemos, está sendo conciliado,
  conta crédita até HH:MM".

## Solução definitiva

- Job de reconciliação diário (cron edge function) cruzando lançamentos
  do Pilar com `GET /payments` do Asaas (filtrado por data).
- Adicionar idempotência no webhook usando `event.id` do Asaas como
  `UNIQUE` em `asaas_webhook_events`.
- Adicionar alerta Sentry quando intervalo entre webhooks > 1h.

## Comunicação

- **Interno:** Slack `#financeiro` + dev oncall.
- **Cliente afetado** (pagou e não foi creditado):
  ```
  Olá, identificamos atraso na conciliação do seu pagamento (R$ X,XX,
  ID Asaas <id>). Já foi conferido manualmente e creditado em HH:MM.
  Não precisa pagar de novo. Obrigado pela paciência.
  ```
- **Cliente cobrado em duplicidade:** estornar via painel Asaas no mesmo dia.

## Pós-mortem

- Obrigatório se houve cobrança duplicada, perda de pagamento ou >2h de outage.
- Anexar lista de transações afetadas (`SELECT * FROM lancamentos WHERE ...`).
