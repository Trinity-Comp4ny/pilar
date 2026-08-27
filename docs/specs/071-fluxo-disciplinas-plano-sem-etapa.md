# SPEC: Fluxo de disciplinas sem a camada "etapa": prazo por disciplina, checklist com duração

**Data:** 2026-08-27
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** projetos
**Estende:** [051 — Duração por etapa, fluxo prazo em cascata](051-duracao-por-etapa-fluxo-prazo-cascata.md)

<!-- Origem: conversa de WhatsApp com Rafael (Mawe Arquitetura, design partner)
em 2026-08-26, usando o fluxo em produção pela primeira vez. -->

## Problema

O spec 051 entregou fluxo com etapas em cascata, grafo visual e checklist por
disciplina. Usando isso ao vivo, o Rafael (design partner) reportou três
atritos reais:

1. **Colisão de nome "etapa".** `FluxoEtapa` (`src/types/fluxoDisciplinas.ts:9`)
   é a coluna que agrupa disciplinas em paralelo. Mas dentro de uma disciplina,
   o Rafael já pensa em "etapas" como os sub-passos do checklist (briefing,
   anteprojeto, executivo...). A mesma palavra nomeando dois níveis diferentes
   confundiu quem usa.
2. **Duração uniforme por coluna.** `fluxoCascata.ts` aplica a mesma janela
   (`data_inicio`/`data_previsao`) a todas as disciplinas de uma etapa — o
   spec 051 deixou isso fora de escopo explicitamente. Na prática, um
   escritório de arquitetura tem uma pessoa por sub-etapa (briefing,
   anteprojeto, entrega conceito, executivo, orçamento são pessoas diferentes),
   cada uma com prazo próprio, não um prazo único pra "arquitetura" inteira.
3. **Checklist sem duração.** `checklist_padrao` (`string[]`) só tem texto. O
   Rafael queria colocar dias em cada item do checklist e a disciplina herdar
   a soma automaticamente — e perguntou como ficaria um item de poucas horas
   (não um dia inteiro).

Adicionalmente, `FluxoEtapaDisciplina.responsavel_id` é singular no template,
enquanto a disciplina real do projeto já suporta múltiplos responsáveis desde
`sync_disciplina_responsaveis` (`projeto_disciplina_responsaveis`).

## Objetivo

Achatar `FluxoEtapa → disciplinas[]` em uma lista única de disciplinas com
posição (`ordem`), sem entidade "etapa" nomeada. Duração passa a ser por
disciplina (disciplinas na mesma `ordem` podem ter prazos diferentes). Itens
de checklist ganham duração opcional em dias úteis, cuja soma vira a duração
da disciplina quando presente. Template do fluxo ganha múltiplos responsáveis,
igualando a disciplina real.

**Fora de escopo:**

- Recalcular datas retroativamente quando uma disciplina atrasa (mesma decisão
  já tomada no spec 051).
- DAG genérico com dependências arbitrárias entre disciplinas — mantém
  sequência linear fixa por `ordem` (mesma régua do ADR 0020, reafirmada no
  spec 051: sem lib de grafo, sem dependência cruzada).
- Granularidade de hora alimentando a cascata de datas. `addBusinessDays`
  (`src/lib/businessDays.ts`) só entende dia inteiro; forçar fração de dia
  não tem semântica definida e reabriria o problema de captura de hora que já
  matou timesheet duas vezes neste projeto (spec 012). Horas ficam como campo
  informativo (`horas_estimadas`), nunca somadas em `duracao_dias_uteis`.
- Recálculo automático de `data_previsao` na disciplina real do projeto a
  partir de duração de checklist (isso já existe hoje via `duracao_dias_uteis`
  aplicado uma vez, na criação — ver requisito 6 do spec 051, mantido aqui).

## Requisitos

### A — Achatar o modelo (fluxo template)

1. `FluxoDisciplinas.etapas: FluxoEtapa[]` vira `FluxoDisciplinas.disciplinas:
FluxoDisciplinaTemplate[]`, lista flat. Cada disciplina carrega `ordem`
   (posição/coluna — disciplinas com o mesmo `ordem` são paralelas).
2. `FluxoDisciplinaTemplate.responsavel_id?` (singular) vira
   `responsaveis_ids?: string[]` (mesmo padrão de `projeto_disciplina_responsaveis`).
3. `FluxoDisciplinaTemplate.checklist_padrao` deixa de ser `string[]` e vira
   `FluxoChecklistItemTemplate[]` — `{ texto: string; duracao_dias_uteis?:
number; horas_estimadas?: number }`.
4. `FluxoDisciplinaTemplate.duracao_dias_uteis?: number` continua existindo
   (era da etapa, agora é da própria disciplina). Quando o checklist tem 1+
   item com `duracao_dias_uteis` preenchido, o valor manual é ignorado — a
   duração efetiva é a soma dos itens do checklist (requisito 8).
5. **Compat com fluxos existentes, sem migration de dado:** `fluxos_disciplinas.etapas`
   continua sendo a mesma coluna `Json` (renomeada semanticamente, sem
   `ALTER TABLE`). Uma função `normalizeFluxoDisciplinas` lê o formato antigo
   (etapas aninhadas) e achata em runtime: cada disciplina de uma etapa antiga
   herda o `ordem` da etapa e, se não tiver duração própria, herda a
   `duracao_dias_uteis` da etapa (aplicada por igual a todas — mesmo
   comportamento que tinham antes, só que copiado pro nível novo). Fluxos
   antigos continuam funcionando sem edição do usuário.

### B — Cascata por `ordem`, duração por disciplina

6. `calcularDatasEtapasFluxo` (`fluxoCascata.ts`) é substituída por
   `calcularDatasFluxo(disciplinas, dataInicioProjeto)`: agrupa por `ordem`;
   `data_inicio` do grupo N = maior `data_previsao` entre as disciplinas do
   grupo N-1 (grupo seguinte só começa quando **todas** as disciplinas
   paralelas do grupo anterior têm `data_previsao`); `data_previsao` de cada
   disciplina = `addBusinessDays(data_inicio do grupo, duracao_efetiva da
disciplina)`. Primeiro grupo herda `data_inicio` do projeto.
7. Disciplina sem duração efetiva (nem manual, nem soma de checklist) fica
   sem `data_previsao`, e quebra a cadeia só pras disciplinas que dependem
   dela terminar (mesma regra do spec 051, aplicada por disciplina em vez de
   por etapa).
8. `duracao_efetiva(disciplina)` = soma de `checklist_padrao[].duracao_dias_uteis`
   quando existir pelo menos um item com esse campo preenchido; senão,
   `disciplina.duracao_dias_uteis` manual.
9. Item de checklist sem `duracao_dias_uteis` (ex.: "ligar pro cliente
   confirmando medida", tarefa de poucos minutos/horas) não participa da soma
   — só marca conclusão. `horas_estimadas`, quando preenchido, é decorativo
   (exibido no card/detalhe), nunca convertido em dia.

### C — Editor do fluxo

10. `FluxoDisciplinasDialog` deixa de ter "criar etapa → nomear → adicionar
    disciplinas dentro". Vira lista flat de disciplinas agrupadas visualmente
    por `ordem`, com ação "+ disciplina em paralelo aqui" (mesmo `ordem`) e
    "+ próxima coluna" (`ordem` seguinte). Nenhum campo de nome de coluna.
11. Campo de responsável vira multi-select (mesmo padrão de componente já
    usado — Popover + Command, nunca dropdown nativo, ver design system).
12. Campo de duração manual fica desabilitado (read-only, mostrando o
    somatório) quando o checklist tem item com duração; habilitado quando o
    checklist está vazio ou nenhum item tem duração.
13. `TarefasEditor` (reusado para `checklist_padrao`) ganha dois inputs
    numéricos opcionais por linha: dias e horas. Ambos vazios por padrão.

### D — Grafo (`FluxoPipelineGraph`) e aplicação no projeto

14. `FluxoPipelineGraph` não muda de assinatura (já é genérico `stages`/
    `nodes`). Só a função que monta `stages` a partir do fluxo muda: 1 `stage`
    por valor de `ordem` (sem título de etapa — rótulo neutro, ex. posição
    numérica ou omitido).
15. `applyFluxo` (`useProjetoForm.ts:471`) usa `calcularDatasFluxo` no lugar
    de `calcularDatasEtapasFluxo`; ao inserir `projeto_disciplinas`, sincroniza
    múltiplos responsáveis via `sync_disciplina_responsaveis` (já existe,
    hoje só usado pós-criação manual) e insere as linhas de
    `projeto_disciplina_checklist` com `duracao_dias_uteis`/`horas_estimadas`
    quando a migration do requisito 16 existir.

Não-funcionais:

- **Migration mínima:** só a tabela real `projeto_disciplina_checklist` ganha
  2 colunas novas (metadado informativo, não recalcula `data_previsao` depois
  de aplicado — ver Fora de escopo). O template (`fluxos_disciplinas.etapas`)
  não precisa de migration, é JSON.
- **Sem ADR:** mesma régua do spec 051 (extensão pontual, sem decisão
  transversal nova).

## Critérios de aceite

- [ ] Dado um fluxo com 2 disciplinas na mesma `ordem` (durações 5 e 3 dias) e
      1 disciplina na `ordem` seguinte, quando aplicado num projeto com
      início numa segunda-feira, então a disciplina da segunda coluna começa
      5 dias úteis depois do início (a mais lenta das duas primeiras manda),
      não 3.
- [ ] Dado uma disciplina cujo checklist tem itens de 2, 4 e 3 dias (um deles
      sem duração, só texto), quando visualizada, então a duração efetiva é
      9 dias (soma dos que têm duração; o item sem duração não conta) e o
      campo manual de duração aparece travado mostrando 9.
- [ ] Dado um item de checklist com `horas_estimadas` preenchido e sem
      `duracao_dias_uteis`, quando a disciplina calcula sua duração efetiva,
      então esse item não altera o total de dias.
- [ ] Dado um fluxo salvo no formato antigo (`etapas` aninhado, sem `ordem`
      em cada disciplina), quando lido pela UI, então `normalizeFluxoDisciplinas`
      produz a lista flat com `ordem` herdado da etapa antiga, sem exigir
      edição do usuário.
- [ ] Dado o editor do fluxo, quando o usuário adiciona 2 responsáveis a uma
      disciplina do template, então ambos são persistidos e, ao aplicar o
      fluxo, ambos aparecem como responsáveis da disciplina real (verificável
      via `projeto_disciplina_responsaveis`).
- [ ] Dado `prefers-reduced-motion: reduce`, o grafo continua sem animação
      (comportamento do spec 051, não deve regredir).

## Dados e contratos

- `src/types/fluxoDisciplinas.ts`: reescreve `FluxoEtapa`/`FluxoEtapaDisciplina`
  para `FluxoDisciplinaTemplate`/`FluxoChecklistItemTemplate`; adiciona
  `normalizeFluxoDisciplinas(raw)` substituindo `normalizeEtapas`; mantém os
  tipos antigos exportados como `@deprecated` só até a migração de leitura
  ser confirmada em produção, se necessário para transição gradual — decidir
  no PR se vale a pena ou se dá pra trocar direto (ver Decisões e riscos).
- Sem RPC nova para A/B/C. Cálculo client-side em `calcularDatasFluxo`
  (`src/lib/fluxoCascata.ts`), reusando `addBusinessDays`.
- **Migration nova:**
  ```sql
  ALTER TABLE public.projeto_disciplina_checklist
    ADD COLUMN IF NOT EXISTS duracao_dias_uteis int,
    ADD COLUMN IF NOT EXISTS horas_estimadas numeric;
  ```
  Sem trigger novo — essas colunas não alimentam `data_previsao`/status
  automaticamente (permanece regra do trigger existente, só sobre
  `concluido`). `npm run gen:types` obrigatório após a migration.

## Plano de implementação

1. `src/types/fluxoDisciplinas.ts`: novo shape + `normalizeFluxoDisciplinas`.
   Testes do normalizador (fluxo antigo aninhado → flat com `ordem` herdado).
2. `src/lib/fluxoCascata.ts`: `calcularDatasFluxo` agrupando por `ordem`,
   `duracao_efetiva` calculando soma de checklist ou fallback manual.
   Atualiza `fluxoCascata.test.ts` (casos: paralelas com durações diferentes,
   grupo sem duração quebra a cadeia, checklist com item sem duração).
3. Migration `projeto_disciplina_checklist` (duas colunas) + `gen:types:local`.
4. `FluxoDisciplinasDialog.tsx`: lista flat com agrupamento visual por `ordem`,
   ações "+ paralelo"/"+ próxima coluna", multi-select de responsáveis,
   duração travada quando checklist tem duração.
5. `TarefasEditor.tsx` (ou um editor irmão dedicado ao checklist de fluxo, se
   ficar muito diferente do uso genérico de tarefas): inputs de dias/horas
   por item.
6. `useProjetoForm.ts` `applyFluxo`: troca de função de cascata, sync de
   múltiplos responsáveis, insert de checklist com duração/horas.
7. Função que monta `stages` do `FluxoPipelineGraph` a partir do novo modelo
   (tanto na prévia do editor quanto no grafo real do projeto).
8. `npm run gen:types` (staging) antes do PR. `npm run build:strict`,
   `npm run test:run`.

## Decisões e riscos

- **Sem ADR**, mesma régua do spec 051: extensão pontual de uma feature já
  entregue, sem decisão transversal nova (stack/auth/data-fetching).
- **Compat de leitura em runtime, não migration de dado**: como `etapas` é
  `Json`, não existe schema a migrar — só a função de normalização, que roda
  toda vez que um fluxo antigo é lido. Risco baixo: se o formato antigo tiver
  alguma variação não prevista, `normalizeFluxoDisciplinas` deve degradar
  para "disciplina sem `ordem` definido" (cai no fim da lista) em vez de
  quebrar a tela — tratar como caso de borda no passo 1.
- **Horas nunca alimentam a cascata de datas**, de propósito: é campo
  decorativo. Se o uso mostrar que faz falta granularidade sub-dia na data
  prevista, isso é uma decisão maior (mudar a unidade de tempo do sistema
  inteiro de cronograma) e não deve ser resolvida aqui.
- Risco: `applyFluxo` hoje insere `projeto_disciplinas` e depois (spec 051)
  os itens de `projeto_disciplina_checklist`; agora precisa também chamar
  `sync_disciplina_responsaveis` por disciplina — mais uma chamada de rede
  por disciplina aplicada. Se isso ficar lento em fluxos com muitas
  disciplinas, considerar uma RPC única de aplicação de fluxo no futuro (fora
  de escopo aqui, ver Fora de escopo do spec 051 sobre recálculo — mesma
  régua de "não expandir, revisitar como v2 própria").
