# SPEC: Painel de gestão no Início

**Data:** 2026-09-04
**Status:** Em implementação
**Autor:** Matheus Rezende (pedido original: Bruno, VRZ)
**Módulo:** dashboard (inicio) · leads · propostas · projetos · financeiro

## Problema

O sócio de escritório não sabe **onde está indo mal**. Ele sente (perdeu proposta,
entregou atrasado, margem sumiu) mas não consegue apontar a causa nem ver se está
melhorando ou piorando. Hoje o dado existe espalhado em 6 telas do Pilar e ninguém
soma: propostas em `/gestao/propostas`, funil em `/gestao/leads`, prazo dentro de cada
projeto, margem em Relatórios. `/inicio` é uma página de atalho (barra dos agentes,
radar de vencimentos, calendário), não uma página de leitura.

Pedido literal do Bruno (VRZ, 04/09): "indicadores de gestão, métrica de comercial e
métrica de projeto: quantas propostas enviadas, perdidas, ganhas, quantas viraram
cliente; quantos entregues atrasados, quantos no prazo. Numa tela, com gráfico ou
número mesmo, porcentagem, porque aí a gente consegue entender onde a gente tá indo
mal e onde precisa melhorar."

## Objetivo

`/inicio` passa a responder, sem clique, quatro perguntas de sócio: **estamos
vendendo? estamos entregando no prazo? o escritório está rendendo, e quem está
sobrecarregado? e onde exatamente estamos indo mal?** Cada indicador vem com tendência
(série histórica), não com número solto, e cada bloco leva à tela-fonte já filtrada.

**O painel não tem nenhum dado financeiro.** Receita, custo, margem, caixa e faturamento
não entram, nem mascarados: seguem no Financeiro, visível só para admin e coordenador com
`financeiro_delegado` (ADR 0034). Consequência direta: a tela serve a qualquer papel, sem
bloco condicional, e pode ficar numa TV do escritório sem expor dinheiro a estagiário,
cliente ou visitante.

**Fora de escopo:**

- Qualquer indicador financeiro. Não é "esconder por permissão", é não existir aqui.
- Construtor de dashboard (usuário escolhe/arrasta widget). O painel é fixo por
  módulo habilitado.
- Relatório exportável novo. Export continua em `/relatorios`.
- Reviver módulo dormente (Projeção de caixa, DRE, WIP, Capacidade, Timesheet, Metas).
  O painel só consome o que está vivo, com uma exceção declarada (`metas` como linha
  de alvo, fase 3).
- BI genérico com query livre. Se o usuário quer cortar dado de outro jeito, é
  `/relatorios` ou os agentes.

## O desenho da tela

### Princípio: número âncora + série + causa

Todo bloco do painel é uma das três coisas, nesta ordem de importância:

1. **Âncora**: o número que responde a pergunta ("62% de conversão").
2. **Série**: a mesma medida no tempo, para dizer se melhora ou piora.
3. **Causa**: a decomposição que aponta onde agir (por motivo, por disciplina,
   por cliente). É o bloco que responde o "onde a gente tá indo mal" do Bruno, e é
   o que o pedido original não tinha.

Bloco que não é nenhuma das três não entra. Máximo 3 séries por gráfico.

### Layout (desktop, 12 colunas)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Início                                        [Mês ▾] [Modo TV] [atualizado│
├─────────────────────────────────────────────────────────────────────────────┤
│ LEITURA DO PAINEL (1 frase, gerada 1x/dia pelos agentes, fase 3)          │
│ "3 de 9 propostas decididas foram ganhas este mês (33%), abaixo dos 46% do │
│  trimestre. 2 projetos com prazo estourado, ambos em Elétrica."            │
├──────────────┬──────────────┬──────────────┬──────────────┬────────────────┤
│ CONVERSÃO    │ NO PRAZO     │ CONCLUÍDAS   │ DESVIO HORAS │ NA MÃO DO      │
│ 41%          │ 71%          │ 34           │ +14%         │ CLIENTE: 11    │
│ ▁▂▃▅▄▆ +6pp  │ ▆▅▃▂▂▁ -7pp  │ ▅▆▄▅▃▄ -15%  │ ▂▃▃▄▅▅ +3pp  │ ▃▄▄▅▅▆ +2      │
│ decid., 90d  │ concl., 6m   │ esta semana  │ acima do est.│ 4 há +30 dias  │
├──────────────┴──────────────┴──────────────┴──────────────┴────────────────┤
│                                                                             │
│  ── COMERCIAL ──────────────────────────────────────────────────────────    │
│  ┌───────────────────────────────┬───────────────────────────────────────┐  │
│  │ Funil de propostas (em nº)    │ Conversão mês a mês (12m)             │  │
│  │ Rascunho, nunca enviada  ██ 6│  ██ ganhas  ██ perdidas               │  │
│  │ Enviada, sem decisão  █████ 11│  painel de baixo: ─ taxa de conversão │  │
│  │ Aceita                ████  9 │                                       │  │
│  │ Recusada              ████ 10 │  (duas escalas, dois painéis, um eixo │  │
│  │ Expirada              █     3 │   x compartilhado; nunca eixo duplo)  │  │
│  └───────────────────────────────┴───────────────────────────────────────┘  │
│  ┌───────────────────────────────┬───────────────────────────────────────┐  │
│  │ Por que perdemos (Pareto)     │ Origem do lead × taxa de ganho        │  │
│  │ Preço          ███████ 9      │ Indicação   ████████ 12  (58% ganho)  │  │
│  │ Prazo          ████ 5         │ Instagram   █████ 8      (12% ganho)  │  │
│  │ Sem resposta   ███ 4          │ Site        ███ 4        (25% ganho)  │  │
│  │ Escopo         ██ 2           │ ← onde investir esforço comercial     │  │
│  └───────────────────────────────┴───────────────────────────────────────┘  │
│                                                                             │
│  ── ENTREGA ────────────────────────────────────────────────────────────     │
│  ┌──────────────┬──────────────────┬─────────────────────────────────────┐  │
│  │ Semáforo de  │ Pontualidade 12m │ Atraso médio por disciplina (dias)  │  │
│  │ prazo        │ ─ % no prazo     │ Elétrica    ████████ 14             │  │
│  │ 12 no prazo  │ ▁▃▅▆▄▃▂▁▂▃▄▅     │ Hidráulica  █████ 9                 │  │
│  │  3 em risco  │                  │ Estrutural  ██ 3                    │  │
│  │  2 estourado │                  │ Arquitetura █ 1                     │  │
│  └──────────────┴──────────────────┴─────────────────────────────────────┘  │
│  ┌───────────────────────────────┬───────────────────────────────────────┐  │
│  │ Status dos ativos (empilhada) │ Horas: estimado vs real (top 8)       │  │
│  │ ██ Planej ██ Andam ██ Revisão │ barras divergentes por projeto        │  │
│  │ ██ Paralisado                 │ ← onde o escopo está corroendo        │  │
│  └───────────────────────────────┴───────────────────────────────────────┘  │
│                                                                             │
│  ── PRODUTIVIDADE ─────────────────────────────────────────────────────────     │
│  ┌───────────────────────────────┬───────────────────────────────────────┐  │
│  │ Ritmo de entrega (12 semanas) │ Horas: estimado x real (top 8)        │  │
│  │ tarefas concluídas/semana     │ divergente no zero, em %              │  │
│  │ ██ ██ ██ ▓▓ ██ ██  ─ média 40 │ Vila Rica      ████ +38%              │  │
│  │ (âmbar = semana abaixo)       │ Ponte C. Fundo ██ -12%                │  │
│  └───────────────────────────────┴───────────────────────────────────────┘  │
│  ┌───────────────────────────────┬──────────────┬────────────────────────┐  │
│  │ Carga da equipe               │ Esperando    │ Retrabalho/disciplina  │  │
│  │ Marcos A.  ██████▓▓  9        │ aprovação    │ Elétrica    ████ 2,4   │  │
│  │ Fernando L ████▓▓▓   8  ← 3   │ 22 d, 18 d,  │ Arquitetura █ 0,8      │  │
│  │ Júlia R.   ██████    6    atr.│ 11 d, 6 d... │ revisões por entrega   │  │
│  │ ██ em dia  ██ atrasada        │ 6 pendentes  │                        │  │
│  └───────────────────────────────┴──────────────┴────────────────────────┘  │
│                                                                             │
│  ── AÇÃO (o que já existe hoje, mantido no rodapé) ─────────────────────     │
│  Radar dos agentes · barra "pergunte aos agentes" · calendário de prazos    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Modo TV (`/inicio?tv=1`)

Mesma fonte de dados, layout separado: tela cheia, tipografia grande (número âncora
em 72px+), zero campo de input, sem hover. As seções viram **cenas** que rotacionam
sozinhas a cada 20 s (Comercial → Entrega → Produtividade), com a faixa de âncoras
sempre fixa no topo. Auto-refresh de 5 min com marca de frescor visível.

Em modo TV o painel **troca nome de pessoa por iniciais** por padrão. Carga da equipe e
prazo por responsável são úteis para o sócio redistribuir trabalho, e viram exposição
pública quando ficam numa parede que estagiário, cliente e visitante enxergam. Não há
máscara de dinheiro a aplicar, porque não há dinheiro na tela.

### O que o pedido do Bruno não tinha e entra

| Bloco | Por que vale mais que o número pedido |
|---|---|
| Motivo de perda em Pareto | "quantas perdidas" diz o tamanho do problema; o motivo diz o que consertar |
| Origem do lead × taxa de ganho | mostra onde o esforço comercial rende, não só quanto entrou |
| Atraso médio por disciplina | "quantos atrasados" não diz onde; a disciplina diz |
| Pontualidade 12 meses (série) | número solto de atraso não diz se está melhorando |
| Tempo de espera da proposta | separa "o cliente está pensando" de "já perdemos e ninguém deu baixa" |
| Ritmo de entrega semanal | mostra queda de produção antes de o prazo estourar |
| Horas estimado vs real | mostra o projeto que já queimou a folga, sem citar dinheiro |
| Carga da equipe (em dia vs atrasada) | atraso concentrado numa pessoa é problema de distribuição, não de cobrança |
| Fila de aprovação de escopo | escopo pendente é trabalho andando sem cobertura |
| Retrabalho por disciplina | revisão repetida é a causa invisível do atraso |

## Requisitos

1. `/inicio` mostra a faixa de 5 números-âncora, cada um com série curta (sparkline) e
   variação vs período anterior.
2. O painel mostra as seções Comercial, Entrega e Produtividade, cada uma só se o
   módulo correspondente está habilitado na empresa (`can()`). Nenhuma seção depende de
   acesso financeiro, porque nenhuma exibe dinheiro.
3. Todo bloco clicável navega para a tela-fonte com o filtro equivalente aplicado
   (ex.: clicar em "2 estourado" abre `/projetos` filtrado por prazo estourado).
4. Todo bloco que depende de histórico e não tem dado suficiente mostra estado vazio
   explicando o que falta ("precisa de 3 meses de propostas decididas"), nunca gráfico
   vazio ou 0%.
5. Nenhum bloco exibe valor monetário, percentual de margem ou qualquer derivada de
   receita e custo. Onde a medida natural seria dinheiro, o painel usa a medida física
   equivalente: proposta em contagem (não em R$), esforço em horas (não em custo).
6. `/inicio?tv=1` renderiza o modo TV com rotação de cenas, sem input, e com nome de
   pessoa reduzido a iniciais por padrão.
7. Seleção de período (mês / trimestre / ano) afeta as seções, não as âncoras de
   janela fixa (90 dias, 6 meses, 12 meses), que declaram a própria janela no rótulo.
8. Os blocos de hoje (radar, barra dos agentes, calendário) continuam na página, no
   rodapé.

Não-funcionais:

- **Segurança / RLS:** toda agregação roda em RPC `SECURITY DEFINER` com `empresa_id`
  vindo de `auth.uid()`, nunca de parâmetro. Nenhuma coluna de folha/PII entra no
  retorno. A RPC **não seleciona coluna monetária de nenhuma tabela**: sem `valor`,
  `valor_proposto`, `custo_*`, `valor_contrato` ou `valor_aditivo` em nenhuma CTE. É a
  forma mais forte de respeitar o ADR 0034 aqui, porque não existe caminho de vazamento
  a proteger, nem sob impersonation.
- **Performance:** o painel faz **uma** chamada agregada, não N queries de linhas
  (o `useDashboardData` atual traz linhas e soma no client, o que não escala para 12
  meses). Orçamento: p95 < 800 ms com 200 projetos e 5 anos de lançamentos. Exige
  índice por `(empresa_id, <coluna de data>)` nas tabelas agregadas.
- **Multi-tenant:** isolamento por `empresa_id` em cada CTE da RPC.
- **Cache:** `staleTime` 5 min, `refetchInterval` 5 min em modo TV; a leitura em
  linguagem natural (fase 3) é gerada 1x/dia e persistida, para não queimar token a
  cada refresh (ADR 0035).

## Critérios de aceite

- [ ] Dado usuário admin, quando abre `/inicio`, então vê as 5 âncoras e as 3 seções, e
      a página faz 1 chamada de dado agregado (verificável na aba Network).
- [ ] Dado usuário **sem** acesso a financeiro (equipe, ou coordenador sem delegação),
      quando abre `/inicio`, então vê exatamente a mesma tela do admin: nenhuma seção
      falta, porque nenhuma depende de dinheiro.
- [ ] Dado qualquer papel, quando se inspeciona a resposta da RPC, então ela não contém
      nenhum campo monetário. Este teste roda no SQL, não na tela (grep de coluna
      proibida no corpo da função, mais um teste pgTAP sobre o JSON retornado).
- [ ] Dada uma segunda empresa com dado no banco, quando o sócio da primeira abre o
      painel, então nenhum número inclui a linha da outra empresa. A RPC é
      `SECURITY INVOKER`: o teste roda como usuário autenticado, nunca como superuser,
      senão o RLS não se aplica e o teste passa por acidente.
- [ ] Dada empresa com 1 mês de uso, quando abre `/inicio`, então os blocos de série
      mostram o estado vazio com o que falta, e a página não exibe 0% nem gráfico
      chapado.
- [ ] Dado projeto concluído com `data_final <= data_previsao_original`, quando o
      painel calcula pontualidade, então ele conta como "no prazo"; com
      `data_final > data_previsao_original`, conta como atrasado.
- [ ] Dada disciplina com `data_fim_real > data_fim`, quando o painel agrega atraso por
      disciplina, então o atraso desconta os dias em `projeto_disciplina_pausas`
      (pausa documentada não é atraso da equipe, spec 084).
- [ ] Dada proposta com `validade` no passado e status `enviada`, quando o painel monta
      o funil, então ela aparece como "Expirada", igual à regra da tela de propostas.
- [ ] Dado `/inicio?tv=1`, quando passam 20 s, então a cena troca sozinha e nenhum
      campo de texto está focável.
- [ ] Dado `/inicio?tv=1`, quando a cena Produtividade aparece, então nome de pessoa
      está reduzido a iniciais em todo bloco (carga da equipe e prazo por responsável).
- [ ] Caso de borda: empresa com 0 propostas decididas no período → âncora de conversão
      mostra "sem decisão no período", não "0%".
- [ ] Caso de borda: projeto sem `data_previsao` não entra em nenhum cálculo de prazo
      (nem como no prazo, nem como atrasado) e o rótulo informa quantos foram ignorados.

## Dados e contratos

### O que já dá com o schema atual (fase 1, sem migration)

| Bloco | Fonte |
|---|---|
| Funil de propostas, só em contagem | `propostas.status`, `validade` (nunca `valor_proposto`) |
| Tempo de espera da proposta | `propostas.status = enviada` + `updated_at` na fase 1, `enviada_em` na fase 2 |
| Origem do lead × taxa de ganho | `leads.origem`, `status`, `convertido_em` |
| Semáforo e status de projetos | `projetos.status`, `data_previsao`, `data_final` |
| Prazos dos próximos 15 dias | `projeto_disciplinas.data_fim` + `projeto_disciplina_responsaveis` |
| Atraso por disciplina | `projeto_disciplinas.data_fim`/`data_fim_real`, `justificativa_atraso`, `projeto_disciplina_pausas` |
| Horas estimado vs real | `projeto_disciplinas.horas_estimadas`/`horas_realizadas` (horas, nunca custo) |
| Ritmo de entrega semanal | `tarefas.status` + data de conclusão |
| Carga da equipe | `tarefas`/`projeto_disciplinas` abertas por responsável, com flag de atraso |
| Fila de aprovação | `escopos.status = pendente_aprovacao` + `created_at` (contagem e dias, sem `valor_aditivo`) |

### Buracos de dado que limitam o painel (fase 2, exigem migration)

1. **`propostas` não registra quando mudou de estado, e `updated_at` não serve de
   substituto.** Só existe `created_at`, `updated_at` e `status` atual, e o trigger
   `handle_record_audit` (000_base_schema) faz `NEW.updated_at = NOW()` em **todo**
   insert e update: `updated_at` é a data da última edição, não da decisão. Logo
   "quantas enviadas no mês" e "ciclo médio de venda" não são calculáveis hoje, e
   agrupar decisão por `updated_at` produziria um gráfico que muda de forma sozinho
   quando alguém reabre uma proposta antiga para corrigir um typo.
   **O que a fase 1 entrega no lugar:** conversão por *coorte de entrada* (das
   propostas criadas no mês X, quantas fecharam), que é bem definida com o schema
   atual, e tempo de espera pela *idade* da proposta (`created_at`), não pelo tempo
   desde o envio. `audit_logs` tem o histórico real (trigger `tr_audit_propostas`,
   019), mas com retenção de 365 dias na tabela quente e formato de auditoria, não de
   BI. → adicionar `enviada_em`, `decidida_em timestamptz` + trigger que grava na
   transição, com backfill best-effort de `audit_logs`.
2. **`projetos.data_previsao` é editável e não tem baseline.** Se o prazo é empurrado
   quando atrasa, a pontualidade histórica mente por construção (o projeto sempre
   "entregou no prazo" do último prazo). → `data_previsao_original` congelada no
   primeiro salvamento, e é ela que o painel usa. Este é o requisito que decide se o
   indicador de prazo tem valor ou não.
3. **`leads.motivo_perda` é texto livre.** Pareto de motivo com texto livre vira 30
   barras de 1. → vocabulário controlado curto (preço, prazo, escopo, sem resposta,
   concorrente, projeto cancelado, outro) + campo livre opcional ao lado.
4. **Não existe histórico de status de projeto.** `status_data` guarda só a data do
   status atual, então não dá pra medir tempo em cada estágio nem detectar projeto
   parado há 40 dias em "Revisão". O dado passado é irrecuperável: nunca foi gravado.
   → tratado na [SPEC 093](./093-timeline-do-projeto-e-revisoes-por-disciplina.md); o
   painel consome quando existir.
5. **Não existe contador de revisão por disciplina.** O bloco de retrabalho (quantas
   vezes cada entrega volta) depende do mesmo registro de ciclo da SPEC 093.

### Contrato

RPC única `get_painel_gestao(p_periodo_inicio date, p_periodo_fim date)`, retorno JSON
com uma chave por bloco, cada bloco já agregado. Sem chave anulável por permissão,
porque nenhum bloco é condicionado a acesso financeiro:

```ts
type PainelGestao = {
  ancoras: { conversao: Ancora; prazo: Ancora; concluidas: Ancora; desvioHoras: Ancora; aguardandoCliente: Ancora };
  comercial: { funil: FunilEtapa[]; conversaoMensal: PontoMensal[]; motivosPerda: Fatia[]; esperaProposta: Fatia[]; origemGanho: OrigemGanho[] } | null;
  entrega: { semaforo: Semaforo; statusAtivos: Fatia[]; pontualidadeMensal: PontoMensal[]; atrasoPorDisciplina: Fatia[]; prazos15Dias: PrazoDisciplina[] };
  produtividade: { throughputSemanal: PontoSemanal[]; horasPorProjeto: HorasProjeto[]; cargaEquipe: CargaPessoa[]; filaAprovacao: Aprovacao[]; revisoesPorDisciplina: Fatia[] };
  cobertura: { desde: string | null; projetosSemPrazo: number; propostasSemHistorico: number; leadsSemMotivoPadrao: number };
};

// Unidade nunca é "brl": este painel não expressa nada em dinheiro.
type Ancora = { valor: number | null; unidade: "pct" | "int" | "horas"; serie: number[]; variacao: number | null; janela: string };
type CargaPessoa = { pessoaId: string; nome: string; iniciais: string; emDia: number; atrasada: number };
```

`iniciais` vem pronto do servidor para o modo TV não precisar derivar nome na tela.
`cobertura` alimenta os estados vazios honestos do requisito 4.

`cobertura` é o que alimenta os estados vazios honestos do requisito 4.

## Plano de implementação

A preencher em plan mode. Fatiamento proposto:

1. **Fase 1, painel com o schema atual.** RPC `get_painel_gestao` (só os blocos da
   tabela "já dá"), hook `usePainelGestao`, seções Comercial/Entrega/Produtividade em
   `/inicio`, blocos de hoje para o rodapé. Pontualidade sai já usando
   `data_previsao_original` se existir, com fallback declarado para `data_previsao`.
2. **Fase 2, fechar os buracos.** Migration com `propostas.enviada_em`/`decidida_em`
   + trigger, `projetos.data_previsao_original` + backfill, `leads.motivo_perda`
   controlado (com migração dos textos existentes para o vocabulário). Liga ciclo de
   venda, conversão mensal honesta e Pareto de perda.
3. **Fase 3, modo TV e leitura automática.** `/inicio?tv=1` com rotação de cenas e
   iniciais no lugar de nome, e a frase de leitura gerada 1x/dia pelos agentes,
   persistida (ADR 0035). Linha de alvo nos gráficos a partir de `metas`, se o módulo
   for reativado. O bloco de retrabalho por disciplina entra quando a SPEC 093 gravar
   o ciclo de revisão.

## Decisões e riscos

- Decisão de direção: `/inicio` deixa de ser página de atalho e passa a ser painel de
  gestão → [ADR 0037](../architecture/adr/0037-inicio-e-painel-de-gestao-nao-atalho.md).
- **Risco 1 (o principal): indicador sem baseline mente.** Sem
  `data_previsao_original`, a pontualidade fica bonita e falsa. Se a fase 2 não vier,
  o bloco de pontualidade histórica precisa sair, não ficar com asterisco.
- **Risco 2: empresa nova vê painel vazio.** VRZ e CBSP têm poucos meses de dado. O
  estado vazio honesto (requisito 4) é o que separa "ferramenta que ainda não tem o
  que dizer" de "ferramenta quebrada".
- **Risco 3: pessoa na parede.** Dinheiro foi resolvido por exclusão (não existe na
  tela), mas carga e atraso por responsável continuam sendo dado sobre gente. Iniciais
  por padrão em modo TV é requisito, não opção, e nenhum bloco ordena pessoas por
  desempenho: a ordenação é por volume de trabalho aberto, que é o que o sócio precisa
  para redistribuir.
- **Risco 4: virar galeria de gráfico.** A regra "âncora, série ou causa" existe para
  barrar o gráfico bonito que ninguém age sobre. Bloco que não muda decisão sai.
- Decisão do CEO em 04/09, já incorporada: **nada financeiro nesta tela.** A versão
  anterior desta spec tinha uma seção Dinheiro (faturamento previsto vs real, margem por
  projeto, aging, concentração de cliente, aditivos). Ela saiu inteira, e o eixo
  Produtividade entrou no lugar. Os blocos financeiros descartados continuam válidos
  como ideia, e o lugar deles é o Financeiro, para quem tem acesso.
- Suposição a validar com o Bruno: ele pediu comercial e projeto. Produtividade entrou
  por decisão do CEO e é a aposta desta spec; vale confirmar com ele se carga da equipe
  e ritmo de entrega são leitura de sócio ou de coordenador.
