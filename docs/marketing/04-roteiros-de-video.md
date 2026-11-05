# 04 · Roteiros de vídeo e estado da produção

> Roteiros dos vídeos `V-xx` citados no calendário e o estado da produção em 05/11/2026.
> O pipeline (gravação dos takes, montagem em HyperFrames, narração, trilha) está em
> [`video/`](./video/README.md). Os roteiros vivos estão em `video/cuts.mjs`; este arquivo é o
> resumo para leitura.

## Estado em 05/11/2026 (produção interrompida: máquina desligada)

| ID | Vídeo | Formato | Duração | Estado |
|---|---|---|---|---|
| V-01 | Pilar em 90 segundos (explicação completa) | 16:9 | 79 s | montado e revisado em snapshot; **falta renderizar** |
| V-02 | Os problemas que a Pilar resolve | 9:16 | 40 s | **renderizado**: `video/renders/v02-problemas.mp4` + `.srt` |
| V-03a | Funcionalidade: agentes preparam o aditivo | 9:16 | 26 s | montado; falta renderizar |
| V-03b | Funcionalidade: da proposta ao projeto | 9:16 | 25 s | montado; falta renderizar |
| V-03c | Funcionalidade: alerta de clima na obra (base do V-10) | 9:16 | 25 s | montado e revisado; falta renderizar |
| V-03d | Funcionalidade: diário de obra organizado | 9:16 | 28 s | montado; falta renderizar |
| V-03e | Funcionalidade: números da semana | 9:16 | 24 s | montado; falta renderizar |
| V-10 | Clima explicativo | 9:16 | 25 a 40 s | usar o V-03c como corte inicial |
| V-11 | Clima técnico | 16:9 + 9:16 | 60 a 90 s | só roteiro (abaixo) |
| V-12 | Clima provocativo | 9:16 | 15 a 20 s | só roteiro (abaixo) |

Para retomar em outra máquina: seguir `video/README.md` (seed, gravar takes, `node build.mjs all`,
render). Os takes gravados estão em `video/takes/` e podem ser reaproveitados sem regravar.

## Padrões de todos os vídeos

- Tela real do produto com a empresa fictícia **Atrium Engenharia** (seed `video/seed/`); nenhum dado de cliente.
- Narração pt-BR (edge-tts `pt-BR-AntonioNeural`), legenda queimada, trilha original gerada por `music.py`
  (trocar por faixa do catálogo HeyGen depois do `npx hyperframes auth login`, se quiser).
- Movimento conforme `brand/motion.md`: entrada ease-out-expo, pílula verde abre depois do texto, símbolo se
  desenha no fim, quadro final parado.
- Fechamento: símbolo + "Do contrato à execução, num fluxo só." + "Agende uma demonstração" + pilarsoft.com.br.

## V-01 · Pilar em 90 segundos (16:9)

| Cena | Tela | Narração |
|---|---|---|
| 1 | Título: "Proposta no Word. Controle no Excel. Obra no WhatsApp." | Proposta no Word. Controle no Excel. Obra no WhatsApp. |
| 2 | "4×" grande, "o mesmo número" | O mesmo número é digitado quatro vezes. E o prejuízo só aparece quando o projeto acaba. |
| 3 | Fundo tinta: "Do contrato à execução, num fluxo só." | A Pilar leva o dado do contrato à execução, num fluxo só. |
| 4 | Take funil de leads e propostas · selo "01 Comercial" | O lead vira proposta. E a proposta aceita vira projeto, com as disciplinas e as parcelas no financeiro. |
| 5 | Take projetos, zoom na margem bruta -1,5% · "02 Projetos" | Cada projeto mostra a margem enquanto ainda dá para agir. Este aqui já passou do orçamento. |
| 6 | Take Agentes › Pendências, aditivo "pronto para você aprovar" · "03 Agentes" | Então o agente prepara o aditivo, citando as despesas que sustentam cada valor. O sistema confere. Você aprova. |
| 7 | Take obra, alerta "Clima pode atrapalhar 2 etapas" · "04 Obra" | Na obra, o cronograma cruza com a previsão do tempo. Se a concretagem cair num dia de chuva, a Pilar avisa antes. |
| 8 | Take diário com registro organizado · "05 Diário" | Quem está no canteiro registra o dia, e o registro chega organizado ao escritório. O cliente só vê o que você liberar. |
| 9 | Take Início com o resumo da semana · "06 Início" | E toda semana, um resumo do que importa, com cada número conferido. |
| 10 | Fechamento | Pilar. Do contrato à execução, num fluxo só. Agende uma demonstração. |

## V-02 · Os problemas (9:16)

Títulos em sequência: "Proposta no Word. Controle no Excel. Obra no WhatsApp." / "O prejuízo aparece no fim." /
"Concretagem marcada no dia da chuva." / "Cliente ligando para saber como está." Depois três provas de tela:
margem antes do fim, alerta de chuva, aditivo para aprovar. Fecha com a tagline.

## V-03 · Série de funcionalidades (9:16, 20 a 30 s cada)

Estrutura fixa: gancho no topo (até 6 palavras, uma pílula), take com zoom no ponto que importa, legenda, fechamento.

- **a. Agentes:** "O projeto passou do orçamento." → "O agente montou o aditivo." → "O sistema confere. Você aprova."
- **b. Fluxo:** "O lead entra no funil." → "Aceitou? Virou projeto." → "Sem redigitar nada."
- **c. Clima:** "Sua concretagem vai pegar chuva?" → "O cronograma cruza com a previsão." → "Você é avisado antes." Fecha em "Obra não para por surpresa."
- **d. Diário:** "Diário de obra no caderno?" → "O canteiro conta. O registro chega pronto." → "O cliente vê só o que você liberar."
- **e. Números:** "Quanto sobrou este mês?" → "Lucro, receitas e o que falta receber." → "Toda semana, um resumo."

## Clima: três vídeos

Regras do território em [01-posicionamento.md](./01-posicionamento.md) §7. A Pilar **avisa**; quem decide
reprogramar é o responsável. Antes de impulsionar clima com dinheiro, resolver a licença do Open-Meteo.

### V-10 · Explicativo (25 a 40 s)

Ponto de partida: V-03c. Acrescentar um take marcando a tarefa como "sensível a clima" (tipo concretagem) no
cronograma, para mostrar a configuração antes do alerta.

### V-11 · Técnico (60 a 90 s, engenheiro falando com engenheiro)

1. Gancho: "Concretagem, impermeabilização e içamento têm uma coisa em comum: a previsão do tempo decide."
2. Por que concretagem é sensível: água de chuva altera a relação água/cimento da superfície e prejudica o
   acabamento e a cura; a prática é proteger ou adiar com chuva prevista. (Conferir a redação com a NBR 14931
   antes de publicar; citar a norma só com a referência certa.)
3. Impermeabilização: precisa de substrato seco; chuva no dia ou na véspera compromete a aderência.
4. Içamento: limite de vento do equipamento e do plano de rigging; a Pilar usa 50 km/h como corte do alerta.
5. Como a Pilar trata: tarefa marcada com o tipo; cruza a janela da tarefa com a previsão diária do local
   (chuva com 60% ou mais, ou vento de 50 km/h ou mais); o alerta cita tarefa, data e motivo.
6. Fecho: "A decisão continua sua. A surpresa, não." CTA de demonstração.

### V-12 · Provocativo (15 a 20 s)

- Quadro 1 (texto grande, fundo tinta): "Quem marcou a concretagem para o dia da chuva?"
- Quadro 2: "O caminhão-bomba chegou. A chuva também."
- Quadro 3: take do alerta "trovoada com granizo (94%) em 07/11. Reprograme."
- Fecho: "Obra não para por surpresa." + pilarsoft.com.br
