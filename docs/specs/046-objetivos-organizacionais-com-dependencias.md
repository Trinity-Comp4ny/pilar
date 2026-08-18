# SPEC: Objetivos organizacionais com etapas dependentes entre pessoas/áreas

**Data:** 2026-08-17
**Status:** Draft (insight de cliente, não aprovada, não priorizada)
**Autor:** Matheus Rezende (relato oral do cliente MF Construções, 17/08)
**Módulo:** metas (toca também Pessoas e Meu trabalho); candidato a módulo novo, ver "Análise de viabilidade"

## Problema

A MF Construções relatou que a empresa tem objetivos gerais (ex.: "organizar o estaleiro") sem um lugar formal de execução. Cada objetivo passa por várias áreas em sequência (logística, depois administrativo, depois RH) e hoje ninguém enxerga o todo: o que já foi feito, o que está travado, quanto falta e quem é o próximo responsável.

## Pedido original do cliente (resumo fiel)

Áudio de 17/08, resumido: cada objetivo geral vira algo como um projeto, com status por etapa (parado, em progresso, concluído) e percentual quando em progresso. Cada etapa fica associada a uma área (logística, administrativo, RH etc.) e as etapas têm ordem de dependência: uma área só começa depois que a anterior termina. Ele quer enxergar o objetivo inteiro, os próximos passos, e ter um lugar para dar feedback e gerar relatório.

Exemplo dado: objetivo "organizar o estaleiro". Logística conta e organiza fisicamente o material. Depois administrativo lança essa informação no sistema. Depois RH mapeia quantas pessoas trabalham lá e o que cada uma faz para manter a organização.

## Referência visual pedida

O cliente quer algo visual, citando o GitHub como exemplo: um grafo de nós conectados por dependência, cada nó com ícone de status (concluído, pendente/bloqueado, em progresso) e duração/percentual ao lado. O print anexado (`Screenshot 2026-08-17 at 17.57.31.png`) mostra a visualização de um workflow do GitHub Actions: jobs com dependências (setas), status por ícone, duração por job.

## Isso já foi cogitado no Pilar (achado relevante)

Este pedido não é novo para o produto: já foi conscientemente engavetado.

- `docs/BACKLOG.md`, seção 6 ("Engavetado com gatilho"): item "Pilar Gestão como produto (iniciativas, departamentos, carga)". Só a view "Meu trabalho" (spec 014) está aprovada hoje. O gatilho para reabrir não tinha critério explícito além disso; o pedido da MF Construções é, na prática, o primeiro sinal concreto de demanda por esse gatilho.
- `docs/BACKLOG.md`, seção 2 (sequência de 90 dias), item P5: "Radar de Prontidão v0: dependência entre etapas com lead time sobre Fluxos+Gantt+Fornecedores". Não começado. É o precedente mais próximo do conceito de dependência entre etapas.
- Spec 027 (Cronograma da obra em dois níveis) lista "dependências entre passos" explicitamente como fora de escopo.
- Tabela `metas` (`nome, alvo, atual, prazo, categoria, pessoa_id, projeto_id`) já modela "objetivo", mas só no eixo numérico/financeiro. Sem etapas, sem área, sem dependência.
- Board unificado "Meu trabalho" (spec 014) e a ponte `tarefa_responsaveis` (multi-responsável) já resolvem status + responsável por tarefa, mas sem encadeamento causal entre tarefas de pessoas diferentes.

Conclusão: a peça que falta de verdade é uma só: dependência direcionada entre etapas de responsáveis/áreas diferentes (a etapa B só libera quando a etapa A conclui) e a visualização em grafo disso. O resto (status, percentual, responsável, feedback) já tem equivalente em Metas, Meu trabalho e Cronograma.

## Objetivo (candidato, se aprovado)

Um objetivo geral da empresa vira uma sequência de etapas atribuídas a pessoas/áreas, com dependência entre elas, visível como um grafo de status; a etapa fica bloqueada até que suas dependências concluam, e o dono do objetivo enxerga de bate-pronto onde está o gargalo.

**Fora de escopo (MVP, se for adiante):**

- Departamento como entidade própria. O MVP usa `pessoas.cargo`/responsável direto, não um cadastro novo de "departamento".
- Grafos com ramificação condicional complexa (fan-out/fan-in como no GitHub Actions). MVP é cadeia linear ou quase linear.
- Relatório exportável (PDF/xlsx) do objetivo. Entra depois que a tela existir e alguém pedir de verdade.
- Notificação automática para o próximo responsável quando a etapa anterior libera. Fica para uma fase 2, sobre a Central de notificações (spec 029).

## Análise de viabilidade

### Modelo de dados

Não dá para encaixar em `metas` sem descaracterizar a tabela (ela é puramente numérica/financeira hoje). Precisaria de:

- `objetivos`: id, empresa_id, nome, descrição, status derivado, created_by.
- `objetivo_etapas`: id, objetivo_id, nome, responsavel_id (pessoas), status (não iniciado/em progresso/parado/concluído), percentual, ordem.
- `objetivo_etapa_dependencias`: etapa_id, depende_de_etapa_id (ponte N:N, porque uma etapa pode depender de mais de uma outra).
- RPC `objetivo_etapas_liberadas`: calcula quais etapas estão liberadas (todas as dependências concluídas), para não recalcular isso no client.

Migration nova + RLS por `empresa_id`, no padrão já conhecido do projeto. Sem novidade de risco aqui.

### UI: o grafo

Não existe hoje nenhum componente de grafo no design system (Gantt é linha do tempo, Kanban é coluna, DataTable é lista). Pela regra do [ADR 0020](../architecture/adr/0020-headless-sim-widget-estilizado-nao.md) (headless sim, turnkey não), uma lib tipo React Flow fica fora: é widget estilizado, brigaria com os tokens. A alternativa correta é construir à mão: nó = card com `StatusBadge` + responsável + percentual, aresta = `<svg>` com path simples ligando as bordas dos cards. Como o grafo de um objetivo tende a ser pequeno (poucas etapas, poucas áreas), o layout em camadas dá para calcular na mão (camada = distância topológica da raiz), sem depender de lib de layout tipo dagre.

Esforço estimado: médio-alto. Schema e RPC são baratos; o componente de grafo do zero (cálculo de camada, desenho de aresta, hover/seleção, responsivo) é o item caro, porque não amplifica nenhum padrão existente, ao contrário de Gantt/Kanban, que reusam TanStack/dnd-kit.

### Riscos de produto

- **Ajuste ao ICP:** o ICP declarado é engenharia multidisciplinar (civil/estrutural/MEP), explicitamente não construtora (ver `CLAUDE.md`). "MF Construções", pelo nome, soa construtora/obra, não o ICP-alvo. Vale confirmar com o CEO se este cliente é um design partner dentro do ICP ou um sinal vindo de um segmento adjacente, antes de priorizar.
- **Sobreposição de sistema de acompanhamento:** o Pilar já tem três lugares que respondem "status + responsável + progresso": Metas, Board "Meu trabalho", Cronograma (projeto/obra). Um quarto sistema ("Objetivos") sem integração com os outros três fragmenta a experiência: a pergunta "onde eu vejo o que falta fazer" passaria a ter quatro respostas.
- **Postura atual do CEO** (memória `project_customers_design_partners.md`): não lançar feature grande nova na pressa, focar em solidificar o core que VRZ e BM3 já usam de verdade. Este pedido é uma feature grande nova (schema, módulo, componente de grafo do zero), então compete direto com essa prioridade.
- Este pedido é, essencialmente, o "Pilar Gestão como produto" (departamentos, iniciativas) já engavetado esperando um gatilho de demanda real. A MF Construções fornece um primeiro sinal, mas um pedido não é o mesmo que dois ou três clientes pedindo a mesma coisa, nem o mesmo que alguém pagando por isso.

### Veredito

Tecnicamente viável e barato na parte de dados. O caro de verdade é o grafo (componente novo, sem precedente no design system), e o risco de produto pesa mais que o técnico: sobreposição com Metas/Meu trabalho/Cronograma e possível desalinhamento de ICP. Recomendação: não codar direto. Validar primeiro se mais de um design partner (idealmente dentro do ICP) sente a mesma dor, e decidir com o CEO se isso é uma extensão de Metas (mais barato: etapas + dependência dentro da meta existente, sem módulo novo) ou um módulo novo "Objetivos" (mais caro, mais fiel ao pedido original).

## Requisitos funcionais candidatos (se aprovada)

1. O usuário cria um objetivo com nome e descrição.
2. O usuário adiciona etapas ao objetivo, cada uma com responsável (pessoa) e, opcionalmente, etapas das quais depende.
3. Uma etapa só entra em "em progresso" se todas as etapas das quais depende estiverem "concluída".
4. O objetivo mostra status geral (derivado das etapas), percentual agregado, e a etapa "próximo passo" (primeira etapa liberada e não concluída).
5. Visualização em grafo: nós são etapas, arestas são dependências, cor/ícone indica status.
6. Cada etapa aceita comentário (feedback), visível no detalhe do objetivo.

## Critérios de aceite candidatos

- [ ] Dado um objetivo com etapas A → B → C, quando A está concluída, então B fica liberada e C continua bloqueada.
- [ ] Dado uma etapa com duas dependências, quando só uma está concluída, então a etapa continua bloqueada.
- [ ] Dado um objetivo sem etapas, quando ele é criado, então o status geral é "não iniciado".
- [ ] Caso de borda: dependência circular (A depende de B, B depende de A) é rejeitada na criação, não silenciosamente ignorada.

## Decisões e riscos

- Decisão pendente do CEO: extensão de Metas vs. módulo novo "Objetivos". Isso muda o nome das tabelas e onde a tela vive na navegação.
- Decisão pendente: layout de grafo calculado à mão vs. avaliar alguma lib headless de layout, só se o grafo crescer além de cadeia quase linear.
- Se aprovado e a decisão for adotar alguma lib para o grafo (mesmo headless), abrir um ADR curto seguindo o padrão do ADR 0020.
- Próximo passo recomendado: levar este documento ao CEO junto com o item já engavetado em `docs/BACKLOG.md` (seção 6) e decidir se o gatilho de reabertura foi atingido.
