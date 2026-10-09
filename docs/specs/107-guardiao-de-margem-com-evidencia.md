# SPEC 107: Guardião de margem com evidência

**Data:** 2026-10-09  
**Status:** Em implementação  
**Autor:** Matheus Rezende  
**Módulo:** projetos | financeiro

Continuação da [SPEC 081](./081-guardiao-de-margem-aditivo-preparado.md). Decisão transversal em
[ADR 0050](../architecture/adr/0050-agente-que-grava-rascunho-cita-evidencia.md).

## Problema

O rascunho de aditivo que o guardião prepara não vem do dado do projeto. O modelo recebe só o nome
do projeto e dois números (orçado e gasto) e devolve itens com disciplina, horas e custo escolhidos
por ele. O sócio que abre o rascunho vê itens plausíveis que nenhuma despesa sustenta.

Ao aprovar, o problema vira número no banco. `handle_escopo_aprovado()` soma cada item em
`projeto_orcamento_fases`, e ali `custo_estimado = horas_estimadas × custo_hora`. Então:

- Numa disciplina que já existe, o orçamento cresce `horas do item × custo_hora da disciplina`, não
  o custo do item. Quem decide quanto o orçamento sobe são as horas inventadas.
- Com horas 0 (o default do schema), o orçamento não sobe. O projeto continua estourado e o
  guardião prepara outro aditivo no dia seguinte.
- Disciplina inventada ("Estrutural" num escritório que usa "Estruturas") vira uma fase nova no
  orçamento. Disciplina vazia quebra a aprovação (`disciplina` é `NOT NULL` na fase).

## Objetivo

Todo item do rascunho cita as despesas que o justificam, cai numa disciplina que já está no
orçamento do projeto, e os valores (custo, horas, valor do aditivo) são calculados em código a
partir da evidência. Aprovado, o rascunho fecha exatamente a diferença entre gasto e orçado.

**Fora de escopo:** mudar o gatilho `handle_escopo_aprovado()`, mudar a regra de quando o guardião
dispara (`projetos_com_escopo_estourado()`), mudar a tela da aba Escopo, mostrar as despesas
citadas na tela (fica no `agent_runs.result` por enquanto).

## Requisitos

1. Para cada projeto estourado, o cron carrega a evidência: as fases de
   `projeto_orcamento_fases` (disciplina, custo estimado, custo/hora) e as despesas do projeto que
   entram na conta do estouro (mesmo filtro da RPC: não deletadas, status `Pago` ou `Pendente`).
2. O prompt leva no máximo 40 despesas, as de maior valor, cada uma com uma referência curta
   (`D1`, `D2`...), data, descrição, categoria, fornecedor e valor. As que ficam de fora entram como
   uma linha de resumo (quantidade e soma).
3. O modelo devolve, por item, só descrição, disciplina e as referências das despesas que o
   sustentam. Não devolve custo nem horas.
4. `disciplina` precisa ser um nome do orçamento do projeto (comparação sem diferenciar maiúscula e
   espaço nas pontas). Fora disso o schema rejeita e o modelo tenta de novo com o erro.
5. Depois da resposta, o código:
   - descarta referência que não está na lista enviada e referência já citada em outro item;
   - descarta item que ficou sem nenhuma referência válida;
   - distribui a diferença (gasto menos orçado) entre os itens, proporcional à soma das despesas
     citadas por cada um, em centavos, com o resto no item de maior peso. A soma dos itens é
     exatamente a diferença;
   - calcula as horas de cada item como `custo / custo_hora da disciplina`, arredondado para cima
     em centésimos, para que a aprovação suba o orçamento pelo menos o custo do item. Disciplina com
     `custo_hora` 0 recebe 0 horas;
   - limita a confiança a 0,5 quando descartou alguma referência ou item;
   - calcula `valor_aditivo = custo total × 1,3`, a mesma margem do gatilho de aprovação.
6. Se nenhum item sobra, o cron não cria rascunho e conta o projeto como falha (Sentry + heartbeat),
   igual a uma resposta inválida do modelo hoje.
7. `agent_runs` guarda a sugestão crua do modelo, os itens finais com os ids das despesas citadas,
   os reparos feitos e quantas despesas foram e não foram para o prompt.
8. Texto de despesa é dado, nunca ordem: o prompt diz isso, e o valor final não depende do texto
   (vem das despesas citadas e da diferença).

Não-funcionais:

- **Multi-tenant:** as consultas de evidência filtram por `projeto_id` do projeto estourado, que já
  vem com `empresa_id` da RPC. Cron roda com service_role, como antes.
- **Custo:** prompt maior (até 40 linhas de despesa). Na faixa de centavos por projeto estourado,
  uma vez por dia por projeto, só enquanto não houver rascunho em aberto.

## Critérios de aceite

- [ ] Dado um item que cita `D1` e `D9` e só `D1` existe, então o item fica só com `D1` e a
      confiança final é no máximo 0,5.
- [ ] Dado dois itens citando `D2`, então só o primeiro fica com `D2`.
- [ ] Dado um item sem nenhuma referência válida, então ele é descartado; se era o único, não há
      rascunho.
- [ ] Dado diferença de R$ 1.000,00 e dois itens com despesas citadas de R$ 300 e R$ 100, então os
      custos são R$ 750,00 e R$ 250,00 e a soma é exatamente R$ 1.000,00.
- [ ] Dado diferença com centavos que não divide exato, então a soma dos itens bate até o centavo.
- [ ] Dado custo de item R$ 250,00 e `custo_hora` da disciplina R$ 120,00, então as horas são 2,09.
- [ ] Dado disciplina "estruturas " e orçamento com "Estruturas", então o item grava "Estruturas".
- [ ] Dado disciplina fora do orçamento, então o schema rejeita.
- [ ] Dado `valor_aditivo`, então é o custo total × 1,3 arredondado em centavos.
- [ ] Rodando contra o modelo real (`evals/rodar.ts`), os casos passam: referências válidas,
      disciplinas do orçamento, e uma descrição de despesa com instrução injetada não muda o total.

## Dados e contratos

- Sem migration. Lê `projeto_orcamento_fases`, `despesas`, `categorias_financeiras` e
  `fornecedores` com o client admin que o cron já usa.
- `_shared/agent-schemas.ts`: `AditivoSugeridoSchema` estático vira
  `montarAditivoSugeridoSchema(disciplinas)`, com itens `{ descricao, disciplina, despesas[] }`.
- `escopo_itens` continua recebendo `descricao, disciplina, horas, custo`, agora calculados.

## Plano de implementação

1. `guardiao-margem-cron/aditivo.ts`: funções puras (montar mensagem, aterrar a sugestão,
   distribuir a diferença, calcular horas). Teste Deno de cada critério acima.
2. `agent-schemas.ts`: schema montado por projeto.
3. `index.ts`: carregar evidência, chamar o modelo com o prompt novo, gravar o resultado aterrado.
4. `guardiao-margem-cron/evals/rodar.ts`: casos sintéticos contra o modelo real, sem banco.

## Decisões e riscos

- **Por que o modelo não escolhe o valor.** O estouro já é um número conhecido (gasto menos orçado).
  Pedir ao modelo para reproduzi-lo só abre espaço para erro; o que ele agrega é agrupar e explicar.
- **Distribuição proporcional é uma aproximação.** Uma despesa citada pode estar parte dentro e
  parte fora do orçamento. O sócio revisa o rascunho antes de aprovar; o total, que é o que muda o
  contrato, está certo.
- **Disciplina com `custo_hora` 0.** O item recebe 0 horas e a aprovação não sobe o orçamento
  dessa fase (o gatilho calcula `custo_estimado` por horas). Hoje isso já acontece com qualquer
  item de 0 horas; corrigir pede mexer no gatilho, fora desta spec.
- **Projeto com mais de 40 despesas.** O modelo vê as maiores e um resumo do resto. O total não
  depende disso; só a explicação.
