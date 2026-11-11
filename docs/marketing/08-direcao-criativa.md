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
