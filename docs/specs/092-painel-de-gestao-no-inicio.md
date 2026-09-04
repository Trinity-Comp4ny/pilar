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

`/inicio` deixa de ser página de atalho e passa a ser **o painel do escritório, montado
pelo usuário**: a tela nasce enxuta, com os números que o sócio cobra de cabeça (projetos
ativos, concluídos no ano, com prazo estourado, conversão de proposta), e cresce só onde
a pessoa escolhe, escolhendo também o tamanho de cada bloco. Ver
[ADR 0038](../architecture/adr/0038-painel-configuravel-por-usuario.md).

Três seções, uma por módulo do produto: **Gestão, Projetos e Obras**, mais **Financeiro**
no catálogo de quem pode ver dinheiro. Esse corte substitui o anterior (Comercial /
Entrega / Produtividade), que era taxonomia analítica e não batia com os módulos que o
usuário navega no resto do sistema.

**O layout padrão não tem nenhum widget financeiro.** Dinheiro no `/inicio` é opt-in de
quem já pode ver dinheiro em qualquer outra tela: os widgets `fin_*` existem no catálogo,
mas só são servidos a quem passa em `can_view_financeiro()` (ADR 0034), e o filtro é no
servidor, não na renderização.

**Fora de escopo:**

- Widget financeiro no layout **padrão**. Ele existe no catálogo, mas ninguém abre a tela
  pela primeira vez com dinheiro nela.
- Layout por empresa, ou herança de layout entre papéis. O layout é do usuário, e o
  padrão é do front (ADR 0038).
- Modo TV e máscara de nomes. Saíram: o painel é privado por usuário, então não há
  parede pública a proteger. Se a TV voltar, volta por decisão própria.
- Gráfico com dimensão livre escolhida pelo usuário (eixo, filtro, agrupamento). O
  catálogo é fechado: o usuário escolhe QUAIS indicadores e o tamanho, não redefine o
  que cada um mede.
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

### Layout: grade de 12 colunas, quatro tamanhos

O usuário escolhe o tamanho de cada widget, e o catálogo declara quais tamanhos cada um
aceita (um gráfico de 12 meses não cabe em KPI, e o sistema não deixa tentar):

| Tamanho | Colunas | Para |
|---|---|---|
| `kpi` | 3 | contagem curta, lista de 3 ou 4 linhas |
| `terco` | 4 | lista média, barras com poucas categorias |
| `meia` | 6 | o tamanho natural de um gráfico |
| `inteira` | 12 | faixa de números, série longa |

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Início                                     atualizado agora  [Personalizar] │
├─────────────────────────────────────────────────────────────────────────────┤
│ Bom dia, Matheus                                                            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Projetos em números                                          (inteira)  │ │
│ │   6            3              10                2  ⌐em risco: 1        │ │
│ │   ativos       em andamento   concluídos/ano    prazo estourado         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────┐ ┌───────────────────────────────────────┐ │
│ │ Propostas em números  (meia)  │ │ Vence nos próximos 15 dias   (meia)   │ │
│ │  9      2       4      33%    │ │ Elétrica · Vila Rica      em 2 d      │ │
│ │  env.   ganhas  perd.  conv.  │ │ Estrutural · CD BR-101    em 4 d      │ │
│ └───────────────────────────────┘ └───────────────────────────────────────┘ │
│ ┌───────────────────────────────┐ ┌───────────────────────────────────────┐ │
│ │ Entregamos no prazo?  (meia)  │ │ Por que perdemos             (meia)   │ │
│ │ área azul + meta tracejada    │ │ barras, uma cor                       │ │
│ └───────────────────────────────┘ └───────────────────────────────────────┘ │
│                                                                             │
│ [✦ Pergunte aos agentes ..................................................] │
└─────────────────────────────────────────────────────────────────────────────┘

Em "Personalizar": cada card ganha alça de arrastar, seletor de tamanho e remover,
e "Adicionar indicador" abre o catálogo agrupado por Gestão / Projetos / Obras /
Financeiro. Nada é gravado até Salvar; "Restaurar padrão" grava lista vazia.
```

### Regra de cor (o que estava errado antes)

A primeira versão usava cinco cores de série e três níveis de transparência diferentes,
e o resultado não parecia Pilar. A regra agora é uma só:

- **Gráfico tem uma cor**: `--chart-info`. Uma segunda série, quando existe, é
  `--chart-neutral` (cinza). Referência (meta, média) é linha tracejada cinza.
- **Cor semântica só onde carrega estado**, e sempre como badge do registry
  (`statusBadgeClasses`) ou borda-esquerda de 3px. Nunca como cor de número, nunca como
  fundo de card.
- **Número é sempre tinta** (`TONE_VALUE`: só dinheiro colore, e o padrão não tem dinheiro).
- **Uma borda, uma sombra**: `border-black/10` + `shadow-sm` em todo card. Sem tint de
  fundo, sem opacidade avulsa.
- Verde e vermelho sobrevivem em exatamente um lugar: a barra divergente ancorada no zero
  (horas e margem), onde o sinal do número é literalmente bom ou ruim, e a posição já
  separa os dois lados sem depender da cor.

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

1. `/inicio` renderiza os widgets de `profiles.painel_layout`, na ordem e no tamanho
   salvos. Lista vazia renderiza o layout padrão do front.
2. O layout padrão tem no máximo 6 widgets, começa por contagem (não por gráfico) e não
   contém nenhum widget financeiro.
3. Em "Personalizar", o usuário pode adicionar, remover, reordenar por arrasto e trocar o
   tamanho de cada widget, entre os tamanhos que aquele widget declara aceitar.
4. Nada é gravado até "Salvar painel". "Cancelar" descarta, "Restaurar padrão" grava lista
   vazia.
5. O catálogo mostra só widgets cuja `feature` o usuário tem. Widget financeiro aparece
   somente para quem passa em `financeiro` (role + `financeiro_delegado`, ADR 0034).
6. Um id de widget desconhecido no layout salvo é ignorado na renderização, nunca quebra
   a tela: é assim que um release pode remover widget sem migrar dado de ninguém.
7. Todo widget clicável leva à tela de origem com o filtro equivalente.
8. Todo widget sem dado suficiente diz o que falta, em vez de desenhar série vazia ou 0%.
9. A barra "pergunte aos agentes" fica fora do painel, fixa no rodapé: é ação, não
   indicador.

Não-funcionais:

- **Segurança / RLS:** a RPC de dados é `SECURITY INVOKER STABLE` (o RLS filtra a
  empresa). O bloco `financeiro` do retorno é **nulo**, não zerado, para quem não pode
  ver dinheiro: zerado faria a tela afirmar que a empresa não tem dinheiro.
  `set_painel_layout` é `SECURITY DEFINER` de escopo mínimo, porque `authenticated` não
  tem (e não deve ter) `UPDATE` em `profiles`: dar essa permissão abriria `role` e
  `empresa_id` na mesma tacada. A função escreve uma coluna, sempre em `auth.uid()`.
- **Validação na escrita:** `set_painel_layout` recusa o que não é lista, item sem id,
  tamanho fora do conjunto e mais de 40 widgets. É entrada livre vinda do cliente.
- **Performance:** uma chamada agregada para a tela inteira, independente de quantos
  widgets o layout tem. O layout vem junto do profile, sem query extra.
- **Multi-tenant:** isolamento por `empresa_id` via RLS em cada CTE.

## Critérios de aceite

- [ ] Dado perfil sem layout salvo, quando abre `/inicio`, então vê o layout padrão e o
      aviso de que pode personalizar.
- [ ] Dado layout salvo com um id que não existe mais no catálogo, quando abre `/inicio`,
      então os outros widgets renderizam normalmente.
- [ ] Dado usuário sem acesso a financeiro, quando abre o catálogo, então a seção
      Financeiro não aparece **e** a resposta da RPC traz `financeiro: null`.
- [ ] Dado admin da mesma empresa, quando abre o catálogo, então a seção Financeiro
      aparece e a RPC traz o bloco preenchido. Os dois casos rodam no mesmo teste pgTAP,
      com dois usuários da mesma empresa.
- [ ] Dado receita pendente vencida no mês anterior, quando o admin abre o widget de
      caixa, então o valor vencido aparece: vencido é estoque, não fluxo do mês.
- [ ] Dado modo de edição, quando o usuário remove um widget e cancela, então o layout
      salvo não muda.
- [ ] Dado modo de edição, quando o usuário adiciona um widget e salva, então
      `set_painel_layout` recebe a lista com o novo id.
- [ ] Dado layout inválido (não-lista, item sem id, tamanho desconhecido, 41 widgets),
      quando chega na RPC, então ela levanta erro com mensagem própria, e o teste verifica
      a mensagem (um `throws_ok` sem texto passaria por qualquer erro, inclusive
      permissão).
- [ ] Dada uma segunda empresa com dado no banco, quando o sócio da primeira abre o
      painel, então nenhum número inclui a linha da outra empresa.
- [ ] Dado projeto concluído com `data_final <= data_previsao`, quando o painel calcula
      pontualidade, então conta como no prazo.
- [ ] Dada disciplina com `data_fim_real > data_fim`, quando o painel agrega atraso, então
      desconta os dias em `projeto_disciplina_pausas` (spec 084).
- [ ] Caso de borda: empresa sem histórico → cada widget diz o que falta, e nenhum mostra
      0% como se fosse resultado.

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
