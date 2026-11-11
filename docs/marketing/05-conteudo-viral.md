# 05 · Conteúdo viral (Reels, TikTok, Shorts)

> Linha de vídeo curto feita para alcance: a planta que vira obra e as séries que saem dela.
> Complementa o calendário de [02-canais-e-calendario.md](./02-canais-e-calendario.md) (ocupa o Reel
> de quinta e acrescenta um de domingo) e os roteiros de [04-roteiros-de-video.md](./04-roteiros-de-video.md).
> IDs novos começam em `V-20` para não colidir com `V-01` a `V-12`. Pipeline em [`video/`](./video/README.md).
> Escrito em 10/11/2026, depois da tagline de 07/11 e da landing com planos de 08/11 (`DECISOES.md`).

## 0. Três decisões a tomar antes de publicar

1. **3D na marca.** `brand/imagery.md` e `brand/social-instagram.md` §11 proíbem 3D, perspectiva e
   foto realista. A linha viral só existe com 3D. Proposta: exceção restrita a esta linha, com 3D em
   **estilo maquete** (volumes em Paper `#FCFCFC` e Ink `#1A1A1A`, traço de prancha, um único destaque
   verde `#A4EC86` na etapa ativa, sem textura fotográfica, sem céu de pôr do sol). Foto realista (tipo B)
   fica como teste isolado, não como padrão. O pedido do CEO vale na hora, mas **registrar em `DECISOES.md`**
   e acrescentar a exceção em `brand/imagery.md`, senão o próximo agente vai barrar a peça.
2. **Nunca sugerir que o Pilar lê planta.** `messaging.md` proíbe anunciar leitura de planta. O vídeo
   mostra uma obra se construindo; em nenhum texto, narração ou legenda aparece "o Pilar transforma sua
   planta em 3D" ou parecido. O Pilar entra como o lugar onde o escritório acompanha essa obra, não como
   quem gera a animação.
3. **CTA e TikTok.** CTA da linha: "Planos e demonstração no link da bio" (landing leva aos planos desde
   08/11, demonstração é caminho secundário). TikTok não está no doc 02: entra como **teste de 4 semanas**
   com `utm_source=tiktok`; a presença do ICP lá é hipótese, não dado.

Fora isso, o fechamento dos vídeos do doc 04 ainda usa "Do contrato à execução, num fluxo só.", que saiu
em 07/11. Na linha viral o fechamento é: símbolo + "Gestão com agentes de IA para escritórios de
engenharia e arquitetura." + `pilarsoft.com.br`.

## 1. Por que "planta vira obra" para o scroll

| Mecanismo | O que acontece no vídeo | O que gera |
|---|---|---|
| **Satisfação visual** | cada etapa encaixa no lugar certo, bloco a bloco, sem erro. É o prazer de ver uma coisa ficar pronta | retenção até o fim, replay |
| **Curiosidade de processo** | quase ninguém viu a ordem real de uma obra. "O que vem depois do baldrame?" segura o olho | retenção nos 3 s iniciais |
| **Loop** | o último quadro volta à folha de papel do primeiro. O espectador assiste de novo sem perceber | views repetidas, que a plataforma lê como interesse |
| **Identidade profissional** | engenheiro e arquiteto reconhecem o próprio trabalho e corrigem o detalhe | comentário ("faltou a contraverga") e compartilhamento com colega |
| **Rótulo técnico** | nome de cada etapa na tela transforma entretenimento em referência | salvamento |

O risco do formato: atrair quem quer construir a própria casa (cliente do escritório, não o ICP) e
estudante. Os dois ajudam o alcance, mas não compram. O filtro é a camada técnica: rótulos com o nome
certo, pergunta para quem projeta, e o fechamento falando de escritório. Medir a fatia de comentários
do ICP (seção 5) e corrigir o gancho se ela ficar baixa.

### Como amarrar ao Pilar sem virar anúncio

- **O vídeo é o gancho, o Pilar é o fecho.** Até 85% da duração é obra; o produto aparece nos últimos
  1,5 a 3 s ou só na legenda.
- **Ponte natural:** a obra que se constrói é o que o escritório acompanha. O fecho troca a maquete pela
  tela do Pilar (Atrium Engenharia, dado fictício) mostrando a mesma obra como cronograma, disciplina ou
  diário. Uma frase faz a ponte: "Na obra, cada etapa tem prazo. No escritório, cada etapa tem custo."
- **Duas versões de fim para testar:** (a) loop puro, sem marca no vídeo, Pilar só na legenda; (b) fecho
  com tela do produto e lockup parado 1 s (regra de `motion.md`). Publicar a (a) no TikTok e a (b) no
  Instagram nas 2 primeiras semanas e comparar visita ao perfil por mil de alcance.
- **Nunca** prometer na peça o que é do escritório de engenharia ("sua casa sem erro"); a promessa é sobre
  gestão do escritório.

## 2. As séries

Quem produz: **A** = o agente faz sozinho por código (three.js em Chromium headless + ffmpeg, motion
graphics em HyperFrames, telas reais do seed Atrium, narração edge-tts, legenda queimada, trilha
`music.py`). **B** = precisa de IA de vídeo foto realista (Kling, Veo, Runway) com o prompt pronto daqui.
**C** = precisa de gravação humana.

| ID | Série | Gancho dos 2 s (texto na tela) | Duração | Quem produz |
|---|---|---|---|---|
| V-20 | Planta vira obra, com rótulos | "Da planta à obra em 12 s" | 12 a 15 s | **A** (já renderizado; falta rótulo e fecho) |
| V-21 | Você sabe o nome de cada etapa? | "Você sabe o nome disso?" | 20 a 25 s | **A** |
| V-22 | O erro que encarece a obra | "Esse erro custa caro depois" | 15 a 20 s | **A** |
| V-23 | Planta A ou B | "Mesmo terreno. Qual planta?" | 12 a 15 s | **A** |
| V-24 | Ache o erro em 5 s | "Tem um erro nesta planta" | 10 a 12 s | **A** |
| V-25 | Raio-X da parede | "O que tem dentro da parede" | 12 a 15 s | **A** |
| V-26 | A obra em disciplinas | "Uma casa. Cinco projetos." | 15 a 20 s | **A** |
| V-27 | Quanto sobrou deste projeto | "A obra ficou pronta. E o lucro?" | 20 a 25 s | **A** |
| V-28 | "Só uma mudancinha" | "Cliente: só mover essa parede" | 12 a 15 s | **A** |
| V-29 | ASMR de prancha | (sem texto, só o traço começando) | 10 a 15 s | **A** |
| V-30 | Concretagem e chuva | "Concretagem marcada. Olha o céu." | 12 a 15 s | **A** |
| V-31 | Do croqui à foto | "Croqui, maquete, foto." | 10 a 12 s | **B** |
| V-32 | Responde o comentário | print do comentário de alguém | 30 a 45 s | **C** |
| V-33 | Na obra e no cronograma | "Na obra e no cronograma." | 13 s | **A** |
| V-34 | Telhado ou laje? | "Mesma casa. Qual cobertura?" | 11 s | **A** |

Onze das treze são tipo A. A prioridade de produção segue a ordem da tabela.

### V-20 · Planta vira obra, com rótulos

- **Estrutura:** 0 a 1 s planta impressa na mesa, câmera parada · 1 a 11 s a obra sobe sobre a folha, cada
  etapa com rótulo no canto (baldrame, arranque dos pilares, pilares, alvenaria, verga, contraverga, cinta
  de amarração, laje ou forro, oitão, tesoura, terça, telhado, reboco, esquadrias) · 11 a 13 s luzes
  acendem · 13 a 15 s versão (b): corte para a tela do cronograma da obra no Pilar com as mesmas etapas.
- **Por que engaja:** satisfação + rótulo vira referência (salvar) + engenheiro corrige ordem (comentar).
- **Ligação:** "cada etapa tem prazo e custo"; o fecho mostra a obra como cronograma.
- **Produção:** o render atual já tem baldrame, armaduras, pilares, alvenaria, vigas, reboco, esquadrias,
  tesouras, telhado. Acrescentar geometria de verga, contraverga, cinta, oitão e terça, e o rótulo
  (Geist 500, plaquinha Ink 80%, uma pílula verde só na etapa ativa). Revisão técnica da ordem pelo
  fundador antes de publicar.

### V-21 · Você sabe o nome de cada etapa? (série de quiz)

- **Estrutura:** 0 a 2 s gancho · cada etapa aparece destacada em verde, com "?" por 1,5 s, depois o nome ·
  6 a 8 etapas · último quadro: "Quantas você acertou? Comenta o número."
- **Por que engaja:** comentário com número (barato de responder), salvamento como glossário, desafio
  compartilhado com colega. Rende episódios: fundação, estrutura, cobertura, instalações, acabamento.
- **Ligação:** legenda fecha em "No Pilar, a obra vira cronograma com essas etapas."
- **Produção:** mesmo gerador do V-20, com pausas e câmera que aproxima da peça.

### V-22 · O erro que encarece a obra

- **Estrutura:** 0 a 2 s gancho · 2 a 7 s a parede sobe sem contraverga · 7 a 10 s avanço de tempo e
  fissura a 45° nascendo no canto da janela · 10 a 14 s volta, contraverga entra em verde · 14 a 17 s
  "Corrigir no projeto custa uma linha. Na obra, custa um aditivo." Outros episódios: falta de
  impermeabilização do baldrame (umidade subindo), pilar fora de prumo, caimento de telhado errado.
- **Por que engaja:** medo de erro e utilidade direta (salvar, mandar para o mestre de obras).
- **Ligação:** a palavra "aditivo" leva ao agente que prepara o aditivo (pilar 1), citado na legenda.
- **Cuidado:** cada causa e efeito revisados pelo fundador; sem citar norma sem a referência certa.

### V-23 · Planta A ou B

- **Estrutura:** 0 a 2 s gancho com duas plantas lado a lado · 2 a 10 s as duas sobem em 3D ao mesmo
  tempo (uma integrada, uma compartimentada) · 10 a 12 s "A ou B? Comenta."
- **Por que engaja:** opinião é o comentário mais fácil que existe; arquiteto defende partido.
- **Ligação:** legenda: "Quem perde mais horas na revisão da planta: você ou o cliente?" e o portal do
  cliente como ponte (o cliente acompanha sem ligar).

### V-24 · Ache o erro em 5 s

- **Estrutura:** 0 a 1 s planta parada · 1 a 6 s contagem de 5 s na barra · 6 a 9 s a câmera mergulha no
  erro (porta batendo na bancada, escada sem patamar, banheiro abrindo para a cozinha) · 9 a 11 s "Achou?"
- **Por que engaja:** desafio curto, replay para achar, comentário com a resposta.
- **Ligação:** só na legenda; peça de alcance puro. Ótima para o domingo.

### V-25 · Raio-X da parede

- **Estrutura:** 0 a 2 s parede pronta e rebocada · 2 a 12 s um plano de corte atravessa e revela as
  camadas: bloco, eletroduto, tubulação de água fria e esgoto, ponto de ar-condicionado, armadura da
  viga · 12 a 15 s cada sistema ganha o nome da disciplina.
- **Por que engaja:** o "por dentro" é tão satisfatório quanto a construção; MEP raramente aparece.
- **Ligação:** "Cada camada é uma disciplina. Cada disciplina é um escopo com prazo." Fala direto com
  escritório de MEP/HVAC.

### V-26 · A obra em disciplinas

- **Estrutura:** 0 a 2 s gancho · 2 a 14 s a casa monta por camada de disciplina (arquitetura, estrutural,
  hidrossanitário, elétrico, HVAC), cada uma acende em verde na vez dela · 14 a 20 s corte para o projeto
  no Pilar (Atrium) com as mesmas disciplinas, cada uma com etapa, prazo e parcela.
- **Por que engaja:** escritório multidisciplinar se reconhece; compartilha com o sócio.
- **Ligação:** é a mais forte da lista. A proposta aceita vira projeto com as disciplinas e as parcelas
  (pilar 2), mostrado na tela real.

### V-27 · Quanto sobrou deste projeto (bastidor de número)

- **Estrutura:** 0 a 2 s gancho com a casa pronta · 2 a 16 s a obra rebobina e, a cada "mudança pedida",
  um contador de horas sobe ao lado · 16 a 22 s corte para a margem do projeto no Pilar caindo abaixo do
  orçado e o agente com o rascunho de aditivo "pronto para você aprovar" · 22 a 25 s "A IA prepara. O
  sistema confere. Você aprova."
- **Por que engaja:** dor real do sócio (prejuízo descoberto no fim); compartilha com o sócio.
- **Ligação:** pilar 4 e pilar 1 numa peça. Legenda e tela marcadas "dados de exemplo".

### V-28 · "Só uma mudancinha" (humor de escritório)

- **Estrutura:** 0 a 2 s balão de mensagem de cliente sobre a obra pronta · 2 a 8 s a casa se desmonta
  até a parede e remonta · 8 a 11 s o balão seguinte: "e a janela, dá pra aumentar?" · 11 a 14 s
  "Escopo mudou. Isso tem nome: aditivo."
- **Por que engaja:** todo escritório tem esse cliente; marcação de colega nos comentários.
- **Ligação:** aditivo preparado pelo agente, citando o que mudou. Sem ridicularizar cliente; o alvo é
  a situação.

### V-29 · ASMR de prancha

- **Estrutura:** traço de croqui se desenhando em Ink: eixos, paredes, cotas com tique, hachura, carimbo
  da prancha. Som de lapiseira e papel sintetizado. Último quadro: o carimbo traz "Pilar" no campo do
  escritório.
- **Por que engaja:** o mesmo prazer do V-20 em linguagem 100% da marca (plana, Paper e Ink). Loop natural.
- **Ligação:** marca pura, sem venda. Serve de respiro na grade e de capa coerente com o feed.

### V-30 · Concretagem e chuva

- **Estrutura:** 0 a 2 s laje armada, caminhão-bomba posicionado, nuvem entrando no quadro · 2 a 9 s
  timelapse do céu fechando · 9 a 13 s corte para o alerta do Pilar "chuva provável na janela da
  concretagem" · 13 a 15 s "O Pilar avisa. Quem decide é você."
- **Por que engaja:** dor conhecida de todo responsável de obra; tensão visual.
- **Ligação:** pilar 3, território do clima (doc 01 §7). Não dizer "prevê o tempo" nem "evita atraso".
  Orgânico só: não impulsionar até resolver a licença do Open-Meteo.

### V-31 · Do croqui à foto (tipo B)

- **Estrutura:** 0 a 3 s croqui em traço · 3 a 6 s maquete branca · 6 a 10 s casa foto realista ao
  entardecer, câmera em travelling lento · 10 a 12 s volta ao croqui (loop).
- **Prompt (Kling, Veo ou Runway), duas tomadas encadeadas, sem texto na imagem:**

```text
Shot 1, 5 seconds, vertical 9:16. Top-down camera slowly tilting to a 30 degree angle over a white
architectural paper sheet on a light wood desk. A clean white physical scale model of a single-storey
modern house with a gable roof rises from the floor plan drawn on the sheet, walls extruding from the
plan lines in one continuous motion. Soft daylight from a window, neutral colors, no people, no text,
no logos, no lens flare.

Shot 2, 5 seconds, vertical 9:16, continuing from shot 1. The white scale model transitions into a
photorealistic real house at golden hour, same angle and composition: exposed concrete and white
plaster walls, timber frames, clay roof tiles, small garden with native plants, interior lights turning
on one by one. Slow dolly-in, stable camera, realistic proportions, no people, no text, no watermark.
```

- **Cuidado:** IA de vídeo erra proporção e estrutura (telhado sem apoio, janela flutuando). Conferir
  quadro a quadro; se algo for tecnicamente errado, o público técnico vai apontar e a marca perde.

### V-32 · Responde o comentário (tipo C)

- **Estrutura:** print do comentário mais técnico da semana (sem nome ou foto da pessoa sem permissão) ·
  fundador em câmera, 30 a 40 s, responde com a conta ou o detalhe · fecha em "Manda a próxima."
- **Por que engaja:** recompensa quem comenta e gera mais comentário; dá rosto ao fundador (doc 02:
  LinkedIn pessoal é prioridade 1, reaproveita lá).
- **Gravação:** celular na vertical, luz de janela, 1 take. Legenda queimada pelo pipeline.

## 3. Calendário de 4 semanas (16/11 a 13/12)

Ritmo realista para fundador solo: **2 vídeos virais por semana**, o mesmo arquivo publicado no
Instagram, TikTok e YouTube Shorts no mesmo dia. Quinta 19h (slot de Reel do doc 02) e domingo 18h
(hipótese de horário; trocar pelo do relatório do `post-automation` depois de 4 semanas). Os Reels de
terça (V-03) seguem como no doc 02. Produção em lote na segunda: 2 renders por semana.

| Semana | Tema do doc 02 | Qui 19h (IG + TikTok + Shorts) | Dom 18h (IG + TikTok + Shorts) | Reaproveitamento |
|---|---|---|---|---|
| **S2** 16/11 | o dado redigitado | 19/11 · **V-20** planta vira obra com rótulos | 22/11 · **V-21** quiz ep. 1 (fundação e estrutura) | frames do V-20 viram carrossel "nome de cada etapa" no feed de quarta da S3 |
| **S3** 23/11 | agentes que trabalham | 26/11 · **V-28** "só uma mudancinha" | 29/11 · **V-24** ache o erro | V-28 no LinkedIn pessoal com texto sobre aditivo (P-17) |
| **S4** 30/11 | um fluxo só | 03/12 · **V-26** obra em disciplinas | 06/12 · **V-21** quiz ep. 2 (cobertura) | V-26 corte 16:9 no LinkedIn e YouTube |
| **S5** 07/12 | canteiro e clima | 10/12 · **V-30** concretagem e chuva | 13/12 · **V-22** o erro que encarece (contraverga) | V-30 entra junto do V-10 da semana |

Reserva (se um vídeo atrasar ou se um formato estourar e pedir sequência): V-25, V-23, V-27, V-29.
V-31 e V-32 entram depois da S5, conforme o resultado: V-31 só se o 3D maquete perder para a foto
realista no teste; V-32 assim que houver um comentário técnico bom para responder.

Regra de corte: depois de 2 episódios, série com visita ao perfil por mil de alcance abaixo da mediana
da linha sai da grade; a de maior resultado ganha episódio extra na semana seguinte.

## 4. Legendas prontas dos 3 primeiros posts

Link na bio com UTM por post (o Instagram não tem link no corpo). TikTok: mesma legenda, link no perfil.
Shorts: link na descrição do canal. Comentário-palavra: quem comenta a palavra recebe o material por
DM, **enviada à mão pelo fundador** (rascunho pronto; nada sai automático).

### Post 1 · V-20 planta vira obra (quinta 19/11)

Texto na capa: "Da planta à obra em 12 s" (pílula em *obra*).

```text
Da planta à obra em 12 segundos.

Baldrame, pilares, alvenaria, verga, contraverga, cinta, oitão, tesoura, terça, telhado. Cada etapa
com o nome certo na tela.

Faltou alguma? Comenta qual, quem projeta sabe.

Na obra, cada etapa tem prazo. No escritório, cada etapa tem custo. O Pilar é gestão com agentes de
IA para escritórios de engenharia e arquitetura: o cronograma da obra e o custo do projeto no mesmo
lugar.

Comenta ETAPAS que eu mando a lista com o nome de cada uma.
Planos e demonstração no link da bio.

#engenharia #arquitetura #engenhariacivil #obra #projetoestrutural
```

UTM do link da bio: `?utm_source=instagram&utm_medium=bio&utm_campaign=viral-planta&utm_content=v-20`
(no TikTok, `utm_source=tiktok`; no Shorts, `utm_source=youtube`).

Alt text: "Animação de uma casa térrea sendo construída sobre uma planta impressa, etapa por etapa, com
o nome técnico de cada etapa escrito na tela."

Rascunho da DM para quem comentar ETAPAS: "Oi, {nome}. Segue a lista com as etapas do vídeo, na ordem:
{link do PDF}. Se você toca escritório de projeto, o Pilar organiza obra, projeto e financeiro num lugar
só. Os planos estão em pilarsoft.com.br." (link com `utm_medium=dm&utm_content=v-20`).

### Post 2 · V-21 quiz ep. 1 (domingo 22/11)

Texto na capa: "Você sabe o nome disso?" (pílula em *nome*).

```text
Oito peças de uma obra. Você sabe o nome de cada uma?

O vídeo pausa antes da resposta. Conta quantas acertou e deixa o número aqui embaixo.

Dica: a terceira derruba muita gente que já é formada.

Salva para mostrar para o estagiário.

Planos do Pilar, gestão com agentes de IA para escritórios de engenharia e arquitetura, no link da bio.

#engenharia #engenhariacivil #arquitetura #estudantedeengenharia #obra
```

UTM: `utm_campaign=viral-quiz&utm_content=v-21-ep1`.
Alt text: "Animação de obra em que cada peça estrutural fica verde com um ponto de interrogação antes de
o nome aparecer: baldrame, arranque, pilar, viga, verga, contraverga, cinta de amarração, laje."

### Post 3 · V-28 "só uma mudancinha" (quinta 26/11)

Texto na capa: "Cliente: só mover essa parede" (pílula em *parede*).

```text
"É só mover essa parede."

A parede move. A viga muda. O elétrico muda. O hidráulico muda. A prancha volta para revisão.

Escopo mudou. Isso tem nome: aditivo.

No Pilar, o agente prepara o rascunho do aditivo com o que mudou e o quanto custou. O sistema confere
cada número. Você aprova antes de ir para o cliente.

Marca aqui o colega que já ouviu essa frase esta semana.
Planos e demonstração no link da bio.

#arquitetura #engenharia #escritoriodearquitetura #gestaodeprojetos #projetoestrutural
```

UTM: `utm_campaign=viral-humor&utm_content=v-28`.
Alt text: "Animação de uma casa pronta que se desmonta e remonta quando aparece a mensagem de cliente
pedindo para mover uma parede; termina com a palavra aditivo."

## 5. Métricas: o que decide se a série fica

Vale a régua do doc 02 §6: **demonstração agendada** e, depois do T0, **cadastro ativado** (cadastrou e
criou o primeiro projeto). Vídeo viral é topo de funil; ele ganha a vaga se levar gente do ICP até o
perfil e o link, não se só juntar curtida.

| Etapa | Métrica | Onde ler | Para que serve |
|---|---|---|---|
| Atenção | retenção média e % que assiste até o fim; replays | Insights do Reel, TikTok Studio, YouTube Studio | decide o gancho e a duração |
| Engajamento útil | salvamentos + compartilhamentos por mil de alcance | idem | decide se o formato vira série |
| Qualidade do público | % de comentários de quem é do ICP (engenheiro, arquiteto, escritório) | leitura manual dos comentários, 15 min por dia | filtro contra viral de leigo |
| Intenção | visitas ao perfil e cliques no link por mil de alcance; comentários-palavra | Insights + UTM na landing | **métrica que decide** o formato |
| Conversa | DMs de pessoas do ICP | caixa do Instagram e TikTok | rascunho de resposta, fundador envia |
| Conversão | demonstrações agendadas e checkouts com `utm_campaign=viral-*`; resposta "rede social" no "Como você conheceu o Pilar?" (SPEC 149) | funil por UTM do Pilar | resultado da linha |

Metas iniciais são hipótese até ter linha de base: as 4 semanas da seção 3 servem para medir. Não há
dado de mercado na pasta `research/` sobre desempenho de Reels ou TikTok para AEC; qualquer número de
referência que aparecer aqui depois precisa da fonte.

Regras de leitura:

1. Um vídeo com alcance alto e visita ao perfil baixa não ganha sequência, ganha gancho novo.
2. Comparar a versão (a) loop puro com a (b) fecho com tela do produto pela visita ao perfil por mil de
   alcance, não pelo alcance.
3. Pago só depois: o vídeo viral com melhor visita ao perfil por mil e público do ICP nos comentários é
   candidato a impulso no fim da fase B (doc 02 §8), medido por custo por demonstração agendada. Clima
   (V-30) fica fora do pago até a licença do Open-Meteo.
4. TikTok fica no plano depois das 4 semanas só se trouxer pelo menos uma conversa de escritório; se não,
   volta a ser só espelho, sem esforço próprio.

## 6. Produzido (11/11/2026)

Arquivos gerados pelo kit em [`video/reels-kit/`](./video/reels-kit/README.md) e pelo gerador 3D em
[`video/planta-vira-casa/`](./video/planta-vira-casa/README.md). Os MP4 ficam fora do repo (peso); o código gera de novo.

| ID | Vídeo | Duração | Observação |
|---|---|---|---|
| V-20 | Planta vira casa (9:16, 16:9, sem texto e em loop) | 12,6 s / 14,5 s | revisão técnica da ordem antes de publicar |
| V-21 | Quiz "Você sabe o nome disso?" | 27,7 s | 8 peças |
| V-24 | Ache o erro em 5 s | 15 s | porta do banheiro bate no vaso |
| V-26 | Uma casa. Cinco projetos. (raio-X) | 17,3 s | arquitetura, estrutural, elétrico, hidráulico, sanitário |
| V-27 | O projeto acabou. E o lucro? | 18,2 s | números da empresa fictícia, com "dados de exemplo" |
| V-28 | Só uma mudancinha | 19 s | humor + aditivo real |
| V-30 | Concretagem e chuva | 15,2 s | o Pilar avisa; quem reprograma é o responsável |
| V-33 | Na obra e no cronograma | 13,4 s | 3D sincronizado com o cronograma real |
| V-34 | Telhado ou laje? | 11 s | enquete nos comentários |
| Carrossel | Glossário da obra | 7 slides | baldrame, verga, contraverga, cinta, tesoura |
| Capas | Uma por Reel | 1080 × 1920 | essencial no centro 3:4 |

