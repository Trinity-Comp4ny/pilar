# 06 · Banco de conteúdo

> Tudo o que está pronto para postar, o que falta produzir e a regra de variedade, até o
> lançamento público (19/01/2027). Estratégia, cadência e métricas em
> [05-plano-de-marketing-2026-11.md](./05-plano-de-marketing-2026-11.md). Atualizado em 10/11/2026.

## 1. A regra de variedade

O CEO pediu (10/11) que os vídeos parem de parecer todos iguais. Daqui em diante, cada peça
escolhe **um conceito visual, uma trilha e um tema** de listas diferentes, e duas peças seguidas
no feed não repetem nenhum dos três.

| Conceito visual | O que é | Exemplo pronto |
| --- | --- | --- |
| Tela do produto | janela do app com câmera e recortes | `comece-aqui-light` |
| Tipografia cinética | a palavra é a imagem, uma por batida | `manifesto-dark` |
| Simulação do dia a dia | um celular ou planilha com o caos de hoje | `grupo-da-obra-light`, `planilha-light` |
| Prancha técnica | croqui que se desenha, cotas viram números | `anatomia-light` |
| Linha do tempo | agenda, relógio, antes e depois do dia | `dia-do-socio-light` |
| Jogo | quiz com contagem regressiva, resposta nos comentários | `quiz-light` |
| Tela dividida | antes e depois lado a lado | `antes-depois-light` |
| Conta rápida | a conta linha a linha | `hora-do-socio-light` |
| Celular do canteiro | o app de obra na mão | `diario-light` |
| Convite em loop | preço e chamada, curto | `planos-light` |
| Fundador falando | o Matheus na câmera, telas por cima | a gravar |

| Trilha (`styles.py`) | Clima | Usada em |
| --- | --- | --- |
| `groove` (padrão, 120 BPM) | energia de tour | Comece aqui, Chuva, Hora do sócio, Antes e depois, Planos, Diário |
| `cinematic` | drama, impacto | Manifesto |
| `lofi` | calma depois do caos | Grupo da obra |
| `quirky` | humor, leveza | Planilha, Quiz |
| `piano` | conta séria | Anatomia de um prejuízo |
| `clock` | tempo passando | Um dia do sócio |
| `foley` | só efeitos, sem música | reservado para "ASMR do sistema" |
| `bed` | fundo para narração | Agentes, explicado |

Tema: claro (padrão), escuro (manifesto, provocativo) ou verde (jogo, convite).

## 2. Vídeos prontos (`docs/marketing/video-v2/renders/`)

| Arquivo | Formato | Pilar | Duração | Gancho do primeiro quadro |
| --- | --- | --- | --- | --- |
| `comece-aqui-light.mp4` | tour | apresentação | 48 s | "Proposta no Word. Controle no Excel. Obra no WhatsApp." |
| `manifesto-dark.mp4` | tipografia cinética | posicionamento | 15 s | "Engenharia" |
| `grupo-da-obra-light.mp4` | simulação | dor nomeada | 20 s | "O grupo da obra às 7h da manhã" |
| `planilha-light.mp4` | simulação + glitch | dor nomeada | 18 s | a planilha de controle se enchendo |
| `anatomia-light.mp4` | prancha técnica | conta aberta | 22 s | "Anatomia de um prejuízo" |
| `dia-do-socio-light.mp4` | linha do tempo | dor nomeada | 22 s | "Um dia do sócio de um escritório de projeto" |
| `quiz-light.mp4` | jogo | engajamento | 15 s | "O que mais tira lucro de um escritório de projeto?" |
| `chuva-dark.mp4` | provocativo | obra e clima | 16 s | "Quem marcou a concretagem para o dia da chuva?" |
| `hora-do-socio-light.mp4` | conta rápida | conta aberta | 22 s | "Quanto custa uma hora do sócio?" |
| `antes-depois-light.mp4` | tela dividida | dor nomeada | 20 s | "O mesmo escritório, antes e depois da Pilar" |
| `diario-light.mp4` | celular do canteiro | na tela | 20 s | "O diário da obra ainda está no WhatsApp?" |
| `planos-light.mp4` | convite em loop | planos | 10 s | "Usuários ilimitados. A plataforma inteira." |
| `agentes-explicado-light.mp4` | tela + narração | na tela | 55 s | **trocar a voz antes de postar** |

### Leva de 10/11 (noite)

| Arquivo | Formato | Pilar | Trilha |
| --- | --- | --- | --- |
| `quiz-2-art-light.mp4` | quiz #2 (fundo azul) | educativo | quirky |
| `quiz-3-revisao-light.mp4` | quiz #3 (fundo areia) | conta aberta | quirky |
| `manifesto-2-gestao-dark.mp4` | manifesto #2: revisão não é favor | posicionamento | cinematic |
| `nao-faz-dark.mp4` | "Não." gigante, os 5 limites | confiança | cinematic |
| `glossario-light.mp4` | verbetes de dicionário | educativo | lofi |
| `novidades-dark.mp4` | novidades da semana (série de sexta) | bastidores | groove |
| `contagem-dark.mp4` | faltam 10 dias (troque o número) | lançamento | cinematic |
| `asmr-light.mp4` | ASMR do escritório, sem música | na tela | foley |
| `comentario-light.mp4` | respondendo comentário | objeção | lofi |
| `mito-fato-light.mp4` | cartões que viram | agentes | quirky |
| `fala-03-ia-nao-aprova-dark.mp4` | **prévia** do vídeo do fundador (sem gravação) | modelo | lofi |

## 3. Posts prontos (`docs/marketing/posts/out/`, prancha em `prancha-posts.jpg`)

| Peça | Slides | Layout | Pilar |
| --- | --- | --- | --- |
| C1 Quanto custa uma hora do sócio | 6 | número grande | conta aberta |
| C2 5 sinais de que o escritório passou da planilha | 7 | lista numerada | dor nomeada |
| C3 Como a IA trabalha na Pilar | 6 | tela real + cartões | na tela |
| C4 Quanto cobrar por um projeto, disciplina por disciplina | 7 | conta | conta aberta |
| C5 4 mitos sobre IA no escritório de engenharia | 6 | tela dividida mito × fato | agentes |
| C6 O que a Pilar não faz | 7 | fundo tinta, "Não." gigante | confiança |
| C7 6 coisas para ter antes de começar um projeto | 4 | checklist para salvar | conta aberta |
| C8 Como pedir um aditivo sem perder o cliente | 7 | passos | conta aberta |
| E1 4× | 1 | número | dor nomeada |
| E2 Quem marcou a concretagem para o dia da chuva? | 1 | pergunta | obra e clima |
| E3 Software de obra é para construtora | 1 | frase | posicionamento |
| E4 A IA prepara. O sistema confere. Você aprova. | 1 | tipografia sobre tinta | agentes |
| E5 Controle_projetos_FINAL_v7 (2) - Cópia.xlsx | 1 | humor, "marque quem tem" | dor nomeada |
| E6 Você sabe a margem de cada disciplina? | 1 | enquete A/B/C nos comentários | engajamento |
| E7 O que mudou na Pilar esta semana (14/11) | 1 | novidades, toda sexta | bastidores |
| E8 A partir de R$ 299 | 1 | preço | planos |
| E9 Gestão de escritório não é só interiores | 1 | frase sobre verde | posicionamento |

**Leva de 10/11 (noite):** carrosséis C9 Honorário (por m², hora ou disciplina), C10 Curva S, C11 Sete
documentos, C12 De 5 para 15 pessoas, C13 Fechar o mês em 30 minutos, C14 As 4 perguntas do cliente,
C15 Carta do fundador (**revisar o texto com o Matheus antes de postar**), C16 Glossário; posts E10
Revisão não é favor, E11 Previsão × cronograma, E12 Frase do fundador, E13 e E14 Dica rápida, E15
Enquete da maior dor, E16 19.01, E17 Por usuário × Pilar (exemplo), E18 Em uma frase.

**Stories** (`docs/marketing/posts/out/stories/`, 1080 × 1920, com espaço para os adesivos):
enquete da margem (3), quiz (2), caixinha "pergunte ao fundador", isso ou aquilo (4), bastidor (2,
com espaço para foto real), contagem 10/7/3/1, novidades, link dos planos.

## 4. Calendário das semanas 6 a 10 (até o lançamento)

As semanas 1 a 5 estão no plano 05. A partir da S6, o ritmo segue 4 posts por semana, com
**sexta fixa de novidades** (o post E7 vira série: atualizar o texto toda semana com o que mudou).

| Semana | Seg (estático) | Ter (Reel) | Qua (carrossel) | Sex (Reel ou novidades) |
| --- | --- | --- | --- | --- |
| **S6** 14/12 | E5 Arquivo FINAL_v7 | **Planilha** | C5 Mitos sobre IA | E7 Novidades |
| **S7** 21/12 | E4 Assinatura | **Manifesto** | C8 Aditivo | **Quiz** |
| **S8** 28/12 (festas) | E6 Enquete da margem | **Um dia do sócio** | C7 Checklist do projeto ("planeje 2027") | E7 Novidades |
| **S9** 04/01 | E9 Engenharia não é só interiores | **Grupo da obra** | C6 O que a Pilar não faz | **Anatomia de um prejuízo** |
| **S10** 11/01 | E8 Preço | Reel do fundador | carrossel "Lançamento: o que vem em 19/01" (a fazer) | **Planos** |
| **T0** 19/01 | post do lançamento (a fazer) | **Comece aqui** renovado | | |

## 5. Ideias para as próximas levas (ainda não produzidas)

**Vídeos**, um conceito novo cada:

1. **ASMR do sistema** (`foley`, sem música): close na tela, cliques e digitação, a proposta virando projeto. Nada de texto por 5 s.
2. **Stop motion de prancheta**: papéis, post-its e carimbos (fotos reais do escritório do Matheus) que somem um a um.
3. **"Respondendo comentário"**: o vídeo abre com um comentário real (autorizado) e responde com a tela.
4. **Contagem regressiva do lançamento** (escuro, `cinematic`): uma frase por dia, de 10/01 a 19/01.
5. **Glossário rápido**: "ART, RRT, aditivo, curva S" em 5 s cada, tipografia cinética.
6. **"Fala, mestre"**: o áudio de um mestre de obras (autorizado) virando o diário na tela.
7. **Mapa de calor do escritório**: a agenda da equipe colorindo por disciplina (dado fictício).
8. **Horizontal 16:9 de 90 s** para YouTube e para a landing, narrado.

**Carrosséis:**

1. Honorário por m² × por hora × por disciplina: qual escolher.
2. Curva S em 5 slides: o que ela mostra e quando se preocupar.
3. Os 7 documentos que todo projeto deveria ter (com o que a Pilar guarda).
4. O que muda no escritório de 5 para 15 pessoas.
5. Como fechar o mês do escritório em 30 minutos.
6. "Benchmark Pilar 2027": resultados da enquete de margem (depois de juntar respostas).

**Estáticos:** frases de cliente (com autorização), "1 número da semana" do produto, bastidor com foto
real do fundador, meme de obra (concretagem x previsão), data do lançamento.

## 6. Como produzir mais

- **Vídeo novo:** copie a composição mais parecida em `docs/marketing/video-v2/src/`, troque o
  conceito e escolha outra trilha em `finalize(..., { style })`. `./make.sh <id> light|dark`.
- **Post novo:** acrescente em `docs/marketing/posts/render-posts.mjs` e rode
  `node docs/marketing/posts/render-posts.mjs <filtro>`.
- **Checar antes de postar:** primeiro quadro com o gancho, nada importante à direita de x=940 na
  metade de baixo nem abaixo de y=1600 (ícones e legenda do Instagram), texto de no mínimo 32 px no
  post, número de exemplo marcado como exemplo, só o que roda em produção.
