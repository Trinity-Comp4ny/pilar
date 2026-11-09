# Validação da estimativa de obra com dados públicos (20/10/2026)

Teste do motor da estimativa (SPEC 136) contra dados reais encontrados na internet. Pedido do dono depois do primeiro
teste em staging (casa de 461 m² em SP, padrão alto). Card: [BEZ-68](https://linear.app/bez-company/issue/BEZ-68).

## Conclusão

Dado público de obra concluída com **custo final, área, local, prazo e etapas juntos não existe** em volume útil. O
que deu para verificar de forma sólida foi a **composição do custo** (contra o CUB oficial) e a **produtividade
implícita**. O **custo total** bateu com o único caso residencial alto padrão que achei (diferença de 1% a 2%), mas é
um ponto só e com proxy de CUB. O **prazo** com a equipe padrão (6 pessoas) saiu bem acima do que a obra real planejou.
Os **percentuais por etapa** não têm fonte boa para conferir.

| Item                                      | Resultado                                                                                            | Confiança                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Natureza do custo (material, mão de obra) | Seed estava errado (material 50%, mão de obra 43%). Corrigido para 41% e 54%, conforme o CUB oficial | Alta (dado oficial)                          |
| Produtividade (h/m²)                      | Casas pedem 20% a 30% mais horas que o seed (28, 34, 42). Não alterei                                | Média (usa salário de SP como aproximação)   |
| Custo total                               | Modelo R$ 1,50 mi contra orçamento de R$ 1,48 mi e projeção final de R$ 1,52 mi                      | Baixa (um caso, CUB de SP no lugar do de PE) |
| Prazo                                     | 23 meses com 6 pessoas contra 14 planejados (e atrasados) com equipe maior                           | Média (um caso)                              |
| Etapas                                    | Estrutura mais alvenaria dentro das faixas; acabamentos e limpeza parecem altos                      | Baixa (só fontes de blog)                    |

## 1. Composição do custo (CUB oficial)

Fonte: Sinduscon-PR, Relatório 5, composição do CUB/m² de set/2026, residências unifamiliares.

| Padrão        | Material  | Mão de obra | Despesas administrativas | Equipamentos |
| ------------- | --------- | ----------- | ------------------------ | ------------ |
| R1-B (baixo)  | 40,8%     | 53,0%       | 6,0%                     | 0,2%         |
| R1-N (normal) | 37,0%     | 58,5%       | 4,5%                     | 0,0%         |
| R1-A (alto)   | 44,5%     | 52,0%       | 3,5%                     | 0,0%         |
| **Média**     | **40,7%** | **54,5%**   | **4,7%**                 | **0,1%**     |
| Seed anterior | 50%       | 43%         | 5%                       | 2%           |

O seed errava material em 9 pontos e mão de obra em 11. A natureza só reparte o total, então o valor da estimativa não
mudou. A migration `20261116000200` passa para 41 / 54 / 4,5 / 0,5, e um teste compara o seed com a composição oficial
(tolerância de 8 pontos por padrão e 2 pontos na média).

## 2. Produtividade implícita (h/m²)

O CUB publica a mão de obra em R$/m² com encargos, e o Sinduscon-SP publica salário por hora e o percentual de encargos.
Horas por m² = mão de obra ÷ (1 + encargos) ÷ salário médio.

- SP, R8-N, set/2026: R$ 1.275,70 ÷ 2,7662 (encargos de 176,62%) ÷ R$ 11,89 (média de servente, pedreiro, carpinteiro,
  armador, eletricista, encanador e pintor) = **38,8 h/m²**.
- Para casa (R1), escalei pela razão da mão de obra do Paraná (R1 contra R8-N): baixo 35, normal 49, alto 53 h/m².
- Seed: baixo 28, normal 34, alto 42. Diferença de **-21%, -30% e -21%**.

É ordem de grandeza (mistura salário de SP com razão do PR). Não troquei os valores sem uma segunda fonte. Está no card
de acompanhamento.

## 3. Caso UFPE: residência alto padrão em Caruaru, PE

Trabalho de conclusão da UFPE sobre uma residência unifamiliar de alto padrão: 550,75 m², semienterrada e térrea,
6 quartos (5 suítes), terreno de 3.800 m², início em junho/2021, término previsto em julho/2022 (cerca de 14 meses).
A obra estava em andamento e atrasada em abril/2022, então **não é obra concluída**.

| Medida                                        | Estudo                                                 | Modelo                                 |
| --------------------------------------------- | ------------------------------------------------------ | -------------------------------------- |
| Orçamento (1.630,23 INCC x 907,899 de jun/21) | R$ 1.480.085 (R$ 2.687/m²)                             | R$ 1.504.824 (R$ 2.732/m²)             |
| Projeção no término (1.673,74 INCC)           | R$ 1.519.600                                           | -1,0%                                  |
| Diferença para o orçamento                    |                                                        | +1,7%                                  |
| Prazo                                         | 14 meses planejados, com atraso (IDP de 0,67 em abril) | 23 meses (6 pessoas), 15 (10), 12 (12) |

Limites: não achei o CUB-PE de junho/2021, então usei o CUB-SP R1 alto sem desoneração de jun/21 (R$ 2.301,48) como
proxy; o orçamento do estudo pode não incluir tudo que o modelo inclui (administração, por exemplo). O resultado indica
ordem de grandeza coerente, não precisão.

O prazo mostra um problema real: a equipe padrão de 6 pessoas é pequena para uma casa de 550 m². A obra planejou 14
meses, o que corresponde a uns 11 a 12 pessoas. Sugestão: equipe padrão proporcional à área (em torno de 1 pessoa a cada
50 m², mínimo 4). Com um caso só, é hipótese para testar com dados da VRZ e da Mawe, não regra.

## 4. Etapas

Percentuais do modelo (sem a fundação, que entra como adicional de 6% da base): preliminares 3, estrutura 18, alvenaria
8, cobertura 6, instalações 14, esquadrias 9, revestimentos 16, pisos 8, pintura 6, louças 5, limpeza 7.

| Grupo                                                           | Modelo | Serasa (faixa) | Monitor do Mercado (faixa)   |
| --------------------------------------------------------------- | ------ | -------------- | ---------------------------- |
| Estrutura e alvenaria                                           | 26%    | 20% a 25%      | 20% a 28%                    |
| Instalações                                                     | 14%    | 15% a 20%      | 10% a 14%                    |
| Acabamentos (esquadrias, revestimentos, pisos, pintura, louças) | 44%    | 30% a 40%      | 18% a 25% (só revestimentos) |

Dois pontos suspeitos: **acabamentos em 44%** e **limpeza e entrega em 7%** (limpeza costuma ser uma parcela pequena do custo). As fontes
são blogs, sem metodologia, então não sustentam mudar o seed. O caminho certo é conferir com orçamentos reais por etapa.

## 5. O que foi descartado

| Fonte                                                | Por que não serve                                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| TCC da ULBRA (casa R1-N de 113,7 m², Palmas, TO)     | Custo real de R$ 87.974 (R$ 774/m²), bem abaixo do CUB e provavelmente parcial ou de autoconstrução. Não deu para confirmar o escopo |
| TCC do IFGoiano (casa pequena, Rio Verde, GO)        | Orçado e executado só de serviços escolhidos, valores na casa de R$ 5 mil a R$ 16 mil                                                |
| Artigo da UNIARP (prédio de 3.260 m², Fraiburgo, SC) | Custo e prazo só da etapa de estrutura                                                                                               |
| ObrasGov (API aberta)                                | Traz local, datas e valor previsto, sem área nem custo final; é obra pública, não residência                                         |

## 6. Próximos passos

1. **Dados reais da própria base.** Pedir à VRZ, à Mawe e ao cliente de Marília, para cada obra concluída: custo final,
   área, UF, mês de início e de fim, número médio de pessoas e o custo por etapa (BEZ-16). Com 3 obras, repetir os quatro
   testes acima com dado fechado.
2. **Equipe por área** e **produtividade** (seção 2 e 3), depois dos dados reais.
3. **SINAPI** para os adicionais e para conferir etapas (BEZ-69).
4. **CUB-PE de jun/2021** para refazer o caso UFPE sem proxy.

## Fontes

- Composição do CUB-PR: sindusconpr.com.br/wp-content/uploads/2026/10/2026-9-Relatorio-5-composicao-cub-m2-valores-em-reais.pdf
- CUB-SP e salários: boletim econômico do Sinduscon-SP de set/2026 (sindusconsp.com.br/servicos/cub)
- CUB-SP de jun/2021 (R-1 alto, R$ 2.301,48 sem desoneração): portaldori.com.br/2021/07/05/sinduscon-divulga-tabelas-de-custo-unitario-basico-no-estado-de-sao-paulo-referencia-junho-de-2021/
- Estudo de caso UFPE: repositorio.ufpe.br/bitstream/123456789/44708/1/Guilherme_TCC 2 - FINAL_.pdf
- Faixas por etapa: blog da Serasa e Monitor do Mercado (fontes fracas, só como indício)
- ObrasGov: api.obrasgov.gestao.gov.br
