# SPEC: Calculadora de margem na proposta (preço, imposto, taxa e desconto máximo)

**Data:** 2026-11-18
**Status:** Draft
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** propostas | leads | projetos

<!-- Origem: conversa com prospect que hoje negocia com uma planilha própria: ele informa
imposto e taxa de maquininha e descobre o desconto máximo que ainda deixa lucro. O Pilar só tem
margem simples por disciplina (venda − horas × custo/hora). Varredura de 2026-11-18 não achou
imposto, taxa de recebimento, desconto máximo, margem-alvo aplicada nem ponto de equilíbrio. -->

## Problema

Na negociação, o sócio do escritório precisa saber na hora quanto pode descontar sem perder
dinheiro. Hoje o Pilar mostra a margem sobre o custo da mão de obra, mas ignora imposto e taxa de
recebimento, então a margem exibida é maior que a real. O sócio volta para a planilha, e o dado
da negociação não chega ao projeto.

## Objetivo

Na proposta, o usuário informa a margem que quer e vê o preço sugerido, ou informa o preço e vê a
margem líquida real e o desconto máximo. A simulação aceita imposto e meio de recebimento, e a
margem prometida segue até o projeto, onde o guardião de margem e a rentabilidade comparam o real
com ela.

**Fora de escopo:**

- BDI em cascata, composição de custo, catálogo, orçamento paramétrico por ambiente. Decisão
  fechada em `DECISOES.md` (~linha 950). A calculadora age só sobre honorário por disciplina.
- Cálculo fiscal oficial (apuração de Simples, retenções por cliente, emissão de NFS-e). A
  alíquota é um percentual efetivo informado pelo escritório.
- Custo/hora carregado com encargos e despesas fixas rateadas (fase 2, ver Decisões).
- Ponto de equilíbrio do escritório (fase 2).
- IA sugerindo preço. As edge functions `ai-*` seguem dormentes.

## Requisitos

Funcionais:

1. **Configuração da empresa** (Configurações > Empresa, ou painel próprio): alíquota efetiva de
   imposto sobre a receita (%), margem mínima aceitável (%), margem-alvo padrão (%) e lista de
   meios de recebimento com taxa (%) e, para cartão, taxa por faixa de parcelas. Só quem tem
   permissão financeira edita e vê.
2. **Calculadora no editor da proposta**, sobre as linhas de `DisciplinasEditor`. Parâmetros da
   simulação: imposto (%), meio de recebimento e parcelas, margem-alvo (%). Tudo pré-preenchido
   pelo padrão da empresa e editável por proposta.
3. **Duas direções, mesmo cálculo** (função pura em `src/pages/propostas/lib/`):
   - Margem-alvo → preço sugerido: `preço = custo / (1 − margem − imposto − taxa)`.
   - Preço → margem líquida: `margem = 1 − custo/preço − imposto − taxa`.
4. **Desconto máximo**: maior desconto sobre o preço de tabela que mantém a margem líquida ≥
   margem mínima. Mostrar também o desconto de empate (margem líquida = 0).
5. **Campo de desconto aplicado** na proposta; o valor proposto passa a ser preço de tabela menos
   desconto, e a margem líquida recalcula ao vivo.
6. **Semáforo**: verde (≥ margem-alvo), amarelo (entre mínima e alvo), vermelho (< mínima),
   nos tokens semânticos, no editor da proposta e no card do lead.
7. **Aplicar preço sugerido** é ação explícita. O sistema nunca sobrescreve o valor digitado.
8. **Fluxo conectado**: o lead mostra `valor_estimado` e a margem da proposta mais recente. A
   simulação fica salva em `propostas.dados_simulacao`. Ao converter em projeto, a margem-alvo
   vai para `projeto_orcamento_fases.margem_alvo_pct`.
9. **Rentabilidade e guardião** passam a exibir margem prometida versus margem real no projeto.
10. **Texto para o usuário** sem jargão: "Você fica com X% depois de imposto e taxa". O cálculo
    abre em um painel recolhível com a conta explicada.

Não funcionais:

- **Segurança / RLS:** tabela de configuração fiscal com RLS por `empresa_id` e leitura/escrita
  só com `can_view_financeiro()`. Quem não tem acesso a dinheiro não vê margem, imposto nem
  desconto máximo (mesma regra de `valor_contrato`).
- **Multi-tenant:** isolamento por `empresa_id`.
- **Precisão:** cálculo em centavos, arredondamento no fim, divisão por zero tratada quando
  `1 − margem − imposto − taxa ≤ 0` (mostrar aviso, não preço).
- **Design:** `PilarPage`, `FormDialog`, `MoneyInput`, `StatusBadge`, `@/lib/format`.

## Critérios de aceite

- [ ] Dado custo 7.000, imposto 6%, taxa 0% e margem-alvo 30%, então o preço sugerido é
      10.937,50 (7.000 / 0,64).
- [ ] Dado preço 10.000 e custo 7.000 com imposto 6% e taxa de cartão 3,5%, então a margem
      líquida é 20,5%.
- [ ] Dado margem mínima 15% e esses parâmetros, então o desconto máximo bate com a fórmula e
      aplicar esse desconto resulta em margem líquida exatamente 15%.
- [ ] Dado desconto que leva a margem abaixo da mínima, então o semáforo fica vermelho e o
      aviso aparece, sem bloquear o salvamento.
- [ ] Dado margem + imposto + taxa ≥ 100%, então não há preço sugerido e aparece aviso.
- [ ] Dado usuário sem permissão financeira, então não vê calculadora, margem nem desconto máximo.
- [ ] Dado proposta com simulação convertida em projeto, então `margem_alvo_pct` das fases
      reflete a margem-alvo da simulação.
- [ ] Caso de borda: proposta sem disciplinas (custo zero) não quebra e não mostra margem.
- [ ] Caso de borda: valor manual divergente da soma das disciplinas mantém o aviso atual
      (`valorDivergeDaSoma`).

## Dados e contratos

- Nova tabela `empresa_config_comercial` (1 linha por empresa): `aliquota_imposto_pct`,
  `margem_minima_pct`, `margem_alvo_pct`, `meios_recebimento jsonb` (nome, taxa_pct, faixas de
  parcelas). Migration com RLS; rodar `gen:types:local` e commitar `types.ts`.
- `propostas`: nova coluna `desconto_pct numeric` (ou `desconto_valor`, a decidir no plano).
  `dados_simulacao` (jsonb, hoje sem uso) guarda o snapshot: imposto, taxa, meio, parcelas,
  margem-alvo, preço de tabela, desconto, margem líquida.
- `rpc_converter_proposta_projeto`: copia a margem-alvo da simulação para
  `projeto_orcamento_fases.margem_alvo_pct`. Nova migration que recria a função vigente
  (`20260713020000_converter_proposta_popula_disciplinas_e_promove_lead.sql`).
- Função pura nova: `src/pages/propostas/lib/margemLiquida.ts`, ao lado de `disciplinasCalc.ts`.

## Plano de implementação

Entregas pequenas, cada uma em PR para `staging`:

1. Função pura `margemLiquida.ts` com testes dos critérios numéricos. Sem UI.
2. Migration `empresa_config_comercial` e painel de configuração.
3. Painel da calculadora no editor da proposta, desconto e semáforo. Mudança visual: PR com
   antes e depois embutido.
4. Semáforo e margem líquida no card do lead e no `LeadDetailDialog`.
5. Snapshot em `dados_simulacao` e propagação na conversão, com migration da RPC.
6. Margem prometida versus real na rentabilidade do projeto e no texto do guardião.

## Decisões e riscos

- **Alíquota efetiva única versus por tipo de serviço.** Começar com uma única. Perguntar ao
  prospect se ele usa Simples (alíquota efetiva) ou presumido, e se cobra retenção por cliente.
- **Taxa de cartão é do escritório que recebe**, não da cobrança da Pilar (Asaas). Não misturar
  com `src/lib/cobranca.ts`.
- **Custo/hora hoje é só salário / horas.** Sem encargos, a margem calculada fica otimista.
  Fase 2: custo/hora carregado e `projetos.custo_indireto_pct` (existe no banco, sem UI).
- **Adoção do dado.** A spec 083 registrou custo/hora e horas zerados em produção. Sem custo por
  disciplina na proposta a calculadora não tem base. Considerar pré-preencher custo/hora da
  pessoa ou da disciplina.
- **Conflito com `DECISOES.md`.** Esta spec fica do lado de "margem sobre honorário". Se virar
  pedido de BDI ou composição, vale decisão nova do CEO, não extensão desta spec.
- **Dormente.** Rentabilidade está atrás de flag e fora do material de venda (PRICING.md).
  Confirmar se a margem prometida versus real aparece para o plano do cliente.
