# Status Page — Setup

Página pública mostrando saúde dos serviços do Pilar pra clientes. Reduz volume de tickets ("tá fora?") e dá transparência em incidentes.

## Opções avaliadas

| Provedor                  | Free tier                  | Status page        | Veredito                                                                   |
| ------------------------- | -------------------------- | ------------------ | -------------------------------------------------------------------------- |
| **BetterStack**           | 10 monitors, 3min interval | Sim, custom domain | **Recomendado** — UI moderna, status page incluso, integra Slack/PagerDuty |
| UptimeRobot               | 50 monitors, 5min interval | Sim, mas básica    | Bom pra muitos endpoints, status page feia                                 |
| Statuspage.io (Atlassian) | Sem free                   | Sim, premium       | Caro ($29+/mês)                                                            |
| Instatus                  | 10 monitors free           | Sim, bonita        | Alternativa válida ao BetterStack                                          |

## BetterStack (recomendado)

### 1. Criar conta

https://betterstack.com/uptime — free forever, sem cartão.

### 2. Criar monitors

Mínimo 3 monitors apontando pra `/health`:

| Nome             | URL                                                 | Interval | Region  |
| ---------------- | --------------------------------------------------- | -------- | ------- |
| Pilar API Health | `https://<project>.supabase.co/functions/v1/health` | 3min     | US East |
| Pilar App        | `https://app.pilarsoft.com.br`                      | 3min     | US East |
| Pilar Landing    | `https://pilarsoft.com.br`                          | 5min     | EU      |

Configurações por monitor:

- **Expected status code**: 200, 206 (degraded ainda retorna 200)
- **Keyword check**: `"status":"ok"` (alerta se status virar `degraded`/`down`)
- **Confirmation period**: 1min (evita flap)
- **Recovery period**: 1min

### 3. Status page

1. Criar status page: Status pages → New status page.
2. Subdomain: `pilar.betteruptime.com` (free) ou custom: `status.pilarsoft.com.br`.
   - Custom domain: adicionar `CNAME status` → `cname.betteruptime.com`.
3. Adicionar resources:
   - **API** (monitor: Pilar API Health)
   - **Aplicação Web** (monitor: Pilar App)
   - **Site Institucional** (monitor: Pilar Landing)
4. Configurar branding: logo Labrynth/Pilar, cor primária (`#000` ou tema brand).
5. Toggle "Public": ON.

### 4. Linkar do app

No footer da landing e do app, link `Status` → `https://status.pilarsoft.com.br`.

### 5. Incidents manuais

Quando houver incidente conhecido (ex: deploy planejado), criar incident manualmente:

- Status pages → seu page → Incidents → New incident
- Severity: `Maintenance` / `Degraded` / `Major outage`
- Affected resources: marcar quais
- Update a cada 30min até resolver

Subscribers (clientes) recebem email automaticamente.

## UptimeRobot (alternativa)

Free 50 monitors, 5min interval. Setup análogo. Status page em `stats.uptimerobot.com/<id>`. Visual mais cru — escolha se já usar UptimeRobot pra outros projetos.

## Política de comunicação

- **Down (P0)**: post no status page em <5min, update a cada 15min.
- **Degraded (P1)**: post em <15min, update a cada 30min.
- **Maintenance**: agendar com 48h de antecedência, post 24h antes.
- Postmortem público em incidentes >30min, em até 5 dias úteis (ver `../INCIDENT_RESPONSE.md`).
