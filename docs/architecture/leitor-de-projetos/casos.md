# Casos de teste (versão pública, sem nomes de pessoas)

Cada caso é um projeto real de arquitetura usado na bancada. Aqui só aparecem letras e características técnicas; o mapa para os arquivos reais fica no repositório privado da BEZ. Os arquivos de projeto não estão no Git: vêm do acervo da VRZ (Meu Drive) e de fontes abertas. Para rodar a bancada, salve cada arquivo com o nome neutro e na pasta indicada, dentro de `scripts/leitor-de-projetos/dados/`.

| Caso | Arquivo esperado (a partir de `dados/`) | Pág. | Origem do texto | Programa | Observação |
|---|---|---|---|---|---|
| A (`caso_a`) | `raw/avulsos/caso_a.pdf` | 1 | vetorial (PDF rasterizado com texto vetorial) | n/d (o executivo da casa 328 é SketchUp) | casa 328, sobrado; rótulos `A= 12,74 m²`, texto girado |
| B (`caso_b_p1`, `caso_b_p2`) | `raw2/pdf/caso_b.pdf` | 1 e 2 | vetorial | n/d | na página 2: rótulos `A= 14,74 m²` e varanda 33,48 sobreposta a cota |
| C (`caso_c`) | `raw2/pdf/caso_c.pdf` | 1 | quadro numerado | n/d | tabela 01 a 25 ligada a bolinhas numeradas na planta; cor da parede vem da legenda |
| D (`caso_d`) | `raw2/pdf/caso_d.pdf` | 1 | OCR (texto em curvas) | n/d (parede em linha dupla) | 1 rótulo: SALÃO 193,68 m²; escala impressa 1:100, real cerca de 1:75 |
| E (`caso_e`) | `raw4/pdf/caso_e.pdf` | 1 | vetorial | AutoCAD 2025 | linha dupla; folha 3370 x 2384 pt |
| F (`caso_f`) | `raw4/pdf/caso_f.pdf` | 1 | vetorial | ArchiCAD | rótulo em 3 linhas `NOME / Área / 5,35 m²` |
| G (`caso_g`) | `raw4/pdf/caso_g.pdf` | 1 | vetorial | SketchUp LayOut | ruído de móvel no desenho |
| H (`escaneada`) | `raw4/pdf/caso_h_escaneada.pdf` | 1 | nenhum (A4, 0 caracteres, 240 imagens a 600 dpi) | escaneada | prancha de salão comercial, provavelmente a mesma obra de D (não confirmado); texto de 2 a 3 pt |

Outros arquivos usados em testes pontuais: `raw4/pdf/caso_i.pdf` (planta aprovada pela prefeitura), IFC elétrico (Revit, `raw2/ifc/caso_k_eletrico.ifc`), IFC estrutural (TQS, `raw2/ifc/caso_l_estrutural.ifc`), DWG e DXF do elétrico da casa 328, PDFs da casa 328 (arquitetônico e estrutural) e hidráulico só em PDF. Onde a coluna Programa diz n/d, o programa de origem não foi registrado nas rodadas.

## Gabarito do caso H (conferido a olho no bloco, 05/11)
Quadro de áreas: terreno 199,33; a construir térreo 108,18; superior 66,29; total 174,47; área livre 91,15; taxa de ocupação 54,27%; coeficiente 0,8752. Plantas: WC PNE Fem. 3,57; Área técnica 48,47; Acesso restrito 38,11.

## Conjunto aberto
buildingSMART "Duplex Apartment" (CC BY 4.0). Atribuição obrigatória: "BSI (2020) Duplex Apartment Test Files, buildingSMART International", com URL do repositório e indicação de alterações. Arquivos: `Duplex_A_20110907.ifc`, `Duplex_Electrical_20121207.ifc`, `Duplex_MEP_20110907.ifc`, `Duplex_M_20111024_ROOMS_AND_SPACES.ifc`, `Duplex_Plumbing_20121113.ifc`. Baixar do repositório de arquivos de teste da buildingSMART para `dados/raw3/aberto/duplex/`.
