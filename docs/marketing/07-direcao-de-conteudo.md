# 07 · Direção de conteúdo: de "feito por IA" para profissional

> Como a Pilar sai do conteúdo que parece gerado (só arte, só tela, nenhum rosto) para o que o
> público reconhece como real. Complementa o plano ([05](./05-plano-de-marketing-2026-11.md)) e o
> banco de conteúdo ([06](./06-banco-de-conteudo.md)). Escrito em 10/11/2026, a pedido do CEO.

## 1. Diagnóstico honesto

O que temos é bem feito, mas tem um teto: **nenhuma peça mostra uma pessoa nem o produto sendo usado
de verdade**. O público de engenharia desconfia de software e confia em gente. O que separa conteúdo
profissional de conteúdo "de IA" não é o acabamento, é a **prova real**:

| Parece gerado | Parece profissional |
| --- | --- |
| Arte, ícone, cartão | Um rosto, uma voz, um lugar real |
| "A Pilar faz X" | "Eu uso assim" / "o cliente fez assim" |
| Número de exemplo | Número real (com autorização) |
| Tela parada com animação | A tela gravada sendo usada, com o dedo e o erro de digitação |
| Mesmo modelo toda semana | Série com nome fixo, mas pauta e formato variando |

## 2. A mistura que vale a partir de agora

| Fatia | Peso | O que é | Quem produz |
| --- | --- | --- | --- |
| **Gente real** | 40% | o Matheus falando; tela do celular gravada usando o app; bastidor com foto real; cliente e canteiro (com autorização) | o Matheus grava, o motor edita |
| **Educativo** | 30% | carrosséis de conta aberta, checklist, glossário | pronto (`docs/marketing/posts/`) |
| **Produto animado** | 20% | os Reels de conceito (manifesto, quiz, planilha, anatomia...) | pronto (`docs/marketing/video-v2/`) |
| **Convite** | 10% | planos, contagem, novidades | pronto |

Regra prática: **toda semana tem pelo menos um vídeo com o rosto do Matheus**. Sem isso, o resto
perde força.

## 3. O vídeo do fundador: grave cru, o motor finaliza

O modelo `src/fala-base.js` pega a gravação do celular e entrega o vídeo pronto: título do gancho,
faixa com nome e cargo, **legenda palavra a palavra**, a tela real da Pilar entrando quando você cita
o produto (a sua gravação vira um quadro no canto), números e listas na hora certa, trilha baixa que
abaixa quando você fala, e o fechamento da marca.

**Doze roteiros prontos** (`src/fala-*.script.json`), de 30 a 50 s cada:

| # | Arquivo | Gancho | Pilar |
| --- | --- | --- | --- |
| 1 | `fala-01-por-que-construo` | Por que eu estou construindo a Pilar | bastidor |
| 2 | `fala-02-por-escritorio` | Por que a Pilar não cobra por usuário | planos |
| 3 | `fala-03-ia-nao-aprova` | A IA da Pilar não aprova nada | agentes |
| 4 | `fala-04-nao-e-interiores` | Engenharia não é interiores | posicionamento |
| 5 | `fala-05-margem-no-fim` | O dia em que a margem apareceu no fim | conta aberta |
| 6 | `fala-06-aditivo-pronto` | O aditivo que chega pronto | na tela |
| 7 | `fala-07-diario-audio` | Diário de obra falado | na tela |
| 8 | `fala-08-o-que-cortei` | Cortei uma funcionalidade que dois clientes pediram | bastidor |
| 9 | `fala-09-ja-uso-planilha` | "Eu já uso planilha. Por que mudar?" | objeção |
| 10 | `fala-10-chuva` | Quem marcou a concretagem para o dia da chuva? | obra e clima |
| 11 | `fala-11-portal-cliente` | O cliente que liga toda semana | na tela |
| 12 | `fala-12-respondendo` | Respondendo: "a IA vai substituir o engenheiro?" | comentário |

Prévia do formato (sem gravação, com o quadro-guia): `renders/fala-03-ia-nao-aprova-dark.mp4`.

**Do celular ao vídeo pronto:**

1. Grave na vertical e salve como `docs/marketing/video-v2/footage/fala-03-ia-nao-aprova.mp4`.
2. Rode `./make.sh fala-03-ia-nao-aprova dark`.
3. O `footage.py` extrai os quadros, trata a voz e **alinha o roteiro à sua fala** pelos silêncios.
   Se você improvisou, ajuste o texto do roteiro e rode de novo.

## 4. O dia de gravação (uma manhã rende um mês)

**Equipamento** (o áudio importa mais que a imagem):

| Item | Por quê | Custo aproximado |
| --- | --- | --- |
| Celular na câmera traseira | qualidade bem maior que a frontal | já tem |
| Microfone de lapela sem fio para celular | voz limpa, sem eco de sala | R$ 100 a 300 |
| Tripé com suporte de celular | imagem parada, enquadramento repetível | R$ 50 a 150 |
| Luz de janela (de frente ou 45°) | pele natural, sem sombra dura | grátis |

**Configuração:** vertical, 1080p ou 4K a 30 quadros, exposição e foco travados no rosto (toque e
segure na tela), modo avião. Enquadramento: olhos na linha de 1/3 de cima, um palmo de ar acima da
cabeça. Fundo: o escritório real (mesa, prancha, monitor), não parede branca.

**Roteiro do dia (3 horas):**

| Bloco | Tempo | O que gravar |
| --- | --- | --- |
| 1 | 60 min | os 12 roteiros de fala, 2 ou 3 tomadas cada, lendo pelo teleprompter |
| 2 | 40 min | **tela do celular gravada** usando a Pilar de verdade: lançar pelo chat do agente, aprovar um aditivo, gravar um diário por áudio, abrir o portal do cliente (gravação de tela nativa do celular, com a conta de demonstração) |
| 3 | 30 min | **cenas de apoio**: mãos no teclado, prancha e escalímetro, a tela do computador com a Pilar aberta, caminhada pelo escritório, café. Sem falar, 10 s cada |
| 4 | 30 min | **fotos** para bastidor e stories: retrato do Matheus, o escritório, a mesa, o caderno de croquis |
| 5 | 20 min | se possível, **uma obra**: 2 min de canteiro, um mestre de obras gravando o áudio do diário (com autorização) |

Teleprompter: use um app gratuito de teleprompter no próprio celular, ou leia de um segundo aparelho
logo acima da lente. Leia devagar, uma fala por respiração, olhando para a lente.

## 5. Formatos com gente real (além do fundador)

| Formato | O que é | Precisa de |
| --- | --- | --- |
| **Depoimento de cliente** | 3 perguntas, 40 s: "como era antes", "o que mudou", "o que você diria a outro escritório" | autorização escrita, 15 min de chamada de vídeo gravada |
| **Um dia no escritório cliente** | 30 s filmando a rotina de um escritório que usa a Pilar | visita e autorização |
| **O áudio do mestre** | o áudio real do diário virando o registro na tela | autorização do mestre de obras e do escritório |
| **Tela de verdade** | gravação de tela do celular, sem edição, com a voz do Matheus por cima | só a conta de demonstração |
| **Respondendo comentário** | pergunta real de seguidor, respondida em vídeo | o comentário (já público) |
| **Ao vivo mensal** | live de 30 min com convidado que ensina precificação ou gestão | um convidado com audiência |

**Texto para pedir autorização** (WhatsApp ou e-mail):

> Oi, [nome]! Estou montando os conteúdos da Pilar e queria muito contar como o [escritório] usa o
> sistema. Seriam 15 minutos de conversa por vídeo, que viram um vídeo curto para o Instagram e o
> LinkedIn. Você aprova a versão final antes de qualquer publicação, e nada de número financeiro
> sai sem o seu ok. Topa?

## 6. Séries com nome fixo (o que faz o perfil parecer editoria, não acaso)

| Série | Dia | Formato | Episódios prontos |
| --- | --- | --- | --- |
| **Conta aberta** | quarta | carrossel | hora do sócio, preço por disciplina, honorário, aditivo, fechar o mês |
| **Novidades da semana** | sexta | Reel + post + story | 14/11 (atualizar toda sexta) |
| **Quiz** | quinzenal | Reel | #1 lucro, #2 ART, #3 revisão |
| **Manifesto** | mensal | Reel | #1 engenharia não é planilha, #2 revisão não é favor |
| **Fala, Matheus** | terça | Reel do fundador | 12 roteiros para gravar |
| **Isso ou aquilo** | stories | enquete | 4 prontos |
| **Contagem** | 10 a 19/01 | Reel + story | modelo pronto (troque o número) |

## 7. Inventário em 10/11/2026

| Tipo | Antes desta leva | Agora | Onde |
| --- | --- | --- | --- |
| Vídeos prontos | 14 | **25** | `docs/marketing/video-v2/renders/` |
| Vídeos do fundador (roteiro + modelo, falta gravar) | 0 | **12** | `docs/marketing/video-v2/src/fala-*` |
| Carrosséis | 8 | **16** | `docs/marketing/posts/out/c*` |
| Posts únicos | 9 | **18** | `docs/marketing/posts/out/e*` |
| Stories | 0 (só o kit dos destaques) | **18** | `docs/marketing/posts/out/stories/` |

Calendário e legendas: [06-banco-de-conteudo.md](./06-banco-de-conteudo.md) (atualizado nesta leva).
