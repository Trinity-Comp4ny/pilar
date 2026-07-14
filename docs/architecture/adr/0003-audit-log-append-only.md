# ADR 0003: Audit log append-only com hash chaining

**Data:** 2026-04-24
**Status:** Accepted

## Contexto

Dados financeiros exigem trilha de auditoria imutável. Se atacante (ou insider) conseguir DELETE em audit_logs, oculta evidência.

## Decisão

- **Triggers bloqueiam UPDATE/DELETE** em `audit_logs` (exceto super-user para housekeeping)
- **Hash chaining:** cada linha carrega `row_hash = sha256(dados || prev_hash)` — tampering em linha antiga quebra cadeia
- **RPC `audit_log_verify_chain()`** valida integridade em demanda
- **Retention 5 anos** (LGPD fiscal) via `audit_log_cleanup()` semanal via pg_cron

## Alternativas consideradas

1. **Blockchain:** overkill, custoso, latência.
2. **Export contínuo para SIEM externo:** complementar (Q3/2026) mas não substitui hash chain DB-side.
3. **Sem proteção:** DBA/atacante com service_role apaga livre. Rejeitado.

## Consequências

### Positivas

- Custo computacional baixo (sha256 é rápido)
- Detecção determinística de tampering via `audit_log_verify_chain()`
- LGPD/SOC2 friendly (evidência de integridade)

### Negativas

- DELETE bloqueado mesmo para correções legítimas → housekeeping requer `postgres`/`supabase_admin` role
- Reordenação ou UPDATE em audit_logs = impossível sem quebrar cadeia (feature, não bug)

## Mitigações

- Mascaramento de campos sensíveis no diff (senha_hash, api_key, tokens) antes de inserir
- Integridade verificada via RPC que qualquer admin pode rodar
- pg_cron cleanup mantém linhas > 5 anos removidas sem quebrar chain (cleanup roda como postgres)
