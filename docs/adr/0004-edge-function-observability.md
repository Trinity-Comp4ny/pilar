# ADR 0004: Observabilidade de Edge Functions via HTTP Envelope direto

**Data:** 2026-05-04  
**Status:** Accepted

## Contexto

Edge Functions da Supabase rodam no Deno Deploy. O SDK oficial do Sentry para JavaScript/Node traz dependências que importam módulos Node.js (`net`, `http`, etc.) incompatíveis com Deno edge runtime. Usar o SDK gera erros de import na hora do deploy.

Outras opções consideradas:

- SDK `@sentry/deno` — existe mas é `0.x`, não mantido ativamente, requer permissões extras de rede.
- Sentry SDK via `npm:@sentry/node` — funciona parcialmente mas aumenta o bundle em ~200 KB e traz shims desnecessários.
- Logging apenas no Supabase (stdout capturado pela plataforma) — sem alertas proativos, sem stack traces, sem contexto de release.

## Decisão

Implementar cliente Sentry mínimo em `_shared/sentry.ts` que envia eventos diretamente via **HTTP Envelope** (POST para `/api/{project_id}/envelope/`), sem nenhuma dependência além de `fetch` nativo.

Cobertura:

- `captureException(err, ctx)` — erros não tratados capturados pelo `withSentry` wrapper
- `sendTransaction(...)` — Performance transactions com sampling via `SENTRY_TRACES_RATE` (default 0.1)
- `withSentry(fnName, handler)` — HOF que envolve qualquer handler, captura exceções e emite transaction

Sem DSN configurado, tudo é no-op (console.warn em dev).

## Consequências

**Positivas:**

- Zero dependências extras; bundle não aumenta
- Funciona em qualquer Deno runtime sem shims
- Envelope HTTP é o protocolo nativo do Sentry — mais estável que SDK que muda entre versões
- Performance transactions disponíveis com sampling configurável

**Negativas:**

- Sem integrations automáticas (breadcrumbs de fetch, user-agent parsing, etc.)
- Stack traces de Deno têm menos frame info que V8 com sourcemaps
- Manutenção manual se o protocolo de envelope mudar (historicamente estável desde 2020)

## Alternativas rejeitadas

| Opção                  | Motivo da rejeição                                       |
| ---------------------- | -------------------------------------------------------- |
| `@sentry/deno`         | Não mantido, `0.x`, bugs conhecidos com Deno Deploy      |
| Console logging apenas | Sem alertas proativos, sem stack traces contextualizados |
| Datadog / New Relic    | Custo adicional; Sentry já está no stack frontend        |
