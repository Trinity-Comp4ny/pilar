# ADR 0053: Conteúdo de prompt e resposta da IA só vai pro Sentry em dev

**Data:** 2026-10-13  
**Status:** Accepted

## Contexto

O [ADR 0027](./0027-sentry-metrics-e-agent-replay-completo.md) passou a mandar
`gen_ai.input.messages` e `gen_ai.output.messages` em todos os ambientes, para a tela
Conversations do Sentry mostrar o replay. O próprio ADR registrou o risco: o `scrub()` por
regex pega CPF, CNPJ, CEP e cartão, mas não pega nome de cliente, valor de contrato,
descrição de despesa nem nome de projeto. É justamente o que o `ai-chat`, o
`ai-import-financeiro` e o guardião de margem mandam ao modelo. Em produção, isso é dado
financeiro de cliente guardado num terceiro (LGPD).

O ganho do replay caiu desde então: a suíte de evals ([ADR 0048](./0048-mudanca-de-prompt-ou-modelo-passa-por-eval.md))
reproduz a decisão do modelo com casos fixos, e o `agent_runs.result` guarda a saída
estruturada dos agentes dentro do nosso banco, com RLS.

Opções consideradas:

- **Manter o conteúdo em produção com scrub**: replay completo, mas o vazamento depende de
  uma regex que não cobre o dado que mais importa.
- **Conteúdo também em staging**: risco menor, mas ninguém controla o que é digitado lá, e
  mais um ambiente liberado é mais um nome que pode ser configurado errado.
- **Conteúdo só em dev, por allowlist** (escolhida): o ambiente precisa estar numa lista
  curta para o texto sair; qualquer outro valor manda só metadado, e um teste fixa os casos.

## Decisão

`sendTransaction()` em `supabase/functions/_shared/sentry.ts` passa os atributos de cada
span `gen_ai.*` por `conteudoGenAiPorAmbiente(attributes, ENVIRONMENT)` antes de montar o
envelope. Fora de `development`, `dev` ou `local`, os dois atributos de conteúdo são
removidos. É allowlist: `production`, `staging`, valor vazio ou digitado errado caem todos
no lado seguro.

Continua saindo em todo ambiente: modelo, tokens de entrada e saída, latência, status,
`pilar.empresa_id`, `gen_ai.conversation.id`. O dashboard Insights > Agents segue com custo,
volume e erro por agente; só o texto da conversa some.

O filtro fica no ponto de envio, não em cada chamada ao modelo, para cobrir qualquer caminho
que registre span (`ai-client.ts` hoje, o gateway do SPEC 106 depois) sem depender de quem
escreve o próximo.

`sentry-genai.test.ts` fixa os três casos (produção/staging, vazio/digitado errado, dev) e
confere o corpo do envelope real que sai do `withSentry`.

## Consequências

**Positivas:**

- Prompt e resposta com dado de cliente deixam de sair do Supabase em staging e produção.
- Novo caminho de IA herda a regra sem precisar lembrar dela.

**Negativas:**

- A tela Conversations do Sentry fica sem texto fora de dev. Investigar uma resposta ruim em
  produção passa por `agent_runs`, pelos logs da função ou por reproduzir o caso na suíte de
  evals.
- Quem quiser o replay localmente precisa de `SENTRY_ENV=development` e um DSN apontando pra
  um projeto de dev.

## Decisões relacionadas

- [ADR 0027](./0027-sentry-metrics-e-agent-replay-completo.md): revisado na parte do replay
  de conteúdo; métricas, `conversation.id`, usuário e a correção de amostragem continuam.
- [ADR 0048](./0048-mudanca-de-prompt-ou-modelo-passa-por-eval.md): evals substituem o
  replay de produção como forma de ver a decisão do modelo.
