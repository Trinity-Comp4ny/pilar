# ADR 0049: Modelo de IA escolhido por configuração, com o Vercel AI Gateway como porta para outros fornecedores

**Data:** 2026-10-09  
**Status:** Accepted

## Contexto

Toda chamada de IA falava direto com a API do Gemini: URL, formato, modo JSON, streaming e
contagem de tokens do Google, com o modelo fixo no código. Trocar de modelo ou comparar
fornecedores exigia reescrever o cliente. As funções, porém, já pediam a mesma coisa a um
único módulo (`_shared/ai-client.ts`): JSON validado por Zod, texto em streaming e anexos.

Opções avaliadas para falar com vários fornecedores:

- **Um adaptador por fornecedor** (OpenAI, Anthropic, Google): três formatos para manter.
- **Gateway compatível com OpenAI** (Vercel AI Gateway, OpenRouter): um formato, uma chave,
  centenas de modelos.
- **AWS Bedrock**: sem GPT nem Gemini, exige conta AWS e assinatura SigV4.

## Decisão

1. **Modelo por configuração, por função.** `AI_MODELO` (padrão) e `AI_MODELO_<TIPO>` (ex.:
   `AI_MODELO_AI_CHAT`), formato `gemini:<modelo>` ou `gateway:<fornecedor>/<modelo>`
   (`_shared/llm.ts`). Sem variável: Gemini 2.5 Flash direto, como antes.
2. **Dois caminhos:** Gemini direto (mantido, é o único que recebe áudio, usado no RDO por
   voz) e Vercel AI Gateway no formato compatível com OpenAI para todo o resto do catálogo.
   O Pilar já está na Vercel; o gateway cobra o preço do modelo, sem taxa.
3. **Débito, agent_runs e Sentry registram o modelo realmente usado** (`modeloEmUso(tipo)`).
   Modelo novo em produção precisa de preço em `ai_model_precos`.
4. **Troca de modelo em produção só com os evals** (ADR 0048) rodados no candidato.

## Consequências

- Trocar o modelo de uma função é uma variável de ambiente nas Edge Functions, sem deploy de
  código.
- Cada fornecedor novo usado em produção é um novo processador de dados: entra na lista de
  fornecedores da política de privacidade e precisa de DPA.
- Bedrock fica para quando um cliente exigir contrato AWS ou dado em região específica.
