# SPEC: Inteligência do fornecedor (página do fornecedor)

**Data:** 2026-08-12
**Status:** Em implementação
**Autor:** Matheus
**Módulo:** obras (+ leitura de financeiro de obra)

Cresce sobre a [conta da obra (016)](./016-conta-da-obra-e-prestacao-de-contas.md)
e as [cotações (018/023)](./018-cotacoes-na-obra.md), agora que o cadastro de
fornecedor passou a morar no módulo Obras. Não cria entidade nova: transforma o
fornecedor, hoje um cadastro morto, na entidade com memória que os dados já
permitem montar.

## Problema

Quem compra pela obra não tem memória do fornecedor. O cadastro guarda nome, CNPJ
e contato, mas não responde as perguntas que decidem uma compra: esse fornecedor
já venceu cotações? por quanto? o que já compramos dele? em que obras ele aparece?
A informação existe espalhada em cotações e na conta da obra, mas nunca consolidada
por fornecedor. O engenheiro/sócio decide no escuro ou no WhatsApp.

## Objetivo

Uma página por fornecedor (`/fornecedores/:id`) que consolida, sem tabela nova,
todo o histórico dele: cotações que mandou (e se venceu), obras em que participa e
compras já feitas pela conta da obra. Depois desta feature é possível abrir um
fornecedor e, em uma tela, saber se vale comprar dele de novo.

**Fora de escopo:**

- Compras do escritório (tabela `despesas`): o "comprado" soma **apenas** a conta
  da obra (`obra_conta_lancamento`). Decisão do design partner.
- Nota/rating manual, comparador lado a lado entre fornecedores, portal do
  fornecedor, ranking automático de "melhor fornecedor".
- Qualquer mudança no fluxo de criar cotação ou lançar despesa.

## Requisitos

Funcionais (numerados, testáveis):

1. O usuário pode abrir `/fornecedores/:id` a partir da lista de fornecedores.
2. O cabeçalho mostra dados do cadastro (nome, CNPJ, contato) e KPIs calculados:
   nº de obras, total comprado (conta da obra), nº de cotações participadas, taxa
   de vitória (venceu/participou), ticket médio de compra e data da última compra.
3. **Aba Cotações:** lista as propostas do fornecedor (`obra_cotacao_proposta`),
   cada uma com a obra, a descrição do que foi cotado, o valor, o status derivado
   (Venceu / Não venceu / Em aberto) e, expandível, os itens
   (`obra_cotacao_proposta_item`). Filtrável por obra.
4. **Aba Obras:** uma linha por obra em que o fornecedor aparece (via cotação ou
   conta), com total cotado, total comprado, nº de cotações e nº de vitórias
   naquela obra. Clicar leva à obra.
5. **Aba Compras:** o extrato de compras reais da conta da obra com esse fornecedor
   (`obra_conta_lancamento` tipo=despesa): data, obra, etapa/frente, descrição,
   valor e comprovante.
6. **Reconciliação (v1):** propostas com `fornecedor_id` nulo e apenas
   `fornecedor_nome` (cotação de campo em texto livre) podem ser associadas a um
   fornecedor do cadastro. Há uma superfície que lista nomes soltos, sugere
   correspondência por semelhança de nome e permite vincular (ou criar cadastro).
   Ao vincular, a proposta passa a contar no histórico do fornecedor.
7. O status "Venceu" deriva de `obra_cotacao.proposta_vencedora_id == proposta.id`;
   "Em aberto" quando `obra_cotacao.status = 'aberta'`; senão "Não venceu".

Não-funcionais:

- **Segurança / RLS:** só leitura de dados já protegidos por `empresa_id` via as
  policies existentes de `fornecedores`, `obra_cotacao*` e `obra_conta_lancamento`.
  A reconciliação é um UPDATE de `obra_cotacao_proposta.fornecedor_id`, coberto pela
  policy existente (checa fornecedor da mesma empresa). Nenhuma tabela nova.
- **Performance:** os agregados por fornecedor não podem full-scan a cada render.
  Buscar por `fornecedor_id` usando índices existentes; se necessário, uma view/RPC
  de agregação por fornecedor. A página carrega os dados de um fornecedor só, não
  de todos.
- **Multi-tenant:** todo filtro parte de `empresa_id = get_user_empresa_id()`.

## Critérios de aceite

- [ ] Dado um fornecedor com 2 propostas vencedoras de 5 enviadas, quando abro a
      página, então a taxa de vitória mostra 40% (2/5).
- [ ] Dado um fornecedor com lançamentos de despesa em 2 obras distintas, quando
      abro a página, então o KPI "obras" conta 2 e a aba Obras lista as duas com
      seus totais comprados.
- [ ] Dado uma proposta com `proposta_vencedora_id` apontando pra ela, quando vejo
      a aba Cotações, então o status é "Venceu".
- [ ] Dado uma proposta de cotação com status 'aberta', então o status na aba é
      "Em aberto" (não "Não venceu").
- [ ] Dado uma proposta com `fornecedor_id` nulo e `fornecedor_nome` = "Concreteira
      X", quando eu reconcilio para o cadastro "Concreteira X Ltda", então a
      proposta passa a aparecer no histórico desse fornecedor e some da lista de
      nomes soltos.
- [ ] Caso de borda: fornecedor sem nenhuma cotação nem compra abre a página com
      KPIs zerados e abas em empty state orientando a primeira ação, sem erro.
- [ ] Caso de borda: compra do escritório (despesa com projeto_id, sem obra) NÃO
      entra em "total comprado" nem na aba Compras.

## Dados e contratos

Sem migration de tabela nova. Fontes:

- `obra_cotacao_proposta` (fornecedor_id, valor, cotacao_id) + `obra_cotacao`
  (obra_id, descricao, status, proposta_vencedora_id) + `obra_cotacao_proposta_item`.
- `obra_conta_lancamento` (fornecedor_id, obra_id, tipo='despesa', valor, data,
  descricao, obra_frente_id, comprovante_url).
- `fornecedores` (cadastro).

Front consome, por fornecedor:

- `resumo`: { obras, totalComprado, cotacoesParticipadas, vitorias, taxaVitoria,
  ticketMedio, ultimaCompra }.
- `cotacoes[]`: { propostaId, obraId, obraNome, descricao, valor, status, itens[] }.
- `obras[]`: { obraId, obraNome, totalCotado, totalComprado, cotacoes, vitorias }.
- `compras[]`: { lancamentoId, data, obraId, obraNome, frente, descricao, valor,
  comprovanteUrl }.

A decidir no plano: agregação por SELECTs no hook vs uma RPC/view
`fornecedor_resumo(fornecedor_id)`. Preferir RPC/view se os SELECTs no cliente
ficarem pesados.

## Plano de implementação

Preenchido em plan mode antes de codar. Peças previstas:

1. Rota `/fornecedores/:id` + página com cabeçalho de KPIs e 3 abas.
2. Hook(s) de leitura por fornecedor (ou RPC de agregação) com os shapes acima.
3. Status derivado da proposta (Venceu/Não venceu/Em aberto) em util testável.
4. Reconciliação: lista de `obra_cotacao_proposta` com fornecedor_id nulo, sugestão
   por similaridade de `fornecedor_nome`, ação de vincular (UPDATE) ou criar cadastro.
5. Link da lista de fornecedores para a página de detalhe.

## Verificação no browser (2026-08-12, dev:local)

Fluxo exercitado ponta a ponta: proposta com fornecedor do cadastro → decidir +
lançar despesa → página do fornecedor populada (obras, total comprado, taxa de
vitória, aba Compras); proposta em texto livre → Reconciliar → entra no histórico.
Tudo ✓.

Gaps de entrada encontrados no teste e corrigidos:

1. O select de fornecedor na proposta abria em "Outro (digitar nome)", nudge pro
   texto livre. Agora abre em placeholder "Selecione o fornecedor" e exige escolha.
2. Não dava pra cadastrar fornecedor sem sair pro texto livre. Adicionada a opção
   "+ Cadastrar novo fornecedor" no select (cria o cadastro na hora e já vincula).
3. Campo de data nativo do SO. Trocado pelo `DatePicker` custom em `CotacaoFormDialog`
   ("Precisa até") e `LancamentoContaDialog` ("Data"), que são os do fluxo.

**Pendente (follow-up):** ainda há ~8 `<input type="date">` nativos em outros forms
de obra (`FrenteDetailDialog` ×3, `ObraCronogramaTab` ×2, `RdoFormDialog`,
`ObraFormDialog` ×2, `MaterialMovDialog`). Não foram trocados porque: (a) os de
frente/cronograma permitem **limpar** a data e são inline compactos, e o `DatePicker`
atual não tem "limpar" nem cabe inline sem redesenho; (b) os de RDO/obra/material
usam react-hook-form (`register`) e exigem `Controller`. Fechar isso pede um
`DatePicker` com opção de limpar + varredura própria.

## Decisões e riscos

- **Escopo "comprado" = só conta da obra.** Simples e coerente com fornecedor no
  módulo Obra; não mistura bolso do escritório. Se depois quiser a visão total do
  relacionamento, é uma fase 2 (somar `despesas`).
- **Texto livre é o maior risco de dado.** Sem reconciliação, o histórico do
  fornecedor cadastrado fica furado. Por isso a reconciliação entra no v1, não
  depois. Suposição: a similaridade por nome resolve a maioria; casos ambíguos
  ficam manuais.
- **Taxa de vitória só conta propostas vinculadas.** Propostas em texto livre não
  reconciliadas não entram no denominador (nem deveriam).
- **Sem tabela nova**, então não há novo gate de RLS; validar mesmo assim que as
  policies existentes cobrem os SELECTs de agregação por `empresa_id`.
