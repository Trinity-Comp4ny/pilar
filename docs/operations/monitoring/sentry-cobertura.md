# Cobertura de erros no Sentry

- **App:** use `VITE_SENTRY_DSN` para erros de navegador.
- **Landing:** configure `VITE_SENTRY_MARKETING_DSN` no build do projeto de marketing.
  O SDK carrega na primeira falha global e reporta a pilha sem URL da página,
  query, breadcrumbs, replay ou texto livre da exceção.
- **Supabase:** configure `SENTRY_DSN`. Um retorno HTTP 5xx de um handler coberto
  gera evento independentemente da amostragem de traces. Quando o handler já
  reportou uma exceção na invocação, vale o evento com a causa original.

Valide em staging. Para a landing, confirme um erro controlado de navegador
com a tag `surface:marketing`. Para o backend, confirme um 5xx controlado
com a função e o status esperados sem enviar dados de cliente.
