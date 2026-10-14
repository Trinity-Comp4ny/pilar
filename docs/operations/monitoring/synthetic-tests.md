# Checks sintéticos de produção

Checks que rodam **fora** da nossa infra contra o produto no ar, como um visitante.
Diferem de:

- **Vitest / deno test / pgTAP**: lógica, no CI.
- **E2E (Playwright)**: fluxos completos, no CI (banco local) e em staging.
- **Health** (`/functions/v1/health`): serviços de pé (banco, Asaas, Resend).
- **Sintético**: o produto responde para quem chega de fora, continuamente.

Health pode estar verde com o app quebrado (bundle fora do CDN, tela de login sem
formulário, roteador do SPA devolvendo 5xx). O sintético pega isso.

## Como roda

Workflow `.github/workflows/monitor-producao.yml`, a cada 10 min, com
`tests/synthetic/critical-flows.spec.ts` (config em `tests/synthetic/playwright.config.ts`):

| Check          | O que prova                                                                  |
| -------------- | ---------------------------------------------------------------------------- |
| Health         | Edge Function responde; componentes `banco` e `autenticacao` ok; banco < 1 s |
| Landing        | `app.pilarsoft.com.br` carrega com título                                    |
| Tela de login  | formulário (e-mail, senha, botão) aparece                                    |
| Guarda de rota | `/dashboard` sem sessão não dá 5xx                                           |
| Login real     | o usuário de monitor entra e chega no app (`#main-content`)                  |

Uma nova tentativa por check (Edge Function fria pode responder 503 na primeira
chamada). Falha abre ou comenta a issue **"Cron falhando: Monitor de produção"**, e o
GitHub avisa por e-mail. Rodar na mão: `npx playwright test --config tests/synthetic/playwright.config.ts`.

A disponibilidade por componente (pagamentos, e-mails, IA, crons) fica no Better Stack,
que olha `/health?componente=<nome>` a cada 3 min: ver [status-page-setup.md](./status-page-setup.md).

### Usuário de monitor (login real)

Sem os secrets, o check de login real é pulado e o resto roda. Para ligar:

1. Criar em produção uma conta só para isso, pelo cadastro normal, com e-mail próprio
   (ex.: `monitor@pilarsoft.com.br`) e empresa "Pilar Monitor". Sem 2FA.
2. No ultra-admin, marcar a empresa como isenta (senão o teste de 3 dias vence e o login
   para na tela de assinatura, e o check acusa queda que não existe).
3. GitHub → Settings → Secrets and variables → Actions → secrets de repositório
   `PILAR_MONITOR_EMAIL` e `PILAR_MONITOR_PASSWORD`.

O check só entra e lê. Não cria dado.

Limites honestos: o cron do GitHub pode atrasar alguns minutos e só liga a partir de
`main`. Para queda de minuto, quem avisa é o Better Stack.

## O que NÃO testar aqui

- **Mutação** (criar projeto, lançar despesa): suja o banco de produção.
- **Efeito externo** (e-mail, cobrança Asaas).
- **Dado específico** ("tem 5 clientes"): quebra quando o cliente mexe no dado.

Fluxo logado em produção pede um usuário dedicado de monitoramento, numa empresa
própria, com dado só de leitura. Ainda não existe.

## Quando o alerta disparar

1. `curl https://vepnsonbnsimqcsfcagm.supabase.co/functions/v1/health`
2. Sentry (org `trinity-company`): erro novo no mesmo horário?
3. Artifact `monitor-producao-<run>` do run: screenshot e trace do check que falhou.
4. Deploy recente? Rollback é o caminho mais rápido.
5. Confirmado: comunicar pela status page (`/status`) e seguir `../INCIDENT_RESPONSE.md`.
