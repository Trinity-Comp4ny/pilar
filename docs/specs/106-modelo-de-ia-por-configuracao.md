# SPEC: Modelo de IA por configuração (Gemini direto ou gateway)

**Data:** 2026-10-09  
**Status:** Em implementação  
**Autor:** Matheus Rezende  
**Módulo:** IA (transversal)

## Problema

Toda chamada de IA fala direto com a API do Gemini (formato, URL, modo JSON, streaming e
contagem de tokens do Google). Trocar de modelo ou de fornecedor exige mexer no código, e
não há como comparar modelos com o mesmo código de produção.

## Objetivo

Escolher o modelo por configuração, por função, sem mudar o código das funções: Gemini
direto (como hoje) ou qualquer modelo do Vercel AI Gateway (OpenAI, Anthropic, Google e
outros) no formato compatível com OpenAI. E comparar candidatos com os evals do ai-chat.

**Fora de escopo:** trocar o modelo de produção (decisão depois da comparação), fallback
automático entre provedores, Bedrock.

## Requisitos

1. Variável `AI_MODELO` (padrão de todas as funções) e `AI_MODELO_<TIPO>` (por função, ex.
   `AI_MODELO_AI_CHAT`), no formato `gemini:<modelo>` ou `gateway:<fornecedor>/<modelo>`.
   Sem variável: `gemini:gemini-2.5-flash`, comportamento de hoje.
2. Gateway: `AI_GATEWAY_API_KEY`, endpoint `https://ai-gateway.vercel.sh/v1`, modo JSON,
   streaming e contagem de tokens no formato OpenAI.
3. Arquivos: imagem e PDF vão no formato do gateway. Áudio (RDO por voz) só no Gemini
   direto: com outro modelo configurado para áudio, a chamada falha com mensagem clara.
4. O débito de tokens e o rastreio (agent_runs, Sentry) registram o modelo realmente usado.
5. Os evals do ai-chat rodam com qualquer modelo configurado e mostram o custo estimado.

## Critérios de aceite

- [ ] Deno: leitura da configuração, montagem da requisição e leitura da resposta do
      gateway (texto, JSON com cerca de código, tokens), recusa de áudio fora do Gemini.
- [ ] Sem nenhuma variável nova, a chamada ao Gemini é a mesma de hoje.
- [ ] Evals rodados em pelo menos 5 modelos, com tabela de acerto, latência e custo.
