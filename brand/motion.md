# Movimento da marca

> Como a Pilar se move em vídeo, Reel e animação de marca. O movimento dentro do produto está em
> [design-language.md](./design-language.md), seção 8, e no ADR 0049. Aqui: o que vale para
> peça de comunicação. Instagram: [social-instagram.md](./social-instagram.md).

## 1. Princípio

**A marca é o movimento, e o movimento é calmo.** Nada pula, quica ou balança. As coisas entram
com firmeza, assentam e ficam. Quem se move com mais cuidado é o símbolo: ele se desenha, respira
e deixa as caneluras ficarem verdes uma a uma.

| Faça | Não faça |
|---|---|
| Entrada que arranca e assenta (ease-out) | Bounce, elástico, overshoot |
| Texto aparecendo por linha ou palavra, em ritmo de leitura | Texto girando, voando de fora da tela |
| Um movimento principal por vez | Tudo animado ao mesmo tempo |
| Corte seco entre ideias | Transição de efeito (wipe, glitch, zoom giratório) |
| Número que sobe até o valor e para | Contador que não termina |
| Quadro final parado por 1 s | Cortar o vídeo no meio do movimento |

## 2. Curvas e tempos

Os mesmos tokens do produto (`src/styles/tokens.css`):

| Uso | Curva | Tempo |
|---|---|---|
| Entrada e assentamento | `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) | 300 a 700 ms |
| Hover, destaque, desenho do traço | `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quint) | 300 a 550 ms |
| Respiração do símbolo | `cubic-bezier(0.65, 0, 0.35, 1)`, vai e volta | 900 ms por ciclo |

Tempos de referência: rápido 300 ms, base 500 ms, lento 700 ms. Nada abaixo de 200 ms (parece
erro) nem acima de 900 ms (parece lento) em uma entrada.

## 3. O símbolo em movimento

| Animação | Descrição | Duração |
|---|---|---|
| Desenho | Capitel, ábaco e as quatro caneluras se traçam em sequência; as caneluras descem do ábaco | 550 ms, uma vez |
| Respiração | As caneluras crescem da base e voltam, em ciclo | 900 ms por ciclo, em espera |
| Hover | As caneluras ficam verdes uma a uma (só cor) | 300 ms por traço |
| Saída | Fade para o quadro final | 300 ms |

O símbolo **nunca gira, escala ou balança**. Em movimento reduzido ou impressão ele aparece parado.

## 4. A pílula verde em movimento

A pílula do destaque entra **depois** do texto: o texto aparece, 200 ms depois a pílula se abre da
esquerda para a direita (`scaleX` de 0 a 1, origem à esquerda, 400 ms) atrás da palavra. A palavra em
itálico já está lá. Duas pílulas na mesma cena nunca animam juntas.

## 5. Vídeo curto (Reel, Short)

Formatos do plano de presença: tela do produto (15 a 30 s), texto cinético (10 a 20 s), conta rápida (20 a 40 s).

| Momento | Regra |
|---|---|
| Gancho | O primeiro quadro já traz a pergunta ou o número. Nada de logo de abertura de 2 s |
| 0 a 3 s | Ideia inteira legível; é o que decide se o dedo para |
| Ritmo | Um texto novo a cada 1,5 a 3 s; cada frase em uma linha curta (até 6 palavras) |
| Texto cinético | Staccato: uma frase por vez, entrada ease-out, saída em corte. Fecha com a tagline |
| Tela do produto | Gravada na UI real com dado encenado; o cursor se move devagar e para antes de clicar |
| Conta rápida | A conta aparece linha a linha, de cima para baixo; o resultado vem por último, maior e em cor de status |
| Fechamento | Lockup horizontal (ou símbolo + handle), CTA em pílula verde, quadro parado por 1 s |
| Legenda | Queimada, Geist 500, 56 a 72 px, dentro das zonas livres |
| Voz | pt-BR neutra, sem sotaque marcado, ritmo de explicação ("sócio explicando") |
| Trilha | Sem música por padrão. Se houver, instrumental discreta, bem abaixo da voz |

Duração total sempre dentro do alvo do formato; corte o que não muda a decisão do espectador.

## 6. Movimento reduzido e acessibilidade

- Em material interativo (landing, app), `prefers-reduced-motion` mostra o quadro final, sem animação.
- Em vídeo, nada pisca mais de 3 vezes por segundo e nenhuma tela inteira muda de brilho de golpe.
- Todo vídeo tem **legenda queimada** e descrição na legenda da publicação.

## 7. Como produzir

- Vídeo é montado em **HyperFrames** (composição HTML) com as curvas acima. Use as skills
  `hyperframes` do ambiente.
- A animação do símbolo é CSS puro (`src/styles/motion.css`, `PilarMark`): copie as keyframes
  `pm-draw` e `pm-breathe` para a composição.
- Exporte em 1080 × 1920, 30 fps, e confira o centro 3:4 da capa.
