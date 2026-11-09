# Leitura de projetos (planta e complementares): pesquisa e proposta

04/11/2026 · base para a spec do "Leitor de projetos" do Pilar (esteiras A e B).

## Princípio

A geometria vem do dado vetorial do arquivo (linhas, blocos, camadas, objetos BIM). A IA de visão entra para ler texto, classificar folhas e conferir, não para medir. Benchmarks recentes mostram modelos multimodais errando contagem de portas e janelas em 45 a 60% dos casos (AECV-Bench, jan/2026) e ficando perto do aleatório para reconstruir planta a partir de fotos (Blueprint-Bench, set/2025).

## Por formato

| Formato | O que traz | Ferramenta | Licença | Fidelidade |
|---|---|---|---|---|
| IFC (Revit, ArchiCAD) | paredes, portas, janelas, ambientes (IfcSpace), pavimentos, pilares, vigas, lajes, instalações; faces de parede por ambiente (IfcRelSpaceBoundary) | web-ifc / ThatOpen (navegador e Node), IfcOpenShell (Python) | MPL-2.0 / LGPL-3.0 | alta, quase direta |
| DWG | camadas, blocos com nome (porta, janela, tomada), polilinhas, hachuras, textos, cotas | LibreDWG (servidor), ODA SDK (pago, SaaS no plano Sustaining: US$ 7.500 no 1º ano), Autodesk APS Model Derivative (por job) | GPLv3 / comercial / por uso | alta se o escritório organiza camadas |
| DXF | igual ao DWG | ezdxf (Python) | MIT | alta |
| PDF exportado do CAD | linhas, retângulos, arcos, hachuras, textos, às vezes camadas (OCG) | pdfplumber/pdfminer.six (MIT), pdf.js (Apache-2.0). Evitar PyMuPDF sem licença comercial (AGPL) | MIT / Apache | média a alta, com conferência |
| PDF escaneado, foto | só pixels | traçado assistido; piloto com API (Planner 5D) ou modelo próprio; datasets CubiCasa5K e FloorPlanCAD são de uso não comercial | variado | baixa sem ajuda humana |

## Pipeline proposto (PDF vetorial e DWG/DXF)

1. Classificar a folha (planta baixa, corte, fachada, estrutural, elétrico) e ler carimbo: escala, pavimento, revisão. IA de visão + texto.
2. Extrair segmentos, arcos, hachuras e textos. Agrupar por camada (DWG/OCG), espessura e cor.
3. Calibrar escala: cota escrita × comprimento medido; "ESC 1:50" + tamanho do papel como checagem.
4. Paredes: pares de linhas paralelas com afastamento de 9 a 30 cm (na escala) ou hachura de parede; juntar colineares; montar o grafo de eixos e encontros.
5. Aberturas: vãos na parede + arco (porta) + linhas finas paralelas (janela); no DWG, blocos.
6. Ambientes: poligonizar o grafo (shapely, BSD) fechando os vãos; nome e área pelo texto dentro do polígono; conferir com o quadro de áreas.
7. Faces: cada parede tem 2 faces; cada face pertence a um ambiente ou ao exterior. Reboco, revestimento e pintura contam por face. Resolve a parede que serve quarto e banheiro.
8. Confiança por elemento; o que ficar abaixo do limite vai para conferência. Original nunca é alterado; leitura versionada (parser, modelo, data).

## Complementares (estrutural, elétrico, hidráulico)

- Alinhar com a arquitetura: eixos/gabarito comuns ou 2 pontos clicados pelo usuário (transformação de escala e translação).
- Estrutural: pilares (retângulo + "P1"), vigas ("V1"), lajes ("L1"), fundação. Texto + geometria.
- Elétrico e hidráulico: no DWG, blocos com nome contam sozinhos (tomadas, pontos de luz, pontos de água). No PDF, achar o símbolo da legenda e procurar o mesmo conjunto de traços repetido na folha.
- Resultado: cada ambiente sabe quantos pontos tem, e o progresso de elétrica/hidráulica deixa de ser chute.

## Infra

Parser pesado não cabe em Edge Function (memória e tempo). Serviço próprio (Cloud Run, Python) com fila; o app chama e acompanha. Decisão transversal: ADR.

## Ordem sugerida

1. Spike de 1 semana com 10 a 20 arquivos reais autorizados: medir que formatos os clientes têm e quanto cada leitor acerta.
2. DWG/DXF e PDF vetorial (o que escritório brasileiro mais manda), com traçado assistido como rede de segurança.
3. IFC (rápido quando o escritório usa Revit/ArchiCAD).
4. Complementares.
5. Escaneado: piloto com API antes de construir.

## Critério de aceite da leitura

Quantidade de ambientes exata; área por ambiente com erro até 2% do quadro de áreas; paredes e aberturas com erro de comprimento até 5 cm; nada inferido entra em quantitativo sem confirmação.

## Fontes

- PyMuPDF get_drawings: https://pymupdf.readthedocs.io/en/latest/recipes-drawing-and-graphics.html
- Discussão de takeoff com PyMuPDF: https://github.com/pymupdf/PyMuPDF/discussions/4884
- LibreDWG (GPLv3): https://en.wikipedia.org/wiki/LibreDWG
- ODA preços: https://www.opendesign.com/pricing.md
- libredwg-web: https://mlightcad.github.io/libredwg-web/docs
- ezdxf: https://ezdxf.readthedocs.io/en/stable/introduction.html
- FloorPlanCAD: https://floorplancad.github.io
- Togal (paredes por linhas paralelas): https://help.togal.ai/en/articles/15602901-ai-powered-area-and-wall-detection
- APS Model Derivative: https://aps.autodesk.com/pricing
- Planner 5D API: https://tool.planner5d.com/b2b-floor-plan-recognition
- Blueprint-Bench: https://arxiv.org/abs/2509.25229v1
- AECV-Bench: https://api.emergentmind.com/papers/2601.04819
- ThatOpen / web-ifc: https://cee.ed.tum.de/fileadmin/w00cbe/cms/Softwarelab/2025/SL2025_Description_IFCVIEWER.pdf

---

# Plano do Leitor de projetos (v1, 04/11, depois da análise do Togal)

## Referências analisadas
- Togal: alvo de experiência = sobreposição 2D no PDF com painel Áreas / Linhas / Contagens, classificação, busca por símbolo e por texto, grupos repetidos, comparação de revisões, chat com o projeto. Escala revisada pelo usuário. "Mede a quantidade; perda é do orçamentista". 3D só para alturas.
- Análise de produtos e repositórios de outro contexto: removida deste repositório de propósito. Resumo do que serviu: texto primeiro (pdfplumber), OCR só para escaneado, LLM só para refinar e conferir, resposta ancorada em página e citação, e conjunto de referência (gold set) para medir.
- Nenhum dos produtos analisados faz geometria (linhas, escala, medidas, levantamento).

## Decisão de método
Manter a página (prancha) como unidade de trabalho e os detectores especializados do produto antigo. Trocar quem busca: em prancha de desenho, quem acha paredes, ambientes, medidas e símbolos é um motor geométrico sobre o vetor; o LLM classifica, lê carimbo e textos, rotula regiões e revisa. Tudo ancorado em página + caixa (coordenada), nunca só em texto.

## Etapas
0. Recebimento: original intacto, hash, versão; fila (Pub/Sub ou Cloud Tasks) para worker Python no Cloud Run; job idempotente por (hash, página, versão do leitor).
1. Inventário (código): dividir páginas (pypdfium2/pdfplumber); por página: formato A0-A4, nº de vetores, nº de textos, imagem raster, camadas OCG, rotação; tipo: desenho vetorial, desenho escaneado, texto, tabela; miniatura para tela e visão.
2. Carimbo e índice: achar o carimbo (caixa com muitos textos pequenos, em geral canto inferior direito); ler o texto do vetor (OCR só se escaneado); LLM barato estrutura: disciplina, tipo de folha, pavimento, escalas, folha, revisão, data, responsável CREA/CAU. Montar o índice de pranchas e cruzar com a folha de índice se houver; detectar revisões.
3. Segmentar a prancha em vistas: planta, cortes, fachadas e quadros costumam dividir a mesma folha; agrupar geometria por densidade e espaços vazios; títulos ("PLANTA BAIXA TÉRREO ESC 1:50"); tabelas (quadro de áreas, de esquadrias, legenda). LLM de visão rotula as regiões; geometria acerta o contorno.
4. Extratores por tipo de vista (motor geométrico):
   - Planta baixa: escala, paredes, vãos e códigos (P1, J1), ambientes, faces, cotas, níveis.
   - Corte: pé-direito, peitoril, laje.
   - Estrutural: pilares, vigas, lajes, fundação.
   - Elétrico e hidráulico: símbolo da legenda procurado na folha (padrão vetorial repetido), contagem por ambiente.
   - Quadros: tabela para JSON.
   Cada elemento: geometria, caixa na página, origem (vetor, texto, tabela, LLM), confiança.
5. Montagem do modelo: por pavimento; complementares alinhados à arquitetura (eixos, pilares ou 2 cliques); alturas dos cortes; códigos de esquadria ligados ao quadro; pontos ligados aos ambientes.
6. Validação cruzada (regras): soma de áreas x quadro de áreas; esquadrias x quadro; escala coerente; polígonos fechados; pilares nos encontros de paredes. LLM revisor olha a sobreposição e aponta o que parece faltar. Abaixo da confiança mínima: fila de conferência.
7. Revisão humana estilo Togal: sobreposição no PDF original, painel Áreas / Linhas / Contagens por classificação, editar, dividir, juntar, reclassificar, ler de novo uma vista, busca por símbolo e por texto. Aprovado: vira o modelo do projeto (2D, 3D, quantitativos, progresso, orçamento).
8. Aprendizado por escritório: mapeamento de camadas, nomes de ambiente, biblioteca de símbolos, padrão de carimbo; correções viram casos do gold set.

## Quem faz o quê
| Tarefa | Quem |
|---|---|
| Dividir, inventariar, miniaturas | código |
| Ler texto do carimbo e das cotas | código (texto do vetor); OCR só em escaneado |
| Estruturar carimbo, classificar folha | LLM barato com saída estruturada |
| Separar vistas e quadros | geometria + LLM de visão para rotular |
| Paredes, vãos, ambientes, medidas, faces | motor geométrico |
| Símbolos (tomada, ponto de água, louça) | casamento de padrão vetorial; visão só em escaneado |
| Conferência | regras determinísticas + LLM revisor |
| Decisão final | pessoa |

## Bibliotecas
pypdfium2 (Apache/BSD), pdfplumber e pdfminer.six (MIT), shapely (BSD), networkx (BSD), OpenCV (Apache-2, só para escaneado), ezdxf (MIT), LibreDWG (GPLv3, servidor, validar com jurídico) ou ODA (pago), IfcOpenShell (LGPL) / web-ifc (MPL), Google Vision ou Textract (OCR de escaneado), pdf.js (Apache-2) para a tela de revisão.

## Riscos
Escritórios desenham diferente (parede de 1 linha, só hachura), PDF com texto virado curva (sem camada de texto), blocos explodidos, várias escalas na mesma folha, DWG sem xref, revisões misturadas. Rede de segurança: traçado assistido e aprendizado por escritório.

## Spike (1 semana, quando chegarem os arquivos)
1. Inventário de todos os arquivos (formatos, vetorial x escaneado, camadas, carimbo).
2. Extrair vetores e textos de 3 pranchas e desenhar por cima, para ver como esse escritório desenha parede.
3. Paredes e ambientes numa planta baixa.
4. Comparar com o quadro de áreas; relatório de go/no-go; uma imagem real no estilo da tela do Togal.
Gold set: 10 pranchas rotuladas à mão (ambientes, áreas, paredes, portas, janelas).

---

# Spike 1 com o projeto real da VRZ (casa 328, sobrado), 04/11

Arquivos (só em `.context/vrz/`, fora do git; dado de cliente, não publicar): arquitetônico caso A (PDF 12 pág), estrutural VRZ "328-ESCA" (20 PDF + 2 DWG), hidrossanitário (5 PDF), elétrico/climatização/fotovoltaico VRZ (7 PDF + 7 DWG), executivo de interiores (SketchUp .skp/.skb, ~5 GB, partes 001-005 do zip não vieram), detalhamento de marcenaria e bancadas (PDF), quantitativo (PDF).

1. Inventário e carimbo: rodou em todas as 75 páginas. Todas vetoriais ou rasterizadas limpas; nenhuma escaneada. Disciplina sai do nome (ESCA, HID, ESG, AP, ELE, CLIM, FOTOV) e do carimbo. Texto girado no carimbo ("ARUTURTSE") exige leitura com rotação.
2. Arquitetônico veio rasterizado (80 blocos de imagem a 300 dpi, texto vetorial por cima; export do Revit com sombra/transparência). Texto perfeito: nomes, "A= xx m²", escala 1:50, títulos das vistas, quadro de áreas.
3. Geometria pela imagem: ambientes fechados por parede batem com a área do arquiteto em 2-4% (E01) e 4-8% (E02, parede cinza, limiar automático). Ambiente integrado ou com porta de vidro vaza para o deck; semente cai em móvel escuro; rótulos girados não lidos; nome às vezes pega cota. Overlay: `.context/vrz/spike/p1-paredes-overlay.jpg`.
4. DWG elétrico (LibreDWG → DXF → ezdxf): export do Revit com camadas padrão AIA (E-LITE-EQPM, E-POWR-CNDT, A-AREA-IDEN); blocos com nome contam sozinhos (térreo: 138 pontos de luz, 118 tomadas, 36 interruptores, 10 pontos de força; superior: 125, 185, 68, 33; deduplicar símbolo x tag pela posição). Nomes dos ambientes vêm na camada A-AREA-IDEN.
5. DWG estrutural: camadas numéricas (estilo TQS/Eberick), sem blocos; precisa de mapeamento por software.

Conclusão: dividir por página continua certo; o que decide a qualidade é a melhor fonte por disciplina. Ordem: IFC > DWG > PDF vetorial > PDF rasterizado (texto como verdade + geometria assistida). Arquitetura e elétrico parecem feitos no Revit: pedir IFC resolve ambientes e permite a compatibilização que o dono da VRZ quer.

---

# Spike 2 (04/11)

Scripts em `.context/ferramentas/` (rooms2.py, dwgrooms.py, elepoints.py); saídas em `.context/vrz/spike/`.

1. PDF rasterizado, prancha de layout (E01): 13 de 18 ambientes dentro de 5% da área do arquiteto, 2 entre 7% e 12%. Ganhos: tirar da máscara de parede o que é grosso demais (bancada), divisas finas só quando retas e encostando em parede nas duas pontas (vidro, esquadria), semente no centro do espaço livre, leitura de texto girado (8 rótulos) e nome com a orientação certa. Estar/cozinha integrado fechou em +2%. Falhas: área gourmet (o rótulo de 77 m² inclui o deck coberto; a parede não diz isso), lavabo e lavatório pequenos com louça escura, hall e circulação com escada.
2. Planta técnica (E02) pior (7 de 21): cotas vermelhas e parede cinza. O produto escolhe a melhor prancha por pavimento (a de layout) e usa a técnica para cotas e tabelas.
3. Quantitativo da pasta R01 é ESTRUTURAL: aço por pavimento e bitola, concreto 91 m³, fôrma 658 m². Sai como tabela (pdfplumber) e alimenta orçamento e gabarito do estrutural.
4. DWG do elétrico tem a arquitetura vinculada como bloco (PAREDES, ESQUADRIAS, PILAR, LAYOUT), mas incompleta como fonte de ambiente: paredes internas em outras camadas, terreno misturado. Fechar portas pelo arco ajuda, mas não basta. Confirma: pedir o DWG/IFC original do arquiteto e ter mapeamento de camadas por escritório.
5. Pontos elétricos sem duplicata (mesma posição): térreo 239 (luz 138, tomada 55, interruptor 36, força 10), superior 227. Atribuir ao ambiente pela etiqueta mais próxima é grosseiro (suíte 03 com 45 pontos de luz); precisa do contorno do ambiente (IFC ou DWG do arquiteto, ou o polígono do PDF alinhado).

Gold set desta casa: rótulos A= da E01 (18 ambientes), quadro de áreas (térreo 149,10; superior 114,75; piscina 8,41; terreno 308,12), quantitativo estrutural.

---

# Spike 3 e bancada de testes (04/11)

Todos os zips são da mesma casa 328 (o "012" e os outros do executivo são SketchUp de interiores, inclusive `Modelagem superior.skp`; sem leitor aberto confiável para .skp: pedir exportação IFC ou glTF do SketchUp Pro).

Bancada: `.context/ferramentas/bancada.py` roda todos os testes nos arquivos reais e grava `placar.jsonl` (cada rodada com nota). Biblioteca: `leitor.py` (Prancha, texto girado, paredes, vãos por pontas, vãos por fechamento, ambientes).

Placar da rodada 3:
- Ambientes (E01): 14/18 dentro de 5%. Fora: área gourmet (rótulo inclui deck), hall (escada), circulação (escada), suíte 03 (-6%).
- Esquadrias (E02 x tabela): 16/17 tipos, 27/28 peças, 27/27 vãos localizados com largura a até 10 cm (maioria exata). PGA70 não aparece na planta.
- Quadro de áreas: 5/5 lidos, soma confere.
- Estrutural (quantitativo): concreto 91 m³ e fôrma 658 m², somas conferem.
- Elétrico (DWG): contagens únicas por pavimento (gabarito para o PDF).

Aprendizados:
- O texto da prancha brasileira carrega muito: código da esquadria (P/J + material + largura), medida ("0,88x2,45"), tabela de portas e janelas, nome e área de cada ambiente, quadro de áreas. Texto primeiro, geometria para localizar e conferir.
- Vão = andar da ponta da parede (esqueleto) na direção dela até a próxima parede. Pega porta encostada em parede perpendicular. Fechamento morfológico como segundo detector.
- Vãos detectados viram divisa de ambiente: lavabo e lavatório passaram de -36%/-17% para exatos.
- Mudar duas coisas na mesma rodada esconde a causa: a ablação mostrou que 200 dpi custava 1-2 ambientes e o segundo detector salvava a lavanderia.

---

# Rodada 4: acervo da VRZ no Drive (04/11)

Acesso: perfil Pessoal do Chrome (conta u/3, Meu Drive = arquivo de projetos da VRZ), só leitura e download, sem upload. Arquivos baixados só em `.context/vrz/raw2/` (fora do git, dado de cliente). Biblioteca de convenções: `.context/ferramentas/biblioteca.py`.

Estrutura do acervo: Meu Drive > Projetos > {2023..2026} > "NNN - Cliente" > {ARQUITETÔNICO, ESTRUTURAL, ELÉTRICO, HIDRÁULICO, SONDAGEM, ART}. Mais de 40 obras só em 2026 (casas, condomínios, UBS, heliponto, logística, igreja, container). Casa 425 está no começo (estrutural e elétrico vazios).

Baixados: 2 IFC (365 elétrico Revit 2025, 10,4 MB; 386 estrutural TQS 26.7, 16 MB), 4 PDFs de arquitetura de 3 ferramentas e 4 arquitetos ([autor do PDF]/Ghostscript, caso I/Adobe PDF Library, caso_d/AutoCAD 2022, PSAR reforma/Adobe PDF Library).

IFC elétrico (Revit MEP): 22 IfcSpace com nome (LongName) e contorno, pavimentos 0/3,37/6,55 m, 396 trechos de eletroduto, 193 peças genéricas (tomadas, interruptores, pontos de força) e 21 terminais; sem parede, porta ou janela. Atribuição de ponto a ambiente pelo contorno: 110 pontos atribuídos, 81 fora de qualquer contorno (ponto de parede cai na divisa; precisa de tolerância).
IFC estrutural (TQS): 76 pilares, 183 vigas, 32 lajes, 44 sapatas, 58 estacas; psets TQS_Padrao, TQS_Geometria (seção b x h, perímetro, área), TQS_Armaduras (cobrimento); pavimentos Fundação, Cobertura 1, Cobertura 2, Ático.
RVT (arquiteto): nenhum leitor aberto; pedir IFC.
PDF caso_d: AutoCAD, 4 vistas por prancha (cortes, plantas, cobertura, demolição, fachada), parede em DUAS LINHAS finas (o detector de preenchimento escuro não pega), rótulos "SALÃO 183,66 m²".
PDF [autor do PDF]: planta baixa + planta de áreas com cores que são imagem (não polígono vetorial); quadro de áreas legível e consistente (400,17 + 21,12 = 421,29; + 69,60 = 490,89). Medição por cor da imagem ficou a calibrar.

Biblioteca: código de esquadria = categoria (P/J/M) + movimento (C,G,B,P,F) + material (M,A,V) + largura NOMINAL em cm + variante (A/B). O vão osso vem da tabela (casa 328: porta madeira/alumínio +8 cm; vidro de correr e janela iguais); nunca derivar do código. MFV = painel fixo de vidro (hipótese).
Vãos sem código: classificar por largura e pelo que há dos dois lados (passagem, acesso ao exterior, portão). Implementado em `leitor.classificar_vao`, falta ligar à lista de esquadrias casadas.

---

# Rodada 5: mais exemplos, fontes abertas e bancada automática (04/11)

Acervo local (tudo em `.context/`, fora do git): `dados/raw` e `dados/raw2` (PDFs, IFC, DWG da VRZ/caso A e de outros arquitetos), `dados/raw3/aberto` (fontes abertas).
Baixados do Drive nesta rodada: 5 PDFs de executivo (2 AutoCAD 2020/2024, 1 caso A caso B de 22 págs, 1 iLovePDF de 8 págs, 1 "Print to PDF" escaneado de 8 págs).
Aberto: buildingSMART "Duplex Apartment" (CC BY 4.0; exigir atribuição "BSI (2020) Duplex Apartment Test Files, buildingSMART International" + URL do repositório, e indicar alterações): 5 IFC (arquitetura 2,3 MB com 56 paredes, 14 portas, 24 janelas, 21 ambientes com área, 4 pavimentos; elétrico; MEP; ambientes; hidráulico 30 MB). FZK-Haus (KIT): licença não confirmada. FNDE e Ministério da Saúde: projetos-padrão existem mas não achei link direto (gov.br/fnde > Proinfância; contato projetos.engenharia@fnde.gov.br). CubiCasa5K e FloorPlanCAD: uso NÃO comercial.

Bancada automática (`bancada2.py`, `leitor2.py`): o rótulo de área escrito pelo arquiteto vira gabarito. Resultados (parede por preenchimento escuro + vãos):
- caso A 328 E01: 13/17 dentro de 5% (mediana 3,0%).
- caso A caso B (outra casa): p1 6/9 (3,2%), p2 7/9 (1,0%), p3 3/7 (15%), p4 0/9. Depende do tipo de vista.
- caso C: leu o quadro de ambientes (26 linhas, 19 com pé-direito), mas o quadro não fica sobre a planta: precisa ligar nome da tabela ao nome na planta.
- caso_d (AutoCAD): nomes de ambiente na planta são contorno vetorial, não texto: só OCR resolve. Parede = 2 linhas finas: detector de linha dupla por imagem não funcionou (0 em tudo).
- "PROJETO EXECUTIVO.pdf": 0 caracteres, 96 imagens: escaneado de verdade (caso de OCR).
- caso I: rótulos só de piscina, prainha e fire pit (sem paredes).

Aviso de direitos: o carimbo da caso A diz "projeto protegido pela Lei 9610/98, não pode ser executado ou alterado sem autorização do autor". Uso para TESTE interno tudo bem; uso para TREINAR ou melhorar produto comercial exige autorização do escritório e da VRZ. Tratar antes de ampliar.

---

# Rodada 6 (04/11): IFC de arquitetura, quadro numerado, OCR, linha dupla e calibração de escala

Autorização: o fundador informou que a VRZ já autorizou o uso (acesso ao acervo); sigo em teste e treino. Mensagem de confirmação para a VRZ e os escritórios: rascunho entregue no chat, ele envia.

1. IFC de arquitetura (`leitor_ifc.py`, teste no Duplex CC BY 4.0): 57 paredes, 14 portas, 24 janelas, 21 ambientes, 4 pavimentos. 38/38 vãos ligados à parede hospedeira; 49/57 paredes com faces em ambientes; 34 paredes servem 2 ou mais ambientes. Contorno do sólido é 8-23% menor que a área declarada (mediana 13%): declarada = verdade do cliente, contorno = posição e conferência, desvio >3% marcado. Revit grava área em PSet_Revit_Dimensions (não em Qto); ambiente liga ao pavimento por IfcRelAggregates; IfcWall já inclui StandardCase (contar uma vez). Pé-direito do ambiente = "Unbounded Height".
2. Quadro numerado + cor da legenda (`leitor3.py`, caso C): o quadro numera os ambientes (nome, área, pé-direito) e a planta tem bolinhas numeradas (texto branco 9 pt); a LEGENDA dá a cor da parede (laranja 1,0/0,498/0) e as paredes são polígonos vetoriais dessa cor. 9 de 9 ambientes fechados dentro de 2,3%; abertos/integrados/externos falham (marcar "confirme"). Notas da prancha: medidas e níveis são ACABADOS.
3. OCR (Tesseract + modelo por, `ocr.py`): 600 dpi em recorte da planta lê nome e número (SALÃO 193,68 confirmado no zoom; minha leitura a olho em baixa resolução estava errada). 300 dpi lê o escaneado (nomes, cotas, códigos). Erro típico: O por 0 em código (PCM9O). Regra: OCR é evidência com confiança; número só entra após soma contra o quadro.
4. Linha dupla por vetor (`leitor4.py`): pares de segmentos paralelos a 9-35 cm com sobreposição >0,9 m. Traçou o perímetro, WCs, escada e divisórias do caso_d sem ruído.
5. ESCALA IMPRESSA != REAL: caso_d rotulado 1:100 mas plotado ampliado (equivale a ~1:75, fator 0,746). Calibrar pela cota horizontal total (8,00 m): salão 193,2 m² (-0,3%) contra 347,5 m² (+79%) com a escala impressa. Regra: calibrar sempre por cota escrita e conferir com outra cota; a vertical divergiu 5% porque o envelope incluía passeio.
6. Biblioteca: MF = montante fixo (tabela própria, confirmado em PROJETO EXECUTIVO.pdf); normalização de OCR em códigos.

---

# Rodada 7 (04/11): calibração automática, escala padrão e seletor de detector

`leitor5.py` (calibrar_por_cotas, encaixar_escala) e `bancada3.py`.

1. Calibração por cotas escritas, por consenso ponderado: cada número de cota perto de uma linha horizontal/vertical gera escala candidata (valor / comprimento); peso 3 se a linha tem traço nas duas pontas; só aceita fator de plotagem 0,5x a 2x das escalas impressas; testa o trecho individual E o trecho unido (cota cortada pelo texto; cotas encadeadas). 7 de 8 dentro de 5% (maioria exata). Cotas viradas contorno (caso_d): ler por OCR e passar como palavras extras. Folha com várias escalas devolve até 3 grupos; fator fora de 0,85-1,2 marca "confirmar".
2. Encaixe em escala padrão (10, 20, 25, 30, 40, 50, 75, 100, 125, 150, 200, 250, 500): se a calibrada está a menos de 4% de uma, usa a padrão. caso B p2: 1:73 dava 2/9; 1:75 dá 7/9. caso_d 1:74,5 vira 1:75 (plotado a 75% do papel).
3. Seletor de detector SEM gabarito: pontua cada máscara de parede (preenchimento escuro, cor da legenda, linha dupla vetorial) por ambientes fechados de 1 a 120 m² menos 0,2 por fragmento <0,3 m², com as portas (vãos) fechadas na máscara, e descarta máscara que cobre >10% da folha. Acertou 5/5 contra o melhor detector pelo gabarito. Amostra pequena: ampliar com mais obras antes de confiar.
4. Lição de método: duas mudanças no mesmo teste esconderam a causa de novo (escala x pontuação); a bancada separou. Pontuar máscara sem fechar portas dava 0 ambientes fechados e escolhia o detector errado.

---

# Rodada 8 (04/11): mais obras, seletor por validação cruzada, compatibilização e medida no rótulo

Acervo novo (Drive, `.context/vrz/raw4`): 5 projetos legais de prefeitura de autores e programas diferentes (AutoCAD 2025, ArchiCAD, SketchUp LayOut, iText, Print to PDF escaneado).
1. Seletor de detector com 6 candidatos (4 limiares + linha dupla + cor da legenda): a pontuação SEM gabarito (ambientes fechados menos ruído) ficou frágil e premia fragmentação (3/7). Trocado por validação cruzada usando as áreas escritas na própria prancha (escolhe com metade, mede na outra metade): 46/105 contra oráculo 47/105 e contra 42/105 da pontuação sem gabarito. Amostra: 7 pranchas, 4 programas.
2. Acurácia absoluta ainda baixa nos programas novos: caso_e (AutoCAD 2025) 6/19, caso_f (ArchiCAD) 3/14, caso_g (LayOut) 3/17. Padrão: ambientes FECHADOS ficam em -2% a -4% (viés de 1 px corrigido por erosão); falham os abertos/integrados e os que vazam para o exterior.
3. Recorte da detecção à região dos rótulos de área (+4 m): derrubou ruído de cortes e fachada (LayOut: de 0 para 21-25 ambientes fechados).
4. Leitor de medida no rótulo (`biblioteca.parse_dimensao`): "0,90x2,10", "80x210", "PM-80x210", "80x60/1,90", texto girado invertido primeiro, cm se >=10, altura dupla até 6 m. Em pranchas sem tabela: caso A 27/31 e caso C 19/29 medidas escritas batem com o vão medido (mediana 1 cm). caso_f: as medidas estão numa coluna (quadro sem código): portas por altura >= 1,9 m.
5. Compatibilização no Duplex (`compat_ifc.py`): arquitetura, elétrico, hidráulico e MEP no mesmo referencial (94-100% de sobreposição). Classifica embutido (esperado), travessia (lista de furações), contato e embutimento longo (rasgo/shaft). Elétrico: 76 embutidos e 0 conflitos. Hidráulico: 108 furações e 42 embutimentos longos. MEP: 199 furações e 81 embutimentos longos.
6. Erro de processo: `pkill -f` com padrão que aparece na própria linha de comando matou o shell (137). Usar padrão com colchete: `pgrep -f '[b]ancada3.py'`.


## Rodada 9 (05/11): pontos fracos, verificação por grupo

- `grupos.py`: componentes do espaço livre com vãos fechados; rótulos agrupados por componente. Estados: confere (<=5%), vaza (toca a borda ou erro > 20%), cortada (< -20%), diverge.
- caso A 13 -> 15/17 e caso C 9 -> 11/20 (ambiente integrado vira grupo que confere pela soma). caso_e 8 -> 6, caso_f 3 -> 1, caso_g 1 -> 0, caso B p1 6 -> 5: onde a parede vaza, o grupo funde ambientes e perde. Uso certo: marcar vaza/cortada/diverge para revisão humana, não como contagem de acerto.
- Bug achado: `recortar` (rótulos + 4 m) decepava salão alongado com 1 rótulo (caso_d 7,5 x 27,7 m, 0/1). Regra nova: sem recorte com menos de 4 rótulos. caso_d voltou a 1/1; controles caso A, caso B p2 e caso C iguais.
- `comp_min_m=2.0` e erosão 3x3 não mexem nos casos fortes; caso_g 0 -> 1.
- Fraco de verdade: detecção de parede em programas novos (caso_e 8/19, caso_f 3/14, caso_g 1/17). Parede hachurada e fundo de móvel não viram par de linhas; sala vaza.


## Rodada 10 (05/11): OCR x texto vetorial, custo e qualidade

Teste: 7 folhas, 111 rótulos de área; gabarito = texto vetorial do PDF. OCR local (Tesseract), blocos de 700 pt renderizados direto na resolução pedida.
- Texto vetorial: exato quando a camada de texto existe, 0,3 a 6 s por folha, custo zero. É o caminho principal.
- OCR da folha inteira numa passada: 0 a 10/17. Culpa do teto de 9000 px (rótulo vira ruído), não do OCR.
- OCR em blocos: 400 dpi 76%; com giro de 90 e 270 graus 83%; 300 dpi 80%; 600 dpi só 64% (glifo grande demais). Texto girado era o erro do caso A (10 -> 17/17).
- Texto gigante (tabela do caso C) só lê a 150 dpi (18 -> 25/26).
- União 150 + 300 + 400 dpi com giros: 102/111 = 92%. Tempo ~44 s por folha em 1 núcleo (paralelizável por bloco).
- Falhas que sobram: rótulo sobreposto a desenho (cota por cima de 33,48, boneco sobre 4,28). Nem o texto vetorial resolve; vira revisão humana.
- Regra: OCR é evidência. Só entra em quantidade depois de bater contra soma de quadro ou confirmação.
- Não testado: LLM de visão. Ordem de grandeza (estimativa, não medida): ~50 blocos de 1568 px por folha A0, ~80 mil tokens de imagem por folha, contra zero do OCR local.


## Rodada 11 (05/11): LLM de visão por subagentes e OCR automático

Visão (4 blocos de 330 x 240 pt em ~1500 px, 21 rótulos, 16 códigos de esquadria, 31 cotas; mesmo prompt, só trocando o modelo; sem API, via subagentes do Claude Code):
- Haiku, Sonnet e Opus empataram: áreas 19/21, cotas 28/31, esquadrias 16/16 (Sonnet 15/16). As 2 áreas que faltam são rótulos cortados na borda do bloco.
- 7 cotas "extras" no caso_e são as cotas verticais (1,46 3,66 4,10 1,20x2 2,70x2): o gabarito de palavra solta do pdfplumber não pega texto girado. O modelo estava certo. Gabarito para texto girado precisa de `linhas()`.
- Tokens por subagente 89 a 95 mil e 9 a 34 s; a maior parte é o contexto fixo do subagente, não as 4 imagens (~1,6 mil tokens cada). Em produção: chamada direta com imagem, sem subagente.
- Onde o OCR falhou (caso_f: 5,35 e 1,71 sobrepostos a desenho), a visão leu certo.
- Limites do teste: 4 blocos, só plantas vetoriais limpas, nada de escaneado, nada de geometria (parede, medida).

OCR automático (`texto_auto.py`): cascata vetor -> OCR em blocos 150+300+400 dpi com giros, só em blocos com desenho ou imagem. 100/111 (90%), 74 com nome, 819 números sem rótulo (cotas) como sobra. caso_d sem região à mão: SALÃO 193,68. Defeitos corrigidos no caminho: token inteiro em vez de busca (60% -> 90%) e nome só em maiúsculas.


## Rodada 12 (05/11): escaneada, filtro m², parede, dpi

- Escaneada (caso_h_escaneada.pdf, A4 com desenho reduzido, texto de 2 a 3 pt, 240 imagens a 600 dpi; mesma obra do caso_d): sem texto vetorial. Gabarito de 9 valores conferido a olho. OCR 8/9 valores, mas 4 de 6 linhas do quadro de áreas com nome trocado (texto vizinho colado) e m² em 1 só. Visão (Haiku, Sonnet): quadro 6/7 e 7/7 com rótulo certo, plantas certas e 38,11 que o OCR perdeu (texto vertical); de brinde códigos de esquadria com medida (MFV/260 260x460/0, PCV/435 4,35x2,50, PCM90 0,90x2,10).
- Filtro por m²: 70% dos rótulos reais passam e só 3,5% do ruído (25 de 709). Camada de alta confiança, não corte final.
- Escolha de bloco por parede (pares de linhas paralelas): -25 a -45% de tempo no caso_e, caso_f e caso_g sem perder rótulo, mas apaga o quadro de áreas (caso C 0/26). Não adotar como filtro.
- dpi pela página: dpi nativo sozinho piorou o caso C (texto grande de tabela pede 150): regra é somar ao padrão 150/300/400. Bloco 700 pt com teto de 6000 px (bloco menor cortava rótulo na borda).
- Insight: o quadro de áreas da folha confere sozinho (108,18 + 66,29 = 174,47; área livre 91,15 = terreno 199,33 − ocupação). Soma que fecha = verificação gratuita para escalar para o LLM só quando não fecha.


## Rodada 13 (05/11): camadas de verificação grátis

- Sinal "a + b = c" (soma que fecha) como verificação por rótulo: inútil. Com ~200 números por folha (cotas), fecha por coincidência (1,50 + 2,70 = 4,20): o nível "verificado" ficou 57 certos e 44 errados. Soma serve só no quadro de áreas, com relação conhecida (térreo + superior = total), não como regra solta.
- Regras simples contra o gabarito vetorial (120 rótulos): m² qualquer 61 acertos e 28 fora, cobre 51%; m² e nome 53/27, 44%; nome qualquer 82/161, 68%.
- Os "falsos" com m² são quase todos rótulos reais que o `rotulos_area` não pegou (Piscina 10,40 no caso B; COPA 2,53 e EXPO RACE 6,74 no caso_e; Área 182,46, 30,00 e 19,11 no caso_f). Precisão do m² é maior que os 70% medidos; o gabarito vetorial é incompleto. Ação: melhorar o parser de texto vetorial (ganho certo e barato).
- Escalar para LLM por "nome sem m²" manda 2 a 11 de 16 blocos por folha (caso_e 11/16): caro. Em folha sem camada de texto a política simples é mais barata e mais segura: LLM (Haiku) em todos os blocos de planta e quadro, e o OCR como segunda leitura independente. Valor que os dois leem igual = confiança; divergência = revisão.
- A seleção de blocos por parede serve melhor para escolher quais blocos mandar à LLM (planta) do que para o OCR, desde que o quadro de áreas entre à parte.


## Rodada 14 (05/11): conserto do parser de texto vetorial

- caso_f 14 -> 29 rótulos. Causa: rótulo em 3 linhas ("NOME / Área / 5,35 m²"): o parser tomava "Área" como nome e o filtro RUIM descartava a sala. Agora, se a linha de cima é só "Área", sobe mais uma linha até achar o nome (`GENERICO` em `leitor2.py`). 13 dos 15 novos foram confirmados, de forma independente, pelo OCR com m². As outras 6 folhas não mudaram e nada se perdeu.
- Os outros "extras" do OCR eram descartes deliberados (Piscina 10,40 em RUIM; 330,00 é linha de quadro com pontinhos) ou erro do OCR (EXPO 6,74 é 36,74 no texto vetorial). Ponto para o texto vetorial sobre o OCR.
- Sobra: nomes com dígito colado ("5Área", "2CIRC.") e rótulo repetido entre vistas (QUARTO 01 em duas plantas): precisa ligar rótulo à vista/prancha. "PAVIMENTO TÉRREO 252,88" entra como ambiente (já era assim) e deve virar total de pavimento.


## Rodada 15 (05/11): LLM de visão na folha escaneada inteira (grade de 21 blocos, Haiku)

- Um agente Haiku leu 21 blocos de 170 x 128 pt (>= 4% de tinta). Achou 3 dos 9 valores conferidos (WC 3,57; Área técnica 48,47; Acesso restrito 38,11) e perdeu o quadro de áreas inteiro. Contraste: no teste dirigido (4 blocos centrados no conteúdo) deu 9/9.
- Causa: os números do quadro estavam legíveis na borda de baixo de um bloco e os rótulos no bloco seguinte. O prompt mandava "rótulo junto" e "omitir se cortado", então saiu lista vazia. É falha de recorte e de prompt, não de leitura.
- Custo: 162 mil tokens, 153 s, 21 blocos. Contra 102 mil dos 4 blocos: ~3,5 mil tokens marginais por bloco e ~88 mil de base fixa do subagente (limite superior, inclui releitura de contexto). Em produção, chamada direta sem subagente.
- Regras que saem daqui: (1) o prompt devolve o número mesmo com rótulo cortado e marca `rotulo_cortado`, e o sistema funde com o bloco vizinho; (2) melhor que grade cega: janelas ao redor dos candidatos do OCR e das âncoras (título "ÁREAS", tabelas) com 60 pt de contexto; (3) grade só onde o OCR rende pouco; (4) ponto cego: o que o OCR não viu (38,11) só a grade pega.
