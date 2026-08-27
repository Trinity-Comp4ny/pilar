# SPEC: Obra inteligente — cronograma ⇄ diário + clima

**Data:** 2026-08-13
**Status:** Em implementação
**Autor:** Matheus (com design partner VRZ) + time de agentes
**Módulo:** obras

<!-- Origem: brain-dump do design partner (13/08). Decisões do CEO em
project_design_partner_obra_inteligente_2026-08-13 (memória). Hierarquia fechada
em 2 níveis; "cronograma rege materiais/MO/dinheiro" cortado (território ERP). -->

## Problema

Hoje o diário de obra (`obra_rdo`) é texto livre e **não fala** com o cronograma
(frentes + tarefas). Quem toca a obra digita "o que fez hoje" numa textarea, e o
avanço do cronograma depende de alguém editar as tarefas à parte. Resultado: ou o
cronograma vira enfeite desatualizado, ou o diário é registro solto sem efeito no
prazo. O design partner resumiu: "numa obra o que reina é o cronograma; quando não
é assim, obra com prazo não acaba". Além disso, etapas sensíveis a chuva
(concretagem, impermeabilização) são reprogramadas tarde, no susto.

## Objetivo

Fazer o **diário ser o ato de manter o cronograma vivo**: ao registrar o dia, o
chefe reporta contra as tarefas do cronograma, e o avanço da obra se atualiza
sozinho. E cruzar a previsão do tempo com as tarefas sensíveis a clima para
alertar **antes** que uma etapa caia num dia impossível.

Depois desta feature passa a ser possível: (a) abrir o cronograma e ver avanço
real derivado do que foi reportado no diário, sem edição paralela; (b) receber
alerta "concretagem de terça vai pegar chuva forte, reprograme".

**Fora de escopo:**

- Terceiro nível de hierarquia no cronograma (fica Frente → Tarefa; a sub-atividade
  é a observação da linha do diário).
- Cronograma "reger" materiais, mão de obra e dinheiro por etapa (custeio por etapa
  = ERP; MO depende do Timesheet dormente). Cortado.
- App de campo / PWA offline do pedreiro (é a spec 041, separada).
- Mover tarefa automaticamente por causa do clima (só sugere; quem move é o humano).
- Foto no diário (entra junto com o app de campo, spec 041).

## Requisitos

Funcionais:

1. No "registrar dia" (RDO), o usuário pode **selecionar tarefas do cronograma** da
   obra e, para cada uma, marcar um resultado: `avancou`, `concluiu` ou `parou`,
   com uma observação curta opcional (a sub-atividade / detalhe do que foi feito).
2. Se a tarefa ainda não existe, o usuário pode **criá-la inline** dentro do RDO,
   pendurada numa frente existente (nome + frente; datas ficam opcionais).
3. Ao salvar o RDO, para cada tarefa marcada `concluir`, o sistema **atualiza o
   status da tarefa para `concluida`**; `parou` marca a tarefa como sinalizada
   (campo de sinalização, sem virar status novo do cronograma). `avancou` só
   registra o vínculo (a tarefa segue em andamento).
4. O avanço da obra e o estado das frentes continuam **determinísticos**
   (`calcularAvanco`, `estadoFrenteCronograma`), agora alimentados pelas conclusões
   vindas do diário. Nenhum campo de "% manual".
5. A textarea "Atividades do dia" continua existindo para nota livre, mas deixa de
   ser o único jeito de registrar o que andou; quando há tarefas vinculadas, elas
   aparecem no card do dia listadas com seu resultado.
6. Uma tarefa pode ser marcada como **sensível a clima**, com um tipo
   (`concretagem`, `impermeabilizacao`, `pintura_externa`, `icamento`, `telhado`,
   `outro`).
7. O sistema cruza a janela prevista da tarefa sensível (`data_inicio`→`prazo`) com
   a previsão (`clima.ts`, obra já tem lat/long) e **gera um alerta** quando o dia
   da tarefa tem chuva relevante (para tipos de chuva) ou vento ≥ `VENTO_FORTE_KMH`
   (para içamento). O alerta cita a tarefa, a data e a razão, e linka para a tarefa
   no cronograma. Sugere reprogramar; não move nada.
8. O alerta de clima aparece: (a) como badge na barra da tarefa no Gantt da obra;
   (b) no painel/topo da aba da obra; (c) opcionalmente na central de notificações.

Não-funcionais:

- **RLS:** a tabela ponte `obra_rdo_tarefa` isola por `empresa_id` (ou por join à
  obra, seguindo o padrão de `obra_rdo`/`obra_tarefas`). Escrita só de quem já pode
  editar a obra (`canEdit`). Testar com `auth.uid()` de outra empresa: zero linhas.
- **Multi-tenant:** vínculo só entre RDO e tarefas da **mesma obra**.
- **Performance:** montar o seletor de tarefas do RDO e os alertas de clima sem
  full-scan; consultar tarefas por `obra_id`. Previsão do tempo é 1 fetch por obra,
  cacheado (react-query), não 1 por tarefa.

## Critérios de aceite

<!-- Checklist revisada em 27/08 contra o código real (estava toda desmarcada
apesar da feature estar funcionando — checkboxes nunca tinham sido atualizadas
desde a implementação). -->

- [x] Dado uma obra com frentes e tarefas, quando abro "registrar dia" e marco a
      tarefa "Concretar laje" como `concluiu` e salvo, então a tarefa fica
      `concluida` no cronograma e o avanço da obra recalcula.
- [ ] Dado que marquei uma tarefa como `parou`, quando salvo, então a tarefa
      aparece sinalizada (atenção) no Gantt, mas o avanço não a conta como concluída.
      **Gap real:** a coluna `sinalizada` é gravada (`obra_tarefas.sinalizada`), mas
      nenhuma tela lê ou exibe esse valor — zero indicação visual hoje.
- [x] Dado que a tarefa que fiz não existe, quando clico "criar tarefa" no RDO,
      informo nome e frente e salvo, então a tarefa nasce na frente e já fica
      vinculada ao dia com o resultado marcado.
- [x] Dado um RDO com tarefas vinculadas, quando vejo o card do dia no diário,
      então vejo cada tarefa com seu resultado e observação.
- [x] Dado uma tarefa `concretagem` agendada para um dia com chuva ≥ limiar, quando
      abro a obra, então vejo um alerta citando a tarefa, a data e "chuva prevista",
      com link para a tarefa.
- [x] Caso de borda: obra sem lat/long → nenhum alerta de clima e nenhum erro
      (degradação silenciosa, mensagem "defina a localização da obra para alertas de
      clima").
- [x] Caso de borda: usuário sem permissão de editar a obra não vê o botão de
      registrar dia nem consegue escrever em `obra_rdo_tarefa` (RLS).
- [x] Multi-tenant: RDO de uma empresa não consegue vincular tarefa de obra de outra.

## Dados e contratos

**Nova tabela `obra_rdo_tarefa`** (ponte RDO ⇄ tarefa):

- `id uuid pk`
- `rdo_id uuid` → `obra_rdo(id)` on delete cascade
- `tarefa_id uuid` → `obra_tarefas(id)` on delete cascade
- `resultado text check in ('avancou','concluiu','parou')`
- `observacao text null`
- `empresa_id uuid` (para RLS, preenchido no insert como nas outras tabelas de obra)
- `created_at timestamptz default now()`
- unique `(rdo_id, tarefa_id)`
- RLS: select/insert/update/delete por `empresa_id = get_user_empresa_id()`.

**Alteração em `obra_tarefas`:**

- `sensivel_clima text null check in ('concretagem','impermeabilizacao','pintura_externa','icamento','telhado','outro')`
- `sinalizada boolean default false` (para o resultado `parou` do diário).

Isto muda o schema → `npm run gen:types` após aplicar no staging, commitar `types.ts`
(o gate `types-sync` bloqueia se esquecer).

**Cálculo de alerta de clima:** função pura em `src/lib/obras.ts` (ou `clima.ts`)
que recebe as tarefas sensíveis (com janela) + `DiaPrevisao[]` e devolve
`{ tarefaId, data, motivo }[]`. Testável sem rede.

## Plano de implementação

Aprovar em plan mode antes de codar.

1. Migration `obra_rdo_tarefa` + colunas em `obra_tarefas` + RLS. Aplicar no staging
   pelo CD (nunca MCP direto), `gen:types`, commitar `types.ts`.
2. Hook `useObraRdoTarefas` (ler/escrever vínculos) + ajuste em `useCreateRdo`/
   `useUpdateRdo` para persistir os vínculos e aplicar o efeito no status da tarefa.
3. `RdoFormDialog`: seletor de tarefas do cronograma (checklist com resultado) +
   criar-tarefa inline. "Atividades" continua como nota livre.
4. `ObraDiarioTab`: card do dia lista as tarefas reportadas com resultado/observação.
5. `sensivel_clima` no form da tarefa (no `ObraCronogramaTab`).
6. Função pura de alerta clima × tarefa + testes; badge no Gantt + alerta no topo da
   obra; (opcional) empurrar para `notificacoes`.

## Decisões e riscos

- **Decisão:** hierarquia fica em 2 níveis (Frente → Tarefa); a sub-atividade é a
  observação da linha do diário. Evita migration grande e a multiplicação de
  digitação que mata adoção.
- **Decisão:** o loop é bottom-up (diário alimenta avanço), não top-down (cronograma
  comanda recursos). Alinhado à pesquisa AEC própria
  (`research/aec/SINTESE-conhecimento-obra-para-decisao-produto.md`).
- **Risco (o que decide tudo):** se o ICP não mantém o cronograma, o seletor de
  tarefas do RDO vem vazio e a feature morre. **Teste antes de codar:** pedir ao VRZ
  o cronograma real da obra atual. Sem tarefas cadastradas, priorizar o passo
  "criar tarefa inline" como entrada principal, não o seletor.
- **Risco:** clima sem lat/long. Degradar em silêncio com CTA para definir a
  localização da obra.
- Se o vínculo diário⇄tarefa virar decisão transversal de modelo, abrir ADR curto.
