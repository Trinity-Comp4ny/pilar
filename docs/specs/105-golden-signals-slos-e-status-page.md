# SPEC: Golden signals, SLOs e status page automática

**Data:** 2026-10-09  
**Status:** Em implementação  
**Autor:** Matheus Rezende  
**Módulo:** plataforma (transversal)

Decisão: [ADR 0047](../architecture/adr/0047-saude-por-componente-e-status-page-fora-da-infra.md).

## Problema

Hoje a observabilidade responde "deu erro?" (Sentry), mas não "o produto está
saudável?". O health checa banco, crons, Asaas e Resend só por alcance; um webhook de
pagamento que falha, e-mail que não sai ou agente de IA que quebra não aparece em lugar
nenhum até o cliente reclamar. A status page `/status` é manual e roda na mesma
infraestrutura que monitora: se o Supabase cai, ela cai junto.

## Objetivo

Cada componente do produto (API, banco, autenticação, pagamentos, e-mails, IA, crons) tem
um sinal de saúde automático, um SLO escrito, alerta que chega no e-mail e uma status page
pública em `status.pilarsoft.com.br` que muda sozinha.

**Fora de escopo:** métricas por empresa, dashboard próprio dentro do app, SLA contratual,
PITR (plano Pro do Supabase), notificação por SMS.

## Requisitos

1. `GET /functions/v1/health` devolve o status de cada componente: `api`, `banco`,
   `autenticacao`, `pagamentos`, `emails`, `ia`, `crons`. Sem números nem detalhe de
   negócio na resposta pública.
2. `GET /functions/v1/health?componente=<nome>` responde 503 quando aquele componente não
   está `ok`. É o que o monitor externo de cada componente consulta.
3. Pagamentos, e-mails, IA e crons são avaliados pelo que aconteceu de fato (tabelas de log
   e `cron.job_run_details`), não só por alcance do fornecedor. A regra considera o volume
   baixo de hoje: falha recente sem sucesso depois conta; uma falha isolada no meio de
   sucessos não derruba o componente.
4. Login de verdade, com usuário de monitor, a cada 10 min no workflow de produção.
5. SLOs escritos em `docs/operations/monitoring/SLOS.md`, cada um com a fonte da medida.
6. Alertas: uptime e erros de produção no Sentry, por e-mail. Falha do monitor sintético
   continua abrindo issue no GitHub.
7. Status page externa (Better Stack) com um recurso por componente, em
   `status.pilarsoft.com.br`. A rota `/status` do app redireciona para ela quando
   `VITE_STATUS_URL` estiver definido.

## Critérios de aceite

- [ ] Deno: regra de avaliação dos sinais (falha sem sucesso, limite de falhas, componente
      sem volume) e o 503 por componente.
- [ ] pgTAP: `_ops_sinais_saude()` não é executável por `anon` nem `authenticated`, e
      devolve as contagens certas para um cenário montado no teste.
- [ ] Sintético: login real passa em produção com o usuário de monitor (pulado sem segredo).
- [ ] Sentry: monitores de uptime do app e do health e monitor de erros de produção ligados
      a um alerta por e-mail.
- [ ] Status page publicada no subdomínio, com os 7 componentes.
