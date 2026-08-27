# SPEC: Busca de CEP resiliente (edge function com fallback) + validação de schema nas APIs externas

**Data:** 2026-08-27
**Status:** Entregue
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** projetos / clientes / obras / checkout

<!-- Origem: bug em produção (busca de CEP quebrada em Projetos e Clientes por CSP
bloqueando viacep.com.br) + pergunta de follow-up do CEO sobre como evitar que
qualquer API externa (CEP, clima) volte a quebrar sem avisar. Ver ADR 0033. -->

## Problema

Busca de CEP quebrou em produção em Projetos e Clientes: as duas telas chamavam
`viacep.com.br` direto do browser, domínio que nunca entrou no CSP (`connect-src` do
`vercel.json`). O fetch era bloqueado pelo browser, caía no `catch`, e o usuário via só
"Erro ao buscar CEP" — nada chegava ao Sentry. A causa raiz (CSP) só apareceu por
inspeção manual. O mesmo padrão de risco existe em qualquer chamada a API externa feita
direto do cliente: se o provedor mudar de formato, sair do ar, ou o CSP bloquear, a
falha é silenciosa.

## Objetivo

Busca de CEP não depende de um provedor único nem do CSP do browser: passa por uma edge
function que já resolve os dois. Qualquer resposta de API externa (CEP, clima) que fugir
do formato esperado gera alerta no Sentry em vez de propagar `undefined` silencioso pela
UI.

**Fora de escopo:**

- **CNPJ** (`lookupCNPJ`, `brasilapi.com.br/api/cnpj/v1`) continua chamando direto do
  cliente. Mesmo padrão de risco do CEP, mas sem histórico de quebra — ver ADR 0033.
- **Proxy pra clima/reverse geocode.** Open-Meteo e BigDataCloud continuam chamados
  direto (já liberados no CSP, sem histórico de quebra); ganham só validação de schema.
- **Cache de CEP.** Fica pra depois, se o volume de chamada justificar.

## Requisitos

1. A busca de CEP tenta BrasilAPI primeiro; se cair, mudar de formato de resposta, ou
   não encontrar o CEP, tenta ViaCEP antes de desistir.
2. `src/lib/brasilApi.ts#lookupCEP` chama a edge function `lookup-cep` (via
   `supabase.functions.invoke`) em vez de `fetch` direto pra `brasilapi.com.br`. O
   contrato de retorno (`CepLookup`) não muda, então nenhuma tela chamadora precisa saber
   que a implementação mudou.
3. Resposta de provedor que não bate com o schema esperado (campo obrigatório ausente,
   tipo trocado) reporta ao Sentry com tag `provider` + `reason: "shape-mismatch"`, e é
   tratada como falha desse provedor (aciona o próximo, se houver).
4. Erro de rede/HTTP de cada provedor (edge function) e de cada chamada externa em
   `src/lib/clima.ts` (cliente) também é reportado ao Sentry, com `reason: "request-failed"`.
5. `lookup-cep` não exige autenticação (usada também no checkout pré-login) e tem rate
   limit de 30 req/min por IP.

Requisitos não-funcionais:

- **Sem PII no alerta:** o corpo da resposta externa reportado ao Sentry passa pelo
  `scrub` já existente (client) ou não contém CPF/CNPJ/dado sensível (a resposta de CEP
  não carrega isso).
- **Sem regressão de contrato:** `CepLookup` e o comportamento das 4 telas chamadoras
  (Obras, Projetos, Clientes, Checkout) ficam idênticos do ponto de vista do usuário.

## Critérios de aceite

- [x] Dado um CEP válido existente na BrasilAPI, quando busco, então recebo
      logradouro/bairro/cidade/UF normalizados.
- [x] Dado um CEP que a BrasilAPI não encontra mas o ViaCEP encontra, quando busco, então
      recebo o resultado do ViaCEP (fallback funciona).
- [x] Dado um CEP inexistente nas duas bases, quando busco, então recebo "CEP não
      encontrado" (sem erro genérico).
- [x] Dado um CEP com menos de 8 dígitos, quando busco, então a function responde 400
      sem tentar nenhum provedor.
- [x] Dado o browser bloqueando `viacep.com.br` por CSP (cenário do bug original), quando
      busco CEP em Projetos/Clientes/Checkout, então a busca funciona (não depende mais
      desse domínio no CSP do cliente).
- [x] Dado que um provedor de clima muda o shape da resposta, quando `buscarPrevisao` /
      `buscarLocais` / `buscarHistorico` / `nomeDaCoordenada` roda, então um evento
      `shape-mismatch` chega ao Sentry em vez de a UI quebrar silenciosa.

## Dados e contratos

- **Edge function nova:** `supabase/functions/lookup-cep` — `POST { cep: string }` →
  `{ found: true, cep, street, neighborhood, city, state }` ou `{ found: false }` (200) ou
  `{ error }` (400 CEP inválido, 429 rate limit).
- **`src/lib/brasilApi.ts`:** `lookupCEP` migra de `fetch` direto pra
  `supabase.functions.invoke("lookup-cep", ...)`. `CepLookup` inalterado.
- **`src/lib/clima.ts`:** schemas Zod novos (`geoResponseSchema`, `forecastResponseSchema`,
  `historicoResponseSchema`, `reverseGeoResponseSchema`) validam a resposta de cada
  chamada antes de virar `LocalGeo`/`Previsao`/`Historico`/string.
- Nenhuma migration, nenhuma tabela nova.

## Plano de implementação

1. Edge function `lookup-cep`: fetch BrasilAPI → valida Zod → fallback ViaCEP → valida
   Zod → normaliza → responde. Rate limit por IP (`_shared/rate-limiter.ts`), Sentry via
   `_shared/sentry.ts` (mesmo padrão de `geocode-address`, `send-proposta-email`).
2. `brasilApi.ts#lookupCEP` passa a chamar a function via `supabase.functions.invoke`.
3. `clima.ts`: schema Zod + `reportShapeMismatch` em `buscarLocais`, `buscarPrevisao`,
   `buscarHistorico`, `nomeDaCoordenada`.
4. Verificação: `supabase functions serve lookup-cep --no-verify-jwt` local, contra
   BrasilAPI/ViaCEP reais (CEP existente, CEP só no fallback, CEP inexistente, CEP
   inválido, OPTIONS/CORS). Schemas de clima validados manualmente contra resposta real
   de cada provedor (curl).
5. `npm run typecheck`, `npx eslint`, `npx vitest run src/lib/clima.test.ts`.
6. Deploy da function pra staging (`npm run functions:deploy:staging`) fica pendente de
   confirmação explícita antes de rodar (muta ambiente compartilhado, ver ADR 0007).

## Decisões e riscos

- Decisão de arquitetura: [ADR 0033](../architecture/adr/0033-resiliencia-de-integracao-com-api-externa.md).
- Risco aceito: CNPJ e o proxy de clima ficam de fora por ora (fora de escopo, seção
  acima) — se algum dia quebrarem, o critério do ADR 0033 decide se viram proxy.
- `lookup-cep` sem autenticação é superfície pública nova; mitigado com rate limit por
  IP, seguindo o mesmo padrão de `send-proposta-email`.
