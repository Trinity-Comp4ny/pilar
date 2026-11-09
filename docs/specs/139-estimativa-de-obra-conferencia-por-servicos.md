# SPEC: Estimativa de obra, conferência por serviços do SINAPI

**Data:** 2026-10-21
**Status:** Draft (aguarda D1 a D4 e o protótipo)
**Autor:** Matheus Rezende
**Módulo:** obras (estimativa)
**Estende:** [137: itens com origem do preço](137-estimativa-de-obra-itens-com-origem-do-preco.md) (F4 daquela spec)
**ADRs:** [0063](../architecture/adr/0063-estimativa-de-obra-motor-deterministico-e-parametros-validados.md), [0064](../architecture/adr/0064-toda-linha-da-estimativa-tem-origem-do-preco-e-a-ia-so-preenche-o-catalogo.md)
**Protótipo:** pendente (briefing no fim desta SPEC, para o Claude Design)
**Card:** BEZ-84

## Problema

A estimativa de cima para baixo (CUB mais itens) dá uma faixa rápida, mas quem assina precisa de um segundo olhar: o que
a mesma obra custaria somando serviço por serviço. Hoje não há como cruzar. O escritório que já tem o quantitativo (m² de
alvenaria, m de estaca, m² de forro, em planilha ou no orçamento de outro sistema) não consegue dizer "o CUB está
coerente com o meu quantitativo?" sem sair do Pilar.

## Objetivo

O usuário informa serviços do SINAPI com quantidade (digitando, buscando ou colando "código; quantidade" da planilha que
já tem) e o Pilar mostra, etapa por etapa, o custo de baixo para cima ao lado do custo do CUB e a diferença, com a
origem de cada preço. Medida de sucesso: estimativas em que o usuário abriu a conferência e quanto a diferença por etapa
bate com a que ele mesmo calculou nas obras de calibração (BEZ-16).

**Fora de escopo:**

- Substituir a base do CUB pelo orçamento detalhado, ou somar os dois (D1: a conferência não muda o provável).
- Gerar quantitativo: ler a planta é o BEZ-48; coeficiente de "quantos m² de alvenaria por m² construído" não entra,
  porque seria número sem fonte (ADR 0064).
- Composições paramétricas e representativas do SINAPI (ver Decisões): não vêm no zip mensal.
- Detalhar a composição (insumos, coeficientes) e produtividade por serviço para o cronograma.
- Ser uma ferramenta de orçamento completo (BDI, curva ABC, medição). O Pilar confere, não orça.

## O que existe no SINAPI (medido no arquivo de set/2026)

- **10.599 composições de serviço** em 172 grupos, 8.443 com custo calculado em SP. O código da composição vem dentro da
  fórmula `HYPERLINK` da aba (a célula guarda 0), então a leitura extrai o código da fórmula.
- Custo por UF (27) e por regime (sem e com desoneração), com 228 mil pares código e UF com custo por regime: cerca de
  456 mil linhas por mês nos dois regimes.
- **Granularidade alta:** só em alvenaria de vedação são 84 composições (tipo de bloco, espessura, argamassa); armação
  de aço é uma composição por bitola. Um orçamento de casa tem de 150 a 400 linhas. Por isso não existe "lista curta de
  serviços": o usuário busca na base inteira ou cola o que já tem.
- É **custo direto**, sem administração, e de insumo de linha corrente. O CUB já traz despesas administrativas e
  equipamentos. A diferença entre os dois não é erro de nenhum: a tela diz isso.
- Itens sem composição ou sem custo no mês: piscina e muro de arrimo existem sem custo; as composições de energia solar
  fotovoltaica (painel, inversor, string box, cabo) apareceram em jan/2026 e em set/2026 ainda estão **sem custo**; já o
  aquecedor solar com instalação tem custo. Item sem custo na UF fica "a definir" e fora da soma.

## Requisitos

1. **Base de composições.** O ultra admin importa, na aba SINAPI, as composições (código, descrição, unidade, grupo) e o
   custo por UF e regime do mês, lidos das abas CSD e CCD do mesmo arquivo da SPEC 137. Só o mês mais recente fica no
   banco (a SPEC 137 já guarda o histórico do que a estimativa usou na versão). Mesma validação na fronteira da
   importação de insumos, sem gravar nada se houver erro.
2. **Linhas de serviço na estimativa.** `ficha.servicos`: lista de `{ codigo, quantidade, etapa? }`, até 500 linhas,
   quantidade positiva. Entram por três caminhos: **buscar** na base por texto ou código, **colar** linhas "código;
   quantidade" (ou o CSV exportado de outro sistema) com prévia e erro por linha, e **editar** a quantidade ou remover.
3. **Preço e origem de cada linha.** Custo unitário da composição na UF e no regime da estimativa, no mês mais recente.
   A origem é sempre SINAPI (código, UF, mês, regime) e abre o mesmo painel de origem da SPEC 137. Composição sem custo na
   UF, ou código que não existe, vira linha "a definir", fora da soma, com o motivo. Nunca empresta custo de outra UF.
4. **Etapa de cada serviço.** O grupo do SINAPI mapeia para uma etapa do modelo (preliminares, estrutura, alvenaria,
   cobertura, instalações, esquadrias, revestimentos, pisos, pintura, louças e metais, limpeza) por uma tabela fixa no
   código. O usuário troca a etapa de uma linha. Serviço de grupo sem etapa (fundação, adicionais, equipamentos) aparece
   à parte, "fora da base do CUB", e não entra na comparação.
5. **Conferência por etapa.** Nova aba "Conferência" no resultado, com: por etapa, o CUB (valor da etapa), o detalhado
   (soma das linhas), a diferença em reais e em %, quantas linhas e quantas "a definir"; a cobertura (etapas com ao menos
   uma linha, de 11); o total das etapas cobertas dos dois lados; e o aviso fixo de que o SINAPI é custo direto, de insumo
   de linha corrente, sem administração.
6. **Não muda o provável.** A conferência nunca altera o custo, a faixa, o cronograma nem o desembolso (D1). Ela é
   gravada na versão junto com a ficha, para a comparação poder ser reaberta.
7. **Sem comparação enganosa.** Etapa sem linha mostra "sem serviços" e não "diferença de 100%". O total só compara as
   etapas cobertas. Cobertura abaixo de metade das etapas leva o aviso "conferência parcial".
8. **Determinístico e puro.** Função `calcularConferencia(entrada)` no mesmo estilo do motor: mesma entrada, mesmo
   resultado, em centavos, sem rede.
9. **Sem regressão.** Estimativa, ficha e versão antigas abrem sem a aba preenchida; `servicos` ausente lê como lista
   vazia.

Requisitos não-funcionais:

- **Segurança / RLS:** composições e custos leem para qualquer autenticado e escrevem só com `is_ultra_admin()` e
  segundo fator, como `sinapi_precos_insumo`. `empresa_id` nunca vem do cliente.
- **Custo de banco:** cerca de 456 mil linhas e algumas dezenas de MB por mês. Fica só o mês mais recente (a importação
  troca o mês), com índice por código, UF e regime. Conferir com o FinOps antes de ligar.
- **Performance:** a busca é no servidor (texto e grupo, limite de 50), o cálculo é no cliente. Colar 400 linhas valida
  em uma consulta só.
- **Importação:** ler CSD e CCD com fórmulas levou 2 s e uns 570 MB de memória no Node; medir no navegador antes de
  prometer. Plano B: dividir a leitura por aba e gravar em lotes pela RPC.
- **Licença:** confirmar os termos de uso do SINAPI antes de mostrar a composição e o custo a terceiros (pendência da SPEC
  137 que passa a pesar mais aqui).

## Critérios de aceite

- [ ] Dado o arquivo de set/2026, então a importação lê 10.599 composições, extrai o código da fórmula e grava os
      custos de 27 UFs nos dois regimes, e recusa arquivo sem as abas CSD e CCD ou com mês diferente entre elas.
- [ ] Dada uma linha com código e quantidade, quando calcular na UF e no regime da estimativa, então o valor é
      quantidade vezes o custo unitário e a origem traz código, UF, mês e regime.
- [ ] Dada uma composição sem custo na UF da obra, então a linha é "a definir", não soma e não pega custo de outra UF.
- [ ] Dado um código que não existe na base, então a linha é recusada na colagem, com o número da linha.
- [ ] Dadas linhas em duas etapas, então a diferença de cada uma é detalhado menos CUB da etapa, e o total compara só as
      etapas cobertas.
- [ ] Dada uma etapa sem linhas, então mostra "sem serviços", sem diferença.
- [ ] Dada qualquer conferência, então o provável, a faixa e o cronograma da estimativa não mudam (teste de contrato).
- [ ] Dado serviço de fundação ou de grupo sem etapa, então aparece "fora da base do CUB" e não entra na comparação.
- [ ] Dado o mesmo input e a mesma base, então o resultado é idêntico.
- [ ] Dada uma estimativa antiga, então abre normalmente e a aba Conferência mostra o estado vazio.
- [ ] Dado usuário de outra empresa ou comum, então não escreve composições (pgTAP) e `empresa_id` não vem do cliente.

## Dados e contratos

Migrations novas (F4a):

- `sinapi_composicoes(codigo int, descricao text, unidade text, grupo text, mes_base date)`, PK `codigo`, com índice de
  busca por texto (`pg_trgm` ou `to_tsvector` em português) e por grupo.
- `sinapi_custo_composicao(codigo int, uf, regime, mes_base, custo numeric(14,2), pct_as numeric(5,2), PK(codigo, uf,
regime, mes_base))`.
- RPC de importação em lotes (`SECURITY DEFINER`, só ultra admin com segundo fator) que troca o mês inteiro em uma
  transação, para a base nunca ficar com dois meses misturados.
- Ficha: `servicos` opcional em `ficha` (jsonb, sem migration). Resultado: `conferencia` opcional.

Resultado da conferência: `{ etapas: [{ id, cub, detalhado, diferenca, diferencaPct, linhas, aDefinir }], linhas: [{
codigo, descricao, unidade, quantidade, custoUnitario, valor, etapaId, origem }], foraDoCub, cobertura, parcial }`.

## Plano de implementação

Fases, cada uma entregável sozinha:

1. **F4a, base de composições.** Migration, RPC, leitor de CSD e CCD no importador da aba SINAPI (fórmula do código,
   validação na fronteira, mês único), teste com o arquivo real, medida de memória e tempo no navegador, pgTAP.
2. **F4b, motor.** `calcularConferencia`, tabela grupo para etapa, `ficha.servicos` no schema, testes (a definir, UF sem
   custo, etapas, determinismo, provável intocado).
3. **F4c, telas.** Aba Conferência, busca, colagem com prévia, edição de etapa. Só depois do protótipo aprovado.

## Decisões e riscos

- **D1. A conferência não muda o provável.** Proposta: só confere. "Usar como base" (trocar a base do CUB pelo detalhado)
  fica para quando a cobertura for alta e houver validação com obras reais, porque base parcial subestima.
- **D2. Entrada dos serviços.** Proposta: busca mais colagem de "código; quantidade" na v1. A colagem é o caminho
  principal: quem tem quantitativo costuma tê-lo com código do SINAPI. Digitar serviço a serviço é para completar.
- **D3. Mapeamento grupo para etapa.** Proposta: tabela fixa no código (172 grupos, a maioria de infraestrutura e obras
  viárias que ficam sem etapa), revista com o uso. Alternativa: o usuário sempre escolhe a etapa.
- **D4. Vale construir agora?** O card é de prioridade baixa. A função só tem valor para quem tem quantitativo, e o
  Pilar ainda não mediu se os escritórios têm. Proposta: fazer a F4a e a F4b (sem tela) só depois de o Matheus confirmar
  que há 2 ou 3 quantitativos reais (por exemplo, da obra Canaã) para validar a comparação; sem eles, a conferência não
  teria o que provar.
- **Composições paramétricas (ponto do card).** A Caixa publica, desde 2022, referências paramétricas e representativas
  para análise de viabilidade, em cadernos técnicos à parte. Elas não estão no zip mensal que importamos. Avaliar quando
  houver o arquivo oficial: seria uma conferência por m² mais próxima do CUB do que a soma de serviços.
- **Risco: dupla contagem.** Mitigação: a conferência não soma ao total (D1) e serviço de fundação ou adicional fica fora
  da comparação.
- **Risco: diferença sistemática entre SINAPI e CUB.** SINAPI é custo direto de insumo corrente; o CUB inclui despesas
  administrativas e equipamentos, e alto padrão pede acabamento acima do SINAPI. A tela explica, e a diferença esperada
  vira dado de calibração (BEZ-16), não alerta de erro.
- **Risco: volume e custo de banco.** Mitigação: um mês só, importação que troca o mês e conferência com o FinOps.
- **Risco: licença dos dados.** Confirmar os termos de uso da Caixa antes de ligar.

## Anexo: briefing para o protótipo no Claude Design

**Telas** (desktop 1440 e celular 390, com os estados vazio, carregando, erro e cheio):

1. **Aba "Conferência" vazia.** Explica em uma frase o que é (custo de baixo para cima, para cruzar com o CUB), diz que
   não muda o valor da estimativa e oferece "Colar serviços" e "Buscar serviço".
2. **Colar serviços.** Caixa para colar "código; quantidade" (uma por linha) ou escolher o CSV, prévia com a descrição, a
   unidade, a etapa sugerida e o custo, e erros por linha ("código 12345 não existe na base de set/2026").
3. **Buscar serviço.** Campo de busca por texto, código ou grupo; resultado em lista (descrição, unidade, custo na UF da
   obra, chip SINAPI); ao escolher, pede a quantidade e a etapa.
4. **Conferência cheia.** Topo com a cobertura ("7 de 11 etapas") e o aviso "SINAPI é custo direto, sem administração".
   Tabela por etapa: CUB, detalhado, diferença em reais e %, linhas e quantas a definir; "sem serviços" nas etapas vazias.
   Abaixo, a lista de linhas (código, descrição, quantidade, custo, valor, etapa editável, chip da origem) e o bloco
   "Fora da base do CUB" (fundação e outros).
5. **Linha a definir.** Serviço sem custo na UF, com o motivo e fora da soma.
6. **Conferência parcial.** Cobertura abaixo de metade: o aviso "conferência parcial" no lugar de qualquer total
   comparativo.

**Dados seed:** obra Canaã (SP, 461 m², alto padrão) com uns 12 serviços em 5 etapas (alvenaria de vedação em m², laje,
telhamento, contrapiso, revestimento de piso, pintura de parede, impermeabilização) e uma composição de energia solar
sem custo.

**Restrições do design system:** `PilarPage`, `SectionTabs`, `FormDialog`, `DataTable` com papéis mobile, `Badge` e
tokens semânticos (nunca cor crua), sem dropdown nativo do sistema, espera com a marca (ADR 0049), dinheiro e data por
`@/lib/format`. Microcopy em português, voz ativa, sentence case, sem emoji.
