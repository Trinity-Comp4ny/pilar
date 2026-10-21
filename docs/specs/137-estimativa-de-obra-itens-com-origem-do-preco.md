# SPEC: Estimativa de obra, itens do catálogo com origem do preço

**Data:** 2026-10-20
**Status:** Em implementação (motor em staging, telas na PR de F1b)
**Autor:** Matheus Rezende
**Módulo:** obras
**Origem:** [DECISOES.md](../strategy/DECISOES.md) de 2026-10-20 (itens com origem do preço e IA sobre o catálogo)
**Protótipo:** aprovado em 20/10/2026 (Claude Design, v1: https://claude.ai/artifact/PGsfphRTCM9gRQsrs3zCkb)
**ADRs:** [0064](../architecture/adr/0064-toda-linha-da-estimativa-tem-origem-do-preco-e-a-ia-so-preenche-o-catalogo.md), [0063](../architecture/adr/0063-estimativa-de-obra-motor-deterministico-e-parametros-validados.md)
**Estende:** [136: estimativa paramétrica de obra](136-estimativa-de-obra-parametrica.md)
**Cards:** BEZ-82 (catálogo e origem), BEZ-69 (SINAPI), BEZ-83 (IA sobre o catálogo), BEZ-84 (modo detalhado), BEZ-48 (PDF da planta), BEZ-80 (itens fora do CUB)

## Problema

A ficha da SPEC 136 é curta: quartos, suítes, banheiros, vagas, piscina e poucos adicionais. Uma obra de alto padrão
tem climatização, aquecimento, energia solar, automação, terraplenagem, contenção e muito mais. No teste real (Canaã,
SP, 461 m², esperado em torno de R$ 2,5 mi) o provável saiu R$ 2,27 mi: faltava cerca de R$ 200 mil antes da
administração, e cerca de 35% do total vinha de adicionais com valor provisório do Pilar, sem fonte. Quem assina a
estimativa não consegue responder "de onde saiu esse número".

## Objetivo

Cada linha de custo da estimativa mostra de onde veio o preço, o usuário descreve o que a casa terá escolhendo itens
de um catálogo (e, numa fase seguinte, escrevendo em texto livre), e a confiança do resultado passa a depender de
quanto do total tem fonte verificável. Medida de sucesso: percentual do total com origem diferente de "referência
provisória" e de "a definir", e diferença entre o provável e o custo real nas obras de calibração (BEZ-16).

**Fora de escopo:**

- Orçamento detalhado por serviço e quantitativo (BEZ-84).
- Leitura do PDF da planta (BEZ-48) e leitura de texto livre por IA (BEZ-83): ficam em SPEC própria, sobre o catálogo
  desta.
- Qualquer preço sem origem: se não há fonte, o item fica "a definir".
- Mudar a base do CUB: continua como na SPEC 136.

## Requisitos

1. **Catálogo curado e versionado.** Cada item tem id estável, nome, categoria, unidade, `escopo`, driver de
   quantidade, regra de preço, fase, etapa, serviços e produtividade (h por unidade). O catálogo tem versão, e a
   estimativa grava a versão usada.
2. **Só entra somando o que o CUB não cobre.** `escopo` vale `fora_do_cub` (soma ao total) ou `dentro_do_cub` (já está
   na base, só informativo). O motor recusa catálogo que marque como soma um item `dentro_do_cub` (teste de contrato).
   Pintura, piso, esquadria, acabamento e mão de obra continuam dentro da base; o padrão (baixo, médio, alto) define a
   qualidade.
3. **Origem obrigatória em toda linha.** `cub`, `sinapi`, `empresa`, `usuario`, `referencia_pilar` (provisória,
   sempre marcada) ou `a_definir`. Para SINAPI: código, UF, mês, regime e se o preço foi coletado ou derivado.
4. **Resolução de preço, nesta ordem.** Valor informado pelo usuário, tabela de preços da empresa, SINAPI (UF, mês e
   regime da estimativa), referência provisória do Pilar enquanto existir, a definir. O motor nunca preenche um número
   sem origem.
5. **Quantidade vem da ficha.** Cada item declara o driver: área construída, m² informado, contagem informada (ex.:
   aparelhos de ar-condicionado por classe de BTU) ou presença (sim ou não). Quantidade ausente deixa o item "a
   definir".
6. **A definir fica fora do total.** Aparece na lista com aviso e três ações: informar valor, anexar orçamento ou usar
   a tabela da empresa.
7. **Resultado com origem.** Cada linha mostra o chip da origem e abre o detalhe (código, UF, mês, regime, coletado ou
   derivado). O topo mostra o percentual do total por origem e quanto tem fonte verificável (`cub`, `sinapi`, `empresa`,
   `usuario`).
8. **Faixa depende da fonte.** A faixa de custo alarga quando o percentual provisório ou a definir passa de um limite
   (parâmetro em `estimativa_parametros`, provisório e sujeito à validação).
9. **Cronograma do catálogo.** Cada item aponta fase, etapa e serviços; o cronograma e o desembolso saem desses
   metadados, como hoje para os adicionais. Item novo só entra numa fase que já existe.
10. **Tabela de preços da empresa.** A empresa mantém o valor próprio por item do catálogo, ao lado do valor de
    referência, com unidade e observação. Só a própria empresa lê e escreve (RLS).
11. **Valor informado pelo usuário.** Por estimativa, com nota e anexo opcionais. Fica na versão e não vira preço da
    empresa sem ação explícita.
12. **SINAPI no servidor (BEZ-69).** Importação mensal do zip oficial (`SINAPI-AAAA-MM-formato-xlsx.zip`), validada na
    fronteira. Guarda insumos e composições uma vez e o preço (por UF e regime) só dos códigos usados pelo catálogo. No
    Excel da Caixa o código da composição vem dentro de uma fórmula; o leitor extrai da fórmula ou da aba Analítico.
13. **Reprodutível.** A versão da estimativa grava a versão do catálogo e a origem de cada linha. Um resultado antigo
    não muda quando o catálogo ou o SINAPI mudam.
14. **Um passo só para o que a obra tem.** O passo "O que a obra tem" do assistente junta os ambientes (quartos,
    suítes, banheiros, lavabos, vagas) e os itens do catálogo. Os ambientes não mudam o preço (o CUB já considera o
    padrão): servem para conferir a ficha e para o PDF. O assistente continua com 4 passos.
15. **Sem regressão.** Estimativa e versão da SPEC 136 continuam abrindo: linhas sem origem gravada leem como
    `referencia_pilar`.

Requisitos não-funcionais:

- **Segurança / RLS:** catálogo e SINAPI leem para qualquer autenticado e escrevem só com `is_ultra_admin()` (com
  segundo fator). Tabela de preços da empresa por `empresa_id = get_user_empresa_id()`. Anexos de orçamento em bucket
  privado por empresa.
- **Multi-tenant:** `empresa_id` nunca vem do client.
- **Validação na fronteira:** planilha do SINAPI, itens do catálogo, valores informados e (depois) a saída da IA passam
  por schema.
- **Performance:** o cálculo continua no cliente e instantâneo. O catálogo curado (centenas de itens) e os preços dos
  seus códigos para a UF e o regime da estimativa cabem numa consulta.
- **Licença:** confirmar os termos de uso dos dados do SINAPI antes de publicar preços a terceiros.

## Critérios de aceite

- [ ] Dado um item `fora_do_cub` com preço de usuário, quando calcular, então a linha traz `origem.tipo = "usuario"` e
      entra no total.
- [ ] Dado um item `fora_do_cub` sem preço em nenhuma fonte, então a linha é `a_definir`, fica fora do total e aparece
      com aviso.
- [ ] Dado SINAPI com preço para o código, UF e regime da estimativa, então a linha traz código, UF, mês, regime e
      coletado ou derivado, e o valor é quantidade vezes custo unitário da composição.
- [ ] Dado valor do usuário e da empresa para o mesmo item, então vale o do usuário.
- [ ] Dado um catálogo com item `dentro_do_cub` marcado como soma, então o motor recusa (teste de contrato).
- [ ] Dado qualquer resultado, então toda linha de custo tem origem, e a soma por origem é igual ao total (teste de
      contrato).
- [ ] Dado o mesmo input e as mesmas fontes, então o resultado é idêntico (determinismo).
- [ ] Dada uma versão antiga da SPEC 136, então ela abre com as linhas lidas como `referencia_pilar`.
- [ ] Dado percentual provisório acima do limite, então a faixa fica mais larga e a tela explica por quê.
- [ ] Dado usuário de outra empresa, então não lê a tabela de preços da primeira (pgTAP).
- [ ] Dado usuário comum, então não escreve no catálogo nem no SINAPI (pgTAP).
- [ ] Dado o zip do SINAPI de set/2026, então a importação lê a fórmula do código da composição e recusa planilha com
      formato diferente, sem gravar nada.

## Dados e contratos

Tabelas novas (migrations nas fases F0 e F1, nomes provisórios):

- `estimativa_catalogo_itens(id, versao, categoria, nome, unidade, escopo, driver jsonb, regra_preco jsonb, fase,
etapa, servicos jsonb, produtividade_h_unidade)`, global, só o ultra admin escreve.
- `sinapi_referencias(mes_base, importado_em, arquivo, regime_disponivel)`, `sinapi_insumos(codigo, descricao,
unidade)`, `sinapi_composicoes(codigo, descricao, unidade, grupo)`, `sinapi_preco_insumo(codigo, uf, regime,
mes_base, valor, origem)` e `sinapi_custo_composicao(codigo, uf, regime, mes_base, custo, pct_as)`, guardando preço só
  dos códigos usados pelo catálogo.
- `estimativa_precos_empresa(empresa_id, item_id, valor, unidade, observacao)`.
- Em `estimativas_obra` e nas versões: `itens jsonb` (item, quantidade, valor do usuário) e `catalogo_versao`.

Linha de custo do resultado: `{ itemId, rotulo, quantidade, unidade, valorUnitario, valor, origem }`, com `origem`
como na ADR 0064.

## Plano de implementação

Fases, cada uma entregável sozinha:

1. **F0, SINAPI (BEZ-69).** Importador na tela do ultra admin: o navegador lê as abas ISD e ICD do
   `SINAPI_Referência_AAAA_MM.xlsx` e grava só os insumos do catálogo (tabela `sinapi_precos_insumo`). Composições ficam
   para a F4 (BEZ-84), onde a fórmula do código da composição será lida. Testado com o arquivo real de set/2026.
   Runbook: [ESTIMATIVA_IMPORTAR_PRECOS_MENSAL](../operations/ESTIMATIVA_IMPORTAR_PRECOS_MENSAL.md).
2. **F1, catálogo e origem (BEZ-82).** Migrations, motor com `origem` em toda linha e resolução de preço, versão do
   catálogo na estimativa, testes de contrato. Catálogo v1 com os itens que o CUB não cobre. Depende do protótipo para a
   tela.
3. **F1b, telas.** Itens do catálogo dentro do passo "O que a obra tem", resultado com origem, a definir com ações, tabela de preços da
   empresa. Só depois do protótipo aprovado.
4. **F2, IA sobre o catálogo (BEZ-83).** SPEC própria: texto livre vira itens validados contra o catálogo, tela "O que
   entendi", conjunto de avaliação com descrições reais.
5. **F3, PDF da planta (BEZ-48).** Preenche área e quantidades.
6. **F4, modo detalhado (BEZ-84).** Quantitativo vezes composição do SINAPI, em substituição à base, como conferência.

## Decisões e riscos

- ADR 0064: origem obrigatória, catálogo fechado, IA só interpreta.
- **Risco: dupla contagem.** Somar item que o CUB já cobre. Mitigação: `escopo` no catálogo e teste de contrato.
- **Risco: SINAPI subestima alto padrão.** Os preços de insumo são de padrão corrente (porcelanato retificado a R$ 63/m²
  em SP). Mitigação: a origem mostra "SINAPI padrão" e o usuário ou a empresa podem informar o valor do acabamento.
- **Risco: catálogo incompleto.** Item fora do catálogo vira "a definir" ou valor do usuário. O conjunto de obras reais
  (BEZ-16) guia quais itens entram primeiro.
- **Risco: licença dos dados.** Confirmar os termos de uso do SINAPI.
- **Suposição:** preço SINAPI por UF e regime cobre os itens que importam no alto padrão; no teste de set/2026 cobre
  split residencial, aquecedor solar, estaca, sapata, radier, forro, janela, porta, pintura e plantio de grama, e não
  cobre painel fotovoltaico, automação, churrasqueira, paisagismo nem móveis planejados.

## Anexo: briefing para o protótipo no Claude Design

**Telas** (desktop 1440 e mobile 390, com os estados vazio, carregando, erro e cheio):

1. **Passo "O que a obra tem"** do assistente de estimativa, com duas partes: os ambientes (contadores de quartos,
   suítes, banheiros, lavabos e vagas, só informativos) e, abaixo, os itens que o CUB não cobre. Lista agrupada por
   categoria (Climatização, Aquecimento, Energia solar, Automação, Piscina, Área gourmet, Paisagismo, Terraplenagem e
   contenção, Fundação especial, Elevador, Marcenaria). Cada item liga e desliga, com quantidade quando faz sentido
   (aparelhos de ar-condicionado por classe de BTU, kWp, m²). Cada item mostra, antes de calcular, de onde virá o preço
   (chip da origem) ou "sem preço de referência: informe o valor". Campo "Descreva a obra" desabilitado com a marca
   "em breve" (fase 2).
2. **Resultado com origem.** A tabela de adicionais ganha a coluna Origem com chips (CUB, SINAPI, Empresa, Você
   informou, Referência provisória, A definir). Clicar abre um painel lateral com código, UF, mês, regime e se foi
   coletado ou derivado. No topo, uma barra com o percentual do total por origem e a frase "X% do total tem fonte
   verificável".
3. **Item a definir.** Linha com aviso e três ações: informar valor (com nota), anexar orçamento ou usar a tabela da
   empresa.
4. **Tabela de preços da empresa** (Configurações): lista de itens com o valor de referência ao lado do valor próprio,
   unidade e observação.

**Dados seed:** obra Canaã (SP, 461 m², alto padrão, terreno inclinado com 80 m² de muro de arrimo), 8 aparelhos de
ar-condicionado de 12.000 BTU, aquecedor solar, painel solar de 10 kWp (sem preço de referência), automação (sem
preço), piscina de 20 m², área gourmet, marcenaria completa.

**Restrições do design system:** `PilarPage`, `SectionTabs`, `FormDialog`, `DataTable` com papéis mobile, `Badge` e
tokens semânticos (nunca cor crua), sem dropdown nativo do sistema, espera com a marca (ADR 0049), dinheiro e data por
`@/lib/format`. Microcopy em português, voz ativa, sentence case, sem emoji.
