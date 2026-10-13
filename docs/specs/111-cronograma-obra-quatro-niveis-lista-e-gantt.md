# SPEC: Cronograma da obra em quatro níveis (fase, etapa, serviço, tarefa) com lista e Gantt

**Data:** 2026-10-13
**Status:** Draft
**Autor:** Matheus Rezende
**Módulo:** obras
**Estende:** [027: cronograma da obra em dois níveis](027-cronograma-obra-dois-niveis.md), [020: cronograma da obra](020-cronograma-da-obra.md)

## Problema

O cronograma da obra hoje tem dois níveis (etapa e tarefa) e só existe como Gantt.
Quem planeja uma obra pensa em cascata: **fase** (ex.: estrutura), **etapa**
(fundação), **serviço** (concretagem de sapatas) e **tarefa** (o que alguém
executa e marca como feito). Sem os níveis do meio, o usuário espreme tudo em
"etapa" e perde a leitura. Sem uma visão de lista, montar o cronograma é difícil:
criar e editar acontece em barras pequenas e num modal que, até 13/10, nem
mostrava a data que acabou de ser salva. E a tarefa da obra, que já mora na
tabela `tarefas`, não aparece para o responsável no filtro "Minhas" da gestão de
tarefas, então a conexão obra → execução não fecha.

## Objetivo

Na aba Cronograma da obra o usuário monta e acompanha a obra em **quatro
níveis** (fase → etapa → serviço → tarefa), alternando entre **Lista** (padrão,
onde se cria, edita e marca como feito) e **Gantt** (onde se lê e ajusta prazo).
Cada tarefa criada ali aparece na **gestão de tarefas** de quem é responsável,
com o caminho da obra visível.

**Fora de escopo:**

- Dependência entre itens (seta "só começa depois de").
- Datas realizadas (início/fim real) e curva-S por serviço.
- Templates de cronograma (fases/etapas padrão por tipo de obra).
- Importar cronograma de MS Project ou planilha.
- Reordenar por arrastar na lista (ordem por botão sobe/desce basta no MVP).

## Requisitos

1. A hierarquia é fixa: fase contém etapas; etapa contém serviços; serviço
   contém tarefas. Não existe etapa fora de fase nem serviço fora de etapa.
2. A aba Cronograma tem um seletor `Lista | Gantt`. Lista é o padrão. A escolha
   persiste por usuário (localStorage).
3. **Lista:** linhas indentadas por nível, recolhíveis, agrupadas por fase. Cada
   linha mostra nome, período (início → fim), progresso (% de tarefas
   concluídas abaixo dela) e estado (em andamento, atrasada, a iniciar,
   concluída). Na linha de tarefa: checkbox de concluir, responsável, etiquetas
   e prazo.
4. Na lista, cada nível tem um "+" para criar o filho direto (fase → "+ etapa",
   etapa → "+ serviço", serviço → "+ tarefa"), inline, com Enter para criar e
   seguir criando. O filho nasce herdando o período do pai.
5. Edição de nome e datas é inline na própria linha (DatePicker), sem modal.
   O modal de detalhe fica só para a tarefa (descrição, responsáveis, clima).
6. Período de fase, etapa e serviço: data própria opcional; sem data própria, a
   barra-resumo é a união do período dos filhos (regra do `spanFrente` atual,
   generalizada para qualquer nível).
7. **Gantt:** mesma árvore de quatro níveis, recolhível, com linha "Hoje", cor por
   estado e drag (mover/redimensionar) em todos os níveis com data própria.
8. **Checklist:** marcar a tarefa como concluída pela lista ou pelo Gantt atualiza
   o progresso de serviço, etapa e fase na hora. Etiquetas usam o campo
   `tarefas.labels` que a gestão de tarefas já usa.
9. **Gestão de tarefas:** tarefa criada na obra entra na ponte
   `tarefa_responsaveis` (aparece em "Minhas" do responsável) e mostra o caminho
   `Obra · Fase › Etapa › Serviço` no card. Concluir lá reflete no cronograma.
10. Excluir um nível pede confirmação (`ConfirmDialog`) informando quantos itens
    e tarefas estão abaixo. Ver decisão D3 sobre o que acontece com as tarefas.
11. Cotações, estoque, conta e RDO, que hoje apontam para `obra_frente` (etapa),
    continuam listando só etapas nos seus seletores.

Não-funcionais:

- **Segurança / RLS:** sem tabela nova se D1 = A; as policies de `obra_frente` e
  `tarefas` (por `empresa_id`) já cobrem. Trigger de validação da hierarquia
  `SECURITY INVOKER`. Se D1 = B, tabelas novas nascem com RLS por empresa.
- **Performance:** a árvore inteira vem em 2 queries (nós + tarefas da obra),
  montada no cliente. Obra grande de referência: 6 fases, 40 etapas, 150
  serviços, 600 tarefas; lista e Gantt renderizam sem travar (virtualizar se
  passar disso).
- **Multi-tenant:** trigger garante que pai e filho são da mesma obra e empresa.

## Critérios de aceite

- [ ] Dado uma obra vazia, quando crio a fase "Estrutura", a etapa "Fundação",
      o serviço "Sapatas" e a tarefa "Concretar S1" pela lista, então os quatro
      aparecem indentados na lista e no Gantt, sem abrir modal.
- [ ] Dado um serviço com 4 tarefas, quando marco 1 como concluída na lista,
      então serviço, etapa e fase passam a mostrar 25% (ou a fração equivalente
      no nível de cima) sem recarregar a página.
- [ ] Dado uma etapa sem data própria e dois serviços datados (01/11 a 10/11 e
      05/11 a 20/11), então a barra da etapa vai de 01/11 a 20/11.
- [ ] Dado que edito o início de uma etapa na lista, quando troco para o Gantt,
      então a barra começa na data nova; e vice-versa (drag no Gantt, data nova
      na lista).
- [ ] Dado uma tarefa da obra com responsável Ana, quando Ana abre a gestão de
      tarefas com o filtro "Minhas", então a tarefa está lá com o caminho da obra.
- [ ] Dado que Ana conclui a tarefa na gestão de tarefas, quando abro o
      cronograma da obra, então ela aparece concluída e o progresso subiu.
- [ ] Tentar criar serviço direto sob fase (via API) falha com erro claro do
      trigger.
- [ ] Seletores de etapa em cotação, estoque, conta e RDO não listam fases nem
      serviços.
- [ ] Obra existente antes da migration abre sem perder etapa nem tarefa (ver D2).
- [ ] Mobile (390px): lista usável (nome + checkbox + prazo); Gantt com coluna
      fixa estreita como hoje.

## Dados e contratos

Recomendação para D1 (opção A, uma árvore só):

- `obra_frente` ganha `nivel text NOT NULL DEFAULT 'etapa' CHECK (nivel IN
('fase','etapa','servico'))` e `parent_id uuid REFERENCES obra_frente(id)`.
- Trigger `obra_frente_valida_hierarquia`: fase sem pai; etapa com pai fase;
  serviço com pai etapa; pai da mesma `obra_id` e `empresa_id`.
- Índice `(obra_id, parent_id, ordem)`.
- `tarefas.obra_frente_id` passa a apontar para serviço nas tarefas novas
  (trigger valida nível conforme D3).
- Trigger em `tarefas`: ao inserir/atualizar `responsavel_id` de tarefa de obra,
  garante a linha em `tarefa_responsaveis` (fecha o furo do filtro "Minhas").
- Hooks: `useObraFrentes` vira `useObraArvore` (nós + montagem da árvore em
  `src/lib/obras.ts`, testada). Seletores de cotação/estoque/conta/RDO filtram
  `nivel = 'etapa'`.
- `npm run gen:types` após a migration.

## Plano de implementação

1. Migration (nivel, parent_id, triggers, backfill conforme D2) + pgTAP da
   hierarquia e da ponte de responsáveis. `gen:types`.
2. `src/lib/obras.ts`: montar árvore, rollup de progresso/estado/período por
   nível, com testes (critérios 2 e 3).
3. Filtrar `nivel = 'etapa'` nos seletores de cotação, estoque, conta e RDO.
4. Visão Lista nova (`ObraCronogramaLista`), com criar/editar inline e checklist.
5. Gantt (`ObraCronogramaTab`) generalizado para N níveis sobre a mesma árvore e
   o mesmo `useGanttDrag`; seletor `Lista | Gantt`.
6. Gestão de tarefas: caminho da obra no card (`TAREFA_SELECT` + join).
7. Verificação: testes de lib e componente, pgTAP, e fluxo real no browser
   (staging) com a obra de referência.

## Decisões em aberto

- **D1. Modelo de dados.** A (recomendado): `obra_frente` vira árvore com
  `nivel` + `parent_id`. Mantém todas as FKs atuais (cotação, estoque, conta,
  RDO apontam para etapa) e o Gantt opera sobre um tipo só. B: tabelas novas
  `obra_fase` e `obra_servico`. FK mais explícita, mas quatro tipos para o Gantt,
  a lista e o drag tratarem.
- **D2. Obras existentes.** Etapas de hoje não têm fase. A (recomendado): a
  migration cria uma fase "Geral" por obra e pendura as etapas nela. B: mostrar
  um grupo "Sem fase" até o usuário mover.
- **D3. Tarefa só em serviço?** A (recomendado): tarefa nova só em serviço;
  as tarefas antigas presas direto na etapa aparecem num serviço "Geral" criado
  pela migration. B: permitir tarefa direto na etapa também (menos rígido, mais
  caso especial na UI).
- **D4. "Checklist".** A (recomendado): checkbox de concluir por tarefa +
  etiquetas (`labels`). B: além disso, sub-itens de checklist dentro da tarefa
  (tabela nova).

## Riscos

- `obra_frente` é usada por 10+ hooks/telas; esquecer o filtro `nivel = 'etapa'`
  em algum seletor mostra fase/serviço onde não devia. Mitigação: passo 3 antes
  da UI nova e grep de `obra_frente` no PR.
- Portal do cliente (spec 030) lê etapas da obra; confirmar que continua lendo só
  etapas ou passa a mostrar fases.
