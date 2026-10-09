# Status page (Better Stack)

Página pública com a saúde de cada componente do Pilar, em `status.pilarsoft.com.br`, fora
da nossa infraestrutura: se o app ou o Supabase caem, ela continua no ar e mostra a queda.
Decisão: [ADR 0047](../../architecture/adr/0047-saude-por-componente-e-status-page-fora-da-infra.md).
SLOs: [SLOS.md](./SLOS.md).

## Como funciona

O `/health` responde por componente. Com `?componente=<nome>`, devolve **503 quando aquele
componente não está ok**. Cada monitor do Better Stack olha um componente; a status page
mostra um recurso por monitor e muda sozinha.

Base do health: `https://vepnsonbnsimqcsfcagm.supabase.co/functions/v1/health`

## Estado (2026-10-09)

Configurado via API do Better Stack: 9 monitores (todos `up`) e status page `266645`
(`pilarsoft.betteruptime.com`, domínio próprio `status.pilarsoft.com.br`). Pendente: registro
DNS `CNAME status → statuspage.betteruptime.com` na Vercel (conta dona do domínio) e
`VITE_STATUS_URL` no projeto do app. Token da API fica em `~/.betterstack-token`, fora do repo.

## 1. Conta

https://betterstack.com/uptime, plano grátis (10 monitores, checagem a cada 3 min, status
page com domínio próprio). Entrar com o e-mail que deve receber os alertas.

## 2. Monitores

Tipo **"Status code"** (alerta quando a URL não responde 2xx), intervalo 3 min,
confirmação de 1 min (evita alarme por uma checagem fria), recuperação de 1 min.

| Nome no Better Stack | URL                                        |
| -------------------- | ------------------------------------------ |
| App                  | `https://app.pilarsoft.com.br/login`       |
| API                  | `<base do health>?componente=api`          |
| Banco de dados       | `<base do health>?componente=banco`        |
| Autenticação         | `<base do health>?componente=autenticacao` |
| Pagamentos           | `<base do health>?componente=pagamentos`   |
| E-mails              | `<base do health>?componente=emails`       |
| Agentes de IA        | `<base do health>?componente=ia`           |
| Rotinas automáticas  | `<base do health>?componente=crons`        |
| Site                 | `https://pilarsoft.com.br`                 |

São 9 de 10 monitores do plano grátis.

Em **Escalation policy**, deixar e-mail e notificação push do app do Better Stack.

## 3. Status page

1. Status pages → New status page. Nome "Pilar", idioma português.
2. Recursos, nesta ordem: App, Autenticação, API, Banco de dados, Pagamentos, E-mails,
   Agentes de IA, Rotinas automáticas, Site.
3. Domínio próprio: `status.pilarsoft.com.br`. Destino do CNAME: `statuspage.betteruptime.com`.
   O DNS de `pilarsoft.com.br` está na Vercel: criar registro `CNAME status → <destino>`
   (hoje `status` cai no curinga da Vercel e devolve 404).
4. Public: ligado. Assinatura por e-mail para clientes exige plano pago (desligada no grátis).

## 4. Ligar o app à página

Na Vercel, projeto do app, ambiente Production: `VITE_STATUS_URL=https://status.pilarsoft.com.br`
e redeploy. A rota `/status` passa a redirecionar para a página externa.

## Incidentes manuais

Manutenção planejada ou problema que os monitores não pegam: Status page → Incidents → New
incident, marcando os recursos afetados. Assinantes recebem e-mail.

## Política de comunicação

- **Fora do ar**: incidente na página em até 5 min, atualização a cada 15 min.
- **Degradado**: em até 15 min, atualização a cada 30 min.
- **Manutenção**: agendar com 48 h, aviso 24 h antes.
- Postmortem público em incidente acima de 30 min, em até 5 dias úteis (ver `../INCIDENT_RESPONSE.md`).
