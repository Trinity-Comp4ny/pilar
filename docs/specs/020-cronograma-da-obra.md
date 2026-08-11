# SPEC: Cronograma da obra (frentes na linha do tempo)

**Data:** 2026-08-11
**Status:** Em implementação
**Autor:** Matheus Rezende
**Módulo:** obras

## Problema

Dentro de uma obra o sócio organiza o trabalho por frente de serviço (fundação,
alvenaria, instalações), mas hoje a aba "Frentes" é só um checklist de pendências:
não mostra *quando* cada frente começa e termina, nem se está atrasada. Para
enxergar prazo o usuário sai do Pilar e volta pra planilha. Em Projetos ele já
tem um cronograma visual (Gantt de disciplinas); na obra, que é a fase de
execução onde o prazo aperta de verdade, ele não tem.

## Objetivo

A aba "Frentes" vira **"Cronograma"** e passa a mostrar as frentes como barras
numa linha do tempo (Gantt), cada uma com seu período e o percentual concluído,
igual ao esquema de Projetos. Depois desta feature o usuário abre a obra e
responde de bate-pronto "a alvenaria começa quando, termina quando, e está no
prazo?" sem sair da tela. O checklist de pendências não some: vira o detalhe de
cada frente.

**Fora de escopo:**
- **Visão calendário** (mês, uma célula por dia com as pendências que vencem).
  Fica para uma fase 2, possivelmente como toggle `Gantt | Calendário` na mesma
  aba. Esta spec entrega só o Gantt.
- **Curva-S / físico-financeiro** (progresso previsto × realizado sobreposto ao
  gasto da conta da obra). Depende da conta da obra (spec 016) madura; vira spec
  própria depois.
- **Arrastar a barra** para redimensionar/mover a frente (o drag que existe no
  cronograma de disciplinas). No MVP a data se edita por campo; drag é fase 2.
- **Dependências entre frentes** (seta "só começa depois que a outra acaba").
- **Datas realizadas** na frente. O MVP guarda só previsto (início/fim planejado);
  o "andamento" vem da contagem de pendências concluídas, não de datas reais.

## Requisitos

Funcionais:

1. A aba hoje chamada "Frentes" passa a se chamar **"Cronograma"** (rótulo e ícone
   de calendário), na mesma posição.
2. A frente de serviço ganha **data de início** e **data de fim** (previstas),
   ambas opcionais. Ao criar uma frente o usuário pode informá-las; numa frente
   existente pode editá-las.
3. Frentes com início **e** fim aparecem como barra numa timeline com coluna fixa
   à esquerda (nome da frente + resumo) e faixa scrollável à direita, com zoom
   `Meses | Semanas`, linha "Hoje" e botão que rola até hoje, reusando o padrão do
   cronograma de projetos.
4. Cada barra mostra o **percentual concluído** desenhado dentro dela, derivado
   das pendências da frente (tarefas concluídas ÷ total). Frente sem tarefas
   mostra 0%.
5. A cor da barra reflete o **estado derivado** da frente:
   - concluída (todas as pendências fechadas) — verde;
   - atrasada (hoje passou da data de fim e ainda há pendência aberta) — vermelha,
     com aviso;
   - em andamento (hoje entre início e fim) — azul;
   - futura (início ainda não chegou) — cinza.
6. Clicar numa frente abre o **detalhe da frente** com as pendências dela (o
   checklist atual: marcar concluída, responsável, prazo, adicionar/remover),
   preservando o comportamento de hoje.
7. Frentes **sem datas** não entram na timeline; aparecem num aviso "N frentes sem
   prazo definido" com atalho para definir, espelhando o tratamento de projetos
   sem data no cronograma de projetos.
8. Sem nenhuma frente, a aba mostra um empty state que orienta criar a primeira
   frente com seu período.

Não-funcionais:

- **Segurança / RLS:** `obra_frente` já tem RLS por `empresa_id`; a feature só
  **adiciona duas colunas de data**, sem tocar policy. O `UPDATE` das datas é
  coberto pela policy de update existente da tabela. Confirmar que não há
  regressão de grant.
- **Multi-tenant:** isolamento por `empresa_id` mantido (nenhuma query nova
  cross-obra; tudo filtra por `obra_id`).
- **Performance:** o cronograma reusa `useObraFrentes(obraId)` e
  `useObraTarefas(obraId)`, ambos já filtrados por obra; o progresso é computado no
  front sobre esses dados já carregados, sem query extra por frente.

## Critérios de aceite

- [ ] Dado que abro uma obra, quando vejo as sub-abas, então a antiga "Frentes" se
      chama "Cronograma".
- [ ] Dado uma frente com início 01/08 e fim 15/08, quando abro o cronograma em
      agosto, então vejo a barra cobrindo esse período.
- [ ] Dado uma frente com 2 de 5 pendências concluídas, quando olho a barra, então
      ela mostra "40%".
- [ ] Dado que hoje é depois da data de fim de uma frente com pendência aberta,
      quando vejo a barra, então ela está vermelha e sinalizada como atrasada.
- [ ] Dado que todas as pendências de uma frente estão concluídas, quando vejo a
      barra, então ela está verde (concluída), mesmo antes da data de fim.
- [ ] Dado que clico numa frente, então abre o detalhe com as pendências dela e
      consigo marcar/adicionar/remover como antes.
- [ ] Dado uma frente sem data de início ou fim, quando abro o cronograma, então
      ela não aparece na timeline e entra no aviso "sem prazo definido".
- [ ] Dado que troco o zoom de Meses para Semanas, então as colunas e as barras se
      ajustam e a linha "Hoje" continua no lugar certo.
- [ ] Caso de borda: ao salvar uma frente com data de fim anterior à de início, o
      sistema impede e explica o porquê.
- [ ] Sem permissão de editar obra, o usuário vê o cronograma e o detalhe das
      frentes, mas não os controles de criar frente nem de editar datas.

## Dados e contratos

Migration (`ALTER TABLE`, sem tabela nova):

- **`obra_frente`**: adicionar `data_inicio date null` e `data_fim date null`.

Nomenclatura: uso `data_inicio` / `data_fim` (curto), não `_prevista`, porque no
MVP só existe o previsto; se um dia entrar o realizado, ele vem em colunas
próprias (`data_inicio_real`, ...), sem renomear as atuais.

Front:

- `useObraFrentes` passa a devolver as duas datas; `useCreateFrente` e
  `useUpdateFrente` aceitam `data_inicio` / `data_fim`.
- Progresso e estado de cada frente são funções puras em `src/lib/obras.ts`
  (`progressoFrente(tarefas)`, `estadoFrenteCronograma(frente, tarefas, hoje)`),
  com testes, alimentadas por `useObraTarefas`.
- Os utilitários de timeline (parse de data, geração de colunas por mês/semana,
  posição da barra em %, posição do "Hoje") são **extraídos** de
  `CronogramaProjetosTab` para um módulo compartilhado (ex.: `src/lib/cronograma.ts`)
  e consumidos pelos dois cronogramas, para não duplicar a matemática.

## Plano de implementação

Preenchido no plan mode e aprovado antes de gerar código. Rascunho:

1. Migration: `ALTER TABLE obra_frente ADD COLUMN data_inicio date, ADD COLUMN
   data_fim date`; rodar `npm run gen:types` (diff = só as duas colunas).
2. Extrair de `CronogramaProjetosTab` os helpers de timeline para
   `src/lib/cronograma.ts` (sem mudar a assinatura consumida por Projetos) + testes.
3. `src/lib/obras.ts`: `progressoFrente` e `estadoFrenteCronograma` + testes.
4. Hooks: estender `useCreateFrente` / `useUpdateFrente` com as datas.
5. Novo componente `ObraCronogramaTab` (Gantt de frentes) reusando o módulo de
   timeline; barra com % e cor por estado; linha "Hoje"; zoom Meses/Semanas;
   aviso de frentes sem prazo; empty state.
6. Detalhe da frente: extrair o checklist atual do `ObraFrentesTab` para um
   painel/dialog reaproveitável, aberto ao clicar na frente.
7. `src/pages/obras/[id]/index.tsx`: renomear a aba `frentes` → `cronograma`
   (rótulo "Cronograma", ícone `CalendarClock`), apontando para o novo componente.
8. Testes dos critérios de aceite (helpers puros + estados de borda).

## Decisões e riscos

- **Datas opcionais na frente.** Frentes já existentes nascem sem data e não podem
  sumir; sem data elas ficam fora da timeline e listadas à parte, igual a projetos
  sem data no cronograma de projetos. Coerência com um padrão já aceito.
- **Progresso por contagem de pendências, não por peso.** Simples e honesto para o
  MVP. Progresso físico ponderado e a curva-S (previsto × realizado × custo) ficam
  para a fase físico-financeira, amarrada à conta da obra (spec 016).
- **Sem drag no MVP.** Editar data por campo cobre o caso; o drag de barra
  (que já existe no cronograma de disciplinas) é UX desejável mas não essencial
  para "enxergar o prazo". Fase 2.
- **Reuso da matemática de timeline.** Extrair os utilitários compartilhados toca
  `CronogramaProjetosTab`; risco de regressão em Projetos. Mitigar mantendo a
  assinatura e cobrindo os helpers com teste antes de trocar o consumo.
- **Sem ADR.** Não há decisão transversal nova: é o padrão de Gantt já estabelecido
  aplicado a outra entidade.
- **Deploy (ADR 0007).** Migration aplicada só no banco **local**; `db:push:staging`
  / `db:push:prod` e o `gen:types` do ambiente são passos explícitos posteriores,
  fora desta entrega.
