# SPEC: Fluxo de disciplinas: prazo em cascata, grafo visual e checklist por etapa

**Data:** 2026-08-18 (atualizada 2026-08-19)
**Status:** Draft
**Autor:** Matheus Rezende
**Módulo:** projetos

## Problema

Fluxos de disciplinas (Projetos > Fluxos) já definem ordem, disciplina e responsável
por etapa, mas hoje tem três lacunas que dois design partners confirmaram na prática:

1. Ao aplicar um fluxo num projeto novo nenhuma data nasce preenchida (`applyFluxo` em
   `src/pages/projetos/components/useProjetoForm.ts:471-497` copia disciplina/
   responsável, não datas). O usuário edita a previsão de cada disciplina manualmente,
   uma por uma. MF Construções (17/08, [spec 046](046-objetivos-organizacionais-com-dependencias.md))
   e Rafael, da Mawe Arquitetura (18/08), pediram a mesma mecânica cada um do seu
   jeito: duração fixa por etapa gerando prazo em cascata a partir do início do
   projeto.
2. A visualização atual do fluxo aplicado (`FluxoPipeline.tsx`, no detalhe do
   projeto) é uma fileira de círculos numerados com o nome das disciplinas escondido
   em tooltip — Rafael, ao ver a tela em demo, comparou favoravelmente com o board do
   Trello que usa hoje, mas pediu mais visibilidade dos nomes/prazos direto na tela,
   sem precisar passar o mouse.
3. Uma etapa não é atômica: "Briefing" tem sub-passos ("criar pasta do cliente" etc.)
   que precisam ser marcados um a um, e o % de conclusão real da etapa/disciplina é o
   que o escritório do Rafael usa para calcular comissão trimestral por entrega — hoje
   o status da disciplina é só um dropdown manual (Não Iniciado/Em Andamento/
   Concluído), sem granularidade.

## Objetivo

Ao criar um projeto a partir de um fluxo com duração configurada, cada disciplina
nasce com prazo calculado automaticamente em cascata; o detalhe do projeto mostra o
fluxo como um grafo de etapas (estilo pipeline de CI: colunas conectadas, cada uma
agrupando as disciplinas paralelas daquela etapa, com estado e animação); e cada
disciplina pode ter um checklist cujo progresso é o que efetivamente conclui a
disciplina.

**Fora de escopo:**

- Recalcular datas futuras quando uma etapa atrasa ou conclui fora do previsto (fica
  para v2 se o uso confirmar a necessidade).
- Duração por disciplina dentro de uma mesma etapa: disciplinas paralelas herdam a
  mesma janela da etapa.
- Painel "TV do escritório" com semáforo de urgência por proximidade de prazo.
- Comissão/pagamento por etapa concluída (Financeiro/Pessoas) — esta spec só produz o
  dado de conclusão real (checklist), não consome para folha.
- Qualquer mudança no domínio de objetivos organizacionais (spec 046).

## Requisitos

### A — Duração por etapa e prazo em cascata

1. Ao criar/editar uma etapa de fluxo em `FluxoDisciplinasDialog`, o usuário pode
   informar uma duração em dias úteis (campo numérico opcional, mínimo 1). Vazio
   mantém o comportamento atual (sem prazo automático).
2. `fluxos_disciplinas.etapas` (coluna `Json`) passa a aceitar a chave opcional
   `duracao_dias_uteis?: number` em cada etapa.
3. Ao aplicar um fluxo num projeto (`applyFluxo`) com `data_inicio` do projeto já
   preenchida: a primeira etapa recebe `data_inicio` = início do projeto; cada etapa
   seguinte recebe `data_inicio` = `data_previsao` da etapa anterior. Toda etapa com
   `duracao_dias_uteis` configurada recebe
   `data_previsao = addBusinessDays(data_inicio, duracao_dias_uteis)`. Etapas sem
   duração ficam sem `data_previsao` (quebra a cadeia nesse ponto).
4. Sem `data_inicio` no projeto no momento de aplicar o fluxo, nenhuma data é
   calculada — comportamento atual, sem regressão.
5. Todas as disciplinas de uma mesma etapa recebem a mesma `data_inicio`/`data_previsao`.
6. Aplicar o fluxo não recalcula nada depois: editar a disciplina manualmente após
   aplicar o fluxo não é sobrescrito.
7. A prévia do fluxo em `FluxoDisciplinasDialog` mostra a duração ao lado do nome da
   etapa quando configurada (ex.: "Briefing · 3 dias úteis").

### B — Grafo visual do fluxo (evolui `FluxoPipeline.tsx`)

8. `FluxoPipeline.tsx` passa de círculos numerados para caixas por etapa: cada etapa é
   uma coluna, cada disciplina dentro da etapa é uma linha na caixa (nome visível
   direto, sem depender de tooltip), com ícone de status, responsável e prazo.
9. Etapas em sequência são ligadas por um conector desenhado como curva (SVG),
   calculado a partir da posição real das caixas no DOM (sem lib de grafo — ver
   Decisões e riscos), com uma transição de entrada (fade/slide) e o conector
   "desenhando-se" ao carregar a tela.
10. Estados visuais por disciplina: não iniciado (cinza), em andamento (cor de
    progresso, ícone com pulso sutil), concluído (verde, check), atrasado (vermelho,
    quando `data_previsao` já passou e o status não é concluído).
11. Clicar numa disciplina abre o `DisciplinaDetailDialog` já existente (não cria um
    painel novo) na seção descrita no requisito C.
12. O grafo é a única visualização do fluxo no detalhe do projeto (substitui, não
    duplica, o `FluxoPipeline.tsx` atual).
13. Respeita `prefers-reduced-motion`: com a preferência ativa, conectores aparecem
    direto (sem desenhar) e o pulso do "em andamento" não anima.

### C — Checklist por disciplina, com template no Fluxo

14. Cada disciplina de um projeto (`projeto_disciplinas`) pode ter uma lista de itens
    de checklist (texto curto + concluído/não concluído), editável dentro do
    `DisciplinaDetailDialog`, numa seção nova (junto de Descrição/Links).
15. Ao editar uma etapa em `FluxoDisciplinasDialog`, cada disciplina do template pode
    ter uma lista de itens de checklist padrão (só texto). Ao aplicar o fluxo num
    projeto, os itens do template são copiados como linhas de checklist da disciplina
    recém-criada.
16. Quando todos os itens do checklist de uma disciplina estão concluídos (e o
    checklist não está vazio), a disciplina muda automaticamente para status
    "Concluído" e `data_fim_real` é preenchida com a data corrente. Desmarcar
    qualquer item de uma disciplina "Concluída" por essa via reverte o status para
    "Em Andamento" e limpa `data_fim_real`.
17. Disciplina sem nenhum item de checklist mantém o comportamento atual: status é
    editado manualmente pelo dropdown, sem alteração automática.
18. O card de disciplina no grafo (requisito B) mostra um badge com a contagem
    "concluídos/total" do checklist quando ele existe.

Não-funcionais:

- **Multi-tenant:** a tabela nova de checklist segue o mesmo padrão de RLS de
  `projeto_disciplina_responsaveis` (join até `projetos.empresa_id`, ver Dados e
  contratos).
- **Sem migration para A e B:** só o requisito C precisa de tabela nova.
- **Performance:** grafo com poucas dezenas de nós (etapas × disciplinas por
  projeto); medição de DOM para os conectores roda uma vez por render + resize, não
  em loop.

## Critérios de aceite

### A

- [ ] Dado um fluxo com Etapa 1 (2 dias úteis) → Etapa 2 (3 dias úteis), quando
      aplicado num projeto com início numa quinta-feira, então a Etapa 1 tem
      `data_previsao` 2 dias úteis depois (pulando fim de semana) e a Etapa 2 começa
      nessa data e termina 3 dias úteis depois.
- [ ] Dado um fluxo com uma etapa sem duração configurada, quando aplicado, então a
      disciplina nasce sem `data_inicio`/`data_previsao`.
- [ ] Dado um fluxo com 2 disciplinas na mesma etapa, quando aplicado, então as duas
      recebem a mesma `data_inicio`/`data_previsao`.
- [ ] Dado um projeto sem `data_inicio`, quando o fluxo é aplicado, então nenhuma data
      é calculada.
- [ ] Caso de borda: duração 0 ou negativa não é aceita no campo (mínimo 1).

### B

- [ ] Dado um projeto com fluxo aplicado e 3 etapas, quando o detalhe do projeto
      carrega, então aparecem 3 caixas conectadas na ordem certa, com o nome de cada
      disciplina visível sem hover.
- [ ] Dado uma disciplina com `data_previsao` no passado e status ≠ "Concluído",
      então o nó aparece no estado "atrasado".
- [ ] Dado `prefers-reduced-motion: reduce`, quando a tela carrega, então não há
      animação de desenho do conector nem pulso.
- [ ] Dado clique numa disciplina do grafo, então abre o `DisciplinaDetailDialog`
      dessa disciplina.

### C

- [ ] Dado uma disciplina com checklist de 3 itens, quando os 3 são marcados,
      então o status vira "Concluído" e `data_fim_real` é preenchida.
- [ ] Dado uma disciplina "Concluída" via checklist, quando um item é desmarcado,
      então o status volta para "Em Andamento" e `data_fim_real` é limpa.
- [ ] Dado uma disciplina sem nenhum item de checklist, quando o usuário muda o
      status manualmente, então nada no checklist interfere (comportamento atual).
- [ ] Dado um fluxo cuja etapa tem checklist padrão em uma disciplina, quando o fluxo
      é aplicado a um projeto, então a disciplina nasce com os itens do template,
      todos não concluídos.

## Dados e contratos

- `src/types/fluxoDisciplinas.ts`: `FluxoEtapa` ganha `duracao_dias_uteis?: number`;
  `FluxoEtapaDisciplina` ganha `checklist_padrao?: string[]`.
- Sem RPC nova para A. Cálculo client-side em `applyFluxo`
  (`useProjetoForm.ts:471`), reusando `addBusinessDays`/`parseDateLocal`/
  `formatDateLocal` de `src/lib/businessDays.ts` (mesma lib do `prazo_dias_uteis` do
  projeto).
- **Migration nova** para C: tabela `projeto_disciplina_checklist`
  (`id uuid pk`, `projeto_disciplina_id uuid fk -> projeto_disciplinas.id on delete cascade`,
  `texto text not null`, `concluido boolean not null default false`, `ordem int not null default 0`,
  `concluido_em timestamptz`, `concluido_por uuid fk -> pessoas.id`, `created_at timestamptz default now()`).
  RLS: mesmo padrão de `projeto_disciplina_responsaveis_empresa` — policy `FOR ALL`
  via `EXISTS (SELECT 1 FROM projeto_disciplinas pd JOIN projetos p ON p.id = pd.projeto_id WHERE pd.id = projeto_disciplina_checklist.projeto_disciplina_id AND p.empresa_id = get_user_empresa_id())`.
- **Trigger** (`AFTER INSERT OR UPDATE OR DELETE ON projeto_disciplina_checklist`,
  `FOR EACH ROW`, função `SECURITY DEFINER` como as demais deste módulo): recalcula
  contagem de itens/concluídos da disciplina afetada e aplica a regra do requisito 16
  em `projeto_disciplinas` (`status`, `data_fim_real`). Só atua quando a disciplina
  tem 1+ itens de checklist; disciplina sem itens não é tocada pelo trigger.
- `npm run gen:types` obrigatório após a migration (tabela nova entra em `types.ts`).

## Plano de implementação

1. `FluxoEtapa`/`FluxoEtapaDisciplina` (`src/types/fluxoDisciplinas.ts`): novos campos
   opcionais.
2. `FluxoDisciplinasDialog.tsx`: input de duração por etapa; mini-editor de checklist
   padrão (lista de textos) por disciplina; refletir os dois na prévia.
3. Extrair função pura `calcularDatasEtapasFluxo(etapas, dataInicioProjeto)` (testável
   isolada de UI).
4. `useProjetoForm.ts` `applyFluxo`: usar a função do passo 3; ao inserir as
   `projeto_disciplinas`, inserir junto as linhas de `projeto_disciplina_checklist` a
   partir de `checklist_padrao`.
5. Migration: tabela `projeto_disciplina_checklist` + RLS + trigger de recálculo de
   status. `npm run gen:types:local` local, depois `gen:types` (staging) antes do PR.
6. `DisciplinaDetailDialog.tsx`: nova seção "Checklist" (lista com checkbox, add/
   remove item, contador concluídos/total) na coluna principal.
7. Reescrever `FluxoPipeline.tsx`: caixas por etapa com disciplinas dentro, conector
   SVG medido via `getBoundingClientRect` + `ResizeObserver`, badge de checklist,
   estado "atrasado", `prefers-reduced-motion` respeitado, clique abre
   `DisciplinaDetailDialog`.
8. Testes: função de cascata (passo 3, unitário), trigger de status por checklist
   (pgTAP ou teste de integração), `FluxoPipeline` renderiza estados corretos por
   disciplina.

## Decisões e riscos

- Sem ADR: são extensões pontuais de uma feature existente (Fluxos), mesmo padrão já
  usado no módulo (RLS por join até `empresa_id`, trigger `SECURITY DEFINER` para
  regra de negócio no banco).
- **Conector do grafo é SVG desenhado à mão, não uma lib de grafo** (react-flow etc.):
  segue a mesma régua já registrada no ADR 0020 (headless sim, widget turnkey não) e
  aplicada à spec 046. A estrutura aqui é mais simples que um DAG genérico —
  sequência linear fixa de etapas, sem dependência cruzada — então medir posições
  reais das caixas e desenhar path bezier é barato e não introduz dependência nova.
- **Status automático por checklist é regra de negócio no banco (trigger), não no
  client**: evita ficar dependente de todo client que grava checklist também lembrar
  de atualizar o status, e cobre edição concorrente. Mesmo padrão de outros triggers
  `SECURITY DEFINER` já existentes no módulo de projetos.
- Risco: usuário pode esperar que mudar a `data_inicio` do projeto recalcule tudo em
  cascata automaticamente — fora de escopo (requisito 6); vale um toast avisando que
  o cálculo só acontece na aplicação do fluxo.
- Risco: se uma disciplina tiver checklist e o usuário tentar mudar o status
  manualmente para "Concluído" com itens pendentes, a UI deve deixar claro que o
  checklist é quem manda (ex.: desabilitar a opção "Concluído" no dropdown quando
  há checklist incompleto, com tooltip explicando) — detalhar no passo 6 do plano.
- Se o padrão de uso mostrar que falta recálculo automático de datas em atraso
  (fora de escopo aqui), revisitar como v2 própria, não expandir esta spec de novo.
