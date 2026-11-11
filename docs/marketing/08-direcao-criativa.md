# 08 · Direção criativa: ideia primeiro, peça depois

> Como a Pilar sobe o nível dos posts e vídeos: menos "template com logo no fim", mais ideia que se
> entende em 1 segundo. Escrito em 11/11/2026, a pedido do CEO, depois de comparar com contas de
> referência (Zapia e outras). Complementa a [07 · Direção de conteúdo](./07-direcao-de-conteudo.md).

## 1. O que as contas de referência fazem (e a Pilar não fazia)

Olhando a Zapia (@zapia_pt) e outras marcas de software com perfil forte, o padrão não é a arte, é o
**conceito**: uma imagem que já conta a piada ou a tese, e uma frase curta que fecha.

| Elas fazem | A Pilar fazia |
| --- | --- |
| Um objeto real como metáfora (a caixa "em caso de emergência", o outdoor no céu) | Cartão, ícone e lista sobre fundo liso |
| Uma frase, às vezes duas | Título, corpo, selo, rodapé e chamada |
| A marca pequena, quase escondida | O logotipo grande no fim de todo vídeo |
| Humor que o público reconhece da própria rotina | Explicação do produto |
| Cada peça parece uma campanha diferente | Toda peça com a mesma cara |

**A regra não é copiar.** A Zapia fala com qualquer pessoa no WhatsApp; a Pilar fala com o sócio de
escritório de projeto. As metáforas têm de vir **do mundo dele**: tapume, placa de obra, escalímetro,
carimbo de aprovação, nível de bolha, betoneira, prancha, capacete na mesa do escritório.

## 2. Precisa terminar todo vídeo com o cartão da marca? Não.

Resposta curta: **as contas grandes quase nunca fecham todo Reel com um cartão de logotipo.** O que
se observa nelas e o que os guias de retenção de Reels recomendam (consenso de blogs de mercado como
Socialk.it, MeetEdgar e Nowbam; a Meta não publica uma regra oficial) é:

- o fim com cartão de marca é o ponto em que a pessoa sai, e isso puxa a retenção e o replay para baixo;
- vídeo que **termina no conteúdo e volta em loop** ganha replay, que é o sinal mais forte do Reels;
- a marca aparece leve durante o vídeo (o @ pequeno no canto, a cor, a voz), não num cartão próprio;
- a chamada vai na **legenda ou no comentário fixado** ("comenta PLANILHA que eu mando o modelo"),
  não na tela.

**A política a partir de agora** (já no motor, `src/fim-base.js`):

| Tipo de vídeo | Como termina | Função |
| --- | --- | --- |
| Educativo, humor, quiz, ASMR, glossário, mito × fato, comentário | **Sem cartão.** Acaba no conteúdo, loop natural, `assinatura()` pequena no canto | alcance e replay |
| Manifesto | a última frase É o fim (sem logotipo grande) | posicionamento |
| Planos, comece aqui, contagem, novidades, lançamento | `fechamento()` com logotipo e "Veja os planos · link na bio" | conversão |

Proporção esperada: **de cada 5 vídeos, no máximo 1 com cartão final.** Já refeitos sem cartão:
`glossario`, `mito-fato`, `comentario`, `asmr` (em `video-v2/renders/`).

## 3. O post-conceito (novo formato fixo do feed)

Uma foto que carrega a ideia e no máximo duas frases. Gerador: `docs/marketing/posts/render-conceito.mjs`,
fotos em `posts/fotos/`, saída em `posts/out/conceito/`, prancha em `posts/prancha-conceito.jpg`.

| # | Foto | Frase | Legenda sugerida (primeira linha) |
| --- | --- | --- | --- |
| 01 | Tapume branco | "Esta obra não depende do grupo do WhatsApp." | Se a obra para quando o grupo silencia, o problema não é o grupo. |
| 02 | Escalímetro | "Você mede tudo em milímetro. E a margem de cada projeto, quem mede?" | A precisão do projeto raramente chega na planilha do escritório. |
| 03 | Carimbo | "A IA prepara. O sistema confere." + carimbo "VOCÊ APROVA." | A assinatura da Pilar, literalmente. |
| 04 | Betoneira na tempestade | "A betoneira já saiu. A previsão dizia chuva." | Marque quem precisa ver isso antes da próxima concretagem. |
| 05 | Placa de obra | Responsável técnico: você. Pela planilha: ninguém. | Toda obra tem responsável técnico. E o controle do escritório? |
| 06 | Nível de bolha | "Projeto e caixa no mesmo nível." | Escopo, prazo e financeiro na mesma tela. |
| 07 | Capacete na mesa | "De manhã, no escritório. À tarde, na obra." | Para quem projeta e acompanha. |
| 08 | Celular sobre a prancha | "Pediu pelo celular. Chegou pronto para você aprovar." | O aditivo preparado pela IA (valor de exemplo). |
| 09 | Planilhas de madrugada | "23h47. Fechando o mês na planilha. De novo." | Marque o sócio que fecha o mês de madrugada. |
| 10 | Caixa de ferramentas | "Cada coisa no seu lugar." | Proposta, projeto, obra e financeiro também. |
| 11 | Malha de vergalhões | "Estrutura não se improvisa." | Nem na obra, nem no escritório que projeta a obra. |
| 12 | Caixa de papéis | "Cadê o contrato da revisão 2? Na caixa. Em algum lugar." | Cada documento dentro do projeto. |

**Como criar o próximo** (o checklist do conceito):

1. Ache o **objeto** do mundo do escritório ou da obra que já diz a dor (sem texto ele já deveria fazer
   sentido).
2. Escreva a frase que **vira** o objeto: a placa de obra preenchida com a verdade, o carimbo que vira
   a assinatura, o nível que vira a tese.
3. Corte tudo o que sobrar: sem selo, sem lista, sem botão. Rodapé com o símbolo e o @, e só.
4. Teste do polegar: se a pessoa não entende em 1 segundo no celular, a frase está longa.
5. Foto: gerada (Figma AI) para metáfora, **real** para bastidor e cliente. Nunca gerar pessoa ou
   cliente "fingindo" ser real.

## 4. Próximos conceitos (banco de ideias)

- **Gaveta de arquivo** etiquetada "FINAL_v7", "FINAL_v8", "FINAL_agora_vai".
- **Régua T** como linha do tempo do projeto, com o ponto onde a revisão entrou de graça.
- **Post-it amarelo** no monitor: "lembrar de cobrar a revisão" (com data de 3 meses atrás).
- **Bloco de concreto com cronômetro**: "Cura de 28 dias. Aprovação do cliente: 47."
- **Chave de uma porta só no chaveiro cheio**: "Um acesso. Todo mundo do escritório." (usuários ilimitados).
- **Fita de isolamento zebrada** em volta de uma planilha: "Área em obra."
- **Vídeo-conceito**: os mesmos objetos em movimento (o carimbo descendo em câmera lenta, o nível
  bolha andando até o centro), 6 a 8 s, sem cartão, loop.

## 5. Calendário: onde entram os conceitos

Substituem metade dos estáticos de "frase sobre fundo liso" do [06](./06-banco-de-conteudo.md): toda
segunda passa a ser post-conceito, alternando com os carrosséis de conta aberta da quarta. A mistura
fica: gente real 40%, educativo 30%, conceito e produto animado 20%, convite 10%.

## 6. Revisão de todos os vídeos (11/11, antes da primeira postagem)

Nenhum vídeo foi postado ainda, então todos foram revisados contra a política da seção 2. O que
mudou: **o cartão final saiu de 19 dos 25 vídeos**, a trilha do "Chuva" virou `cinematic` (a `groove`
aparecia em 7 peças) e a música dos vídeos sem cartão agora vai até o último quadro (`audio.py` usa o
fim do vídeo como virada quando não há cartão).

| Vídeo | Fim antes | Fim agora | Outras melhorias e pendências |
| --- | --- | --- | --- |
| `anatomia-light` | cartão (3,4 s) | conteúdo, loop | 22 → 18,6 s |
| `antes-depois-light` | cartão + tagline | conteúdo, loop | 20 → 16,4 s |
| `chuva-dark` | cartão + tagline | conteúdo, loop | 16 → 9,8 s; trilha `cinematic` |
| `dia-do-socio-light` | cartão | conteúdo, loop | 22 → 18,6 s |
| `diario-light` | cartão | conteúdo, loop | 20 → 16,4 s |
| `grupo-da-obra-light` | cartão | conteúdo, loop | 20 → 16,4 s |
| `hora-do-socio-light` | cartão + nota | conteúdo, loop | 22 → 18,4 s; "faça a conta com os seus números" vai para a legenda |
| `planilha-light` | logotipo + botão sobre o quadro | conteúdo, loop | 18 → 14,4 s |
| `nao-faz-dark` | cartão | conteúdo, loop | 16 → 12,2 s |
| `quiz`, `quiz-2-art`, `quiz-3-revisao` | logotipo + botão | "Acertou? Comenta a sua letra." | 15 → 13,2 s; o pedido de comentário é a chamada |
| `manifesto`, `manifesto-2-gestao` | cena da marca | a virada ("É sistema.") é o fim | 15 → 10,6 s |
| `glossario`, `mito-fato`, `comentario` | cartão | conteúdo, loop | 18 → 14,4 s |
| `asmr-light` | cartão | conteúdo, loop | 20 → 16,4 s; o cartão quebrava o clima sem música |
| `fala-*` (12 do fundador) | véu escuro + cartão | termina na última frase | só o roteiro com `"cta"` mantém o cartão |
| `comece-aqui-light` | cartão | **mantido** | peça de apresentação (fixar no perfil); 48 s é longo para quem não conhece: usar como fixado e na landing, não como alcance |
| `planos-light` | convite em loop | **mantido** | é a peça de conversão |
| `contagem-dark` | cartão | **mantido** | lançamento |
| `novidades-dark` | cartão | **mantido** | série semanal, quem assiste já segue |
| `agentes-explicado-light` | cartão | **mantido** | explicativo narrado; **trocar a voz antes de postar** (Google Chirp 3 HD) |

**Regras que a revisão deixou** (valem para os próximos):

- **Primeiro quadro = gancho.** Todos abrem com a frase ou a imagem do problema, sem logotipo.
- **Até 15 s para alcance, até 25 s para educativo.** Acima disso, só a apresentação e o narrado.
- **A trilha não se repete em duas peças seguidas** (ver a regra de variedade do 06).
- **A chamada mora na legenda**: "comenta PLANILHA", "salva para a próxima reunião", "marque o sócio".

## 7. Leva de 11/11: o que ficou pronto

**Vídeos-conceito** (`video-v2/src/conceito-*.js`, 7 a 9 s, loop, sem cartão): `conceito-carimbo`
(a batida do carimbo "VOCÊ APROVA."), `conceito-placa` (a placa de obra se preenchendo),
`conceito-madrugada` (o relógio correndo até 23h47), `conceito-nivel` (a tela torta que se acerta),
`conceito-betoneira` (relâmpago e chuva), `conceito-busca` (o autocompletar de "como cobrar revisão").

**Posts, série 2: objetos digitais** (sem foto, em `posts/out/conceito/13` a `20`):

| # | Objeto | Frase | Legenda sugerida (primeira linha) |
| --- | --- | --- | --- |
| 13 | Busca com autocompletar | "O que todo escritório de projeto já pesquisou" | Salve para mandar para o sócio. |
| 14 | Pasta de propostas `FINAL_agora_vai (1)` | "Qual dessas foi para o cliente?" | Marque quem salva assim. |
| 15 | Relatório de ensaio | "O concreto passou no ensaio. A gestão, não." | O projeto é calculado. A margem também deveria ser. |
| 16 | Tela de bloqueio às 6:58 | "O seu dia começa no grupo ou no planejamento?" | Responda com 🏗 ou 📋. |
| 17 | Post-it de 12/08 | "Hoje é 11/11." | Lembrete não cobra ninguém. Aditivo, sim. |
| 18 | Agenda da semana | "Onde foi parar a semana?" | Ajuste rápido de 14 horas tem nome. |
| 19 | Planilha com fita zebrada | "Se ninguém pode mexer, não é controle. É risco." | Comenta quantas abas tem a sua. |
| 20 | Conversa com o cliente | "A palavra que salva a margem." | Como você responde o "só um ajustezinho"? |

A série 2 não gasta crédito de imagem: é HTML, dá para trocar o texto e gerar de novo em segundos.
