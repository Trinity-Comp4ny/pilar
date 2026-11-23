# SPEC: Dependências entre tarefas da obra e caminho crítico

**Data:** 2026-11-19  
**Status:** Draft  
**Autor:** Matheus Rezende (com apoio de agente de IA)  
**Módulo:** obras (aba Cronograma)

> Origem: item 7 da análise de UI das telas de Obras ([ANALISE_UI_OBRAS_2026-11.md](../strategy/ANALISE_UI_OBRAS_2026-11.md)).
> A barra do Gantt já tem Meses/Semanas, "Hoje" e Exportar (CSV). Faltam as **setas de dependência** e o **caminho
> crítico**, que o Mais Controle e a Vobi mostram e que dependem de um dado que o banco ainda não guarda: quem espera
> quem. Esta spec cobre só isso. O cronograma de **projetos** tem o mesmo problema resolvido à parte na
> [SPEC 162](162-fluxo-em-grafo-dependencias-e-caminho-critico.md); aqui é o cronograma da **obra** (fase › etapa ›
> serviço › tarefa, [SPEC 111](111-cronograma-obra-quatro-niveis-lista-e-gantt.md)).

## Problema

O engenheiro de obra sabe que a laje só concreta depois da fôrma e da armação, mas o cronograma da obra é uma lista de
tarefas com datas soltas. Quando a fôrma atrasa, nada avisa que a concretagem, a desfôrma e a alvenaria andaram junto.
Ele refaz a conta de cabeça, planilha em mão, e descobre o efeito dominó tarde. O Gantt também não responde a pergunta
do sócio: "o que, se atrasar, atrasa a entrega da obra?".

## Objetivo

Ligar tarefas entre si ("termina para começar") e, com isso, desenhar as setas no Gantt, calcular o caminho crítico e
avisar quando um atraso empurra uma sucessora. Depois desta feature, abrir o cronograma responde sozinho: "estas 7
tarefas decidem a data de entrega; este atraso empurra a concretagem em 4 dias".

**Fora de escopo:**

- Tipos de vínculo além de "termina para começar" (início-início, fim-fim) e defasagem negativa. A defasagem em dias
  (espera de cura, por exemplo) entra; o resto não.
- Nivelamento de recursos (mover tarefa porque a equipe está ocupada).
- Reescrever datas salvas automaticamente. O sistema **mostra** o empurrão e oferece "Aplicar ajuste"; quem confirma é
  a pessoa.
- Dependência entre obras diferentes e dependência de fase, etapa ou serviço (só tarefa com tarefa; as barras-resumo
  continuam a união dos filhos).
- Biblioteca de grafo ou de Gantt de terceiros ([ADR 0020](../architecture/adr/0020-headless-sim-widget-estilizado-nao.md)):
  as setas são SVG à mão sobre o `CronogramaGantt`, e a conta de caminho crítico vive em `src/lib/cronograma.ts`.
- Importar dependências de MS Project ou Excel (spec própria, se a demanda aparecer).

## Requisitos

### Fase 1: dependências (migration)

1. No detalhe da tarefa da obra, o usuário com edição escolhe as **predecessoras** (outras tarefas da mesma obra) e
   uma **defasagem** opcional em dias (padrão 0). A lista mostra o caminho "Fase › Etapa › Serviço › Tarefa" para
   desambiguar nomes repetidos.
2. Dependência que fecharia ciclo é recusada no banco e no front, com a mensagem dizendo qual tarefa fecha o ciclo.
3. Uma tarefa não depende de si mesma, e o par (predecessora, sucessora) é único.
4. Excluir (soft delete) uma tarefa remove as dependências dela dos dois lados; restaurar não as devolve.
5. A lista do cronograma mostra, na tarefa, um chip "Depende de N" e abre a lista ao clicar.

### Fase 2: setas no Gantt

6. O Gantt desenha uma seta do fim da barra da predecessora ao início da sucessora, em ângulo reto, atrás das barras.
7. Seta com a predecessora terminando **depois** do início da sucessora (conflito de datas) fica na cor de alerta.
8. Uma chave "Dependências" na barra do Gantt liga e desliga as setas (ligada por padrão; a preferência é por
   usuário, em `localStorage`).
9. Passar o mouse numa barra realça as setas que entram e saem dela.
10. Em celular (390 px) as setas ficam desligadas por padrão e a chave continua disponível.

### Fase 3: caminho crítico e empurrão

11. Uma chave "Caminho crítico" realça as tarefas e as setas do caminho mais longo até a última entrega, calculado
    por CPM (passo à frente e passo atrás) sobre as dependências, a duração (`data_inicio` → `prazo`) e a defasagem.
12. Tarefa sem data de início ou de prazo não entra no cálculo; a barra de ferramentas diz quantas ficaram de fora em
    vez de inventar data.
13. Tarefa concluída entra com a data real de conclusão (a do RDO que a concluiu, como na Curva S) e nunca é crítica.
14. Quando uma predecessora atrasa (prazo passado e não concluída) e empurra a sucessora, o card da sucessora e a barra
    mostram "empurrada Nd". O botão "Aplicar ajuste" abre uma confirmação listando as tarefas e as novas datas e só
    grava depois do "Confirmar".
15. O cabeçalho executivo da obra ([item 3 da análise](../strategy/ANALISE_UI_OBRAS_2026-11.md)) passa a usar a data de
    fim do caminho crítico como "previsão de entrega", ao lado do fim previsto da obra, e mostra o desvio em dias.

**Requisitos não-funcionais**

- **Segurança / RLS:** `obra_dependencia` com `empresa_id`; as quatro policies exigem `can_view_module`/`can_edit_module`
  do módulo Obras e a sub-feature `obras_cronograma` (mesmo padrão de `obra_frente`, ADR 0046 não se aplica: não é
  dinheiro). Testar com `auth.uid()` de outra empresa e de usuário sem edição.
- **Performance:** o CPM roda no cliente sobre as tarefas já carregadas (mesma ordem de grandeza do Gantt: centenas);
  O(n + arestas), sem consulta nova por tarefa. Uma única consulta traz as dependências da obra.
- **Multi-tenant:** isolamento por `empresa_id`, com trigger conferindo que predecessora e sucessora são da mesma obra
  e da mesma empresa.
- **Sem regressão:** obra sem nenhuma dependência abre idêntica à de hoje (sem chip, sem setas, sem caminho crítico).

## Critérios de aceite

- [ ] Dado duas tarefas da mesma obra, quando o usuário adiciona A como predecessora de B, então B mostra "Depende de 1"
      e a seta A → B aparece no Gantt.
- [ ] Dado A → B, quando tenta adicionar B como predecessora de A, então o banco recusa e a tela diz que B fecha o ciclo.
- [ ] Dado A → B → C, quando tenta C como predecessora de A, então recusa (ciclo indireto).
- [ ] Caso de borda: tarefa de outra obra ou de outra empresa não aparece na lista e o banco recusa por RPC direta.
- [ ] Dado A termina dia 10 e B (sucessora, defasagem 2) começa dia 10, então a seta fica em alerta e B mostra
      "empurrada 2d" (começaria no dia 12).
- [ ] Dado a cadeia A → B → C mais longa que A → D, quando liga "Caminho crítico", então A, B, C e suas setas ficam
      realçadas e D não.
- [ ] Dado A concluída pelo RDO, então A não é crítica e a conta usa a data do RDO.
- [ ] Dado uma tarefa sem prazo, então ela fica fora do cálculo e a barra diz "1 tarefa sem data".
- [ ] Dado "Aplicar ajuste", então nada grava antes do "Confirmar" e a lista mostra cada tarefa com data antiga e nova.
- [ ] Dado a tarefa A excluída, então as dependências dela somem e B deixa de mostrar o chip.
- [ ] Usuário sem permissão de edição vê as setas e o caminho crítico, mas não adiciona nem remove dependência.
- [ ] Obra sem dependências: o Gantt é idêntico ao de hoje (teste de regressão).
- [ ] Mobile 390 px: as setas começam desligadas e a chave as liga sem estourar a barra de ferramentas.

## Dados e contratos

Tabela nova `obra_dependencia`:

| Coluna            | Tipo               | Observação                         |
| ----------------- | ------------------ | ---------------------------------- |
| `id`              | uuid PK            |                                    |
| `empresa_id`      | uuid not null      | RLS                                |
| `obra_id`         | uuid not null      | facilita a consulta única por obra |
| `predecessora_id` | uuid → `tarefas`   | `on delete cascade`                |
| `sucessora_id`    | uuid → `tarefas`   | `on delete cascade`                |
| `defasagem_dias`  | int not null def 0 | `check (defasagem_dias >= 0)`      |
| `created_at/by`   | padrão             |                                    |

- `unique (predecessora_id, sucessora_id)` e `check (predecessora_id <> sucessora_id)`.
- Trigger `before insert or update`: mesma obra e mesma empresa nas duas tarefas; recusa ciclo por busca recursiva a
  partir da sucessora (mensagem com o título da tarefa que fecha o ciclo).
- Soft delete da tarefa: o trigger de soft delete remove as linhas de `obra_dependencia` da tarefa.
- RPC não é necessária na fase 1: `insert`/`delete` direto, protegido por RLS e pelo trigger.
- Front: `useObraDependencias(obraId)` (uma consulta), `useSalvarDependencia`, `useRemoverDependencia`; tipos via
  `npm run gen:types:local`.
- Lib pura em `src/lib/cronograma.ts`: `caminhoCritico(tarefas, dependencias)` → `{ criticas: Set<id>, fim: Date, empurroes: Map<id, dias>, semData: number }`.

## Plano de implementação

Três PRs, nesta ordem, cada um entrega valor sozinho e com antes/depois no corpo:

1. **Dependências (fase 1):** migration + RLS + trigger + pgTAP (ciclo, outra obra, outra empresa, sem edição); hooks;
   seletor de predecessoras no detalhe da tarefa; chip na lista. Verificável: critérios de ciclo e permissão.
2. **Setas (fase 2):** camada SVG no `CronogramaGantt` (hoje com ~620 linhas, perto do teto de 700: extrair a camada de
   setas para arquivo próprio antes de somar); chave "Dependências"; realce no hover; mobile.
3. **Caminho crítico e empurrão (fase 3):** `caminhoCritico` com testes de tabela; chave "Caminho crítico"; "empurrada
   Nd" e "Aplicar ajuste" com confirmação; previsão de entrega no cabeçalho executivo.

## Decisões e riscos

- **Por que tarefa com tarefa, e não nó com nó:** a obra agenda e cobra por tarefa (RDO conclui tarefa); as barras de
  fase, etapa e serviço já são a união dos filhos. Dependência entre nós duplicaria a verdade.
- **Por que CPM no cliente:** as tarefas já estão carregadas para o Gantt; calcular no banco exigiria RPC a cada
  edição e deixaria o realce do hover lento. O banco só garante integridade (ciclo, obra, empresa).
- **Por que não reescrever datas sozinho:** obra real negocia prazo com cliente e fornecedor; empurrar em silêncio
  esconde a conversa. Mostrar e pedir confirmação.
- **Risco:** cronogramas importados ou grandes (milhares de tarefas) deixam a camada de setas pesada; mitigação:
  desenhar só as setas das linhas visíveis e desligar por padrão acima de 300 tarefas.
- **Risco:** sem dependência cadastrada o caminho crítico não existe e a chave mostra vazio. A tela deve dizer
  "Ligue tarefas para ver o caminho crítico" em vez de uma chave que não faz nada.
- Se o modelo de dependência virar compartilhado com projetos ([SPEC 162](162-fluxo-em-grafo-dependencias-e-caminho-critico.md)
  fase 2), abrir ADR antes de duplicar a lógica de ciclo.
