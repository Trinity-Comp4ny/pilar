# Estimativa de obra: importar o CUB e o SINAPI todo mês

Quem faz: o ultra admin, com o segundo fator ativo. Onde: **Ultra > Estimativa de obra** (abas CUB e SINAPI).
Os dois preços valem para todas as empresas. Específico do módulo: [SPEC 136](../specs/136-estimativa-de-obra-parametrica.md)
(CUB) e [SPEC 137](../specs/137-estimativa-de-obra-itens-com-origem-do-preco.md) (SINAPI).

## Automação (workflow `precos-referencia.yml`)

Roda todo dia às 08:23 (Brasília), em staging e em produção. Código em `scripts/precos-referencia/`.

**Configuração:** nenhuma nova. O robô grava pelo `SUPABASE_DB_URL` que os environments `Staging` e
`production-automation` do GitHub já têm (o mesmo do backup noturno). Ele só toca `cub_valores`,
`sinapi_precos_insumo` (escrita) e `estimativa_parametros` (leitura), e cada mês de cada UF entra numa transação.

### SINAPI

O robô procura na página do SINAPI da Caixa o zip do mês que falta no banco (sem link na página, tenta o endereço
direto `Downloads/sinapi-relatorios-mensais/SINAPI-AAAA-MM-formato-xlsx.zip`), tira a planilha
`SINAPI_Referência_AAAA_MM.xlsx` e passa pelo mesmo leitor da aba SINAPI. Mês ainda não publicado não é falha.
Retificação (`_Retificacao01.zip`) de mês já gravado é lida de novo. Formato fora do esperado não grava nada e abre
"Cron falhando: SINAPI automático (alvo)"; aí vale a importação manual abaixo.

### CUB: de onde vem cada UF

Situação conferida pela sondagem contra os sites reais em 2026-11-10 (job "Sondar fontes reais" do PR #786):

| Fonte                                                       | UFs                                                                    | Situação real                                                                                                                                                        |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portal da CBIC (`cub.org.br/cub-m2-estadual/{UF}/`)         | AM, BA, CE, DF, ES, GO, MA, MG, MT, PA, PB, PE, PI, PR, RJ, RN, RR, SC | lido e conferido nos dois regimes. MG, PI e RN publicam com 2 a 3 meses de atraso: entra o mês mais novo que existir                                                 |
| Portal da CBIC                                              | AC, RO, SE                                                             | nenhum mês nos últimos 6 no portal: importação manual                                                                                                                |
| Portal do Sinduscon-MS (`sindusconms.com.br/cub/`)          | MS                                                                     | lido (sem desoneração); o Sinduscon-MS não publica a versão com desoneração                                                                                          |
| Portal do Sinduscon-RS (`sinduscon-rs.com.br/cub-rs/`)      | RS                                                                     | PDF "Preços e custos da construção de MÊS-AAAA" (traz o CUB do próprio mês); só sem desoneração                                                                      |
| Portal do SindusCon-SP (`sindusconsp.com.br/servicos/cub/`) | SP                                                                     | os arquivos do mês ficam no Download Manager, com a API fechada (401); o robô tenta o feed RSS da categoria. A planilha de série histórica só tem o R8-N e não serve |
| Variável `CUB_PORTAIS`                                      | TO, AL, AP e quem mais precisar                                        | o mesmo leitor de portal, sem deploy                                                                                                                                 |

O robô busca até 6 meses para trás por UF e regime, do mais novo ao mais antigo, e para no primeiro mês encontrado
ou já gravado. Quem não tem fonte automática aparece no resumo do job e no alerta de atraso.

Em cada UF, a primeira fonte que passa nas conferências vence. **Nenhum PDF é gravado sem passar em todas:** os 19
códigos da NBR 12721 (R1, PP-4, R8, R16, PIS, CAL-8, CSL-8, CSL-16, RP1Q, GI) nos padrões certos; padrão alto acima
do normal e normal acima do baixo; o mês pedido citado no PDF; o regime certo (fora da CBIC, "com desoneração"
precisa estar escrito no PDF); valores entre R$ 500 e R$ 30.000 por m²; variação de até 15% contra o mês anterior;
e não idêntico ao mês anterior (arquivo repetido). Do portal da CBIC, o PDF ainda precisa citar o Sinduscon pedido:
na sondagem o portal devolveu, para a BA, o PDF do Sinduscon-MT de outro mês (o robô pede de novo uma vez e, se
continuar trocado, recusa). O PDF é lido por linha e por coluna (tabelas lado a lado) e, se
trouxer os dois regimes, página por página; leituras que discordam são recusadas. O RP1Q é conferido mas não é
gravado (o motor não usa e o banco não aceita esse código).

Recusa não grava nada daquela UF e mês, as outras seguem, e abre "Cron falhando: CUB automático (alvo)" com o motivo.
O resumo do job lista as UFs sem fonte automática; elas seguem na importação manual abaixo.

**Ajustes sem deploy** (Settings > Secrets and variables > Actions > Variables):

- `CUB_SINDUSCON`: UF com mais de um Sinduscon no portal da CBIC e nenhum chamado "Sinduscon-UF", ex. `MG=12,PR=3`
  (o número sai no resumo do job).
- `CUB_PORTAIS`: portal estadual novo ou corrigido, ex. `TO=https://site/cub/;AL=https://site/cub/|publicacao`
  (`|publicacao` quando o nome do arquivo cita o mês de publicação, não o de referência).

### Atraso

Sem o CUB do mês anterior a partir do dia 10, ou sem o SINAPI a partir do dia 15, abre "Preço de referência
atrasado: CUB/SINAPI do mês (alvo)". Fecha sozinha quando o mês chega.

### Testar e rodar à mão

Actions > Preços de referência > Run workflow: por padrão só lê e mostra o resumo, sem gravar. "mês" força um mês
(AAAA-MM), "cub_ufs" limita as UFs (ex. `SP,RS`). Local, com o banco de staging:

```bash
SUPABASE_DB_URL=... DRY_RUN=1 CUB_UFS=SP deno run --config scripts/precos-referencia/deno.json -A \
  scripts/precos-referencia/coletar.ts cub   # ou sinapi, ou conferir
```

## CUB (todo dia 5, por estado)

1. Baixe o PDF do mês no site do Sinduscon de cada UF e monte a planilha (UF, código do CUB, valor por m²).
2. Aba **CUB**: escolha o regime (com ou sem desoneração) e o mês-base, envie a planilha e confira a prévia.
3. Importe um regime por vez. Importar o mesmo mês e regime de novo corrige os valores.

## SINAPI à mão (quando o robô falhar; perto do dia 9)

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
