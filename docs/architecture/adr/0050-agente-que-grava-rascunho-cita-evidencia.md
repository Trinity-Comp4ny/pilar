# ADR 0050: Agente que grava rascunho no domínio cita a evidência e não escolhe número

**Data:** 2026-10-09  
**Status:** Accepted

## Contexto

Agentes proativos do Pilar gravam rascunho direto no domínio (o guardião de margem cria aditivo em
`escopos` e `escopo_itens`). O schema Zod garante o formato da resposta, não que o conteúdo veio do
dado. O guardião recebia só dois números e devolvia itens, horas e custos escolhidos pelo modelo;
aprovado, isso virava orçamento e contrato (ver [SPEC 107](../../specs/107-guardiao-de-margem-com-evidencia.md)).

O mesmo padrão aparece em outros projetos que comparamos: no precursal-agents (Labrynth), o juiz de
prior art recebe as referências e cada citação é checada em código contra elas, descartando o que
não bate; no deep-fission-licensing, o veredito sem trecho da fonte vira "não verificável" em vez
de confirmação.

## Decisão

Todo agente que grava rascunho no domínio segue três regras:

1. **Recebe a evidência no prompt**, com uma referência curta por registro (`D1`, `D2`...).
2. **Cita a evidência**: cada item da saída aponta as referências que o sustentam. O código descarta
   referência fora da lista e item sem referência válida, e rebaixa a confiança quando descarta.
3. **Número sai do código, não do modelo**: valor, horas e totais são calculados a partir do dado e
   das referências citadas. O modelo agrupa, nomeia e explica.

Campo que aponta para cadastro existente (disciplina, fornecedor, tarefa) é validado contra a lista
enviada no schema, como o `ai-rdo-voz` já faz.

## Consequências

- O rascunho fica auditável: `agent_runs.result` guarda a sugestão crua, os ids citados e os reparos.
- Prompt maior (a evidência vai junto). Limitar a quantidade de registros e resumir o resto.
- Agente novo que gera número sem evidência para citar é sinal de que o número deveria vir de uma
  regra em código, não do modelo.
