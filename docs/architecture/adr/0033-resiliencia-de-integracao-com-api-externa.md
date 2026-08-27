# ADR 0033: Resiliência de integração com API externa: proxy quando há CSP/fallback, validação Zod sempre

**Data:** 2026-08-27
**Status:** Accepted

## Contexto

A busca de CEP quebrou em produção em três telas (Projetos, Clientes, Checkout) porque
elas chamavam `viacep.com.br` direto do browser, e esse domínio nunca entrou no
`connect-src` do CSP (`vercel.json`). O erro é bloqueado silenciosamente pelo browser,
cai no `catch` do fetch e vira só um toast genérico — nada chega ao Sentry. A causa raiz
só apareceu por inspeção manual do CSP, não por alerta.

O Pilar chama hoje várias APIs de terceiros direto do cliente (CEP, geocoding e
previsão do tempo, reverse geocode, CNPJ) e também já tem precedente de proxy via edge
function pra isso: `geocode-address` (Nominatim) já existe e é usado por
`useProjetoForm.ts`. O ADR 0030 cobre o mesmo problema de "erro de fronteira invisível",
mas só pro `fetch` instrumentado do cliente Supabase (REST/RPC/Storage/Auth) — chamada
a domínio de terceiro fica fora do interceptor dele.

Duas forças em tensão:

- **Proxy via edge function** elimina o problema de CSP por definição (o browser só
  fala com `*.supabase.co`, que já está liberado) e abre espaço pra fallback entre
  provedores e cache. Custo: mais uma function pra manter, mais um hop de latência.
- **Validação na fronteira + alerta** é barata e não muda a topologia de rede, mas não
  evita a quebra em si (CSP, CORS, provedor fora do ar) — só garante que ela não fica
  invisível.

Nem toda integração externa justifica o mesmo nível de proteção: Open-Meteo (clima) e
BigDataCloud (reverse geocode) já estão liberados no CSP e nunca quebraram em produção;
só o CEP tem histórico de quebra real.

## Decisão

**1. Proxy via edge function quando a chamada já tem (ou pode ganhar) fallback entre
provedores, ou quando o histórico mostra risco de CSP/CORS/instabilidade.** CEP passa a
usar `supabase/functions/lookup-cep`: tenta BrasilAPI, cai pra ViaCEP se a primeira
cair, mudar de formato, ou não achar o CEP. `src/lib/brasilApi.ts#lookupCEP` chama essa
function via `supabase.functions.invoke` em vez de `fetch` direto. CNPJ
(`lookupCNPJ`) fica de fora por ora — mesmo padrão de risco, mas sem histórico de
quebra; migrar é trabalho futuro se/quando quebrar.

**2. Toda resposta de API externa passa por schema Zod antes de virar dado no app,
mesmo sem proxy.** `src/lib/clima.ts` (Open-Meteo geocoding/forecast, BigDataCloud
reverse geocode) e a própria `lookup-cep` (BrasilAPI, ViaCEP) validam o shape da
resposta. Se não bater, reporta pro Sentry (`reason: "shape-mismatch"`, tag por
provedor) e trata como falha — nunca deixa `undefined` se propagar silencioso pela UI.

**3. Erro de request (rede, 5xx) e erro de shape são sempre capturados no ponto onde a
chamada acontece** — `captureException` (edge function, via `_shared/sentry.ts`) ou
`monitoring.captureException` (cliente) — com tag `provider` e `reason` (`shape-mismatch`
| `request-failed`), pra cada provedor virar um issue agrupável no Sentry em vez de se
perder no catch.

## Consequências

**Positivas:**

- CEP não quebra mais por CSP: o browser só fala com o próprio domínio Supabase.
- Mudança de formato de provedor (o que causou o incidente original) agora gera um
  alerta no Sentry em vez de um toast silencioso — descoberta em minutos, não por
  reclamação de cliente.
- BrasilAPI caindo ou não achando o CEP não derruba a busca: ViaCEP cobre o gap.

**Negativas:**

- `lookup-cep` é mais uma edge function pra manter e adiciona um hop de latência (dois
  fetches em série no pior caso, provedor 1 falha → tenta provedor 2).
- Clima e reverse geocode continuam sem proxy — se algum dia um desses passar a
  quebrar (CSP, CORS, saída do ar), o fix imediato é mitigar na hora e só depois avaliar
  se justifica proxy, seguindo o critério da decisão 1 acima.
- Zod nas respostas externas duplica, em parte, o shape que o TypeScript já descrevia
  como tipo — mas o tipo não valida em runtime, é exatamente o gap que quebrou.

## Decisões relacionadas

- Complementa o [ADR 0030](./0030-erro-de-fronteira-sempre-reportado.md): lá é o
  `fetch` do cliente Supabase, aqui é `fetch` pra domínio de terceiro.
- Ver [SPEC 070](../../specs/070-lookup-cep-fallback-e-validacao-de-schema.md).
