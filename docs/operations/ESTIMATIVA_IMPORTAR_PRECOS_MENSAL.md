# Estimativa de obra: importar o CUB e o SINAPI todo mês

Quem faz: o ultra admin, com o segundo fator ativo. Onde: **Ultra > Estimativa de obra** (abas CUB e SINAPI).
Os dois preços valem para todas as empresas. Específico do módulo: [SPEC 136](../specs/136-estimativa-de-obra-parametrica.md)
(CUB) e [SPEC 137](../specs/137-estimativa-de-obra-itens-com-origem-do-preco.md) (SINAPI).

## CUB (todo dia 5, por estado)

1. Baixe o PDF do mês no site do Sinduscon de cada UF e monte a planilha (UF, código do CUB, valor por m²).
2. Aba **CUB**: escolha o regime (com ou sem desoneração) e o mês-base, envie a planilha e confira a prévia.
3. Importe um regime por vez. Importar o mesmo mês e regime de novo corrige os valores.

## SINAPI (perto do dia 9)

1. Em [caixa.gov.br](https://www.caixa.gov.br), página do SINAPI, baixe o zip do mês (`SINAPI-AAAA-MM-formato-xlsx.zip`).
2. Extraia o arquivo **`SINAPI_Referência_AAAA_MM.xlsx`** (cerca de 13 MB). Os outros arquivos do zip não são usados.
3. Aba **SINAPI**: escolha o arquivo. O mês e o regime vêm das abas **ISD** (sem desoneração) e **ICD** (com desoneração).
4. A prévia mostra, por item do catálogo e regime, em quantas UFs há preço. Item sem preço em nenhuma UF aparece
   numa lista: ele fica "a definir" (ou com o valor da empresa ou do usuário) até o SINAPI trazer preço.
5. Importe. Só os códigos usados pelo catálogo (`parametros.adicionais[*].sinapi.codigo`) são guardados, em
   `sinapi_precos_insumo`. Importar o mesmo mês de novo corrige os preços.

O leitor recusa o arquivo inteiro, sem gravar nada, quando: faltam as abas ISD e ICD, o título da aba não bate com
o regime, o mês de referência não é MM/AAAA, as duas abas são de meses diferentes, o cabeçalho não tem "Código do
Insumo", uma coluna de UF é desconhecida ou repetida, ou um preço, origem (C ou CR), descrição ou unidade é inválido.

## O que muda nas estimativas

- Estimativa nova usa o mês mais recente com preço na UF e no regime dela. Falta de preço na UF não pega preço de outra.
- Estimativa já salva guarda o valor da versão e não muda sozinha.
- Item novo no catálogo com `sinapi.codigo` passa a ser lido na importação seguinte. Antes disso ele fica "a definir".

## Cuidados

- O SINAPI traz custo direto, sem administração, com preço de insumo de linha corrente: equipamento de linha
  superior fica acima. A origem na tela diz "SINAPI" e deixa o usuário informar outro valor.
- Confirmar os termos de uso da Caixa antes de mostrar esses preços a terceiros fora do Pilar (pendente).
