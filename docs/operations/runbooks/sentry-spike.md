# Runbook: Aumento súbito de erros no Sentry

## Severidade

**P2** (default) — promover a P1 se taxa de erro > 5% das sessões ou se
afetar checkout/auth.

## Sintomas

- Alerta Sentry "Issues spike" / "Error rate exceeds threshold".
- Gráfico de eventos no dashboard com pico vertical.
- Slack `#alerts` cheio.

## Diagnóstico (passo-a-passo)

1. **Abrir Sentry → Issues → ordenar por "Events" (last 1h).**
   A issue do topo é o suspeito.
2. **Filtrar por `release`:** se o pico começou exatamente quando uma release
   subiu, é regressão. Se é uniforme entre várias releases, é dado/infra.
3. **Filtrar por `environment`:** se só `production`, é prod específico.
   Se `preview` também, é código.
4. **Ver "Tags" da issue:**
   - `browser`: só Safari? bug de compatibilidade.
   - `url`: rota específica? feature isolada.
   - `user.empresa_id`: 1 tenant só? dado corrompido daquele cliente.
5. **Stack trace:** identificar arquivo/linha. `git blame` no commit.
6. **`git log $LAST_GOOD_RELEASE..$CURRENT_RELEASE`:** lista de mudanças
   suspeitas.

## Decisão: rollback / hotfix / silence

| Critério                                                   | Ação                                     |
| ---------------------------------------------------------- | ---------------------------------------- |
| Erro afeta auth/financeiro/checkout, > 5% sessões          | **Rollback Vercel** imediato             |
| Erro afeta feature isolada, fix é simples (< 1h)           | **Hotfix** + deploy                      |
| Erro é noise (extensão chrome, ad blocker, ResizeObserver) | **Silence/Ignore** no Sentry com nota    |
| Erro afeta 1 tenant só, dado corrompido                    | **Reparar dado** + investigar root cause |

### Rollback Vercel

```bash
vercel rollback                       # interativo
# ou
vercel rollback <deployment-url>
```

### Hotfix

```bash
git checkout -b hotfix/<bug-curto>
# editar
npm run typecheck && npm run test:run
git commit -m "fix: <descrição>"
git push -u origin HEAD
# PR direto pra main, merge, deploy automático
```

### Silence (Sentry)

- Issue → menu "..." → **Ignore** com motivo no comentário.
- Adicionar à lista `IGNORED_ERRORS` em `src/lib/sentry.ts` (se aplicável)
  para parar de mandar daqui pra frente.

## Mitigação imediata

- Se decisão é rollback, **rollback agora**, debugar depois.
- Se hotfix, anuncie no Slack que está acontecendo (evita PRs concorrentes
  na main).
- Para spike de **3rd party** (CDN caiu, dependência externa lentidão),
  considere `Retry`/circuit breaker; nem sempre dá pra resolver no nosso lado.

## Solução definitiva

- Adicionar **teste regressivo** que cobre o cenário (Vitest ou e2e).
- Se falha de configuração: documentar em `DEPLOY_CHECKLIST.md`.
- Se falha de validação de dado: schema Zod / constraint no DB.

## Comunicação

- **Spike sem clientes reportando** (silent error): só Slack interno.
- **Spike com impacto visível:** status page + Slack `#status-clientes`.
- **Pós-rollback:** "deploy de HH:MM teve regressão, revertemos para versão
  estável. Investigando."

## Pós-mortem

- Se rollback: sim, post-mortem leve em 48h.
- Se silence/ignore: anotar no `docs/sentry-ignores.md` (criar quando precisar)
  com motivo, data, owner.
