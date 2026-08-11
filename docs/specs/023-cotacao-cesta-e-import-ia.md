# Spec 023 — Cotação com cesta multi-item + import de orçamento por IA

Status: Em implementação
Depende de: [018 — Cotações na obra](018-cotacoes-na-obra.md), [016 — Conta da obra](016-conta-da-obra.md)
ADR relacionado: leitura multimodal de arquivo pela IA (ver seção "Decisão de arquitetura")

## Problema

A cotação da spec 018 é **item único**: uma cotação = uma necessidade (descrição,
quantidade, unidade), e cada proposta de fornecedor é um **valor único**. Na obra
real o fornecedor manda um **orçamento com vários materiais** num único PDF
(elétrico, hidráulico, uma lista de 5 a 40 linhas com preço unitário e total).
Hoje o usuário teria que redigitar tudo à mão, linha por linha, e o modelo nem
comporta os itens.

## Tipo detectado pela IA (sem seletor manual)

Cotar tem dois formatos de documento, mas o usuário NÃO escolhe qual: ao analisar
o PDF, a IA **classifica** sozinha (passo de classificação antes da extração) e
roteia. Os formatos:

- **comparativo** — o MESMO item entre várias lojas (colunas = lojas). Vira N
  propostas, uma por loja, com preço à vista/parcelado. Ex.: planilha comparando
  tábuas em MADEMAR e BASSAN.
- **cesta** — UM fornecedor, vários materiais. Vira 1 proposta com itens. Ex.: um
  fornecedor manda um PDF com 20 materiais.

A cotação não tem mais tipo escolhido na criação (o seletor foi removido; a coluna
`obra_cotacao.tipo` fica dormente com default). A forma é derivada do que existe:
propostas com `itens` (cesta) ou propostas com valor/à vista (comparativo), e a UI
se adapta aos dados. Adicionar proposta à mão continua possível (form único que
aceita valor simples ou itens).

Comparar a MESMA cesta item-a-item entre fornecedores (matriz item × fornecedor)
foi considerado e **adiado**: mais UI (casar itens por nome entre PDFs) do que o
design partner precisa agora. Se a dor aparecer, evolui para a matriz reusando
`obra_cotacao_proposta_item`.

## O que muda

1. **Cesta multi-item na proposta (tipo `cesta`).** A proposta de um fornecedor
   passa a ter N itens (`obra_cotacao_proposta_item`). O `valor` da proposta
   continua sendo o total; quando há itens, o total é a soma deles.
2. **Import por IA nos DOIS modos, com contexto diferente.** O usuário sobe o PDF
   do orçamento; a IA (Gemini multimodal) lê o arquivo. O que a IA extrai depende
   do modo, informado à edge function junto do contexto (a descrição da cotação):
   - `cesta`: extrai TODOS os itens (descrição, qtd, unidade, preço unit, total) →
     preenche a lista editável.
   - `item`: recebe o contexto "o usuário está cotando `<descrição>`" e acha o
     PREÇO desse item específico no orçamento (mais fornecedor, prazo, condição de
     pagamento se houver) → preenche o valor da proposta.
   - `comparativo`: o PDF já é uma planilha comparando o MESMO item entre vários
     fornecedores (loja = coluna, condição de pagamento = linha). Roda em **dois
     passos** (extrair → verificar): o 1º agente extrai uma proposta por loja com
     preço à vista e parcelado; o 2º agente revisa a extração **contra o próprio
     PDF** (loja duplicada? loja faltando? valores batem?), corrige e rebaixa a
     confiança das linhas duvidosas. O app cria **uma proposta por loja** de uma
     vez, com preview editável (linhas de baixa confiança destacadas). Botão no
     nível da cotação (tipo `item`), ao lado de "Adicionar proposta".
   O preenchimento é sempre sugestão editável, nunca gravação automática (HITL).

Por que dois passos no comparativo (e não multi-agente por dimensão): num teste
real o 1º passo esqueceu a loja mais barata; o verificador a recolocou. "Extrair +
criticar" pega o que um passo só perde. Dividir por dimensão (um agente por
material/loja/valor) foi rejeitado: re-juntar as saídas parciais desalinha loja×
valor e custa mais, sem ganho para documentos pequenos.

Modelo de preço da proposta: `valor` = à vista (base de comparação entre lojas),
`valor_parcelado` = cheio/parcelado quando difere, `condicao_pagamento` = texto
da condição. Comparação e "menor" seguem o à vista.

Evolução registrada: quando o comparativo for uma MATRIZ (vários itens × vários
fornecedores), evoluir para o modelo item×fornecedor reusando
`obra_cotacao_proposta_item` ligado a um item canônico da necessidade. Adiado até
a dor aparecer (o design partner disse "os dois, depende da compra").

## Modelo de dados

Reusa `obra_cotacao` e `obra_cotacao_proposta` da 018. Acrescenta:

```
obra_cotacao_proposta_item
  id             uuid PK
  empresa_id     uuid  -- isolamento
  proposta_id    uuid  -- FK obra_cotacao_proposta ON DELETE CASCADE
  descricao      text NOT NULL
  quantidade     numeric(14,3)
  unidade        text
  preco_unitario numeric(14,2)
  valor_total    numeric(14,2) NOT NULL >= 0
  ordem          int   -- ordem de exibição (ordem do PDF)
  created_at/updated_at
```

Decisões:
- **Itens vivem na proposta, não na necessidade.** A `obra_cotacao.descricao` é o
  rótulo da cotação ("Material elétrico, Bloco B"). Cada fornecedor traz sua
  própria cesta (o PDF é do fornecedor). Compatível com proposta simples da 018:
  sem itens, o `valor` digitado continua valendo.
- **Sem soft delete nos itens** (são filhos da proposta; somem por CASCADE).
- **Comparação entre fornecedores por total** da proposta (menor total destacado,
  igual à 018). Cada proposta é expansível para ver os itens. Comparar item-a-item
  entre fornecedores fica **fora** (exigiria casar itens por nome, frágil).
- RLS por `empresa_id = get_user_empresa_id()` + revalidação de que `proposta_id`
  pertence à empresa, no padrão da 018.

## Import por IA (edge function `ai-cotacao-import`)

- Entrada: `{ arquivoBase64, mimeType }` (PDF, PNG ou JPG). Auth pelo token do
  request; `empresa_id` derivado do token, nunca confiado do body.
- Rate limit por empresa via `checkRateLimit` (padrão `_shared/ai-client.ts`).
- Chama `callGeminiStructured` em modo **multimodal**: o arquivo vai como
  `inline_data` (base64) junto do prompt. Schema Zod força a saída
  (`{ itens: [{ descricao, quantidade, unidade, preco_unitario, valor_total }],
  fornecedor_nome?, observacoes? }`).
- Saída validada volta ao client, que preenche o preview. Registra uso com
  `recordAiUsage(featureKey: "cotacao-import")`.

### Decisão de arquitetura (multimodal vs texto-only)

A spec 017 (import financeiro) decidiu **texto-only** por privacidade: só texto
sai do cliente para o Gemini. Aqui a decisão é **oposta e deliberada**: orçamento
de fornecedor costuma vir como PDF escaneado/foto, que extração de texto no client
(`pdfjs`) não lê. Para a feature funcionar no mundo real, o arquivo em si vai ao
Gemini (`inline_data`). Custo: o binário sai do cliente para o provedor de IA, e
gasta mais token. Registrar como ADR se o padrão se espalhar para outros imports.

## UI

Na tela de cotação (aba da obra, `CotacaoDetailDialog`):
- No formulário de proposta, botão **"Importar de orçamento (PDF)"**: sobe o
  arquivo, mostra spinner enquanto a IA lê, e abre o preview.
- **Preview editável**: tabela de itens (descrição, qtd, unidade, preço unit,
  total) com edição linha a linha, remover linha, adicionar linha manual. Total da
  proposta = soma dos itens (recalcula ao editar). Nome do fornecedor sugerido
  quando a IA identificar.
- Confirmar grava a proposta + itens em lote. Editar depois abre os mesmos itens.
- A comparação de propostas mostra o total; expandir a proposta lista os itens.

## Fora de escopo (desta rodada)

- Comparação item-a-item entre fornecedores.
- Itens na necessidade (`obra_cotacao`) — a cesta é por proposta.
- Excel/CSV de orçamento (só PDF/imagem via multimodal por ora).
- Lançar a cesta como despesa detalhada: ao decidir, segue a 018 (uma despesa pelo
  total da vencedora via `rpc_obra_despesa_salvar`).

## Verificação (critérios de aceite)

- [ ] Migration cria `obra_cotacao_proposta_item` com RLS por empresa; `npm run test:run` do núcleo passa.
- [ ] Edge function lê um PDF de orçamento de teste e devolve itens válidos (schema Zod).
- [ ] Preview permite editar/remover/adicionar item; total recalcula.
- [ ] Confirmar grava proposta + itens; reabrir a proposta mostra os itens.
- [ ] Proposta simples (sem itens) da 018 continua funcionando.
