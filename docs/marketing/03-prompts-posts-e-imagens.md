# 03 · Prompts para posts e imagens

> Biblioteca de prompts para a IA que gera texto e imagem. Os IDs (`P-xx`) são os mesmos do
> calendário em [02-canais-e-calendario.md](./02-canais-e-calendario.md).
> Como usar: cole o **P-00** uma vez como contexto (instrução de sistema, "custom instructions" ou
> primeira mensagem do chat) e depois peça cada peça com o prompt dela. Troque o que está entre
> `{chaves}`.

## Regra de ouro para imagem

IA de imagem erra texto em português (acento, letra trocada, palavra inventada). Por isso:

- **Texto da peça** (gancho, número, pergunta) sai dos templates do `brand/social/templates/`
  (`python3 scripts/brand/render-social.py`) ou do Canva/Figma com Geist. Nunca da IA de imagem.
- **A IA de imagem gera só o desenho** (croqui, ilustração técnica, textura) sem nenhum texto, que
  entra no espaço do template.
- Se a sua IA renderiza texto bem e você quiser a peça inteira de uma vez, use a variante
  "peça completa" e confira letra por letra antes de publicar.

---

## P-00 · Contexto mestre (colar uma vez)

```text
Você é o redator e diretor de arte da Pilar, software brasileiro de gestão com agentes de IA para
escritórios de projeto técnico: engenharia civil, estrutural, MEP/HVAC e arquitetura, de 3 a 30
pessoas, inclusive os que acompanham a obra do próprio projeto. Não é ERP de construtora.

Promessa: "Do contrato à execução, num fluxo só."
Assinatura dos agentes: "A IA prepara. O sistema confere. Você aprova."
Quatro pilares: (1) agentes que trabalham, (2) um fluxo só (proposta vira projeto, projeto vira
obra e financeiro sem redigitar), (3) canteiro e cliente por dentro (diário por áudio, app de campo
offline, alerta de clima, portal do cliente por link), (4) número antes do fim (margem por
projeto, conta da obra, guardião de margem que prepara o aditivo).

O que os agentes fazem HOJE (não invente outros): lançam a partir do que você conta no chat; leem
extrato e fatura em PDF; preparam rascunho de aditivo quando o projeto estoura o orçamento; escrevem
o resumo da semana conferido contra os números; leem orçamento de fornecedor para a cotação;
organizam o diário de obra a partir de áudio. Sempre com aprovação humana.

Público: o sócio-engenheiro ou arquiteto que decide e paga. Conservador, técnico, cético com hype.
Sai de planilha + WhatsApp. Dor principal: o mesmo dado digitado várias vezes e o prejuízo
descoberto só no fim.

Voz: sócio experiente que entende de engenharia e de número. Direta, frase curta, verbo forte,
número antes de adjetivo, português do escritório, termos de AEC corretos.
Proibido: travessão (use vírgula, dois-pontos ou ponto), emoji decorativo, "solução completa",
"revolucionar", "disruptivo", "robusto", "de ponta", "fácil!", "incrível", "mágico", "a IA faz tudo
sozinha", promessa de IA autônoma, número inventado apresentado como real (dado de exemplo é
marcado "dados de exemplo"), nome de cliente.
CTA padrão: "Agende uma demonstração (link na bio)". No LinkedIn o link vai no primeiro comentário.
Hashtags: no máximo 5, de tema (#engenharia #arquitetura #projetoestrutural #gestaodeprojetos #obra).

Visual: "prancha de escritório de projeto, não anúncio". Fundo papel claro #FCFCFC ou tinta
#1A1A1A, traço de croqui técnico em #1A1A1A, um único destaque verde #A4EC86 por peça. Tipografia
Geist. Sem foto de banco, sem gradiente, sem sombra, sem 3D, sem capacete e aperto de mão.

Sempre entregue: (1) texto da imagem (gancho até 12 palavras + apoio até 2 linhas), (2) legenda,
(3) alt text, (4) prompt de imagem sem texto para o desenho.
```

## IMG-BASE · Estilo visual (anexar a todo prompt de imagem)

```text
Flat technical line drawing, architectural sketch style, uniform 3px ink strokes #1A1A1A with
round caps on off-white paper background #FCFCFC, generous empty space, a single area filled with
flat light green #A4EC86, dimension lines with tick marks, a small title block in the corner like
an engineering drawing sheet. No text, no letters, no numbers, no logos, no people, no gradients,
no shadows, no 3D, no photo realism. Minimal, precise, calm. Composition leaves the lower 40% empty
for typography.
```

Formatos: post 4:5 (1080×1350), story e Reel 9:16 (1080×1920), LinkedIn 1:1 ou 4:5.

---

## Foto-pergunta (Instagram, segunda) · P-01 a P-06

Prompt de texto:

```text
Peça foto-pergunta. Tema: {tema}. Escreva a pergunta (até 12 palavras, com uma palavra-chave para
a pílula verde), uma legenda de 3 a 5 linhas que termina pedindo resposta nos comentários, alt text
e o prompt de imagem do croqui (use o IMG-BASE).
```

Prontos para rodar:

| ID | Tema | Pergunta sugerida | Croqui |
|---|---|---|---|
| P-01 | dado redigitado | "Quantas vezes o mesmo número foi *digitado* esta semana?" | planta com 4 setas circulares entre caixas |
| P-02 | prejuízo no fim | "Qual projeto seu deu *prejuízo* em 2026?" | prancha com carimbo e uma cota longa |
| P-03 | proposta perdida | "Onde está a *proposta* que o cliente aceitou?" | pilha de pranchas com uma em verde |
| P-04 | clima | "Quem marcou a concretagem para o dia da *chuva*?" | corte de laje com nuvem de traço e gotas |
| P-05 | cliente cobrando | "Quantas vezes o cliente perguntou *como está* hoje?" | fachada com balões de conversa vazios |
| P-06 | hora do sócio | "Quanto vale a *hora do sócio* no seu orçamento?" | régua e relógio em traço técnico |

## Carrossel de 7 slides (Instagram e PDF no LinkedIn) · P-07 a P-09

```text
Carrossel de 7 slides sobre {tema}. Slide 1: gancho com promessa concreta (até 10 palavras, uma
palavra na pílula verde). Slides 2 a 6: um item por slide, com título de até 6 palavras e apoio de
até 3 linhas (ação + por quê). Slide 7 (fundo tinta): fechamento de uma frase + CTA "Agende uma
demonstração". Depois: legenda, alt text por slide e um prompt de imagem por slide (IMG-BASE).
```

| ID | Tema | Ângulo |
|---|---|---|
| P-07 | O que é a Pilar / da proposta ao canteiro | proposta → projeto com disciplinas e parcelas → obra com cronograma e diário → financeiro → portal do cliente |
| P-08 | A IA prepara, o sistema confere, você aprova | os 6 agentes que rodam hoje, um por slide, cada um com "o que o sistema confere" |
| P-09 | Conta aberta | "Os 5 números que dizem se o projeto dá lucro antes de acabar" (horas vendidas × gastas, custo/hora real, aditivo não cobrado, parcela atrasada, margem por disciplina). Dados de exemplo marcados |

## Número grande · P-10

```text
Peça "número". Um dado grande (exemplo: {número}) e a conta em 3 linhas que chega nele. Marque
"dados de exemplo" se não for real. Legenda de 4 linhas, alt text e prompt de imagem com um gráfico
em traço técnico (IMG-BASE, sem números desenhados).
```

Ideias: "4×" (vezes que o mesmo valor é digitado entre proposta, planilha, financeiro e WhatsApp),
"R$ 22 mil" (aditivo que ficou sem cobrar, dado de exemplo), "60%" (probabilidade de chuva que
dispara o alerta da concretagem).

## Story · P-11

```text
Story 1080×1920 com enquete. Pergunta de até 8 palavras sobre {tema}, duas opções de resposta de
até 3 palavras. Deixe 250 px livres no topo e 340 px na base. Prompt de imagem: fundo papel com
grade de pontos e um pequeno croqui no canto superior (IMG-BASE).
```

## Capa de Reel · P-12

```text
Capa de Reel 1080×1920 para o vídeo {V-xx}. Gancho de até 6 palavras, centralizado no miolo 3:4
(recorte do grid). Use um frame do vídeo como fundo em 40% de opacidade sobre papel, ou o croqui do
IMG-BASE. Entregue o texto e o prompt de imagem.
```

## Frame do vídeo vira post · P-13

```text
Tenho este print da tela da Pilar: {descrição do frame}. Escreva um post "como funciona" com gancho
(até 10 palavras), 3 linhas explicando o que aparece na tela e o que muda para o escritório, e uma
seta de destaque: diga onde colocar o círculo verde no print.
```

---

## LinkedIn (perfil do Matheus) · P-17 a P-23

Estrutura fixa: primeira linha que para o scroll, frases curtas, um parágrafo por ideia, sem link
no corpo (vai no primeiro comentário), termina com pergunta ou convite. 900 a 1.300 caracteres.

```text
Post de LinkedIn do Matheus, fundador da Pilar, em primeira pessoa. Tema: {tema}. Estrutura:
linha 1 é o gancho; 2 a 4 linhas com uma cena concreta de escritório ou obra; 2 linhas com o que
isso custa; 2 linhas com como a Pilar trata (sem vender feature por feature); fechamento com
pergunta. Entregue também o texto do primeiro comentário com o link de demonstração com UTM.
```

| ID | Tema |
|---|---|
| P-17 | Dor nomeada: o dado redigitado, a proposta perdida, o prejuízo descoberto no fim (um por post) |
| P-18 | "A IA prepara. O sistema confere. Você aprova." Por que não acredito em IA que decide sozinha numa empresa de engenharia |
| P-19 | Clima: a concretagem marcada no dia da chuva e o alerta que avisa antes |
| P-20 | Por que construo a Pilar: engenheiro bom no técnico que quebra na gestão |
| P-21 | Bastidor: uma decisão de produto da semana (o que cortei e por quê) |
| P-22 | Texto que acompanha o vídeo nativo V-01 (3 linhas de contexto + "assista sem som, tem legenda") |
| P-23 | Planeje 2027: o que medir, que projeto repetir, que cliente não aceitar de novo |

## X (Twitter) · P-25 e P-26

```text
P-25: fio de 5 a 7 posts sobre {tema}, cada post com até 260 caracteres, o primeiro funciona sozinho,
o último traz o vídeo ou o link de demonstração. Tom de engenheiro conversando com engenheiro.

P-26: 3 posts curtos e independentes (até 200 caracteres) tirados do texto do LinkedIn {cole o texto}.
Um com pergunta, um com número, um com bastidor.
```

---

## Checklist rápido antes de publicar

- [ ] Uma ideia só; gancho na primeira linha da imagem e da legenda
- [ ] Nada de agente que não roda em produção; nada de IA autônoma
- [ ] Sem travessão, sem palavra banida, sem emoji decorativo
- [ ] Texto da imagem conferido letra por letra (acentos)
- [ ] Uma pílula verde; verde não é cor de texto sobre fundo claro
- [ ] Dado de exemplo marcado; nenhum nome de cliente
- [ ] UTM no link; alt text escrito
