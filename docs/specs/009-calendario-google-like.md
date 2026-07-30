# SPEC: Calendário familiar (padrão Google Calendar)

**Data:** 2026-07-30
**Status:** Em implementação
**Autor:** Matheus
**Módulo:** projetos

## Problema

O `/calendario` tem só a visão de mês e dois dropdowns de filtro. Quem gerencia
prazos (sócio/coordenador de engenharia) não consegue focar numa semana, nem ver
uma lista corrida do que vence, nem pular de mês sem clicar seta por seta. O
usuário já sabe usar o Google Calendar; forçá-lo a reaprender um calendário
próprio é atrito à toa (Lei de Jakob).

## Objetivo

Navegar prazos no padrão que o usuário já domina: alternar Mês / Semana / Agenda,
pular de período pelo mini-mês lateral e ligar/desligar tipos de prazo, sem
reaprender nada.

**Fora de escopo:**

- Grade de horas na Semana/Dia. Todo prazo é "dia inteiro" (`data_previsao` é data,
  sem hora), então a grade de horas ficaria vazia. Não copiamos isso do Google.
- Criar/editar evento pelo calendário. Continua só leitura: clicar abre o projeto.
  Remarcar prazo arrastando é o que o Cronograma (Gantt) já faz.
- Integração com timesheet, reuniões ou feriados. Fonte segue sendo prazo de
  projeto e de disciplina.

## Requisitos

1. O usuário pode alternar entre três visões: **Mês** (atual), **Semana** e **Agenda** (lista cronológica).
2. A navegação anterior/próximo respeita a visão: mês a mês em Mês/Agenda, semana a semana em Semana. "Hoje" volta ao período atual em qualquer visão.
3. Uma barra lateral mostra um **mini-mês** navegável; clicar num dia move o período visível para aquele dia.
4. A barra lateral tem toggles "Meus calendários": **Projetos** e **Disciplinas**, que mostram/ocultam os prazos daquele tipo.
5. Os filtros por projeto e por responsável migram para a barra lateral.
6. A busca do header filtra os eventos por texto (nome de projeto ou disciplina).
7. Todas as visões consomem a mesma lista de eventos (mesma classificação de estado: em atraso / próximos 7 dias / futuro / concluído).
8. Início da semana em **segunda-feira**, como no Google Calendar de referência.

Não-funcionais:

- **Só leitura:** nenhuma visão muta banco. Sem mudança de RLS.
- **Performance:** reusa a query `["projetos"]` já existente; nada de query nova por visão. Construção de eventos memoizada.

## Critérios de aceite

- [ ] Dado que estou na visão Mês, quando clico em "Semana", então vejo os 7 dias da semana do período com os prazos empilhados por dia.
- [ ] Dado que estou na visão Semana, quando clico em ">", então avanço uma semana (não um mês).
- [ ] Dado que estou na visão Agenda, quando há prazos no mês, então vejo uma lista cronológica agrupada por dia; quando não há, vejo empty state orientando.
- [ ] Dado o toggle "Disciplinas" desligado, então nenhum evento de disciplina aparece em nenhuma visão.
- [ ] Dado que clico num dia do mini-mês, então o período visível passa a conter aquele dia.
- [ ] Dado texto na busca, então só aparecem eventos cujo projeto/disciplina casa com o texto.
- [ ] Caso de borda: hoje destacado usa `bg-brand text-ink` (não `text-white`), respeitando a regra de contraste da marca.
- [ ] Caso de borda: semana que cruza virada de mês mostra os dias dos dois meses corretamente.

## Dados e contratos

Sem tabela nova, sem migration. Mesma query `["projetos"]` com joins de
`projeto_disciplinas` → `projeto_disciplina_responsaveis` → `pessoas`. Modelo de
evento interno (`PrazoEvento`) com `estado: "atrasado" | "proximo" | "concluido" | "futuro"`.

## Plano de implementação

1. `eventos.ts`: tipos + `buildEventos(projetos, visiveis, filtroProjeto, filtroResponsavel, busca)` e helpers de data (Monday-first).
2. `MesView`, `SemanaView`, `AgendaView`: consomem `PrazoEvento[]` / `eventosPorDia`.
3. `MiniMes` e `CalendarioSidebar` (mini-mês + toggles + filtros).
4. `Calendario.tsx` vira o shell: estado (cursor, view, tipos visíveis, filtros, busca), navegação por visão, monta `PageLayout` com `sidebar`.
5. Aposenta `CalendarioPrazosTab` (só o `/calendario` usa).

## Evolução (2026-07-30): motor compartilhado

O código do calendário saiu de `src/pages/projetos/components/calendario/` para
`src/components/calendario/` e virou motor por camadas togláveis, reusado por
"Meu trabalho → Agenda" (escopo pessoal) e, no futuro, por Obras. A visão de
`/calendario` (Projetos) não muda de comportamento. Ver **ADR 0010** para a
decisão de arquitetura (camadas, providers de evento, clique desacoplado).

## Decisões e riscos

- Semana e Dia sem grade de hora é decisão deliberada: o dado é all-day. Se um dia
  os prazos ganharem hora, a grade de horas entra como evolução.
- Risco: mudar início de semana para segunda muda a leitura de quem já usava
  domingo-primeiro. Baixo: alinha com o Google que o usuário citou como referência.
