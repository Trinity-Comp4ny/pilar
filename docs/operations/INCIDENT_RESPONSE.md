# Incident Response Plan

Processo de resposta a incidentes de segurança.

## Severidades

| Nível            | Critério                                             | Tempo de resposta |
| ---------------- | ---------------------------------------------------- | ----------------- |
| **P0 — Crítico** | Vazamento de dados, RCE, acesso não-autorizado amplo | < 15 min          |
| **P1 — Alto**    | XSS/SQLi explorável, MFA bypass                      | < 1h              |
| **P2 — Médio**   | Rate limit bypass, info leak limitada                | < 4h              |
| **P3 — Baixo**   | Misconfig sem impacto imediato                       | < 24h             |

## Papéis

- **Plantão:** Matheus Rezende, único por ora. Empresa pré-lançamento, sem
  outros pagantes confirmados ainda — formalizar uma escala com mais gente
  seria over-engineering neste estágio (decisão registrada 17/08, revisar
  quando houver 1º cliente pagante ou mais alguém no time técnico).
- **Incident Commander (IC):** o plantão assume, sempre. Sem "primeiro a
  detectar" — só tem uma pessoa.
- **Tech Lead:** o plantão (mesma pessoa por ora).
- **Comms:** o plantão avisa clientes/Legal quando P0/P1.

Contatos: security@labrynth.ai · Slack #security

## Fluxo

### 1. Detecção (minuto 0)

- Alerta Sentry/Slack dispara.
- Sinal vindo de: `critical_alerts` tabela, Sentry, email cliente, oncall.
- IC assume. **Não mexer em produção ainda.**

### 2. Contenção (minuto 0-15)

- Se P0: desabilitar feature afetada via flag ou rollback.
- Rotacionar secrets potencialmente expostos (Supabase SERVICE_ROLE_KEY, api_keys).
- Revogar sessões comprometidas: `DELETE FROM auth.sessions WHERE user_id IN (...)`.
- Se atacante ativo: bloquear IPs via Cloudflare WAF.

### 3. Diagnóstico (minuto 15-60)

- `audit_logs` + `critical_alerts` + Sentry → timeline.
- `SELECT audit_log_verify_chain()` pra checar tampering.
- Identificar: ponto de entrada, escopo de impacto, dados afetados.

### 4. Erradicação

- Fix de código + deploy hotfix.
- Forçar reset de senha dos afetados: `supabase.auth.admin.updateUserById(id, { password: random })`.
- Invalidar tokens portal afetados: `UPDATE cliente_portal_accounts SET token_sessao = NULL WHERE ...`.

### 5. Recuperação

- Restaurar de backup se data loss (Supabase PITR — ver `./DISASTER_RECOVERY.md`).
- Validar integridade: `audit_log_verify_chain()`, diff com último backup bom.

### 6. Comunicação

- **LGPD Art. 48:** se vazamento de dados pessoais, ANPD em 3 dias úteis.
- Clientes afetados: email + notificação in-app.
- Template: "Detectamos [descrição neutra]. Impacto: [X registros]. Ações: [1, 2, 3]. Prazo: [data]."
- **NÃO publicizar detalhes exploráveis antes do fix em produção.**

### 7. Post-mortem (D+7)

- Timeline completa
- Causa raiz (5 whys)
- O que pegou, o que não pegou
- Action items com owner e prazo
- Publicar internamente

## Runbooks específicos

### Vazamento de SERVICE_ROLE_KEY

1. Supabase Dashboard → Project Settings → API → rotate service_role
2. Atualizar Vercel env var
3. Deploy edge functions com nova key
4. Revisar audit_logs últimas 48h pra ver uso

### Admin comprometido

1. `DELETE FROM auth.sessions WHERE user_id = '<uuid>'`
2. Forçar reset de senha
3. Revogar MFA factors: `DELETE FROM auth.mfa_factors WHERE user_id = '<uuid>'`
4. Audit log dos últimos 7 dias desse actor
5. Se ações destrutivas: restaurar do backup

### Bucket portal-entregas leak

1. Marcar entregas afetadas: `UPDATE portal_entregas SET arquivo_path = NULL WHERE ...`
2. Soft-delete arquivo no Storage
3. Emitir novos links de download
4. Avisar clientes afetados

## Preventivo contínuo

- Revisar `critical_alerts` diariamente (UI em `/admin/auditoria`)
- Rodar `audit_log_verify_chain()` semanalmente
- npm audit mensal
- Pentest anual externo (ver `../security/COMPLIANCE.md`)
