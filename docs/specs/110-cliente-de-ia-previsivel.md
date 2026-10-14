# SPEC: Cliente de IA previsível (temperatura, raciocínio, erro tipado, proveniência)

**Data:** 2026-10-13  
**Status:** Em implementação  
**Autor:** Matheus Rezende  
**Módulo:** IA (todas as edge functions `ai-*`, guardião de margem)

## Problema

Quatro pontos do `_shared/ai-client.ts` deixavam a IA menos previsível do que precisa ser
para mexer em dinheiro de escritório:

- `temperature: 0.7` em toda chamada, inclusive classificar intenção e extrair valor. A
  mesma frase podia sair com decisão diferente (a ADR 0048 viu oscilação de 1 em 3).
- No Gemini 2.5 o raciocínio conta dentro do `maxOutputTokens`. Sem teto, ele pode comer o
  limite e o JSON sair cortado, o que vira "JSON inválido" e gasta o retry de schema. O
  motivo de parada (`finishReason`) não era lido.
- Qualquer falha virava "Erro ao processar a conversa" no chat, e as outras três funções
  `ai-*` devolviam `err.message` cru ao usuário (`Gemini API error (500): {...}`). Um 429 ou
  503 passageiro do provedor derrubava o pedido na primeira tentativa.
- O `agent_runs` gravava o modelo, mas não qual versão do código ou do prompt gerou a
  saída. Não dava para ligar uma execução ruim aos evals daquela versão.

## Objetivo

Mesma entrada dá a mesma decisão, JSON nunca sai cortado por raciocínio, falha passageira
do provedor se resolve sozinha, o usuário vê uma mensagem que diz o que houve, e cada run
aponta o commit (e o prompt) que o gerou.

**Fora de escopo:** cobrar raciocínio como saída (#561); motivo de parada e erro tipado no
adaptador do gateway (`llm.ts`, só classificado pelo texto do erro); proveniência no
guardião de margem (entra junto do #558, que reescreve aquele insert).

## Requisitos

1. Chamada JSON (`callGeminiStructured`, `callGemini`) usa temperatura 0. Texto livre (a
   resposta da consulta em streaming) mantém 0.7.
2. Em modelo `gemini-2.5-*`, o raciocínio tem teto de 1/4 do `maxOutputTokens`
   (`thinkingConfig.thinkingBudget`). Outros modelos usam o padrão deles.
3. O motivo de parada vai para o span (`gen_ai.response.finish_reasons`). Em JSON,
   `MAX_TOKENS` vira erro `saida_truncada` e filtro do provedor vira `bloqueada`, sem gastar
   o retry de schema. Em texto livre, `MAX_TOKENS` só conta na métrica `ai.saida_truncada`.
4. Falha de IA tem tipo fechado (`_shared/ai-erros.ts`): `limite_do_provedor`,
   `provedor_indisponivel`, `tempo_esgotado`, `saida_truncada`, `saida_invalida`,
   `bloqueada`, `configuracao`, `desconhecido`. Cada tipo tem status HTTP e mensagem própria.
5. 429, 5xx e erro de rede do provedor ganham até 2 novas tentativas (espera de ~0,6 s e
   ~1,8 s com jitter), só se sobrar 3 s até o prazo. Vale para Gemini direto, gateway e a
   abertura do streaming.
6. `ai-chat`, `ai-import-financeiro`, `ai-cotacao-import` e `ai-rdo-voz` respondem falha
   com `{ error, tipo }` e o status do tipo; o texto bruto fica só no log da função.
   `configuracao` e `desconhecido` vão pro Sentry.
7. O chat mostra a mensagem do tipo. No streaming, falha tipada não cai no fallback
   buffered (que chamaria o modelo de novo para falhar igual).
8. `agent_runs` ganha `release` (commit do deploy) e `prompt_hash` (16 hex do SHA-256 do
   system prompt), preenchidos por `recordAgentRun` e pelos inserts do `ai-chat`.

## Critérios de aceite

- [x] JSON em gemini-2.5-flash com limite 4096: temperatura 0, `thinkingBudget` 1024
      (`ai-geracao.test.ts`).
- [x] Texto livre: 0.7, sem `responseMimeType` (`ai-geracao.test.ts`).
- [x] `MAX_TOKENS` vira `saida_truncada`; `SAFETY` vira `bloqueada`; `STOP` passa.
- [x] 429 seguido de sucesso devolve o resultado; 5xx persistente para em 3 tentativas;
      timeout, truncada, configuração e bloqueada não repetem; sem tempo até o prazo, não
      repete (`ai-erros.test.ts`).
- [x] Corpo de erro nunca traz o texto bruto do provedor (`ai-erros.test.ts`).
- [x] Chat usa a mensagem do tipo, sem passar por cima de timeout e 402 (`erros.test.ts`).
- [x] Hash do prompt estável e sensível a mudança; release nulo sem `RELEASE_SHA`
      (`ai-proveniencia.test.ts`).
- [x] Evals do ai-chat com a configuração nova: intenção e campos sem queda.

## Resultado dos evals (gemini-2.5-flash, 47 casos, 2 rodadas cada)

| Config                         | Intenção | Campos | p95         | Tokens de saída iguais entre rodadas |
| ------------------------------ | -------- | ------ | ----------- | ------------------------------------ |
| Antes (0.7, raciocínio livre)  | 100%     | 100%   | 4,5 a 5,4 s | 2 de 47 casos                        |
| Depois (0, teto de raciocínio) | 100%     | 100%   | 4,9 s       | 27 de 47 casos                       |

A acurácia já estava no teto; o ganho é estabilidade (diferença média de tokens de saída
entre rodadas caiu de 88 para 40 por caso).

## Dados e contratos

- Migration `20261020120000_agent_runs_proveniencia.sql`: `agent_runs.release text`,
  `agent_runs.prompt_hash text`, nulas.
- Erro das funções `ai-*`: `{ "error": string, "tipo": TipoErroIa }` com status 422, 500,
  502, 503 ou 504. 401/402/429 do próprio Pilar continuam como antes.

## Decisões

- [ADR 0054](../architecture/adr/0054-erro-de-ia-tem-tipo-fechado.md): erro de IA tem tipo fechado.
- [ADR 0048](../architecture/adr/0048-mudanca-de-prompt-ou-modelo-passa-por-eval.md): a
  mudança de temperatura e raciocínio passou pelos evals.
