# ADR 0013: Financeiro de obra por administração — dois bolsos e uma lente

**Data:** 2026-07-31
**Status:** Accepted

## Contexto

O [ADR 0011](./0011-reabrir-obras-como-fase-de-execucao-do-projeto.md) decidiu que a
obra "reusa o Financeiro do projeto; não cria um segundo motor de dinheiro". Isso está
certo para o **faturamento de honorário** do projeto, mas é insuficiente para o modo
como o ICP realmente ganha dinheiro tocando a obra do cliente.

Ao usar o módulo e ao conversar com o design partner (VRZ, que passa a administrar
também a obra de um terceiro), o CEO identificou o furo: **o gasto da obra (material,
empreiteiro) é dinheiro do CLIENTE, não do escritório.** Jogar esse custo no mesmo
balde que mede a margem do escritório mente sobre o resultado — o faturamento aparente
infla e a margem real some.

Validação de duas fontes:

- **Persona ICP** (engenheiro de escritório multidisciplinar): cobra a obra por
  **administração** (taxa de 8-15% sobre o custo), não por empreitada de preço fechado.
  A receita dele é **honorário de projeto + taxa de administração**. O custo da obra é
  dinheiro de terceiro em trânsito, que às vezes passa pela conta do escritório (ele
  adianta e reembolsa). O cliente cobra transparência ("cadê meu dinheiro?") toda
  reunião, e a prestação de contas hoje é feita no braço, em planilha.
- **Research de mercado** (`research/aec/obra-por-administracao-prestacao-de-contas-mercado-br.md`):
  a obra por administração tem rito consagrado (conta individualizada por obra, extrato
  - carta de avanço, assembleia, auditor). **Nenhum concorrente** (Sienge, Vobi, Obra
    Prima, Mais Controle) entrega, para o escritório que administra sem fornecer mão de
    obra, o par **extrato-que-o-dono-vê + segregação do dinheiro do cliente**. É janela
    aberta e é a tese do Pilar (margem confiável) aplicada a caixa de terceiros.

A pergunta deste ADR: como modelar o financeiro para separar o dinheiro do cliente da
margem do escritório sem duplicar o motor financeiro nem virar ERP de construtora.

Opções consideradas:

- **A — Tudo num financeiro só, custo da obra como despesa do escritório.** É o que o
  ADR 0011 sugeria ao pé da letra. Contra: polui a margem do escritório com dinheiro
  que não é dele; é exatamente o erro que o ICP comete na planilha e que o Pilar deveria
  corrigir.
- **B — Três financeiros paralelos (escritório, projeto, obra).** Contra: o ICP foi
  explícito que "financeiro do projeto" não é um caixa, é um recorte; três lugares para
  conferir gera desconfiança de que os números não fecham entre si.
- **C — Dois bolsos e uma lente.** Dois caixas reais (escritório e obra) + uma visão
  (projeto) que recorta o caixa do escritório. Escolhida.

## Decisão

Adotar o modelo **dois bolsos e uma lente**.

- **Bolso 1 — Financeiro do escritório** (o que já existe). Receita = honorários +
  **taxa de administração**. Despesa = custos próprios (folha, aluguel, imposto). É a
  **margem real do escritório**. O custo da obra (material/empreiteiro) **não entra
  aqui**.
- **Bolso 2 — Conta da obra** (novo, um por obra). Registra **aportes do cliente**
  (entradas) e **despesas pagas com o dinheiro do cliente** (saídas), com **previsto vs
  realizado por grande etapa** e **saldo**. É dinheiro de terceiro / prestação de
  contas; **não compõe a margem do escritório** (não entra na DRE do Bolso 1).
- **Lente — Resultado do projeto.** Recorte do Bolso 1 por contrato (honorário
  faturado / a receber + custo de horas alocadas). **Não é caixa próprio.** Nomear
  "resultado do projeto" / "quanto sobrou nesse projeto", **nunca** "financeiro do
  projeto" (evita a falsa impressão de um caixa que não existe).
- **Elo automático da taxa.** Cada despesa lançada na conta da obra gera
  **automaticamente** uma receita de taxa de administração (o `taxa_administracao_pct`
  configurado na obra) como "a receber" no Bolso 1. Digitação única; o usuário nunca
  lança a taxa dos dois lados. Este elo é o que faz a separação valer a pena em vez de
  dobrar o trabalho.
- **Campo "pago por" na despesa da obra.** `cliente` (dinheiro de terceiro) ou
  `escritorio_reembolsavel` (o escritório adiantou do próprio caixa). Quando é
  `escritorio_reembolsavel`, o valor vira um "a receber" no Bolso 1 até o cliente pagar.
  Modela o dinheiro que encosta no escritório sem inventar contabilidade dupla.
- **Aporte não é obrigatório.** Pode lançar despesa sem aporte registrado; o saldo pode
  ficar negativo (= o cliente deve / o escritório adiantou). Bate com a informalidade
  real (cliente que manda PIX quando pedido).
- **Previsto vs realizado por GRANDE etapa** (5-8 macroetapas), nunca por insumo /
  curva ABC. Composição de custo detalhada é território de ERP de construtora
  (anti-persona) e foi cortada na spec 015.
- **Prestação de contas ao cliente** reusa o **portal do cliente** existente: o dono da
  obra vê o extrato (aportes, despesas por etapa, saldo, taxa de administração como
  linha destacada). Read-only.

O **detalhamento de tabelas, RPC e telas** fica na [spec 016](../../specs/016-conta-da-obra-e-prestacao-de-contas.md).

Fora deste ADR (direção registrada, não decisão): a integração **Asaas** (backend
dormente) para a conta da obra virar **conta bancária real com repasse e extrato
automático** (paridade com Vobi Pay). É o caminho natural de fase 2; a fase 1 é
registro manual/assistido.

## Consequências

**Positivas:**

- A margem do escritório para de mentir: o custo do cliente sai da DRE do Bolso 1.
  É a tagline ("saber se o projeto dá lucro") aplicada à execução.
- Prestação de contas ao cliente no portal = a feature que o ICP disse que pagaria na
  hora (para de ser cobrado "cadê meu dinheiro" toda reunião).
- Ocupa um espaço competitivo que nenhum player atende para esse comprador.
- O elo automático da taxa evita a dupla digitação que faria o ICP abandonar.

**Negativas (assumidas de olho aberto):**

- Nova entidade "conta da obra" e um conceito novo na cabeça do usuário. Mitigado pela
  linguagem "dois bolsos e uma lente" e por nunca chamar a lente de "financeiro".
- Manter o custo da obra fora da DRE do escritório exige que o usuário classifique
  "pago por" com disciplina. Mitigado por default sensato (`cliente`).
- Sem Asaas, a conta da obra é registro manual — fricção. Mitigada pela captura leve
  (voz / importação de extrato, spec 016 e roadmap).
- Risco de escorregar para ERP se "previsto vs realizado" virar curva ABC de insumo.
  **Guardrail:** grande etapa apenas.

## Decisões relacionadas

- [ADR 0011](./0011-reabrir-obras-como-fase-de-execucao-do-projeto.md): amendado no
  ponto "obra reusa o Financeiro" — para honorário sim; para custo de obra, a conta da
  obra é um bolso à parte.
- [ADR 0012](./0012-obra-sem-projeto-obrigatorio-e-local-proprio.md): obra pode existir
  sem projeto; a conta da obra também (não depende do vínculo).
- [SPEC 015](../../specs/015-obras-mvp.md): o MVP (RDO/frentes/timeline) sobre o qual
  isto cresce.
- [SPEC 016](../../specs/016-conta-da-obra-e-prestacao-de-contas.md): o QUÊ e o COMO.
- `docs/strategy/DECISAO_MODULOS_INDEPENDENTES_2026-07-30.md`: Financeiro na fundação
  compartilhada; a conta da obra é um recorte dessa fundação, não um app paralelo.
- `research/aec/obra-por-administracao-prestacao-de-contas-mercado-br.md`: o buraco de
  mercado que sustenta esta decisão.
