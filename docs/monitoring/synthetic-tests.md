# Synthetic Tests — Estratégia

Synthetic = testes que rodam **fora** da nossa infra, simulando usuário real. Diferem de:

- **Unit/integration tests** (Vitest): rodam em CI, validam lógica.
- **E2E tests**: rodam contra ambiente, validam fluxos.
- **Health checks** (`/health`): validam que serviços estão de pé.
- **Synthetic** (Checkly): validam que o produto **funciona pra usuário real**, continuamente, em produção.

## Por que sintético

Health pode estar verde e o app quebrado:

- JS bundle 500ed no CDN
- Auth endpoint OK mas formulário de login quebrou
- Postgres OK mas RLS rejeita 100% das queries
- Latência absurda em sa-east-1 mas não em us-east-1

Synthetic pega isso porque executa o app igual usuário.

## Quando rodam

Configurado em `checkly.config.ts`:

| Check                    | Frequência | Justificativa                                           |
| ------------------------ | ---------- | ------------------------------------------------------- |
| `/health` API            | 1min       | Sinal mais rápido de outage                             |
| `turnstile-verify` smoke | 5min       | Auth crítico, mas chama externo (Cloudflare)            |
| Login screen renders     | 5min       | Quebra de bundle/CSS aparece aqui                       |
| Landing loads            | 5min       | Marketing/SEO, menos crítico                            |
| Dashboard route guard    | 10min      | Smoke do SPA router                                     |
| Login flow real          | 12h (cron) | Caro (consome browser minutes), só pra confiança diária |

## O que NÃO testar

- **Mutações**: criar projeto, lançar despesa. Suja DB de prod.
- **Fluxos com side effect externo**: enviar email, criar cobrança Asaas.
- **Dados específicos**: "deve ter 5 clientes". Quebra quando cliente real muda dado.

## User dedicado de monitoring

Pra checks que precisam autenticar (ex: "dashboard carrega com dados"):

- Criar empresa "Synthetic Monitoring" com 1 user `monitor@labrynth.ai`.
- Marcar `is_monitoring=true` no perfil (RLS deve excluir de relatórios reais).
- Senha em Checkly secret, NUNCA no repo.
- Dados do usuário são read-only (seed fixo).

## Interpretação de alertas

Quando Checkly dispara:

1. **Confirmar com `/health`**: `curl https://<project>.supabase.co/functions/v1/health`.
2. **Olhar Sentry**: erros novos correlacionados no horário?
3. **Checkly run details**: screenshot + console logs do browser check.
4. **Deploy recente?** Rollback é o caminho mais rápido em outage.
5. **Postar no status page** se confirmado.

Falha em 1 região + outras OK = problema regional (CDN, AWS), normalmente recupera sozinho. **Não acordar on-call por 1 região** — política de alerta exige 2 falhas consecutivas em ≥2 regiões.

## Custos vs cobertura

Free tier Checkly = ~43k API runs/mês, 1.5k browser/mês. `/health` 1x/min × 2 regiões = 86k runs/mês — **excede free tier**. Opções:

- Reduzir `/health` pra 2min: 21k runs, cabe.
- Manter 1min só em sa-east-1: 43k, no limite.
- Upgrade Team Plan ($80/mês): ilimitado.

Recomendado: começar 2min × 2 regiões, subir pra 1min quando tiver paying customers.

## Integração com IR (Incident Response)

`docs/INCIDENT_RESPONSE.md` é a fonte de verdade pra severidade e comunicação. Synthetic é o **trigger**, não o playbook.

Checkly alert → Slack `#incidents` → on-call abre incident em BetterStack → segue runbook.
