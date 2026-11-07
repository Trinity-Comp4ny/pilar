# SPEC: Financeiro com títulos, baixas e nova experiência (desktop e mobile)

**Data:** 2026-11-07
**Status:** Em implementação
**Autor:** Matheus + Claude (pesquisa de mercado, UX e diagnóstico de código)
**Módulo:** financeiro

Depende de: [diagnóstico 2026-11-07](../qa/2026-11-07/financeiro-lancamentos-parcelas-duplicatas.md), [SPEC 033](033-lancamentos-fonte-unica-filtros-parcelas.md), [SPEC 017](017-importacao-extrato-e-fatura-por-arquivo.md).
ADRs: [0017](../architecture/adr/0017-lancamentos-pagina-server-side.md), [0020](../architecture/adr/0020-headless-sim-widget-estilizado-nao.md).

## Problema

O dono do escritório abre o Financeiro para responder três perguntas: **o que vence e o que está atrasado**, **o que entrou e saiu de fato na conta** e **se o sistema bate com o banco**. Hoje as três vivem misturadas numa tela só ("Lançamentos"), com a mesma tabela densa, e a baixa de pagamento é binária (pago ou não pago). O diagnóstico de 2026-11-07 achou ainda erros de dado em parcelas, exclusão, importação e duplicatas. A tela parece "comum" porque o modelo por trás é comum.

## Objetivo

Separar os três eixos que todo financeiro maduro separa (títulos, extrato e conciliação), dar ao título um ciclo de vida completo (baixa parcial, juros, multa, desconto, comprovante) e dar ao mobile uma experiência de app de banco. Tudo com uma regra só por conceito, aplicada no servidor.

**Fora de escopo:** emissão de boleto e CNAB (o Asaas por empresa foi removido, DECISOES 2026-11-03), ledger contábil de partidas dobradas, DRE e projeção (módulos dormentes), integração bancária direta (Open Finance).

---

## 1. O que existe pronto no mercado (bibliotecas)

Não existe uma biblioteca pronta de "contas a pagar e a receber" que valha adotar num stack React + Postgres. O que existe são ledgers de fintech, e eles resolvem outro problema.

| Opção                                                    | Veredito                    | Por quê                                                                                                                                                                             |
| -------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ledgers: Formance, Blnk, TigerBeetle, Medici             | **Não adotar**              | São serviços à parte (Go, banco próprio ou MongoDB) com modelo de contas e postings. Não trazem título, baixa parcial nem conciliação, e acrescentam infraestrutura.                |
| pgledger (SQL puro no Postgres)                          | **Só referência**           | Projeto pequeno de uma pessoa. O padrão que vale copiar é saldo corrido e transação atômica dentro do mesmo banco.                                                                  |
| dinero.js v2                                             | **Não adotar**              | Continua em alpha.                                                                                                                                                                  |
| Dinheiro no front                                        | **Manter o que temos**      | `numeric(12,2)` no banco, cálculo de saldo e status em SQL. O front só formata (`@/lib/format`, `MoneyInput`).                                                                      |
| `ofx-data-extractor` (TypeScript, MIT, Node e navegador) | **Adotar** na importação    | OFX é o formato que todo banco brasileiro exporta e é muito mais confiável que PDF. Traz o `FITID`, que é a identidade da transação no banco e acaba com duplicata na reimportação. |
| CNAB em JS (`nodenab`, `@banco-br/nodejs-cnab`)          | **Não adotar agora**        | Imaturos, testados em um ou dois bancos. Só faz sentido com emissão de boleto.                                                                                                      |
| Matching/conciliação                                     | **Escrever à mão em SQL**   | Não há biblioteca madura. Todos os ERPs usam valor + janela de data + semelhança de texto. `pg_trgm` já está instalado.                                                             |
| `@tanstack/react-virtual`                                | **Adotar** no extrato longo | Mesmo ecossistema do `DataTable` (ADR 0020).                                                                                                                                        |
| `Sheet` do shadcn (desktop) e `Drawer`/vaul (mobile)     | **Adotar** para o detalhe   | Painel lateral no desktop, bottom sheet ou tela cheia no mobile.                                                                                                                    |

**Modelo de dados de referência** (só o desenho; não adotar o código): o Odoo guarda cada pagamento parcial numa tabela que liga título e pagamento (`account.partial.reconcile`), e o saldo em aberto do título sai dessas ligações. O ERPNext aloca um pagamento a várias faturas. O Firefly III tem regras de categorização automática na importação. É isso que a seção 4 copia.

Fontes: [pgledger](https://github.com/pgr0ss/pgledger), [Blnk](https://github.com/blnkfinance/blnk), [dinero.js v2](https://www.github.com/dinerojs/dinero.js/discussions/618), [ofx-data-extractor](https://www.npmjs.com/package/ofx-data-extractor), [nodenab](https://github.com/developers-vitta/nodenab), [Odoo baixa parcial](https://apps.odoo.com/apps/modules/18.0/metro_account_partial_outstanding), [Firefly III](https://docs.firefly-iii.org/explanation/more-information/architecture/).

---

## 2. Como os líderes fazem (benchmark)

Legenda: ✓ confirmado em documentação; (✓) padrão conhecido, a confirmar no produto; ? não verificado.

| Campo ou recurso                                       | Omie                 | Conta Azul | Xero                | QuickBooks | **Pilar hoje**                | **Pilar alvo**  |
| ------------------------------------------------------ | -------------------- | ---------- | ------------------- | ---------- | ----------------------------- | --------------- |
| A pagar e A receber como visões próprias               | ✓                    | ✓          | ✓ (abas por estado) | ✓          | Tela única                    | Abas            |
| Totais por estado (Vencido, Hoje, A vencer, Pago)      | ✓                    | ✓          | ✓                   | ✓          | KPIs gerais                   | Chips clicáveis |
| Baixa parcial com saldo em aberto                      | ✓                    | ?          | ✓                   | ✓          | **Não**                       | Sim             |
| Juros, multa e desconto na baixa                       | ✓ (separados no DRE) | ?          | —                   | —          | **Não**                       | Sim             |
| Baixa em lote com data e conta únicas                  | ✓                    | (✓)        | ✓                   | ✓          | Sem conta                     | Com conta       |
| Comprovante anexado                                    | (✓)                  | (✓)        | ✓                   | (✓)        | **Não**                       | Sim             |
| Extrato por conta com saldo corrido                    | ✓                    | ✓          | ✓                   | ✓          | Não                           | Aba             |
| Conciliação com sugestão de par                        | ✓ (painel lateral)   | ✓          | ✓                   | ✓          | Simples, dentro da importação | Aba própria     |
| Criar título a partir da linha do extrato              | ✓                    | (✓)        | ✓                   | ✓          | Sim (importação)              | Sim             |
| Desconciliar                                           | ✓                    | (✓)        | ✓                   | ✓          | Só "desfazer lote"            | Sim             |
| Regras de categorização na importação                  | ?                    | ?          | ✓                   | ✓          | Sugestão da IA                | Regras + IA     |
| Editar recorrência "só esta / esta e próximas / todas" | (✓)                  | (✓)        | —                   | —          | Só "em aberto"                | Sim             |
| Data planejada de pagamento                            | —                    | —          | ✓                   | —          | Não                           | Depois          |
| Linha digitável / PIX copia-e-cola                     | (✓)                  | (✓)        | —                   | —          | Só chave PIX do cliente       | Depois          |

Padrões que se repetem e vamos copiar:

1. **Omie** registra a baixa com valor editável (o parcial nasce de editar o valor sugerido) e campos de juros, multa e desconto. O título fica "Pago parcialmente" e mostra o saldo. Na conciliação, ao selecionar a linha do extrato, o **painel lateral** mostra o lançamento parecido, com "Conciliar", "Buscar e associar" e "Criar e conciliar".
2. **Conta Azul** mostra posição por estado (Em atraso, A pagar, Pago, Total), envia alerta diário de vencimento e sugere o par na conciliação para o usuário confirmar.
3. **Xero** separa "Bills to pay" em abas por estado e faz o pagamento em lote com data e conta definidas uma vez.
4. **QuickBooks** tem a aba "For review", em que cada transação baixada é **Match** (liga a um título existente e dá a baixa) ou **Categorize** (cria um registro novo), e regras automáticas de categoria.

Fontes: [Omie baixa](https://ajuda.omie.com.br/pt-BR/articles/1432247-baixando-as-contas-a-pagar), [Omie baixa parcial](https://ajuda.omie.com.br/pt-BR/articles/499030-realizando-uma-baixa-parcial-despesa), [Omie lote](https://ajuda.omie.com.br/pt-BR/articles/7828387-baixando-as-contas-a-pagar-em-lote), [Omie juros e multa no DRE](https://ajuda.omie.com.br/pt-BR/articles/3622801-visualizando-juros-multas-e-descontos-de-contas-a-pagar-e-a-receber-no-dre), [Omie conciliação](https://ajuda.omie.com.br/pt-BR/articles/2495094-conciliacao-bancaria-com-o-extrato-do-banco-integrado-ao-omie), [Omie desconciliar](https://ajuda.omie.com.br/pt-BR/articles/6863667-conciliacao-bancaria-desconciliando-lancamentos-no-extrato-das-contas-correntes), [Conta Azul conciliação](https://contaazul.com/tutoriais/como-fazer-conciliacao-bancaria-na-conta-azul), [Conta Azul posição](https://contaazul.com/blog/relatorio-de-posicao-de-contas-contaazul/), [Xero lote](https://support.approvalmax.com/en/articles/414195-how-to-create-a-xero-batch-payment), [QuickBooks match](https://quickbooks.intuit.com/learn-support/en-us/help-article/bank-transactions/match-transactions-quickbooks-online/L0MF3Fn6y_US_en_US).

---

## 3. Arquitetura de informação

### Decisão: uma rota, quatro abas com eixos diferentes

Os líderes separam três visões porque cada uma tem um eixo de tempo e uma ação principal diferentes:

| Aba             | Pergunta que responde        | Eixo de data                                    | Ação principal                             |
| --------------- | ---------------------------- | ----------------------------------------------- | ------------------------------------------ |
| **A receber**   | Quem me deve e quando?       | Vencimento                                      | Registrar recebimento, cobrar              |
| **A pagar**     | O que eu devo e quando?      | Vencimento                                      | Registrar pagamento (individual ou lote)   |
| **Extrato**     | O que entrou e saiu de fato? | Data do pagamento, por conta, com saldo corrido | Conferir, anexar comprovante               |
| **Conciliação** | O sistema bate com o banco?  | Data do extrato                                 | Conciliar, criar e conciliar, desconciliar |

Ficam todas dentro de **Financeiro > Lançamentos**, como abas sincronizadas na URL (`?aba=receber`), não como itens novos de menu. O ICP é escritório pequeno, a mesma pessoa faz tudo e as quatro abas compartilham período, conta e projeto. "Todos" deixa de ser o padrão e vira opção do filtro de tipo, para quem quiser a lista antiga.

A aba aberta por padrão é **A pagar** se houver algo vencido a pagar; senão, **A receber**. A última aba usada fica salva por usuário (`localStorage`).

### Cabeçalho de A pagar e A receber

Chips totalizadores clicáveis, que aplicam o filtro ao clicar: **Vencidos · Vencem hoje · Próximos 7 dias · A vencer · Pagos no período**, cada um com contagem e valor. Substitui os KPIs genéricos nessas abas.

### Detalhe: painel lateral

Clicar numa linha abre um **painel lateral** (`Sheet`, 480px) no desktop sem sair da lista; no mobile, abre em tela cheia. Conteúdo, de cima para baixo:

1. Valor grande, status (`StatusBadge`) e saldo em aberto quando parcial.
2. Ações: **Registrar pagamento/recebimento** (`variant="brand"`), Editar, ⋯ (Duplicar, Anexar, Excluir).
3. Dados: contraparte, categoria, projeto, centro de custo/rateio, conta ou cartão, forma de pagamento, NF, competência.
4. Parcelas do grupo: barra k/N, total pago × saldo, próxima parcela e lista clicável. "Renegociado de…" quando houver.
5. Baixas: cada pagamento com data, conta, valor, juros, multa, desconto e comprovante.
6. Anexos.
7. Histórico: criado por e alterações (o `handle_record_audit` já grava `created_by`/`updated_by`).

Setas ↑/↓ navegam entre lançamentos com o painel aberto, e Esc fecha.

### Filtros

- **Desktop:** busca sempre visível (descrição, contraparte, categoria, código do projeto **e valor**: "1.250" acha R$ 1.250,00), chips de status e o popover de filtros que já existe (SPEC 024). Barra de filtros ativos com "×" em cada um e "Limpar".
- **Presets:** Vencidos, Esta semana, Sem categoria, Sem comprovante, Sem conta.
- Filtros novos: forma de pagamento, "tem anexo", "parcelado", "conciliado".

---

## 4. Modelo de pagamento: baixas

### Tabela `lancamento_baixas`

| Coluna                                   | Tipo          | Observação                                                            |
| ---------------------------------------- | ------------- | --------------------------------------------------------------------- |
| `id`, `empresa_id`                       | uuid          | RLS por empresa, gate do módulo financeiro                            |
| `tipo_lancamento`                        | text          | `receita` ou `despesa`                                                |
| `lancamento_id`                          | uuid          | FK lógica para `receitas` ou `despesas`                               |
| `data`                                   | date          | Data em que o dinheiro se moveu                                       |
| `valor_principal`                        | numeric(12,2) | Quanto do título foi abatido (> 0)                                    |
| `juros`, `multa`, `desconto`             | numeric(12,2) | ≥ 0                                                                   |
| `valor_movimentado`                      | gerada        | `principal + juros + multa − desconto`: o que saiu ou entrou na conta |
| `conta_id`                               | uuid          | Obrigatória (ou `cartao_id` para despesa no cartão)                   |
| `forma_pagamento`                        | text          |                                                                       |
| `comprovante_path`                       | text          | Supabase Storage, bucket privado por empresa                          |
| `extrato_linha_id`                       | uuid null     | Preenchido na conciliação                                             |
| `created_by`, `created_at`, `deleted_at` |               | Estornar = soft delete da baixa                                       |

### Regras

- `valor_aberto = valor − Σ valor_principal` das baixas ativas.
- Status **derivado**: Pago/Recebido quando `valor_aberto = 0`; **Parcial** quando há baixa e ainda resta valor em aberto; **Atrasado** quando `valor_aberto > 0` e o vencimento já passou; Pendente nos demais casos. Cancelado continua manual. Isso substitui o job `rpc_atualizar_status_atrasados`.
- `data_pagamento`/`data_recebimento` e `conta_id` do título passam a refletir a última baixa (compatibilidade com dashboard, view e agentes durante a transição).
- **Migração:** cada título Pago/Recebido hoje vira uma baixa com principal = valor, data = data de efetivação e conta = conta do título.
- RPCs: `rpc_registrar_baixa(tipo, lancamento_id, data, valor_principal, juros, multa, desconto, conta_id, forma, comprovante)`, `rpc_registrar_baixa_lote(...)` e `rpc_estornar_baixa(id)`. A quitação antecipada de grupo passa a gravar baixas com desconto, sem reescrever o valor da parcela.
- DRE e visão geral: juros e multa pagos viram despesa financeira; desconto obtido, receita financeira (Omie faz isso).

### Diálogo "Registrar pagamento"

Um só diálogo para todos os caminhos (linha, painel, lote, swipe no mobile, quitação). Campos: data (hoje), conta (pré-preenchida com a do título), valor (pré-preenchido com o saldo em aberto; editar para baixo gera parcial), "+ juros/multa/desconto" recolhido e comprovante (câmera no mobile). Mostra a prévia: "Fica em aberto: R$ 500,00".

---

## 5. Mobile (390px)

Baseado em padrões de Nubank, Inter, Revolut, Monzo, Mercury, Ramp, Conta Azul de Bolso e QuickBooks, mais as diretrizes NN/g e Apple HIG ([NN/g swipe contextual](https://www.nngroup.com/articles/contextual-swipe/), [HIG listas](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables), [Conta Azul de Bolso](https://contaazul.com/blog/app-conta-azul-de-bolso/), [Ramp comprovantes](https://support.ramp.com/what-to-do-if-youre-missing-a-receipt), [Nubank faturas](https://tecnoblog.net/339838/nubank-atualiza-app-e-muda-interface-para-cartao-de-credito/)).

**P0**

1. **A tabela vira lista, não tabela encolhida.** Linha em dois andares (64–72px): ícone da categoria à esquerda; título = contraparte (ou descrição); subtítulo = "Projeto · Conta"; à direita, valor e, embaixo, status compacto ou "3/12". O resto vai para o detalhe. Abaixo de `md`, nunca tabela com scroll horizontal.
2. **Cor do valor só pelo sentido.** Receita com "+" e token positivo; despesa neutra; transferência neutra com ícone de setas. Vermelho só para vencido. Pendente em peso menor, efetivado em peso cheio.
3. **Cabeçalho de dia fixo** ("Hoje", "Amanhã", "Seg, 10 nov") com o líquido do dia.
4. **Resumo recolhível no topo**: A receber, A pagar e Vencidos, tocáveis, e cada um aplica o filtro.
5. **Mês com "‹ Nov 2026 ›"**, não com swipe horizontal (conflitaria com o swipe da linha).
6. **Swipe "marcar pago" com caminho alternativo visível** (botão no detalhe e long-press) e desfazer no toast. O swipe abre o diálogo de pagamento, nunca grava sem conta. Excluir nunca por swipe.

**P1**

7. Abas A receber / A pagar / Extrato como segmentado no topo; a Conciliação no mobile só lista pendências.
8. Chips rápidos fixos sob a busca (Vencidos · Esta semana · Cartão · Sem comprovante) e "Filtros (n)" abrindo um bottom sheet.
9. Detalhe em tela cheia com barra de ação fixa no rodapé (Registrar pagamento) e ⋯.
10. Fatura do cartão como uma linha agregada ("Fatura Itaú · fecha 05/12 · R$ 4.320"). Ao abrir, abas Fechada / Aberta / Próximas, como no Nubank.
11. Botão "+" flutuante abrindo Despesa · Receita · Transferência · **Fotografar comprovante**.

**P2**

12. Long-press para seleção múltipla, com barra de lote no rodapé mostrando o total selecionado.
13. Skeleton no formato da linha (sem spinner, ADR 0049), puxar para atualizar e estados vazios distintos ("Nada vence esta semana" × "Nenhum resultado: limpar filtros").
14. Selo "sem comprovante" e filtro correspondente, para fotografar o recibo na hora (Ramp).

---

## 6. Duplicatas (motor único)

Ver diagnóstico, seção 2. Resumo: `rpc_buscar_duplicatas` no servidor, com pontuação (NF + contraparte = certeza; FITID/hash de importação = certeza; contraparte + valor + data ±3d = alta; `pg_trgm` + valor ±1% + data ±5d = média), ignorando parcelas do mesmo grupo e a mesma série recorrente, com memória de "não é duplicata", usada por form, quick add, importação, agentes e folha. Na importação, o pareamento é 1:1 por pontuação.

---

## Plano de implementação (fases, cada uma um PR para `staging`)

| Fase                       | Entrega                                                                                                     | Mudança visual                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **1. Integridade**         | Correções B1–B8 do diagnóstico                                                                              | Pequena (conta no diálogo de pagamento, `MoneyInput`, desfazer) |
| **2. Duplicatas**          | Motor único + diálogo de comparação + pareamento 1:1 + hash/FITID                                           | Diálogo novo                                                    |
| **3. Navegação e detalhe** | Abas A receber / A pagar / Extrato, chips totalizadores, painel lateral, presets de filtro, busca por valor | Grande                                                          |
| **4. Baixas**              | `lancamento_baixas`, status derivado, diálogo "Registrar pagamento", lote com conta, comprovante            | Média                                                           |
| **5. Mobile**              | Itens P0 e P1 da seção 5                                                                                    | Grande (mobile)                                                 |
| **6. Conciliação e OFX**   | Aba Conciliação, `ofx-data-extractor`, regras de categorização, desconciliar                                | Grande                                                          |

## Andamento

| Fase                   | Situação                                                                                                                                                               | Commit    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1. Integridade (B1–B8) | Entregue na branch                                                                                                                                                     | `e53c1ca` |
| 2. Duplicatas          | Entregue na branch: motor no servidor, diálogo com motivo e confiança, campo "Nº da nota fiscal" (era Sim/Não)                                                         | `44aacd5` |
| 3. Navegação e detalhe | Entregue na branch: A pagar / A receber / Tudo, chips de posição, painel lateral, cor por sentido                                                                      | `d102af7` |
| 4. Baixas              | Pendente: muda o modelo de dados, pede aprovação desta spec                                                                                                            | —         |
| 5. Mobile              | Parcial: cabeçalho do dia fixo com líquido, cor por sentido, detalhe em tela cheia. Faltam chips sob a busca, filtros em bottom sheet, "+" flutuante e fatura agregada | `d102af7` |
| 6. Conciliação e OFX   | Pendente                                                                                                                                                               | —         |

Fica para depois da fase 2: checagem de duplicata na edição e nas RPCs dos agentes, memória de "não é duplicata" e varredura periódica.

Antes e depois das telas da fase 3: `docs/design/antes-depois/spec-149/`.

## Critérios de aceite (por fase, resumidos)

- [ ] F1: parcelado criado pelo form, pela proposta ou por agente tem linha em `grupos_parcela`; renegociar e quitar funcionam nele.
- [ ] F1: criar parcelado com rateio é tudo-ou-nada.
- [ ] F1: editar receita recebida mantém a data de recebimento original.
- [ ] F1: excluir lançamento é reversível por "Desfazer".
- [ ] F1: reimportar o mesmo extrato não cria nenhuma linha nova; linhas de extrato entram efetivadas.
- [ ] F1: nenhuma baixa pela lista grava título efetivado sem conta.
- [ ] F2: lançamento com mesma NF e mesma contraparte de outro existente é bloqueado com link para o existente.
- [ ] F2: duas linhas iguais no extrato nunca conciliam o mesmo título.
- [ ] F4: pagar R$ 600 de um título de R$ 1.000 deixa o status Parcial com R$ 400 em aberto; estornar a baixa volta para Pendente ou Atrasado.
- [ ] F4: o saldo da conta = saldo inicial + Σ baixas de receita − Σ baixas de despesa ± transferências.
- [ ] F5: em 390px não há scroll horizontal em nenhuma aba do Financeiro.
