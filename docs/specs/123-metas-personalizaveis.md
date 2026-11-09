# SPEC 123: Metas personalizáveis (sem tipo, por empresa ou colaborador, com período)

**Data:** 2026-10-15  
**Status:** Em implementação  
**Autor:** Matheus  
**Módulo:** gestao: metas

## Problema

"Nova meta" pergunta o tipo antes de tudo (financeira, pessoal, livre), e o tipo decide o
que dá para preencher. Só a meta financeira escolhe uma fonte automática (receita,
projetos...), só a pessoal exige colaborador, e nenhuma tem período. O sócio não consegue
dizer "faturar R$ 500 mil no ano que vem", "entregar 30 projetos em 2027" ou "o Rafael
entrega 5 projetos por mês" sem contornar o formulário.

Além do formulário, o motor trava a ideia: `rpc_sync_metas` olha sempre o ano (ou mês)
corrente, sempre a empresa inteira, ignora `pessoa_id`, e devolve 0 para quem não tem
acesso ao financeiro, inclusive para métrica que não é dinheiro.

## Objetivo

Uma meta é **indicador + alvo + período + escopo**, sem tipo. O sócio cria qualquer meta em
um formulário só, para a empresa toda ou para um colaborador, medida por um indicador do
sistema (calculado sozinho) ou à mão, num período fixo ou que se repete todo mês,
trimestre ou ano, com o histórico de cada período.

**Fora de escopo:**

- Meta de equipe ou de disciplina (só empresa ou uma pessoa).
- Meta manual recorrente (exigiria lançamento de valor por período).
- Colaborador (`role` abaixo de coordenador) ver a própria meta fora da ficha da pessoa. O
  módulo Metas segue restrito a admin e coordenador com concessão (ADR 0034, extensão).
- Aviso de "meta em risco" no sino.

## Requisitos

1. "Nova meta" é um botão só, sem escolha de tipo. O formulário tem: o que medir, alvo,
   período, para quem, nome (sugerido, editável), área e descrição (opcionais).
2. **O que medir:** "Acompanhar manualmente" ou um indicador do catálogo:
   - Financeiros (só empresa): faturamento recebido, lucro, margem média.
   - Projetos: projetos concluídos, projetos ativos (empresa ou colaborador).
   - Entregas: disciplinas concluídas, tarefas concluídas (empresa ou colaborador).
   - Comercial: leads ganhos (empresa).
3. Indicador automático: a unidade vem do indicador e o "atual" é calculado, nunca digitado.
   Manual: o sócio escolhe a unidade (R$, %, quantidade com rótulo livre, ex. "relatórios")
   e digita o atual.
4. **Período:** "Todo mês", "Todo trimestre", "Todo ano" (recorrente, só indicador
   automático) ou "Datas específicas" (início e fim; atalhos "Este ano", "Ano que vem",
   "Este trimestre", "Este mês"). Na meta manual, as datas são opcionais.
5. **Para quem:** "Empresa toda" ou uma pessoa. Com pessoa escolhida, só indicadores que
   aceitam pessoa ficam disponíveis; os outros aparecem desabilitados com o motivo.
6. Meta recorrente mostra o período corrente e o histórico dos últimos 6 períodos (cada um
   com seu atual e o percentual do alvo). O alvo vale para todo período.
7. "Projeto da pessoa" = projeto em que ela é responsável por ao menos uma disciplina
   (`projeto_disciplina_responsaveis`). "Entrega da pessoa" = disciplina concluída em que
   ela é responsável. Tarefa da pessoa = tarefa em que ela é responsável.
8. O progresso é calculado na leitura por RPC, por período. O front não grava mais `atual`
   de meta automática e o `setInterval` de 60 s sai.
9. Indicador financeiro exige `can_view_financeiro()`. Sem acesso, a meta aparece sem o
   valor atual ("Sem acesso ao valor"), em vez de 0. Indicador não financeiro não exige.
10. O dashboard deixa de ter as 3 colunas por tipo. Agrupa por escopo (Empresa, depois um
    grupo por colaborador), com filtro de escopo e de situação (em andamento, concluída,
    atrasada). O gráfico mostra o progresso médio por escopo.
11. As metas existentes continuam e se comportam igual: financeira com fonte vira indicador
    equivalente com recorrência "Todo ano" (ou "Todo mês" para `receita_mes`); pessoal e
    livre viram manual com a pessoa e a unidade que já tinham; `tipo` deixa de ser lido.
12. A ficha da pessoa lista as metas dela (todas as com `pessoa_id`), com o progresso
    calculado.

Requisitos não-funcionais:

- **Segurança / RLS:** as policies de `metas` não mudam (`user_has_feature('metas')`). As
  RPCs novas são `SECURITY DEFINER`, conferem `user_has_feature('metas','viewer')` e filtram
  por `get_user_empresa_id()`. A função de cálculo é interna (prefixo `_`), sem EXECUTE para
  `authenticated` nem `anon`.
- **Multi-tenant:** isolamento por `empresa_id` em todo SELECT do cálculo; `pessoa_id` de
  outra empresa não produz valor.
- **Performance:** uma chamada de RPC por carga da tela (todas as metas), não uma por meta.

## Critérios de aceite

- [ ] Dado o admin em Metas, quando clica "Nova meta", então abre direto o formulário, sem
      menu de tipo.
- [ ] Dado indicador "Faturamento recebido", alvo R$ 500.000 e datas 01/01/2027 a
      31/12/2027, quando salva, então a meta aparece com o recebido de 2027 calculado.
- [ ] Dado indicador "Projetos concluídos", pessoa Rafael, alvo 5 e período "Todo mês",
      quando 3 projetos em que ele é responsável de disciplina foram concluídos no mês, então
      a meta mostra 3 de 5 (60%) e o histórico lista os meses anteriores.
- [ ] Dado um projeto concluído em que o Rafael não é responsável de nenhuma disciplina,
      então ele não conta na meta do Rafael e conta na meta da empresa.
- [ ] Dado pessoa escolhida no formulário, quando abre "O que medir", então indicador
      financeiro aparece desabilitado.
- [ ] Dado "Todo mês" escolhido, quando troca para "Acompanhar manualmente", então a opção
      volta para "Datas específicas".
- [ ] Dado coordenador com concessão de metas sem acesso ao financeiro, quando abre meta de
      faturamento, então vê "Sem acesso ao valor" e a meta de projetos mostra o valor.
- [ ] Dado empresa B, quando chama a RPC com meta da empresa A, então não recebe linhas.
- [ ] Dado meta financeira antiga (`receita_total`), quando migra, então mostra o mesmo
      valor de antes, com recorrência "Todo ano".
- [ ] Caso de borda: alvo 0 não gera NaN nem Infinity (percentual 0).
- [ ] Caso de borda: virada de ano e de trimestre calculam a janela certa (Vitest).
- [ ] Caso de borda: meta recorrente consultada para um mês passado devolve só os projetos
      concluídos naquele mês.

## Dados e contratos

Migration `20261103000000_metas_personalizaveis.sql` (aditiva; `tipo` fica como legado):

- `metas.indicador text` (null = manual), com CHECK no catálogo.
- `metas.periodo_inicio date`. O fim é o `prazo` que já existe.
- `metas.recorrencia text NOT NULL DEFAULT 'nenhuma'` (`nenhuma|mensal|trimestral|anual`).
- `metas.unidade_rotulo text` (rótulo livre da unidade "quantidade").
- `metas.categoria` vira "área" opcional: CHECK trocado pela lista de áreas; valores
  antigos (`receita`, `entregas`...) migrados.
- `metas.tipo` DEFAULT passa a `'livre'`; o código para de ler.
- `_meta_valor(empresa, indicador, pessoa, inicio, fim)`: cálculo interno.
- `rpc_metas_progresso(p_ref date DEFAULT CURRENT_DATE)` devolve
  `(meta_id, atual, janela_inicio, janela_fim, restrito)` das metas da empresa.
- `rpc_meta_historico(p_meta_id uuid, p_periodos int DEFAULT 6)` devolve
  `(janela_inicio, janela_fim, atual, restrito)`, do mais recente para o mais antigo.
- `rpc_sync_metas` deixa de ser chamada pelo front; fica no banco só para o front antigo
  durante o deploy, reescrita para gravar o valor do período corrente via `_meta_valor`.
  Sai numa migration seguinte.

Datas de conclusão: projeto = `data_final`, senão a última transição para `Concluído` em
`projeto_status_historico`, senão `created_at`; disciplina = `data_fim_real`, senão
`updated_at`; tarefa = `updated_at` (a tabela não guarda a data de conclusão); lead =
`convertido_em`, senão `created_at`.

Catálogo no front: `src/lib/metas.ts` (chave, rótulo, unidade, aceita pessoa, financeiro,
pontual). Um teste confere que as chaves são as mesmas do CHECK da migration.

## Plano de implementação

1. Migration + `gen:types:local` + pgTAP (`supabase/tests/metas_progresso.sql`).
2. `src/lib/metas.ts` (catálogo, janela do período, percentual, nome sugerido, rótulo do
   período) + Vitest.
3. Hook `useMetasProgresso` e `useMetaHistorico`.
4. `MetaFormDialog` unificado; página sem dropdown de tipo.
5. `MetaCard`, dashboard por escopo e filtros, ficha da pessoa.
6. Typecheck, lint, testes, exercício do fluxo real, PR com antes e depois.

## Decisões e riscos

- Progresso calculado na leitura, não gravado: histórico por período sai da mesma função e
  some o `setInterval`. Custo: uma consulta por carga, com índice nas chaves já existentes.
- Tarefa concluída usa `updated_at`: editar uma tarefa já concluída muda o período dela.
  Aceito na v1; vira coluna `concluida_em` se incomodar.
- Atribuição de projeto pela disciplina assume que o escritório marca os responsáveis das
  disciplinas. Projeto sem responsável de disciplina só conta na meta da empresa.
- A fonte antiga "horas faturadas" lia `timesheets`, tabela removida em abril: nunca
  atualizou. Sai do catálogo e a meta que a usava vira manual, com o valor que tinha.
