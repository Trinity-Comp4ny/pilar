# ADR 0010: Calendário compartilhado por camadas, escopado por quem o monta

**Data:** 2026-07-30
**Status:** Accepted

## Contexto

O Pilar tem um calendário completo (Mês/Semana/Agenda, mini-mês, toggles,
busca) em `/calendario`, que hoje só enxerga prazos de projeto e disciplina.
Duas telas passaram a querer calendário: "Meu trabalho" (agenda pessoal: minhas
disciplinas + minhas tarefas) e, no futuro, Obras (marcos de obra). O código do
calendário morava em `src/pages/projetos/components/calendario/`, acoplado ao
módulo Projetos: importava `Projeto[]`, navegava sempre para `/projetos/:id` e
tinha os toggles "Projetos"/"Disciplinas" chumbados.

Se cada módulo ganhasse o próprio calendário, teríamos três implementações
divergentes da mesma coisa, e a confusão de "qual calendário é qual". A dúvida do
produto era "separar ou juntar os calendários".

- **Opção A — um calendário por módulo:** simples de começar, mas triplica o
  código e a manutenção; três lugares para corrigir o mesmo bug de data.
- **Opção B — um calendário gigante com tudo:** todos os projetos + todas as
  obras + minhas tarefas numa tela só vira ruído; ninguém quer supervisão e
  fila pessoal no mesmo campo de visão.
- **Opção C — um motor, várias camadas togláveis, escopo por quem monta:**
  o modelo "Meus calendários" do Google. Uma engine; cada fonte de dado é uma
  camada que o usuário liga/desliga; a tela que monta decide quais camadas vêm
  ligadas e para onde o clique leva.

## Decisão

Adotar a Opção C. O calendário vira componente compartilhado em
`src/components/calendario/`, agnóstico à origem dos eventos.

- **Camadas** (`CamadaId = "projeto" | "disciplina" | "tarefa"`, extensível para
  `"obra"`): cada fonte de dado é uma camada com rótulo, ícone e cor, no
  `CAMADA_REGISTRY`. A sidebar renderiza os toggles a partir do registro.
- **Modelo de evento único** (`PrazoEvento`) com `camada`, `titulo`, `subtitulo`,
  `estado` e `projetoId?`. Providers montam a lista: `buildEventosProjetos`,
  `buildEventosDisciplinas`, `buildEventosTarefas`. `filtrarVisiveis` esconde as
  camadas desligadas.
- **Clique desacoplado:** as visões (Mês/Semana/Agenda) recebem `onEventoClick`;
  quem monta decide o destino (Projetos navega para `/projetos/:id`; Meu trabalho
  abre a tarefa em diálogo).
- **Escopo por quem monta:** a tela passa as camadas disponíveis, os defaults e
  a fonte já filtrada. `/calendario` monta Projetos+Disciplinas de toda a
  empresa; "Meu trabalho → Agenda" monta Disciplinas+Tarefas da pessoa logada.

```ts
// cada tela compõe o motor com suas camadas e sua fonte
const eventos = filtrarVisiveis(
  [...buildEventosDisciplinas(minhasDisciplinas), ...buildEventosTarefas(minhasTarefas)],
  visiveis
);
<CalendarioSidebar camadas={["disciplina", "tarefa"]} visiveis={visiveis} onToggleCamada={toggle} />
<MesView eventosPorDia={porDia} onEventoClick={abrir} />
```

## Consequências

**Positivas:**

- Um só lugar para a lógica de data, visões e a11y. Obras pluga uma camada nova,
  não um calendário novo.
- O usuário monta o recorte que quiser (obra + minhas tarefas, disciplinas +
  minhas tarefas) ligando/desligando camadas, sem telas separadas.
- `/calendario` preserva comportamento e layout; a mudança é interna.

**Negativas:**

- Uma indireção a mais: a tela precisa montar os eventos e passar `onEventoClick`,
  em vez de o calendário "saber" tudo. Trade-off aceito pela reutilização.
- O `CAMADA_REGISTRY` é um ponto central: camada nova exige entrada lá (rótulo,
  ícone, cor) além do provider.

## Decisões relacionadas

- SPEC 009 (calendário Google-like): a base de visões que este ADR generaliza.
- SPEC 008 ("Meu trabalho"): a aba Agenda é o primeiro consumidor do motor além
  de Projetos.
- ADR 0008 (design system): cores por token; o registro de camadas usa
  `bg-brand`/`text-ink` nos toggles.
