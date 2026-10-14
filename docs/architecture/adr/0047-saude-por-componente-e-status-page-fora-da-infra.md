# ADR 0047: Saúde por componente no /health, status page fora da nossa infra

**Data:** 2026-10-09  
**Status:** Accepted

## Contexto

O Sentry responde "deu erro?", mas ninguém respondia "o produto está saudável?". Webhook
de pagamento que falha, e-mail que não sai ou agente de IA que quebra não apareciam em
lugar nenhum até o cliente reclamar. A status page `/status` (SPEC 055) é manual e roda no
mesmo app e no mesmo Supabase que deveria acompanhar: quando o Supabase cai, ela não
carrega os incidentes, justamente quando mais precisa aparecer.

Duas restrições pesaram:

- **Plano do Sentry sem pay-as-you-go.** Uptime monitor e monitor de cron extra exigem
  saldo; a criação via API devolve "not enough pay-as-you-go". Os check-ins de cron que o
  banco envia (ADR 0036) chegam com 202, mas sem monitor criado são descartados: o Sentry
  Crons nunca mostrou nada. Monitores de métrica (erros, latência) funcionam no plano atual.
- **Volume baixo.** Dezenas de e-mails e poucas execuções de agente por semana. Taxa de
  erro em percentual vira ruído (1 falha em 2 é "50%").

Opções consideradas:

- **Sentry para tudo**: uptime e crons pagos; sem status page pública.
- **Status page própria em `status.pilarsoft.com.br` apontando para a `/status` atual**:
  barato, mas cai junto com o app.
- **Health por componente + monitor externo grátis (Better Stack) com status page**: cada
  componente vira um monitor HTTP; a página muda sozinha e fica fora da nossa infra.

## Decisão

1. **O `/health` mede o produto, não só o alcance.** Componentes `api`, `banco`,
   `autenticacao`, `pagamentos`, `emails`, `ia` e `crons`. Pagamentos, e-mails, IA e crons
   são avaliados pelo que aconteceu de fato, lido por `public._ops_sinais_saude()` (interna,
   só service_role). Regra para volume baixo: degradado quando a falha é mais recente que o
   último sucesso ou quando as falhas na janela chegam ao limite (1 para pagamento e cron,
   3 para e-mail e IA). Crons também ficam degradados se nada rodou em 24 h.
2. **`?componente=<nome>` devolve 503 só por aquele componente.** É o contrato com o
   monitor externo: um monitor por componente, sem precisar de checagem de palavra-chave.
   A resposta pública não traz contagem nem dado de negócio.
3. **Status page no Better Stack**, em `status.pilarsoft.com.br` (DNS na Vercel). A rota
   `/status` do app redireciona para ela quando `VITE_STATUS_URL` está definida. As tabelas
   de incidente da SPEC 055 ficam como fallback, sem uso novo.
4. **Sentry fica com erros e latência** (monitores de métrica ligados a um alerta por
   e-mail). Uptime e crons ficam no Better Stack e no `/health`.
5. **SLOs escritos e com fonte** em `docs/operations/monitoring/SLOS.md`.

## Consequências

- Um componente novo que mereça sinal (ex.: integração bancária) entra em
  `_ops_sinais_saude()`, no `/health` e ganha um monitor no Better Stack.
- O Better Stack grátis checa a cada 3 min; a detecção de queda é de minutos, não de
  segundos. Basta enquanto não houver SLA contratual.
- Se um dia o Sentry tiver pay-as-you-go, os check-ins de cron passam a valer criando os
  monitores com o schedule do pg_cron; nada no banco muda.
- A janela de 1 h faz um componente voltar a verde sozinho uma hora depois da última
  falha, mesmo sem sucesso novo. Em volume baixo isso é aceitável: o alerta já foi enviado.
