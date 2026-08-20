# ADR 0030: Erro de fronteira é reportado no interceptor, não na tela

**Data:** 2026-08-20
**Status:** Accepted

## Contexto

Um design partner levou 11 respostas `403` em 23 minutos tentando cadastrar uma
disciplina e o Sentry não registrou uma linha. O código da tela é o padrão do
repo hoje:

```ts
const { error } = await supabase.from("disciplinas").insert({ nome });
if (error) toast.error("Erro ao adicionar disciplina");
```

O erro chega ao usuário e morre ali. A proporção no app: 429 `toast.error`
contra 33 `captureException`, e 112 arquivos com toast e nenhuma captura. O bug
só foi descoberto porque o cliente avisou por mensagem e os logs do PostgREST
ainda estavam na janela de retenção.

Duas formas de resolver:

- **Editar os 112 arquivos** para capturar em cada catch. Cobre também erro de
  lógica local, mas depende de disciplina em toda tela nova, é exatamente a
  disciplina que falhou nas 429 chamadas existentes, e nada no CI garante.
- **Capturar na fronteira (escolhida).** Todo erro de dado atravessa um ponto
  só: o `fetch` que o cliente Supabase usa para REST, RPC, Storage e Auth.
  Instrumentar esse ponto cobre 100% deles de uma vez, incluindo as telas que
  ainda não existem.

## Decisão

**1. O cliente Supabase recebe um `fetch` instrumentado.** Toda resposta
`>= 400` e toda falha de rede vira evento no Sentry com rota/tabela, método,
status, código PostgREST e `request_id`. Corpo de requisição não é enviado
(PII); a mensagem do PostgREST passa pelo `scrub` que o monitoring já aplica.

**2. Severidade calibrada, para o sinal não afogar no ruído.** `401` e `403` são
`warning` com fingerprint por rota + status, então viram um issue por endpoint em
vez de um por clique. `5xx` e falha de rede são `error`. `406` de
`.maybeSingle()` sem linha é ignorado, é resposta esperada da API.

**3. `QueryClient` ganha `onError` global** em query e mutation: o que passa por
React Query fica coberto mesmo quando a tela engole o retorno.

**4. `reportError(err, ctx)` é o caminho padrão do catch de escrita.** Captura e
devolve a mensagem para o toast junto do event id, que a UI mostra como código
de referência. As telas migram para ele conforme forem tocadas; o interceptor já
garante o piso enquanto isso.

**5. O interceptor não substitui captura explícita onde há contexto de domínio.**
Erro de regra de negócio, parse de arquivo e cálculo continuam capturando na
tela, onde se sabe o que o usuário estava fazendo.

## Consequências

**Positivas:**

- Nenhum erro de dado invisível, sem depender de lembrar em cada tela. Tela nova
  já nasce coberta.
- O diagnóstico do incidente que motivou este ADR levaria minutos: o issue teria
  rota, status e usuário, em vez de exigir log de PostgREST e relato do cliente.
- Um lugar só para calibrar (amostragem, severidade, o que ignorar), em vez de
  112.

**Negativas:**

- Volume de eventos sobe, e `403` de RLS é o mais comum. Sem o fingerprint por
  rota isso estouraria a quota do plano; com ele, agrupa, mas exige revisar a
  calibragem quando surgir um endpoint barulhento.
- O evento do interceptor não sabe a intenção do usuário (qual botão, qual
  fluxo). Por isso `reportError` e a captura explícita continuam existindo.
- Um `fetch` customizado no cliente é código no caminho crítico de toda
  requisição: precisa ser à prova de falha (nunca lançar por causa da
  instrumentação) e coberto por teste.

## Decisões relacionadas

- Complementa o [ADR 0027](./0027-sentry-metrics-e-agent-replay-completo.md)
  (métricas e replay): lá é o que medir, aqui é garantir que a falha chega.
- Ver [SPEC 058](../../specs/058-acesso-por-role-observabilidade-total-mfa-opcional.md).
