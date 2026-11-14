# Kit de lançamento do Instagram (@pilarsoft.app)

Peças em `brand/assets/social/lancamento/`, geradas por `node scripts/brand/render-lancamento.mjs`
(edite o texto no script e rode de novo; `node scripts/brand/render-lancamento.mjs story-planos`
gera só as peças cujo nome contém o filtro). Regras visuais: [social-instagram.md](../social-instagram.md).
Preço e limites espelham `apps/marketing/src/lib/planos.ts` (DECISOES 2026-11-06): se o preço
mudar, atualize o script e gere de novo antes de repostar o destaque Planos.

## 1. Destaques (ordem no perfil)

Capas em verde cheio (o gradiente do ícone `pilar-app-icon-verde`) com um ícone de linha grosso em
Ink no centro, desenhado para ler a 60 px no celular. Comece aqui leva o play (o destaque abre com o
vídeo de apresentação; o símbolo já está na foto do perfil); Planos, o cartão de preço (o card do plano com o que vem nele); Gestão,
a maleta (comercial, contrato e financeiro); Projetos, o esquadro; Obras, o capacete; Agentes, a faísca da IA. A variação disco
sobre papel sai com `DESTAQUE_ESTILO=disco`, mas repete o disco da foto do perfil. Fechamentos (último story e post 06) também são claros, sobre a
paisagem, com o botão em Ink.

### Roteiro dos stories

Cada destaque conta uma história curta, na mesma ordem: **o que é → como aparece na tela → a
dúvida que trava → convite**. Peças `story-<destaque>-<posição>-<assunto>.png`; as posições
marcadas como **vídeo** são os Reels de `docs/marketing/video/renders/` (branch
`docs/marketing-plan-and-videos`), postados direto no story, sem arte. Telas reais com o dado
fictício da empresa de vídeo (Atrium Engenharia), recortes em `lancamento/telas/`.

**Comece aqui** (capa `destaque-comece-aqui.png`, 8 stories)

| #   | Peça                              | O que diz                                           |
| --- | --------------------------------- | --------------------------------------------------- |
| 01  | `story-comece-aqui-01-o-que-e`    | Gestão para escritórios de engenharia e arquitetura |
| 02  | **vídeo** `v02-problemas.mp4`     | Os problemas que a Pilar resolve (40 s)             |
| 03  | `story-comece-aqui-03-para-quem`  | É para / não é para (o filtro do ICP)               |
| 04  | `story-comece-aqui-04-modulos`    | Três módulos, um fluxo                              |
| 05  | `story-comece-aqui-05-inicio`     | Tela de início: a semana já vem resumida            |
| 06  | `story-comece-aqui-06-agentes`    | A IA prepara, o sistema confere, você aprova        |
| 07  | `story-comece-aqui-07-um-sistema` | Pergunta: são três sistemas ou um só?               |
| 08  | `story-comece-aqui-08-planos`     | Convite "Veja os planos" + **adesivo de link**      |

**Planos** (capa `destaque-planos.png`, 6 stories)

| #   | Peça                          | O que diz                                              |
| --- | ----------------------------- | ------------------------------------------------------ |
| 01  | `story-planos-01-tabela`      | Essencial R$ 299, Profissional R$ 499, Escala R$ 899   |
| 02  | `story-planos-02-incluso`     | O que vem em todo plano, sem exceção                   |
| 03  | `story-planos-03-por-usuario` | Pergunta: preciso pagar por usuário? Não               |
| 04  | `story-planos-04-credito`     | Pergunta: o que é um crédito de IA?                    |
| 05  | `story-planos-05-faixa`       | Pergunta: e se eu passar da faixa?                     |
| 06  | `story-planos-06-planos`      | O plano muda quanto, nunca o quê + **adesivo de link** |

**Gestão** (capa `destaque-gestao.png`, 8 stories)

| #   | Peça                         | O que diz                                             |
| --- | ---------------------------- | ----------------------------------------------------- |
| 01  | `story-gestao-01-modulo`     | Do lead ao dinheiro na conta                          |
| 02  | `story-gestao-02-leads`      | Tela do funil: cada lead na sua etapa                 |
| 03  | `story-gestao-03-propostas`  | Tela de propostas: o status de cada uma               |
| 04  | **vídeo** `v03b-fluxo.mp4`   | Da proposta ao projeto, sem redigitar (25 s)          |
| 05  | `story-gestao-05-financeiro` | Tela do financeiro: quanto sobrou este mês            |
| 06  | **vídeo** `v03e-numeros.mp4` | Os números da semana (24 s)                           |
| 07  | `story-gestao-07-enquete`    | **Adesivo de enquete**: "Word", "Planilha", "Sistema" |
| 08  | `story-gestao-08-planos`     | Convite "Veja os planos" + **adesivo de link**        |

**Projetos** (capa `destaque-projetos.png`, 6 stories)

| #   | Peça                            | O que diz                                                 |
| --- | ------------------------------- | --------------------------------------------------------- |
| 01  | `story-projetos-01-modulo`      | Disciplina, prazo e responsável                           |
| 02  | `story-projetos-02-disciplinas` | Tela de disciplinas: cada uma com dono e prazo            |
| 03  | `story-projetos-03-cronograma`  | Tela do cronograma: todos os projetos numa linha do tempo |
| 04  | `story-projetos-04-proximo`     | Concluiu uma disciplina, o próximo já sabe                |
| 05  | `story-projetos-05-enquete`     | **Adesivo de enquete**: "Cobro", "Às vezes", "De graça"   |
| 06  | `story-projetos-06-planos`      | Convite "Veja os planos" + **adesivo de link**            |

**Obras** (capa `destaque-obras.png`, 8 stories)

| #   | Peça                        | O que diz                                               |
| --- | --------------------------- | ------------------------------------------------------- |
| 01  | `story-obras-01-modulo`     | A execução e a conta da obra                            |
| 02  | `story-obras-02-clima`      | Tela da obra: vai chover na concretagem?                |
| 03  | **vídeo** `v03c-clima.mp4`  | O cronograma cruza com a previsão (25 s)                |
| 04  | `story-obras-04-diario`     | Tela do diário: o canteiro conta, o diário chega pronto |
| 05  | **vídeo** `v03d-diario.mp4` | Diário de obra organizado (28 s)                        |
| 06  | `story-obras-06-sem-email`  | Pergunta: meu pessoal de obra não tem e-mail. Funciona? |
| 07  | `story-obras-07-portal`     | Seu cliente acompanha por um link                       |
| 08  | `story-obras-08-planos`     | Convite "Veja os planos" + **adesivo de link**          |

**Agentes** (capa `destaque-agentes.png`, 6 stories)

| #   | Peça                          | O que diz                                                |
| --- | ----------------------------- | -------------------------------------------------------- |
| 01  | `story-agentes-01-principio`  | A IA prepara. Você aprova.                               |
| 02  | **vídeo** `v03a-agentes.mp4`  | O agente monta o aditivo (26 s)                          |
| 03  | `story-agentes-03-pendencias` | Tela de pendências: o aditivo chega montado              |
| 04  | `story-agentes-04-conversar`  | Tela de conversa: pergunte, eles consultam os seus dados |
| 05  | `story-agentes-05-confiar`    | Pergunta: posso confiar no que a IA monta?               |
| 06  | `story-agentes-06-planos`     | Convite "Veja os planos" + **adesivo de link**           |

O vídeo `v01-pilar-em-90s` é horizontal (16:9): vai para o feed ou YouTube, não para story.

### Como montar

1. Publique os stories de um destaque na ordem da tabela (o destaque mostra na ordem em que foram
   postados). Num perfil novo, dá para postar tudo no mesmo dia: o story some em 24 h, o destaque fica.
2. **Adesivo de link** em todo story "planos": a área livre fica entre o texto e o botão. Link da
   página de planos com UTM `utm_source=instagram&utm_medium=story&utm_campaign=destaque-<nome>`
   (convite principal "Veja os planos" desde 08/11; a demonstração fica como alternativa no texto).
3. **Adesivo de enquete** nos stories "enquete", logo abaixo de "Responde aqui embaixo".
   As respostas valem como pesquisa: anote no `voz-do-cliente.md` do `post-automation`.
4. **Vídeos**: suba o MP4 como story; ative as legendas automáticas do Instagram ou cole o `.srt`.
5. Adicione cada story ao destaque e escolha a capa em "Editar destaque › Editar capa".
6. Áreas livres respeitadas em todas as artes: 250 px no topo (perfil e barra) e 340 px na base
   (campo de resposta).

## 2. Os primeiros posts do feed

Frase e convite seguem as decisões de 07/11 (frase principal "Gestão com agentes de IA para
escritórios de engenharia e arquitetura."; "Do contrato à execução" não aparece mais) e 08/11 (o
convite principal é "Veja os planos"; a demonstração é caminho secundário, citada só na legenda).

### Calendário

| Quando           | #   | Peça                                            | Formato        |
| ---------------- | --- | ----------------------------------------------- | -------------- |
| Seg 09/11, manhã | 01  | `post-01-logo.png`                              | foto           |
| Seg 09/11, 12h   | 02  | `post-02-conheca-01` a `-07`                    | carrossel de 7 |
| Seg 09/11, 19h   | 03  | vídeo `v02-problemas` + `post-03-reel-v02-capa` | Reel           |
| Qua 11/11, 12h   | 04  | `post-04-pergunta.png`                          | foto-pergunta  |
| Sex 13/11, 19h   | 05  | vídeo `v03a-agentes` + `post-05-reel-v03a-capa` | Reel           |
| Seg 16/11, 12h   | 06  | `post-06-agentes.png`                           | foto           |

Os três do primeiro dia fecham a primeira linha do perfil, então ninguém chega a um perfil com um
post só. A grade fica assim (o mais novo à esquerda):

```
03 Reel V-02     02 Conheça a Pilar   01 logo (paisagem)
06 agentes       05 Reel V-03a        04 pergunta (croqui)
```

**Vídeos:** use as versões com a tela final nova (logo de três caneluras, frase atual e "Veja os
planos"). No V-02 a última fala, que dizia a frase antiga, saiu do áudio; o resto do áudio é o
original. Telas finais em `reel-fim-v02.png` e `reel-fim-v03a.png`. Os outros vídeos da série
(V-03b a V-03e) ainda têm a tela antiga e, no V-03b, a fala antiga: refaça do mesmo jeito antes de postar.

**Capa do Reel:** ao publicar, em "Editar capa › Adicionar da galeria", use a `post-0X-reel-*-capa.png`.

### Depois da primeira semana (sem arte ainda)

Do plano de canais (`docs/marketing/02-canais-e-calendario.md`, semanas S2 e S3):
Ter 17/11 Reel V-03b (da proposta ao projeto), Qua 18/11 carrossel P-08 (os agentes, um por slide),
Qui 19/11 Reel V-03c (clima), Sex 20/11 post "número" P-10 ("4×", o mesmo valor digitado quatro vezes).

### Legendas

Primeira linha é o gancho (é o que aparece antes de "mais"). Link só na bio. Até 5 hashtags.

**01 · Logo**

> Prazer, Pilar.
>
> Gestão com agentes de IA para escritórios de engenharia e arquitetura.
>
> A IA prepara. O sistema confere. Você aprova.
>
> Nos próximos dias a gente mostra como funciona, tela por tela. Siga para acompanhar.

Alt text: logo da Pilar, uma coluna de três caneluras e o nome Pilar, com a frase "Gestão com agentes de IA para escritórios de engenharia e arquitetura." embaixo, sobre céu claro e morros verdes.

**02 · Carrossel Conheça a Pilar**

> Conheça a Pilar em 7 slides.
>
> Proposta no Word, controle no Excel, obra no WhatsApp. Cada lugar guarda um pedaço do projeto, e o
> mesmo número é digitado de novo em cada um.
>
> A Pilar junta tudo num sistema só: Gestão (do lead ao dinheiro na conta), Projetos (disciplina,
> prazo e responsável) e Obras (a execução e a conta da obra). Por cima, agentes de IA que preparam
> o trabalho repetitivo. Nada grava sem o seu aval.
>
> Planos a partir de R$ 299 por mês, com usuários ilimitados. Link na bio. Prefere ver antes? Responda
> "demo" aqui que a gente marca.
>
> #engenharia #arquitetura #projetoestrutural #gestaodeprojetos #escritoriodeengenharia

Alt text por slide:

1. Capa: "Gestão com agentes de IA para escritórios de engenharia e arquitetura".
2. "Proposta no Word. Controle no Excel. Obra no WhatsApp."
3. Gestão, com a tela de propostas e o status de cada uma.
4. Projetos, com o cronograma de três projetos numa linha do tempo.
5. Obras, com o alerta de chuva sobre a concretagem e o avanço da obra.
6. "A IA prepara. O sistema confere. Você aprova.", com um aditivo esperando aprovação.
7. "Um sistema só, do primeiro contato à obra entregue", planos a partir de R$ 299, botão "Veja os planos".

**03 · Reel V-02 (os problemas)**

> Seu escritório roda em três lugares?
>
> Proposta no Word. Controle no Excel. Obra no WhatsApp. O prejuízo aparece no fim, a concretagem
> cai no dia da chuva e o cliente liga para saber como está.
>
> Na Pilar, o lucro do projeto aparece antes de terminar, a chuva vira aviso no cronograma e o
> aditivo chega pronto para você aprovar.
>
> Planos no link da bio.
>
> #engenharia #arquitetura #gestaodeobras #construcaocivil

**04 · Pergunta**

> Quantas vezes o mesmo número foi digitado esta semana?
>
> O valor sai na proposta, vai para a planilha, entra no financeiro e volta pelo WhatsApp. Quatro
> digitações, quatro chances de erro.
>
> No seu escritório, quantas são? Conta aqui embaixo.
>
> #engenharia #arquitetura #escritoriodeengenharia

Alt text: croqui de quatro caixas ligadas por setas em círculo (proposta, planilha, financeiro e
WhatsApp), com uma cota marcando "4×", e a pergunta "Quantas vezes o mesmo número foi digitado esta semana?".

**05 · Reel V-03a (agentes)**

> O projeto passou do orçamento. O aditivo chegou pronto.
>
> O agente monta o aditivo com o motivo e o valor, tirados das despesas e dos apontamentos do
> projeto. O sistema confere a conta. Nada vai para o cliente sem você aprovar.
>
> A IA prepara. O sistema confere. Você aprova.
>
> #engenharia #arquitetura #inteligenciaartificial #gestaodeprojetos

**06 · Agentes**

> A IA prepara. O sistema confere. Você aprova.
>
> Você conta o que aconteceu, solta o PDF do banco ou fala no canteiro. O agente lança e organiza.
> O sistema acha o projeto, calcula a parcela e confere cada número contra os seus dados.
>
> A conta não é da IA. E nada grava sem o seu aval.
>
> Você confiaria num número que a IA escreveu? Responde aqui.

Alt text: texto "A IA prepara. O sistema confere. Você aprova.", com "Você aprova." destacado em verde.
