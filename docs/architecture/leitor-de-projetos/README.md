# Leitor de projetos (Pilar): HANDOFF

Última atualização: 05/11/2026. Versão pública: nomes de pessoas foram removidos e os casos de teste aparecem como letras (A a L). A versão completa, com o mapa dos casos para os arquivos reais, fica num repositório privado da BEZ. Cards: BEZ-569 (salvamento privado) e BEZ-570 (esta publicação).
Este documento existe para que outra pessoa, ou outra sessão do Claude Code, retome o trabalho sem a máquina original. Tudo que está aqui foi medido em arquivos reais; onde é suposição, está escrito como suposição.

## 1. O que é e por que existe

O Pilar (SaaS de gestão para escritórios de projeto técnico) está evoluindo para um produto que conduz a obra. O fundador da BEZ analisou em 03 e 04/11/2026 o documento mestre "AI-native" e decidiu:

- WhatsApp por link `wa.me` com texto pronto (sem API oficial agora).
- Agente do funil: qualifica leads e lê conversão por origem. Prospecção ativa fica como experimento depois.
- "Templates" volta com o nome **Modelos** (proposta e projeto), ligado ao funil.
- Orçamento e cotação mais completos, sem virar ERP de construtora. CUB automático só se cada estado tiver fonte estável.
- Duas esteiras: **A** lead, proposta e projeto (com planta); **B** obra (cronograma, clima, Campo, 3D, compras).
- Progresso da obra por elemento (locação, fundação, estrutura, paredes com duas faces, esquadrias, piso, forro e gesso, louças e box, pintura, área externa, sobrado), tudo com a mesma estrutura.
- Foco imediato: o **leitor de projetos** (arquitetônico, depois estrutural, elétrico e hidráulico). Começar por paredes e ambientes e ampliar depois.
- Referência de experiência: Togal.ai (sobreposição 2D no PDF com painel Áreas, Linhas e Contagens, revisão humana). Estudamos a ideia; o código é nosso.

Protótipo (12 telas, desktop e celular, estados): fonte em `prototype/` (`src/` e `build.py` geram o `index.html`). Publicado como artifact: https://claude.ai/artifact/PuGn883seoYzChGRwqu9oe . Regra do fundador: tela nova nasce de protótipo aprovado antes de código.

## 2. Estado em 05/11/2026

Feito:
- 15 rodadas de pesquisa e testes com projetos reais (detalhe em `pesquisa-rodadas.md`, números em `scripts/leitor-de-projetos/dados/placar.jsonl`).
- Cascata de leitura definida e medida (seção 4).
- Leitor de IFC de arquitetura e compatibilização entre disciplinas no conjunto aberto Duplex.
- Bancada de testes com 9 folhas (seção 7) e ferramentas reutilizáveis (seção 9).
- Teste de LLM de visão (Haiku, Sonnet, Opus) por subagentes do Claude Code, sem API.

Pendente (nada disso foi feito de propósito, esperando o fundador):
- Spec curta e ADR do Leitor de projetos (conteúdo sugerido na seção 12).
- Cards no ClickUp (Pilar / Platform): um pai "Leitor de projetos" e cerca de 12 filhos (seção 12). Só criar depois da confirmação dele.
- Mensagem de confirmação de autorização para a VRZ (rascunho entregue ao fundador; não há canal para eu enviar).
- Pedido à VRZ e ao arquiteto: IFC do Revit, DWG da arquitetura e do hidráulico, partes 001 a 005 do zip.

## 3. Princípios

1. A geometria vem do dado vetorial, do IFC ou do DWG. LLM só para texto, classificação e conferência.
2. A unidade de trabalho é a prancha (página).
3. O texto escrito no projeto é a verdade principal (nomes, áreas, tabelas). A geometria localiza e verifica.
4. Nada inferido entra em quantidade sem confirmação. OCR é evidência com confiança, nunca verdade.
5. Área declarada vale: no IFC a área declarada e a do contorno diferem de 8 a 23%; sinalizar acima de 3%.
6. Ranking de fonte: IFC, depois DWG ou DXF, depois PDF vetorial, depois PDF raster, depois escaneado (OCR). RVT e SKP não são legíveis abertamente; pedir IFC ou glTF.
7. Infraestrutura prevista: o worker de leitura é Python em Cloud Run, com fila; o Supabase guarda metadados, estado e arquivos. Não cabe em Edge Function (memória e tempo). Isso exige uma ADR.

Modelo de dados em rascunho: Projeto lido, Prancha, Vista, Pavimento, Ambiente, Parede (face A e B), Vão, Esquadria (tipo), Elemento técnico, Quantidade. Todo elemento leva bbox na página, origem (texto, vetor, imagem, IFC, DWG, IA), confiança e estado (lido, confirmado, corrigido, divergente).

## 4. A cascata de leitura (decisão com números)

| Passo | Quando | Custo | Qualidade medida |
|---|---|---|---|
| 1. IFC ou DWG | veio o arquivo | zero | exato |
| 2. Texto vetorial do PDF | há camada de texto | zero, 0,3 a 6 s por folha | exato onde existe; o OCR errou "36,74" como "6,74" e o texto vetorial acertou |
| 3. OCR local em blocos | sem texto vetorial (escaneada, texto em curvas) | zero, cerca de 40 s por folha em 1 núcleo | 92% dos rótulos (102 de 111) com união de resoluções e giros |
| 4. LLM de visão (Haiku primeiro) | só nos blocos duvidosos | tokens de imagem | no teste dirigido 9 de 9 e quadro de áreas 6 a 7 de 7 |

Como decidir que um bloco é duvidoso, sem gabarito, e sem "o OCR falhou" (ele falha sem avisar: no quadro de áreas da escaneada trocou o nome em 4 de 6 linhas):
- O quadro de áreas fecha (térreo + superior = total)? Quando é uma relação conhecida, sim. Soma solta por rótulo é inútil (seção 5, item 14).
- A área lida casa com a área medida nas paredes (tolerância de 5%)?
- Falta "m²" ou nome, confiança baixa, ou leituras divergentes entre resoluções.
- Em folha SEM camada de texto, a política mais barata e segura é: LLM nas janelas em volta dos candidatos do OCR e das âncoras (título "ÁREAS", tabelas), com 60 pt de contexto, e o OCR como segunda leitura independente. Acordo entre os dois é confiança; divergência vai para revisão humana.
- A grade cega de blocos com modelo barato perdeu o quadro de áreas inteiro (seção 8). Não usar assim.

## 5. Regras que viraram certeza (cada uma com a evidência)

1. **Escala impressa não é a real.** Calibrar por cota escrita com consenso ponderado (peso 3 quando a cota tem marca nas duas pontas; fator de plotagem só entre 0,5 e 2; testar segmentos individuais e fundidos) e encaixar numa escala padrão (10, 20, 25, 30, 40, 50, 75, 100, 125, 150, 200, 250, 500) se estiver dentro de 4%. Caso `caso_d`: impressa 1:100, real cerca de 1:75; sem calibrar a área errava +79%. Calibração automática: 7 de 8 folhas dentro de 5%.
2. **A cor da parede vem da legenda**, e a parede é polígono vetorial. Caso `caso_c_p1`.
3. **Quadro numerado** liga linhas da tabela (01 a 25, com área e pé-direito) às bolinhas numeradas na planta. `caso_c_p1`: 9 de 9 ambientes fechados dentro de 2,3%.
4. **Detectores de parede:** preenchimento escuro (limiar 40 a 170), cor da legenda, e linha dupla por vetor (pares de segmentos paralelos de 9 a 35 cm, sobreposição de pelo menos 0,9 m; erosão de 1 px tira um viés de menos 3%; descartar componentes com menos de 2 m). Recortar à região dos rótulos mais 4 m de margem SÓ com 4 ou mais rótulos (com poucos rótulos o recorte decepa salão alongado: o `caso_d` tem 7,5 por 27,7 m).
5. **Vãos** são lacunas na parede (pontas de esqueleto) mais fechamento morfológico.
6. **Ambientes** por watershed semeado nos rótulos; verificação por grupo de ambientes (`grupos.py`): onde a parede fecha, ambiente integrado vira um grupo e a soma dos rótulos confere (Hall mais Estar e Cozinha: 57,58 contra 57,95 m²). Onde a parede vaza, o grupo funde ambientes e perde. Use para marcar `vaza`, `cortada` e `diverge` para revisão, não como contagem de acerto.
7. **Formatos de rótulo** que existem: `A= 12,74 m²`, `SALÃO 183,66 m²`, tabela numerada, e três linhas `NOME / Área / 5,35 m²` (o parser subia para "Área" e perdia a sala; corrigido em 05/11: caso_f foi de 14 para 29 rótulos). `Pd: 2,85 m` é pé-direito, não área. Descartes deliberados em `RUIM`: terreno, total, taxa, coeficiente, piscina e semelhantes; linha com `..` (quadro com pontinhos).
8. **Biblioteca de esquadrias** (`biblioteca.py`): código P, J ou M, mais movimento (C, G, B, P, F), material (M, A, V), largura nominal em cm e variante (A ou B). `MF` é montante fixo e tem tabela própria. A largura no código é nominal; o vão osso vem da tabela (mais 8 cm para porta de madeira ou alumínio na casa 328). Parser universal de dimensão: `0,90×2,10`, `80x210`, `PM-80x210`, `80x60/1,90`; texto girado se lê invertido primeiro; valor em cm se for 10 ou mais; altura até 6 m é pé-direito duplo; no OCR normalizar O para 0. Medida escrita no rótulo contra vão medido: caso A 27 de 31, caso C 19 de 29, mediana de 1 cm.
9. **Seletor de detector sem gabarito é frágil.** A pontuação sem gabarito (ambientes fechados menos ruído) premia fragmentação. Validação cruzada com as áreas escritas na própria prancha (escolhe com metade, mede na outra): 46 de 105, contra 47 do oráculo e 42 do seletor sem gabarito (amostra pequena, 7 folhas e 4 programas).
10. **IFC:** `IfcWall` duplica `IfcWallStandardCase` (deduplicar); ambientes não estão no contêiner (usar o agregado); a área fica no `PSet_Revit_Dimensions` (procurar nos psets); o contorno vem dos triângulos de face voltada para baixo. Duplex: 57 paredes, 14 portas, 24 janelas, 21 ambientes, 4 pavimentos; 38 de 38 vãos com parede hospedeira; 49 de 57 paredes com faces; 34 servem 2 ou mais ambientes. `compat_ifc.py` classifica embutido (esperado), travessia (lista de furações), contato e embutimento longo: elétrico sem conflito; hidráulico 108 furações e 42 embutimentos longos; MEP 199 e 81. As disciplinas alinham no mesmo referencial (94 a 100% de sobreposição).
11. **OCR (Tesseract local, `por`)**: não lê texto girado com `--psm 11`; girar a imagem 90 e 270 graus (caso A foi de 10 para 17 de 17). Mais resolução nem sempre ajuda (600 dpi 64%, 400 dpi 76%, 300 dpi 80%). Texto gigante de tabela só lê a 150 dpi. A folha inteira numa passada falha (teto de 9000 px faz o rótulo virar ruído): usar blocos de 700 pt com 40 pt de sobra. União de 150, 300 e 400 dpi com giros: 92%. Em página que é imagem, somar o dpi nativo e 1,5 vez ao padrão, sem repetir resolução parecida; bloco de 700 pt com teto de 6000 px (bloco menor cortava rótulo na borda). O dpi nativo sozinho piorou o `caso_c_p1` (23 de 26 caiu para 16).
12. **Número lido por OCR só entra depois de cruzar contra o quadro.** Incidente: li "183,66" a olho em baixa resolução; ao dar zoom era 193,68 (o OCR estava certo).
13. **O texto vetorial ganha do OCR** quando existe (36,74 contra 6,74).
14. **Verificação grátis:** a soma "a mais b igual c" aplicada a cada rótulo é inútil com cerca de 200 números por folha (fecha por coincidência: 1,50 mais 2,70 é 4,20). O sinal "m²" cobre cerca de 51% dos rótulos com precisão alta (os "falsos" eram rótulos reais que o parser vetorial perdia).
15. **Escolher blocos pela parede** (pares de linhas paralelas) poupa 25 a 45% do tempo de OCR no caso_e, caso_f e caso_g sem perder rótulo, mas apaga o quadro de áreas (caso C 0 de 26 contra 16 de 26). Não usar como filtro. Pode servir para priorizar planta, com o quadro entrando à parte.
16. **Visão:** ver seção 8.

## 6. Resultados por rodada (resumo; detalhe em `pesquisa-rodadas.md`)

| Rodada | Data | O que mostrou |
|---|---|---|
| Spike 1 | 04/11 | Casa 328 (sobrado): ambientes fechados batem 2 a 8% pela imagem, abertos vazam. DWG elétrico (Revit, camadas AIA) conta pontos sozinho e traz nomes de ambiente. |
| Spike 2 | 04/11 | 13 de 18 ambientes dentro de 5% na prancha de layout (texto girado lido, divisas de vidro). Quantitativo estrutural: aço, 91 m³ de concreto, 658 m² de fôrma. Pontos elétricos deduplicados: térreo 239, superior 227. |
| Spike 3 e bancada | 04/11 | Ambientes 14 de 18; esquadrias 27 de 27 vãos medidos a até 10 cm; quadro de áreas e quantitativo estrutural conferem. Todos os zips eram a mesma casa 328. |
| 4 | 04/11 | Acervo da VRZ no Drive; 2 IFC e 4 PDFs de 4 arquitetos; biblioteca de convenções. |
| 5 | 04/11 | Mais 5 PDFs e o Duplex aberto; bancada automática por rótulo de área. caso A caso B generaliza em parte (7 de 9 numa vista). AutoCAD de linha dupla e escaneado sem solução ainda. |
| 6 | 04/11 | IFC de arquitetura; quadro numerado; OCR; linha dupla (`caso_d` salão 193,2 contra 193,68, menos 0,3% após calibrar); calibração de escala. |
| 7 | 04/11 | Calibração automática 7 de 8; encaixe em escala padrão; seletor sem gabarito 5 de 5 (amostra pequena). |
| 8 | 04/11 | Mais obras; seletor por validação cruzada 46 de 105; compatibilização no Duplex; medida no rótulo. |
| 9 | 05/11 | Verificação por grupo (`grupos.py`); bug do recorte no `caso_d` (0 de 1 para 1 de 1). |
| 10 | 05/11 | OCR contra texto vetorial: blocos, giros, resoluções (92% na união). |
| 11 | 05/11 | LLM de visão por subagentes (Haiku, Sonnet, Opus) em 4 blocos; `texto_auto.py` (cascata vetor, depois OCR). |
| 12 | 05/11 | Folha escaneada; filtro m²; blocos por parede; dpi pela página. |
| 13 | 05/11 | Verificação grátis: soma solta é inútil; m² é camada de alta confiança. |
| 14 | 05/11 | Parser vetorial: caso_f de 14 para 29 rótulos. |
| 15 | 05/11 | Visão em grade cega na escaneada inteira: perdeu o quadro (3 de 9). |

## 7. Placar por folha

Ambientes dentro de 5% (rodada 9, melhor detector por caso; "grupo" = verificação por grupo):

| Caso | Divisão | Grupo | Observação |
|---|---|---|---|
| `caso_a` | 13/17 | 15/17 | parede fecha bem |
| `caso_b_p2` | 7/9 | 7/9 | varanda vaza |
| `caso_b_p1` | 6/9 | 5/9 | |
| `caso_c_p1` | 9/20 | 11/20 | cor da legenda |
| `caso_d` | 1/1 | 1/1 | depois de corrigir o recorte |
| `caso_e` | 8/19 | 6/19 | AutoCAD 2025, linha dupla, sala vaza |
| `caso_f` | 3/14 | 1/14 | ArchiCAD; depois do conserto do parser há 29 rótulos e a bancada ainda não foi refeita |
| `caso_g` | 1/17 | 0/17 | LayOut, ruído de móvel |

Pontos fracos conhecidos: detecção de parede em programa novo (hachura e fundo de móvel não viram par de linhas, a sala vaza), sala aberta ou integrada, escala por vista em folha com várias escalas.

OCR em blocos contra o texto vetorial (111 rótulos, rodada 10): vetor exato; 400 dpi com giros 83%; união 150, 300 e 400 com giros 92%; folha inteira numa passada 0 a 10 de 17.
Folha escaneada (9 valores conferidos a olho): OCR 8 de 9 valores, nome errado em 4 de 6 linhas do quadro; visão dirigida 9 de 9.

## 8. LLM de visão: custo e qualidade

Como foi feito: subagentes do Claude Code com o parâmetro de modelo (Haiku, Sonnet, Opus), mesmo prompt, imagens de blocos de cerca de 1500 px. Sem API. (`tiles_visao.py` gera blocos e gabarito; `score_visao.py` pontua.)

- 4 blocos de plantas vetoriais de 4 programas: os três modelos empataram (áreas 19 de 21, cotas 28 de 31, esquadrias 15 a 16 de 16). As 2 áreas que faltam eram rótulos cortados na borda do bloco. Para ler texto impresso limpo, o modelo mais barato basta.
- Os 7 valores "extras" do caso_e eram as cotas verticais: o gabarito (palavra solta do pdfplumber) não pega texto girado. O modelo estava certo.
- Onde o OCR falhou por sobreposição de desenho (caso_f 5,35 e 1,71), a visão leu certo.
- Escaneada, 4 blocos centrados no conteúdo: Haiku quadro 6 de 7, Sonnet 7 de 7, os dois acharam o 38,11 que o OCR perdeu (texto vertical), e leram códigos de esquadria com medida (`MFV/260 260x460/0`, `PCV/435 4,35x2,50`, `PCM90 0,90x2,10`).
- Escaneada inteira em grade de 21 blocos num agente só (Haiku): 3 de 9 e perdeu o quadro de áreas. Causa: os números do quadro estavam na borda de baixo de um bloco e os rótulos no bloco seguinte, e o prompt mandava omitir o que estivesse cortado. Falha de recorte e de prompt, não de leitura.
- Tokens: cada subagente gastou 89 a 102 mil para 4 blocos (a maior parte é o contexto fixo do subagente, cerca de 88 mil) e 162 mil para 21 blocos, ou seja, cerca de 3,5 mil por bloco (limite superior, inclui a releitura de contexto do subagente). Em produção, chamada direta à API sem subagente.
- Limite do teste: poucos blocos, quase todos de plantas vetoriais limpas. A visão NÃO foi testada em geometria (medir parede) nem em escaneado de baixa qualidade.
- Regras que saem daqui: o prompt devolve o número mesmo com rótulo cortado e marca `rotulo_cortado` (o sistema funde com o bloco vizinho); preferir janelas em volta de candidatos a grade cega; grade só onde o OCR rende pouco; o que o OCR não viu nunca ganha janela (ponto cego).

## 9. Ferramentas (`ferramentas/`)

Todas rodam a partir de `ferramentas/` (os caminhos para dados são relativos a `../dados/`). Usar o Python da venv com `-I` (modo isolado); os scripts já inserem o próprio diretório no `sys.path`.

| Script | O que faz |
|---|---|
| `ablacao.py` | Ablação do leitor v1: liga e desliga etapas para ver o efeito de cada uma. |
| `afinar.py` | Guarda o gabarito vetorial de cada caso em `dados/spike/refs.json` (usado para comparar regras de verificação do OCR). |
| `bancada.py` | Bancada de testes do Leitor de projetos: roda tudo nos arquivos reais e grava o placar. |
| `bancada2.py` | Bancada automática: todo PDF com rótulo de área vira teste (o arquiteto escreveu a resposta). |
| `bancada3.py` | Bancada v3: escala calibrada pelas cotas + 3 detectores de parede + seletor sem gabarito, comparado com o gabarito. |
| `bancada4.py` | Bancada v4: mesmo melhor detector por caso, avaliado por divisão (watershed) e por grupo (soma dos rótulos). |
| `biblioteca.py` | Biblioteca de convenções dos projetos brasileiros, para os agentes lerem com contexto. |
| `comparar_parser.py` | Compara o `rotulos_area` antes e depois de uma mudança (quantidade de rótulos, novos e perdidos, e quantos o OCR com m² confirma). |
| `compat_ifc.py` | Compatibilização entre IFCs: referencial comum e interferências (elemento de instalação atravessando parede/laje). |
| `dbg_caso_d.py` | Depuração do caso `caso_d` com OCR em cache (área livre do salão por dpi e erosão). |
| `dbg_caso_d2.py` | Depuração do caso `caso_d` aplicando o recorte por rótulo. |
| `dbg_caso_d3.py` | Depuração do caso `caso_d`: caixa da sala contra caixa do recorte (achou o bug do recorte). |
| `dwgrooms.py` | Spike 2: ambientes a partir da planta vetorial (bloco da arquitetura dentro do DWG). |
| `dxfstats.py` | Estatística de DXF (camadas e entidades) com ezdxf. |
| `elepoints.py` | Conta pontos elétricos (luz, tomada, interruptor, força) em DXF. |
| `escaneada.py` | Roda a cascata `texto_auto` na folha escaneada e grava o JSON do OCR. |
| `esq_dim.py` | Esquadrias sem tabela: medida escrita no rótulo x largura do vão medido na geometria. |
| `esquadrias.py` | Esquadrias: tabela da prancha (gabarito) x códigos na planta x vãos medidos na geometria. |
| `extract.py` | Extrai zips para uma pasta de destino. |
| `grupos.py` | Verificação por GRUPO de ambientes: região livre conexa (portas fechadas) com k rótulos dentro. |
| `ifcstats.py` | Inventário de um IFC: esquema, exportador, pavimentos, ambientes, paredes, esquadrias, pilares e propriedades. |
| `inv2.py` | Inventário rápido de um PDF (páginas e metadados). |
| `inventory.py` | Inventário de PDFs: tamanho de folha (A0 a A4), páginas e metadados em JSON. |
| `leitor.py` | Biblioteca do spike do Leitor de projetos (código próprio, só para teste). |
| `leitor2.py` | Leitor v2: escala do desenho, rótulos de área em vários formatos, parede por linha dupla. |
| `leitor3.py` | Leitor v3: prancha com QUADRO NUMERADO + marcadores na planta + cor de parede aprendida pela legenda. |
| `leitor4.py` | Leitor v4: parede de linha dupla por vetor (pares de segmentos paralelos) + rótulos por OCR. |
| `leitor5.py` | Leitor v5: calibração automática da escala real pelas cotas escritas (consenso) e seletor de detector de parede. |
| `leitor_ifc.py` | Leitor de IFC de arquitetura -> modelo do Pilar (pavimento, ambiente, parede com faces, vão, esquadria). |
| `listzips.py` | Lista o conteúdo de zips. |
| `names.py` | Lista nomes e tamanhos dentro de zips. |
| `ocr.py` | OCR de prancha: renderiza, lê palavras com posição (em pontos do PDF) e procura nome + 'NNN,NN m²'. |
| `ocr_tiles.py` | OCR em blocos: renderiza cada bloco da folha direto na resolução pedida (sem renderizar a folha inteira) e junta as palavras. |
| `ocr_vs_vetor.py` | Texto vetorial (gabarito) x OCR Tesseract na folha inteira: quantos rótulos de área o OCR recupera, a que resolução e quanto tempo gasta. |
| `perdas_vetor.py` | Para cada rótulo que o OCR achou e o parser vetorial não, mostra o que a camada de texto tem naquele valor. |
| `perdidos.py` | Recorta, num painel só, os rótulos de área que o OCR em blocos não leu (posição vem do texto vetorial). |
| `probe.py` | Sonda uma página de PDF (bbox e contagem de objetos e texto). |
| `render.py` | Renderiza páginas de um PDF para PNG numa escala. |
| `rooms.py` | Spike: paredes e ambientes de uma prancha rasterizada com texto vetorial. |
| `rooms2.py` | Spike 2: ambientes de prancha rasterizada com texto vetorial. |
| `score_visao.py` | Pontua a saída dos modelos de visão contra o gabarito (texto vetorial): ambientes por área, esquadrias e cotas como multiconjunto. |
| `selecao_cv.py` | Seletor por validação cruzada: escolhe o detector pelas áreas escritas na própria prancha (metade A) e mede na outra metade (B), e vice-versa. |
| `texto_auto.py` | Rótulos de área em cascata, sem região escolhida à mão: texto vetorial primeiro; sem ele, OCR em blocos só onde a folha tem conteúdo. |
| `tiles_visao.py` | Gera blocos de planta para o teste de LLM de visão: janela com mais rótulos de área, imagem <= 1500 px e gabarito (texto vetorial) à parte. |
| `varrer.py` | Varre PDFs e diz, só pelo texto (sem renderizar), quais páginas têm gabarito de área e qual a escala impressa. |
| `verificar.py` | Camadas de confiança do OCR sem gabarito: ser rótulo de área (m², nome) x ser leitura confiável (várias passadas, soma que fecha). |

Receitas:
```
cd ferramentas
./venv/bin/python -I bancada4.py caso_a caso_b_p2 caso_c_p1      # placar de ambientes (divisão e grupo)
./venv/bin/python -I texto_auto.py caso_d                     # cascata vetor e depois OCR em blocos
./venv/bin/python -I texto_auto.py caso_a ocr conteudo       # força OCR e pontua contra o texto vetorial
./venv/bin/python -I ocr_tiles.py caso_e 150 300 400            # OCR em blocos por resolução, com união
./venv/bin/python -I leitor_ifc.py ../dados/raw3/aberto/duplex/Duplex_A_20110907.ifc saida.json
./venv/bin/python -I compat_ifc.py arq.ifc instalacao.ifc
```

## 10. Ambiente e como reproduzir

- Python 3.14.7 (a venv original). `python3 -m venv ferramentas/venv && ferramentas/venv/bin/pip install -r requirements.txt`.
- Tesseract 5.5.2 instalado no sistema (`brew install tesseract`). Os dados de idioma (`por` e `eng`, variante `tessdata_fast`) NÃO estão no repositório: baixar de https://github.com/tesseract-ocr/tessdata_fast para `ferramentas/tessdata/` (o código aponta `TESSDATA_PREFIX` para lá). Em macOS o OpenMP do Tesseract pode disputar núcleos: usar `OMP_THREAD_LIMIT=1` ao paralelizar vários casos.
- Baixar os casos do Drive e os IFC abertos conforme `scripts/leitor-de-projetos/dados/LEIA-ME.md` e `casos.md`.
- Medir sempre contra o gabarito vetorial (`rotulos_area`) e registrar a rodada em `scripts/leitor-de-projetos/dados/placar.jsonl` (uma linha por rodada).

## 11. Dados, direitos e segurança

- Os projetos são da VRZ e dos escritórios de arquitetura. O fundador informou que a VRZ já autorizou o uso para teste e treino; a mensagem de confirmação ainda precisa ser enviada por ele. Os projetos têm aviso de autoria (Lei 9610) e dados de clientes finais: teste interno é seguro; treinar produto comercial pede autorização formal da VRZ e dos escritórios.
- Arquivo de cliente NUNCA vai para repositório público, artifact ou Drive. Este repositório é público: só há saídas derivadas pequenas, sem nome de pessoa e sem imagem derivada de projeto. O mapa dos casos para os arquivos reais fica no repositório privado.
- Duplex (buildingSMART): CC BY 4.0, atribuição obrigatória (texto em `scripts/leitor-de-projetos/dados/raw3/aberto/duplex/LICENSE-README.md`).
- CubiCasa5K e FloorPlanCAD são só para uso não comercial: não treinar produto com eles.
- Arquivo baixado é dado não confiável: pasta própria, scripts em outra, Python com `-I`.
- O acesso ao Drive foi pelo perfil Pessoal do Chrome só porque o fundador mandou (a regra normal é um perfil por contexto).
- Nunca registrar dado de cliente ou de outra empresa em memória pública ou em PR.

## 12. Pendências e backlog

Spec e ADR (conteúdo sugerido): a spec descreve a prancha como unidade, a cascata (seção 4) com os critérios de aceite medidos (ambiente dentro de 5% quando a parede fecha; quadro de áreas conferindo; esquadria com vão a até 10 cm), o modelo de dados (seção 3), a tela de revisão (protótipo no Claude Design antes de código) e os estados lido, confirmado, corrigido e divergente. A ADR registra a infraestrutura: worker Python em Cloud Run com fila, Supabase para metadados, estado e arquivos; por que não Edge Function; custo de LLM por bloco; chamada direta sem subagente.

Cards sugeridos (Pilar / Platform, o fundador como responsável, depois da confirmação): um pai "Leitor de projetos" e filhos:
1. ADR e infra: worker Python, fila, armazenamento.
2. Modelo de dados do projeto lido.
3. Ingestão por formato (IFC, DWG ou DXF, PDF vetorial, raster, escaneado).
4. Calibração de escala por cota e escala por vista.
5. Detector de parede (hachura, preenchimento, linha dupla) e vãos.
6. Ambientes: rótulos, quadro numerado, grupos, abertos e integrados.
7. Biblioteca de esquadrias e ligação do vão à esquadria.
8. OCR em blocos e cascata automática.
9. Visão por janelas de candidatos, com prompt que devolve número com rótulo cortado.
10. Verificação cruzada (quadro de áreas, área medida contra rótulo).
11. Tela de revisão humana (protótipo primeiro).
12. Compatibilização entre disciplinas por IFC.
13. Conjunto de referência (gold set) e métricas no CI.

Lacunas técnicas abertas: parede em programa novo; escala por vista em folha multiescala; detecção automática de cota em texto em curvas; ligar a classificação do vão (garagem, passagem, portão) às esquadrias casadas; tabela de esquadria sem nome (classificar por altura, caso caso_f); DWG de arquitetura; hidráulico só em PDF; refazer a bancada do caso_f com o parser corrigido; nomes com dígito colado ("5Área", "2CIRC.") e rótulo repetido entre vistas (ligar rótulo à vista); "PAVIMENTO TÉRREO 252,88" entra como ambiente e deve virar total de pavimento; verificação de que a área vinda da visão bate com a geometria.

## 13. Armadilhas operacionais (aprendidas)

- `pkill -f "padrão"` mata o próprio shell se o padrão aparece na linha de comando; usar `pgrep -f '[b]ancada3.py'`.
- `sleep N` em ferramenta de shell pode ser bloqueado; esperar processo longo com loop `until [ "$(pgrep -f '[x]yz' | wc -l)" = "0" ]; do sleep 8; done`. Monitores expiram em 5 minutos: rearmar ou consultar o estado.
- `sed -i` no macOS exige argumento de sufixo e quebrou duas vezes; editar com o editor de arquivos.
- `grep` pode estar aliasado para `rg`: regex com `{` quebra. Usar Python para filtrar JSON.
- `python3 -I` não importa módulos locais sem `sys.path.insert`; o `python3` do sistema não tem `pdfplumber` (usar a venv).
- Mudar uma variável por teste. Quando três coisas mudaram juntas (dpi, bloco, critério) o resultado do caso C enganou até separar.
- Em teste de recorte, conferir que o recorte não decepa sala alongada.
- Não confiar em leitura de número a olho em imagem pequena (caso 183,66 contra 193,68).
- Gabarito que usa palavra solta do pdfplumber não pega texto girado: usar `P.linhas()`.
- Clique no Chrome por coordenada errou após mudança de layout: usar `find` e referência do elemento.

## 14. Como retomar com o Claude Code

1. Clonar o repositório, montar o ambiente (seção 10) e baixar os casos (seção 10 e `scripts/leitor-de-projetos/dados/LEIA-ME.md`).
2. Copiar `contexto-do-projeto.md` para a pasta de memória do projeto Pilar do Claude (`~/.claude/projects/<projeto>/memory/`) e acrescentar uma linha no `MEMORY.md` apontando para ela.
3. Ler este HANDOFF, `pesquisa-rodadas.md` e `scripts/leitor-de-projetos/dados/placar.jsonl`. Pedir: "retomar o leitor de projetos pela seção 12".
4. Convenções da BEZ para este repositório: commits em inglês com o número do card (`type(scope): [BEZ-<n>] resumo`), card no ClickUp da BEZ por REST, texto em português sem travessão.

## 15. O que NÃO está neste repositório (e onde está)

- Arquivos de projeto (PDF, IFC, DWG, DXF): Drive da VRZ e fontes abertas.
- Imagens derivadas (recortes, overlays, renders): geradas de novo pelos scripts.
- A venv (recriar com o `requirements.txt`).
- O histórico completo da conversa com o Claude (arquivo `.jsonl` em `~/.claude/projects/` da máquina original): contém dado de cliente, por isso não foi publicado. Se ainda for possível, copiar à mão para um local seguro.
- O protótipo publicado continua no claude.ai como artifact; a fonte está em `prototype/`.
- Conteúdo de terceiros fora do escopo do produto: removido de propósito. O mapa dos casos para os arquivos reais e a cópia sem anonimização ficam no repositório privado da BEZ.
