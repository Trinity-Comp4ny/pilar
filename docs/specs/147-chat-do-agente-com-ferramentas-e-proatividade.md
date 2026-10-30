# SPEC: Chat do agente: consulta com ferramentas, resposta com registros e proatividade

**Data:** 2026-10-30
**Status:** Em implementação (fase A pronta; fases B a D aguardam protótipo, BEZ-512 e BEZ-513)
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** agentes
**ClickUp:** BEZ-508 (pai), BEZ-512, BEZ-513

## Problema

O chat de /agentes é pouco útil hoje. Evidências:

1. **O agente de projetos respondia com lista vazia.** `coletarProjetos` lê `valor_contrato` direto da tabela
   `projetos`, e essa coluna tem SELECT revogado para `authenticated` desde a ADR 0034. A consulta inteira falhava, o
   código fazia `data ?? []`, e o agente dizia "0 projetos". O "projeto em foco" falhava do mesmo jeito, em silêncio.
2. **Só totais.** Cada agente de domínio despeja um agregado (soma a receber, contagem de projetos). A pergunta
   "qual parcela vence esta semana?" não tem como ser respondida com a parcela.
3. **Reativo.** Só responde quando perguntam; não traz o que mudou nem o que está atrasado.
4. **Sem caminho até o registro.** A resposta cita nomes, sem link para abrir o projeto ou a obra.
5. **Pouco uso:** 8 consultas em 60 dias em produção (3 projetos, 3 gerais, 1 comercial, 1 obras).

## Objetivo

O agente responde com os registros reais (a parcela, o projeto, a tarefa), cada um com link, em qualquer área e
cruzando áreas, sabe o que está pendente sem ser perguntado e leva da resposta até a ação, com confirmação humana.

**Fora de escopo:** escrita sem confirmação; novo modelo de IA; canal externo (WhatsApp) no primeiro ciclo; regras
configuráveis por empresa (vêm depois, a partir do volume real da SPEC 146).

## Requisitos

Fase A (nesta entrega, sem mudar layout):

1. **Investigação antes da resposta.** O planejador escolhe até 3 consultas por rodada, em até 3 rodadas, entre
   ferramentas de leitura fechadas: `listar_pendencias`, `listar_recebimentos`, `listar_pagamentos`,
   `listar_projetos`, `detalhar_projeto`, `listar_tarefas_obra`, `listar_leads`, `resumo_da_area`.
2. **Argumento validado por schema.** Ferramenta inexistente, argumento inválido, chamada repetida e erro de leitura
   viram observação para o planejador; nunca derrubam a conversa. No máximo 25 linhas por chamada, com `total` e
   `mostrando` para o agente dizer "mostrando 25 de 40".
3. **Toda leitura pela RLS do usuário.** Quem não vê dinheiro recebe linhas sem valor e a resposta diz isso; marcos,
   parcelas e orçamento voltam vazios para quem não pode.
4. **Fallback.** Se o planejamento falhar ou toda consulta der erro, usa os coletores agregados de antes.
   `AI_CHAT_FERRAMENTAS=0` desliga a investigação.
5. **Resposta com registro.** Cada item citado leva link em markdown (`[Parcela 2 do Projeto X](/projetos/abc)`) que
   navega dentro do app. Lista vem do mais urgente, com prazo ou dias de atraso. Item com `acao_sugerida` fecha com
   uma frase oferecendo o próximo passo.
6. **Conserto do agente de projetos e do projeto em foco** (leitura por `projetos_safe`).
7. **Rastro.** Cada ferramenta rodada entra em `agent_actions` (args e total), e os tokens do planejamento entram no
   débito do mesmo run.

Fase B (BEZ-513, depende de protótipo):

8. **Briefing ao abrir.** O chat abre com o resumo do que importa hoje (urgentes da SPEC 146 e o que mudou desde a
   última visita), não com tela em branco.
9. **Perguntas sugeridas que vêm do dado.** "3 parcelas venceram esta semana. Quer ver?" no lugar de exemplos
   genéricos.
10. **Resolver com o agente.** Botão na pendência abre o chat já com o dado e a operação pronta no card de
    confirmação (marcar recebido, marcar pago, preparar aditivo).

Fase C:

11. **Ação em lote com confirmação:** "marque as 3 parcelas do Projeto X como recebidas" gera um card com as três.
12. **Resumo diário das urgentes** por e-mail (reaproveita `notificacoes-email-cron`) e, depois, WhatsApp.

Fase D:

13. **Regras do usuário em linguagem natural** ("me avise quando uma parcela passar de 5 dias") viram detector
    parametrizado na SPEC 146, nunca texto livre executado.
14. **Memória de preferências** (formato de resposta, área de foco) por usuário.

Não funcionais:

- **Segurança:** o planejador só nomeia ferramenta e argumento; código valida, executa e limita. Texto do usuário e
  do histórico entra sanitizado e rotulado como dado (já era assim). Nenhuma escrita nas ferramentas.
- **Custo e latência:** planejamento com modelo sem raciocínio (`semRaciocinio`), 1 retry; saudação e pergunta fora do
  escopo respondem sem consultar. Tokens do planejamento debitados no mesmo run.
- **Qualidade:** conjunto de perguntas com resposta esperada em `ai-chat/evals` (a ampliar na fase B).

## Critérios de aceite

- [x] Dado um perfil sem acesso a dinheiro, quando pergunta pelos projetos, então vê os projetos (sem valor) e a
      resposta diz que o valor não está disponível para o perfil. Antes: "0 projetos".
- [x] Dado o planejador pedindo ferramenta inexistente ou argumento inválido, então a conversa segue com o erro como
      observação (teste `investigar.test.ts`).
- [x] Dado planejador que nunca encerra, então para em 3 rodadas.
- [x] Dada chamada repetida, então executa uma vez e encerra.
- [x] Todas as ferramentas rodam contra o schema real e a RLS (smoke local com `dev@local.test` e `user@local.test`).
- [x] Link de registro na resposta navega dentro do app; link externo abre em outra aba; `javascript:` não vira link.
- [ ] "Qual parcela vence esta semana?" lista as parcelas com valor, data, projeto e link (verificação ao vivo no
      staging após o deploy da function).
- [ ] Briefing ao abrir e "Resolver com o agente" (fase B, depois do protótipo).

## Dados e contratos

- Sem migration própria: usa `agente_pendencias` e `agente_pendencias_atualizar()` da SPEC 146.
- Edge function `ai-chat`: novos módulos `ferramentas.ts`, `investigar.ts`, `preparar.ts`. Resposta SSE e contrato com
  o front inalterados; `meta.ferramentas` lista as consultas usadas.
- Env: `AI_CHAT_FERRAMENTAS=0` desliga (padrão ligado).

## Plano de implementação

1. **Fase A (esta PR):** ferramentas, laço de investigação, fallback, regras de resposta, links internos, conserto de
   `projetos`, testes unitários e smoke no banco local.
2. **Verificação no staging** com perguntas reais antes do release: recebíveis da semana, projetos atrasados, tarefas
   da obra, "o que preciso resolver hoje?".
3. **Fase B:** protótipo (briefing, perguntas sugeridas, botão Resolver) no Claude Design, aprovação, código.
4. **Fases C e D** conforme o uso da fase B.

## Decisões e riscos

- **Planejador em duas etapas (plano e resposta) em vez de function calling nativo:** reaproveita
  `callGeminiStructured` (schema, retry, débito de tokens, telemetria) e o streaming da resposta; troca possível
  depois sem mudar o contrato.
- **Latência:** soma 1 a 3 chamadas curtas antes do streaming. Medir no staging; se passar de ~4 s no p50, juntar o
  roteamento e o planejamento numa única chamada.
- **Dado de valor para perfil sem acesso:** a resposta precisa dizer que não tem acesso, e não omitir. Coberto pelo
  prompt; vale incluir caso no eval.
- **Protótipo:** pendente (BEZ-513). Sem protótipo aprovado não há código de tela das fases B em diante.
