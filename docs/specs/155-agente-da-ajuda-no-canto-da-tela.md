# SPEC: Agente da ajuda no canto da tela

**Data:** 2026-11-10
**Status:** Em implementação
**Autor:** Matheus Rezende
**Módulo:** plataforma (ajuda, agentes)
**Relacionada:** [SPEC 154](154-central-de-ajuda.md) (central de ajuda), [SPEC 147](147-chat-do-agente-com-ferramentas-e-proatividade.md) (agentes), [SPEC 112](112-feedback-no-banco-com-print-anotado.md) (feedback)

## Problema

O usuário que não acha onde fazer algo não sabe que existe central de ajuda, e o chat dos
agentes fica numa tela própria. Ideia do CEO: o agente sai da tela fixa e fica também no canto,
responde "como eu crio um lead?" com o caminho e um botão que leva à tela.

## Objetivo

De qualquer tela, em dois cliques, a pessoa pergunta como fazer algo e recebe o passo a passo
certo com o botão "Ir para <tela>"; o que a ajuda não cobre segue para os agentes ou para o
suporte, já com a pergunta, e vira pauta de artigo.

**Fora de escopo (fase 2):** responder "como faço" pelo modelo de linguagem dentro do
`ai-chat` usando os artigos como fonte (rota `geral` do roteamento da SPEC 109).

## Requisitos

1. Botão verde "Dúvidas", com a estrela dos Agentes, no canto inferior direito (computador), e
   item "Dúvidas" no menu do celular abrem um chat flutuante no canto (sem título, balões de
   mensagem, campo embaixo; Enter envia, Esc fecha). Some na tela `/agentes`, que já é a conversa.
2. Ao abrir, mostra os artigos da tela atual ("Nesta tela").
3. A pergunta em linguagem natural é respondida pela central (SPEC 154): o artigo mais próximo
   inteiro, com **Ir para <tela>** e **Abrir na central**, e até dois outros que podem ajudar.
   Não gasta tokens e não inventa caminho: o texto e a rota vêm do artigo.
4. Sem artigo, ou em "Não resolveu?": **Perguntar aos agentes** abre `/agentes` com a pergunta
   pronta; **Falar com o suporte** abre o feedback com "Dúvida: <pergunta>" (o feedback já leva
   tela, navegador e versão).
5. Pergunta sem resposta e busca da central sem resultado gravam em
   `ajuda_perguntas_sem_resposta`; o Ultra admin vê em **Lacunas da ajuda** (30 dias, agrupado,
   com vezes, escritórios e telas).

Requisitos não-funcionais:

- **RLS:** o usuário só grava a própria pergunta (`created_by = auth.uid()`), empresa vem do
  perfil por trigger; só ultra admin lê.
- **Bundle:** o painel (traz o markdown) é carregado sob demanda; o evento de abrir fica num
  módulo de poucas linhas.
- **Marca:** "agente", nunca "chatbot", "bot" ou "assistente" (brand/voice-tone.md).

## Critérios de aceite

- [x] "como eu crio um lead?" mostra o artigo de leads e o botão "Ir para Leads" (`/gestao/leads`).
- [x] Pergunta sem artigo registra a lacuna e leva aos agentes com a pergunta.
- [x] "Falar com o suporte" abre o feedback com a dúvida.
- [x] O balão não aparece em `/agentes`.
- [ ] pgTAP: usuário não grava em nome de outro nem lê a lista; ultra admin lê.

## Decisões e riscos

- **Resposta pela central, não pelo modelo, na fase 1:** custo zero de token, nenhum caminho
  inventado e resposta instantânea. O modelo entra na fase 2, com os artigos como fonte.
- **Busca em linguagem natural simples** (palavras vazias fora, raiz curta, 60% das palavras
  precisam casar): suficiente para 12 artigos; trocar por busca semântica se a lista crescer.
