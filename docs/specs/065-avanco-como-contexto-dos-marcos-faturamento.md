# SPEC: Avanço como contexto dos marcos de faturamento

**Data:** 2026-08-26
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** obras
**Estende:** [015 — Obras MVP](015-obras-mvp.md)

<!-- Origem: docs/strategy/DECISOES.md, entrada de 26/08 à noite (gate D2
fechado: orçamento continua por disciplina/etapa). Esta spec é a versão
"Opção A" do item OBR-3 do Mapa de Melhorias — indicador de contexto, não
motor automático de cobrança (essa segunda opção exigiria catálogo de
composição com preço unitário, que a decisão do gate fechou). -->

## Problema

Ao decidir se já é hora de marcar um marco de faturamento como faturado, o
sócio hoje precisa lembrar de cabeça (ou abrir a aba Cronograma) o quanto da
obra já avançou. O avanço já é calculado e mostrado em outro card da mesma
tela ("Avanço"), mas nada liga essa informação à lista de marcos ao lado.

## Objetivo

O card "Marcos de faturamento" (aba Visão da obra) passa a mostrar, junto ao
título, o avanço atual da obra ("68% concluída"), como contexto pra decidir.
Depois desta feature, o sócio vê no mesmo olhar "quanto a obra andou" e
"quais cobranças estão pendentes", sem trocar de aba.

**Fora de escopo (decisão explícita, não corte por prazo):**

- **Avanço por marco individual.** `marcos_faturamento.disciplina` é um campo
  de texto livre, sem vínculo com etapa/tarefa do cronograma — não existe
  como calcular "quanto da entrega estrutural está pronta" separado do
  avanço geral da obra. Mostrar um número fingindo essa precisão seria pior
  que não mostrar nada.
- **Gerar ou ajustar marco automaticamente a partir de medição.** Essa era a
  versão "T2B" do item (medição vira cobrança sozinha); fechada junto com o
  gate D2 — depende de catálogo de composição com preço unitário, que a
  decisão de 26/08 descartou.
- **Alertar/destacar quando avanço > X% e marco ainda pendente.** Um
  indicador de contexto não é uma régua de cobrança; o sócio decide, o
  sistema não empurra.

## Requisitos

Funcionais:

1. O card "Marcos de faturamento" (só aparece quando a obra tem
   `projeto_id`, comportamento atual preservado) mostra, abaixo do título,
   uma linha "Obra X% concluída" — o mesmo número já calculado e mostrado no
   card "Avanço" da mesma aba (`obra.avanco`).
2. Essa linha só aparece quando há marcos pra decidir sobre (a lista de
   marcos não está vazia); sem marcos, o card já mostra "O projeto não tem
   marcos cadastrados" e a linha de avanço não teria pra que servir.

Não-funcionais:

- **Nenhum dado novo.** `obra.avanco` já vem calculado no mesmo hook
  (`useObra`) que a página já usa; zero query nova, zero tabela nova.

## Critérios de aceite

- [x] Dada uma obra com projeto vinculado e marcos cadastrados, quando abro a
      aba Visão, então vejo "Obra X% concluída" junto ao título do card de
      marcos. Verificado no browser (dev local) em duas obras diferentes
      ("Edifício Horizonte" e "Reforma Parque das Águas"), ambas com marcos.
- [ ] Dada uma obra sem projeto vinculado, quando abro a Visão, então o card
      mostra a mensagem atual de "sem projeto" e nenhuma linha de avanço.
      _(Não verificado ao vivo — nenhuma das obras seed não tem projeto
      vinculado. O branch de código em si não foi tocado por esta mudança,
      só o branch "há marcos", então o risco é baixo, mas fica registrado
      como não observado diretamente.)_
- [ ] Dada uma obra com projeto mas sem marcos cadastrados, quando abro a
      Visão, então vejo "O projeto não tem marcos cadastrados" sem a linha
      de avanço. _(Mesmo caso acima: branch não tocado, não verificado ao
      vivo por falta de obra seed nesse estado.)_
- [x] `npm run test:run` e `npm run typecheck` verdes. 727 testes, 0 erros
      de tipo, lint limpo.

## Dados e contratos

Nenhum. Muda só `ObraTimelineTab.tsx`: o card de marcos passa a receber
`obra.avanco` (já disponível via a prop `obra: ObraResumo` que o componente
já recebe) e renderiza a linha condicionalmente.

## Plano de implementação

1. `ObraTimelineTab.tsx`: adicionar a linha de avanço no card de marcos.
2. `npm run typecheck` + `npm run test:run` (sem teste novo dedicado — é
   JSX condicional puro, sem lógica nova a testar isoladamente; os critérios
   de aceite são verificados no browser).
3. Verificar no browser (dev local): obra com marcos e avanço > 0%, obra sem
   projeto, obra com projeto sem marcos.

## Decisões e riscos

- **Decisão (26/08, DECISOES.md):** fecha o gate D2 e, com ele, a versão
  "cobrança automática por medição" deste item. Esta spec é deliberadamente
  pequena — o item maior (trilha C) está descartado, não adiado.
- **Risco:** o avanço é da obra inteira, não do marco. Se o sócio ler "68%"
  e assumir que é sobre o marco específico que está olhando, pode decidir
  errado. Mitigação: o rótulo diz "Obra X% concluída", não "marco X%
  concluído" — a UI não pode implicar uma precisão que não existe.
- Nenhuma decisão de arquitetura transversal; não abre ADR.
