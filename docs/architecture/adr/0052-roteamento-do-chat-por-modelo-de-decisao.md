# ADR 0052: Roteamento do chat por modelo de decisão, com o modelo de texto de reserva

**Data:** 2026-10-13  
**Status:** Accepted

## Contexto

O primeiro passo de toda mensagem do chat é classificar a intenção. Com um modelo de texto
isso custa 1,4 s no p50 e 2,9 s no p95 (Claude Haiku 5.5), antes de qualquer dado ser lido.
O Vercel AI Gateway passou a oferecer modelos de decisão (`POST /v1/evaluate`), que escolhem
entre opções fechadas e devolvem a probabilidade de cada uma. O `typesafe-ai/jev` decide em
~0,35 s, cobra só a entrada (US$ 0,042 por milhão) e acertou os 47 casos dos evals.

Ele não escreve texto: extração de campos e resposta continuam precisando de um modelo de
texto. E é um fornecedor novo, com uma API nova.

Opções avaliadas para a dúvida do modelo de decisão:

- **Fallback do próprio gateway** (`providerOptions.gateway.models` com condição de
  confiança): uma requisição só, mas a regra fica fora do código e dos evals.
- **Fallback no código**: a mesma regra roda em produção e nos evals, testável sem rede.

## Decisão

1. **Modelo de decisão opcional, por função:** `AI_DECISAO_<TIPO>` (hoje só
   `AI_DECISAO_AI_CHAT`), formato `gateway:<fornecedor>/<modelo>`.
2. **O modelo de texto é a reserva, no código** (`ai-chat/roteamento.ts`): falha, timeout de
   2 s, confiança abaixo de 0,7 numa resposta que importa ou opção fora do schema levam à
   classificação de sempre. O chat nunca para por causa do modelo de decisão.
3. **Evals usam o mesmo caminho** (`classificarIntencao`) e mostram quantos casos o modelo de
   decisão resolveu sozinho. Mudar o limiar ou as descrições das opções passa pelos evals
   (ADR 0048).
4. **Um débito por turno**, com o modelo de texto como `model`: os tokens do modelo de decisão
   entram no débito em tokens do cliente; o custo estimado fica um pouco acima do real,
   porque o Jev é mais barato que o modelo de texto.

## Consequências

- A resposta começa ~1 s antes em ~92% das mensagens; nas demais, o roteamento leva ~0,35 s a
  mais que antes.
- TypeSafe AI vira subprocessador quando a variável é ligada (`docs/legal/SUBPROCESSADORES.md`).
- A métrica `ai.roteamento` (via, motivo) mostra no Sentry quanto cai na reserva; se passar de
  ~15%, rever as descrições das opções ou o limiar com os evals.
- Retenção zero por requisição (`zeroDataRetention`) existe no gateway, mas exige o plano Pro
  da Vercel.
