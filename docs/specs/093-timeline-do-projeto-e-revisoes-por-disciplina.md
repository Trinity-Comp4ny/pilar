# SPEC: Timeline do projeto e revisões por disciplina

**Data:** 2026-09-04
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** projetos

<!-- Origem: feedback do Victor (sócio da VRZ, design partner) em 2026-09-04. -->

## Problema

O escritório não consegue reconstruir a história de um projeto. Cada evento importante
mora numa tabela diferente e, na tela, aparece só como estado atual: a disciplina mostra
`data_fim_real`, a pausa mostra "Pausada", o projeto mostra "Concluído". Não existe lugar
que responda "o que aconteceu nesse projeto, em ordem".

Duas consequências concretas para o ICP:

1. **Retrabalho invisível.** Revisão de disciplina não é registrada em lugar nenhum. Sem
   isso, ninguém sabe quantas vezes o estrutural foi refeito, nem que esse cliente pede
   3x mais revisão que a média. Retrabalho é hora de sócio que não é faturada.
2. **Prazo sem defesa.** "Atrasou 20 dias" e "atrasou 20 dias, dos quais 12 parados
   esperando o cliente confirmar a locação" são conversas diferentes. Os dados da segunda
   já existem (spec 084) mas ficam escondidos dentro do dialog da disciplina.

## Objetivo

O projeto ganha uma aba **Histórico**: um feed cronológico único, filtrável por
disciplina, que junta início, conclusão, pausa, retomada, revisão e mudança de escopo.
Depois desta feature é possível responder, sem abrir cinco telas: quando cada disciplina
começou, quanto tempo ficou parada e por quê, e quantas revisões teve.

**Fora de escopo (fast-follow):**

- **Categorizar a revisão** (cliente vs interna vs órgão aprovador). Decisão do Victor em
  2026-09-04: revisão é genérica no v1, o campo `motivo` em texto livre descreve o caso.
  Vira enum quando houver volume real para agrupar num relatório.
- **Numeração formal de revisão** (R00, R01 na prancha). Decisão do Victor: não existe.
  O contador da disciplina é derivado por `count`, nunca persistido.
- **Vínculo com contrato**: nada de "N revisões inclusas", nada de gerar aditivo a partir
  da revisão. Decisão do Victor: não liga com contrato ainda. A tabela fica extensível
  para isso (ver "Decisões e riscos").
- **Horas gastas por revisão** e o efeito na margem. Depende do vínculo com contrato acima.
- **Marcos de faturamento na timeline.** Evento financeiro tem RBAC próprio
  (`podeVerValor`); misturar na mesma view sem cuidado vaza valor para quem não pode ver.
- **Marcadores de pausa e revisão na barra do Gantt** (`CronogramaTab.tsx`). Mesma
  pendência já registrada como fast-follow na spec 084.
- **Anexo de arquivo por revisão.** Isso é gerenciador de documentos, outra feature.
- **Timeline no Portal do Cliente.** O portal está em 0% de uso na VRZ; não vale a
  superfície extra agora.

## Requisitos

1. Na disciplina, o usuário do escritório registra uma revisão informando **motivo
   obrigatório** e a data em que ela foi solicitada (default: hoje).
2. A revisão fica **em aberto** até ser marcada como concluída, com data de conclusão.
3. Uma disciplina tem no máximo **uma revisão em aberto** por vez.
4. O card e o dialog da disciplina mostram o **total de revisões** e sinalizam quando há
   revisão em aberto.
5. O projeto ganha uma aba **Histórico** com feed cronológico decrescente dos eventos:
   projeto iniciado, projeto concluído, mudança de status do projeto, disciplina iniciada,
   disciplina concluída, pausa iniciada, pausa retomada, revisão registrada, revisão
   concluída, escopo/aditivo aprovado.
6. O feed é **filtrável por disciplina** e cada item mostra data, quem registrou e o
   detalhe textual do evento (motivo da pausa, motivo da revisão).
7. Mudança de status do projeto passa a ser **gravada como evento**, a partir da entrega
   desta spec. Não há reconstrução retroativa (ver "Decisões e riscos").
8. Estado vazio orienta a primeira ação, em vez de mostrar lista em branco.

Não-funcionais:

- **Segurança / RLS:** as duas tabelas novas isolam por `empresa_id` via join até
  `projetos`, mesmo padrão de `projeto_disciplina_pausas`
  (`supabase/migrations/20260891000000_projeto_disciplina_pausas.sql`). As RPCs são
  `SECURITY DEFINER` e por isso fazem o **check de tenant explícito no corpo**.
- **View:** `v_projeto_timeline` criada com `security_invoker = true`, para herdar a RLS já
  correta das tabelas base (doutrina de
  `supabase/migrations/20260842000000_fecha_leak_cross_tenant_v_budget_vs_actual.sql`).
  Não precisa entrar em allowlist: as duas listas do repo
  (`supabase/tests/hardening_grants_search_path.sql` e `scripts/audit-security.mjs`)
  catalogam views que rodam como dona, ou seja, **sem** invoker. `leads_safe` está lá
  porque usa `security_barrier`, não invoker.
- **Performance:** a aba consulta sempre com `projeto_id` fixo. Cada braço do `UNION ALL`
  precisa filtrar por projeto usando índice; validar com `EXPLAIN` que não há seq scan em
  `projeto_disciplinas` nem em `escopo_historico`.
- **Multi-tenant:** nenhum braço da view pode retornar linha sem passar por `projetos.empresa_id`.

## Critérios de aceite

- [ ] Dado uma disciplina "Em Andamento", quando registro uma revisão com motivo, então
      ela aparece na lista da disciplina como em aberto e o contador vai para 1.
- [ ] Dado uma revisão em aberto, quando tento registrar outra na mesma disciplina, então
      a operação falha com mensagem clara.
- [ ] Dado uma revisão em aberto, quando marco como concluída, então `concluida_em` é
      gravada e uma nova revisão pode ser registrada.
- [ ] Dado motivo vazio ou só espaços, quando tento registrar, então a RPC recusa.
- [ ] Dado um usuário de outra empresa, quando chama a RPC com o id da disciplina, então
      recebe erro de permissão e nada é gravado.
- [ ] Dado um projeto com disciplina iniciada, pausada, retomada e revisada, quando abro a
      aba Histórico, então vejo os 4 eventos em ordem cronológica decrescente com autor e data.
- [ ] Dado o filtro por disciplina aplicado, quando escolho uma disciplina, então só
      eventos dela e do projeto aparecem.
- [ ] Dado um projeto sem nenhum evento além da criação, quando abro a aba, então vejo o
      estado vazio orientando a primeira ação, não uma lista em branco.
- [ ] Caso de borda: disciplina excluída (`ON DELETE CASCADE`) não deixa evento órfão na view.
- [ ] Caso de borda: revisão registrada com data retroativa aparece na posição cronológica
      correta, não no topo.

## Dados e contratos

**Tabela nova** `projeto_disciplina_revisoes`:

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid pk | |
| `projeto_disciplina_id` | uuid not null | FK `projeto_disciplinas`, `ON DELETE CASCADE` |
| `motivo` | text not null | livre; é o "campo que especifica" a revisão |
| `solicitada_em` | date not null default `current_date` | aceita retroativo |
| `registrada_por` | uuid null | FK `pessoas`, `ON DELETE SET NULL` |
| `concluida_em` | date null | null = em aberto |
| `concluida_por` | uuid null | FK `pessoas` |
| `created_at` | timestamptz not null default `now()` | |

Índice único parcial em `(projeto_disciplina_id) WHERE concluida_em IS NULL`: garante o
requisito 3 no banco, não só na UI.

**Tabela nova** `projeto_status_historico`: `projeto_id`, `de`, `para`, `mudado_em`,
`mudado_por`. Append-only por trigger em `projetos`. Existe porque hoje `projetos.status`
guarda só o valor atual e `status_data` só a última mudança: sem essa tabela, a coluna
"mudança de status" da timeline é impossível, agora e no futuro.

**RPCs** (`SECURITY DEFINER`, check de tenant no corpo, `REVOKE ALL` + `GRANT EXECUTE TO authenticated`):

- `rpc_registrar_revisao(p_disciplina_id uuid, p_motivo text, p_solicitada_em date default current_date) returns uuid`
- `rpc_concluir_revisao(p_revisao_id uuid, p_concluida_em date default current_date) returns void`

**View** `v_projeto_timeline` (`security_invoker = true`), shape que o front consome:

```
projeto_id        uuid
disciplina_id     uuid null   -- null = evento do projeto, não de disciplina
disciplina_nome   text null
tipo              text        -- 'projeto_iniciado' | 'projeto_concluido' | 'status_alterado'
                              -- | 'disciplina_iniciada' | 'disciplina_concluida'
                              -- | 'pausa_iniciada' | 'pausa_retomada'
                              -- | 'revisao_registrada' | 'revisao_concluida'
                              -- | 'escopo_alterado'
ocorrido_em       timestamptz
detalhe           text null   -- motivo da pausa, motivo da revisão, "de X para Y"
autor_nome        text null
```

`UNION ALL` das fontes que já existem (`projetos`, `projeto_disciplinas`,
`projeto_disciplina_pausas`, `escopo_historico`) mais as duas tabelas novas. Nenhuma fonte
existente é duplicada em tabela de evento: a verdade continua na tabela dona, a view só lê.

## Plano de implementação

A preencher em plan mode antes de gerar código. Ordem pretendida:

1. Migration: `projeto_disciplina_revisoes` + índice único parcial + RLS + as 2 RPCs.
2. Migration: `projeto_status_historico` + trigger em `projetos` + RLS.
3. Migration: índice em `escopo_historico(escopo_id)` (hoje a tabela só tem PK, e sem esse
   índice o braço de escopo do UNION cai em seq scan) e `v_projeto_timeline` com
   `security_invoker = true`.
4. `npm run gen:types:local`, validar, depois `gen:types` contra staging antes do PR (o job
   `types-sync` do CI bloqueia divergência).
5. pgTAP das RPCs: motivo vazio, revisão duplicada em aberto, tenant errado, conclusão.
6. Hook `useProjetoTimeline(projetoId)` + hook de revisões da disciplina.
7. UI da revisão em `DisciplinaDetailDialog.tsx`, seguindo o padrão visual do bloco de
   pausas já existente (`FormDialog` `sm` para o motivo obrigatório).
8. Aba Histórico em `ProjetoDetailTabs.tsx` (hoje: disciplinas, pagamentos, escopo), com
   filtro por disciplina e `EmptyState`.
9. Contador de revisões no card da disciplina.

## Decisões e riscos

- **Híbrido view + tabela, não tabela de eventos única.** A alternativa de materializar
  tudo numa `projeto_eventos` alimentada por trigger exigiria backfill dos projetos
  existentes e criaria duas fontes de verdade para o mesmo fato. A view custa mais no
  `SELECT` e ganha em não divergir. Se o `EXPLAIN` mostrar problema com projeto grande, o
  caminho é materializar a view, não trocar de modelo.
- **Histórico de status não é retroativo.** Projeto que passou por "Revisão" no mês passado
  não tem esse dado em lugar nenhum e não dá para reconstruir. A timeline nasce pobre nos
  projetos antigos e enche daqui para frente. Isso é argumento para começar agora, e
  precisa ser dito ao Victor para não parecer bug.
- **Revisão genérica é aposta consciente.** Sem separar cliente de interna, o relatório
  futuro não distingue retrabalho cobrável de controle de qualidade interno. Decisão do
  Victor para não travar o v1. A migração depois é aditiva (coluna `origem` com default),
  sem quebrar o que já foi registrado.
- **Extensibilidade guardada:** `aditivo_id` e `horas_gastas` são as duas colunas que ligam
  revisão a dinheiro. Ficam de fora agora, entram sem reescrever a tabela quando o vínculo
  com contrato for decidido. Aí a revisão passa a alimentar o guardião de margem
  ([spec 081](081-guardiao-de-margem-aditivo-preparado.md), [spec 083](083-orcamento-vivo-por-disciplina.md)).
- **Débito de segurança herdado:** a spec 084 registrou que
  `recalc_disciplina_status_por_checklist` é `SECURITY DEFINER` sem check de tenant.
  Continua aberto e não é resolvido aqui.
