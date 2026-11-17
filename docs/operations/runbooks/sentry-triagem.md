# Runbook: triagem automática de issues do Sentry

Workflow: `.github/workflows/sentry-triagem.yml`. Código: `scripts/sentry-triagem/`.

## O que faz

A cada 2 h (ou sob demanda) busca issues não resolvidas de **produção** no Sentry e decide por issue:

| Veredito | Resultado |
| --- | --- |
| Ruído conhecido (rede do usuário, sessão expirada, cartão recusado, MFA errado) | Ignorada no Sentry sem usar IA, com comentário |
| `ruido` (agente) | Ignorada no Sentry com o motivo |
| `corrigir` | Branch `sentry/<id>`, PR para `staging` atribuído ao Matheus, CI disparado |
| `humano` | Issue no GitHub (`[Sentry <id>] ...`) com o motivo; sem código alterado |

O agente **nunca mergeia**. Máximo de 3 issues por rodada, as com mais usuários afetados primeiro.
Issue com PR ou issue do GitHub com o código no título não é tratada de novo.

## Caminho principal: rotina na nuvem (assinatura, sem secrets)

A triagem do dia a dia roda como **rotina do Claude Code na nuvem** (claude.ai/code/routines), na assinatura do
Matheus, com o conector do Sentry, a cada 2 h. Mesmas regras deste runbook: ruído ignorado, bug vira PR para
`staging`, o resto vira issue; nunca mergeia. O workflow abaixo fica de **reserva** (exige `ANTHROPIC_API_KEY`
ou token de assinatura gerado com `claude setup-token`).

## Reserva: workflow do GitHub (uma vez)

1. Sentry → Settings → Developer Settings → **Custom Integration (interna)** com escopos `Issue & Event: Read & Write`. Copie o token.
2. GitHub → Settings → Secrets → Actions: `SENTRY_TOKEN` (o token acima) e `ANTHROPIC_API_KEY`.
3. Settings → Actions → General: marcar "Allow GitHub Actions to create and approve pull requests".
4. O cron só dispara a partir da `main`: vale depois do próximo release. Antes disso, use **Run workflow** (campo `issue`, ex.: `PILAR-1T`).

Sem os secrets o workflow só avisa e sai.

## Segurança

- Texto do Sentry é dado não confiável (repo público). O contexto vai marcado como dado e passa por sanitização.
- O agente só edita `src/`, `supabase/functions/` e `supabase/migrations/`, e só roda `tsc` e `vitest`. A chave Anthropic existe só no passo do agente; o `SENTRY_TOKEN` só nos passos que não rodam código do agente.
- Guarda pós-agente reprova a rodada se algo em `.github/`, `scripts/`, `package*.json`, `vercel.json` ou `.env*` mudou.
- Migration gerada pelo agente passa pela revisão normal do PR e pelo `check-migration-safety`.

## Ajustar

- Ruído novo: acrescentar o padrão em `RUIDO` (`scripts/sentry-triagem/lib.mjs`) e o caso em `lib.test.ts`.
- Comportamento do agente: `scripts/sentry-triagem/prompt.md`.
- Pausar: desabilitar o workflow em Actions.
