#!/usr/bin/env python3
"""
Monta a biblioteca de conteúdo pronta para postar (docs/marketing/conteudo/).

Cada peça ganha uma pasta com a mídia final e o `legenda.md` (legenda pronta para colar, primeira
comentário, onde e quando postar). As pastas de geração (`posts/out/`, `video-v2/renders/`) ficam fora
do Git; a cópia versionada é esta.

    python3 docs/marketing/conteudo/organizar.py

Rode de novo depois de gerar ou refazer qualquer peça: ele copia as mídias, atualiza as legendas e
o índice (README.md). Legenda nova ou ajuste de texto: edite este arquivo.

Regras de legenda (brand/voice-tone.md e 05-plano-de-marketing): a primeira linha é o gancho (é o que
aparece antes do "mais"), link só na bio, até 5 hashtags, sem travessão, número de exemplo dito como
exemplo, só o que roda em produção.
"""
import json
import shutil
import subprocess
from pathlib import Path

AQUI = Path(__file__).resolve().parent
MKT = AQUI.parent
RENDERS = MKT / "video-v2" / "renders"
SRC = MKT / "video-v2" / "src"
OUT = MKT / "posts" / "out"

H_ESC = "#engenharia #arquitetura #escritoriodeengenharia #gestaodeprojetos #engenhariacivil"
H_OBRA = "#engenhariacivil #obra #gestaodeobras #diariodeobra #engenharia"
H_ARQ = "#arquitetura #escritoriodearquitetura #gestaodeprojetos #projetos #engenharia"
H_IA = "#inteligenciaartificial #engenharia #arquitetura #gestaodeprojetos #escritoriodeengenharia"
CTA = "Veja os planos · link na bio."

# ----------------------------------------------------------------------------------------------
# REELS: arquivo em video-v2/renders/, legenda, pilar, observação
# ----------------------------------------------------------------------------------------------
REELS = [
    dict(slug="01-comece-aqui", arquivos=["comece-aqui-light.mp4", ("comece-aqui-dark.mp4", "variacao-escura.mp4"), ("comece-aqui-light-capa.jpg", "capa.jpg"), ("comece-aqui-dark-capa.jpg", "capa-variacao-escura.jpg")],
         titulo="Comece aqui (apresentação)", pilar="apresentação", voz=True,
         uso="Fixar no perfil e usar na landing. 48 s é longo para quem não conhece: não é peça de alcance.",
         legenda=f"""O mesmo número, digitado quatro vezes.

Proposta no Word, controle no Excel, obra no WhatsApp. A Pilar junta comercial, projetos, obras e financeiro num sistema só, com agentes de IA que preparam o trabalho repetitivo. Você aprova.

Planos a partir de R$ 299/mês, usuários ilimitados. Link na bio.

{H_ESC}"""),
    dict(slug="02-agentes-explicado", arquivos=["agentes-explicado-light.mp4"], titulo="Agentes, explicado", pilar="na tela", voz=True,
         legenda="""A Pilar faz o preparo. Você aprova.

Você conta o que aconteceu, a Pilar monta o lançamento, o sistema confere a conta e nada grava sem o seu ok. Vale para o aditivo e para o resumo da semana.

Comente PLANOS que eu te mando o link.

""" + H_IA),
    dict(slug="03-hora-do-socio", arquivos=["hora-do-socio-light.mp4"], titulo="Quanto custa uma hora do sócio?", pilar="conta aberta", voz=True,
         legenda=f"""Quanto custa uma hora do sócio? (números de exemplo, troque pelos seus)

R$ 24.000 por mês ÷ 140 horas produtivas = R$ 171 por hora. Seis horas por semana em retrabalho são R$ 4.400 por mês. Devolver duas já paga o sistema.

Salve para fazer a sua conta.

{H_ESC}"""),
    dict(slug="04-anatomia-de-um-prejuizo", arquivos=["anatomia-light.mp4"], titulo="Anatomia de um prejuízo", pilar="conta aberta", voz=True,
         legenda=f"""Anatomia de um prejuízo (projeto de exemplo).

Orçado em 420 horas. Uma revisão aqui, um ajuste ali, e o projeto fechou em 550. São 130 horas que ninguém cobrou, e a margem caiu de 25% para 6%.

O problema não é a revisão. É descobrir no fim. Na Pilar, a hora real aparece durante o projeto.

Salve para mostrar ao sócio.

{H_ESC}"""),
    dict(slug="05-antes-e-depois", arquivos=["antes-depois-light.mp4"], titulo="Antes e depois da Pilar", pilar="dor nomeada", voz=True,
         legenda=f"""O mesmo escritório, antes e depois da Pilar.

Proposta, lucro do projeto, diário de obra, cliente e aditivo: cinco coisas que hoje vivem em cinco lugares. Qual delas mais te custa hora? Comenta aqui.

{H_ESC}"""),
    dict(slug="06-um-dia-do-socio", arquivos=["dia-do-socio-light.mp4"], titulo="Um dia do sócio", pilar="dor nomeada", voz=True,
         legenda=f"""Um dia do sócio de um escritório de projeto.

Reunião, planilha, cobrança, grupo da obra. No fim do dia, uma hora de engenharia. O resto foi administrar.

Quantas horas de projeto você fez hoje? Responde com um número.

{H_ESC}"""),
    dict(slug="07-diario-da-obra", arquivos=["diario-light.mp4"], titulo="Diário da obra por áudio", pilar="na tela", voz=True,
         legenda=f"""O diário da obra ainda está no grupo do WhatsApp?

Quem está no canteiro fala, a Pilar organiza o registro do dia: o que avançou, o que ficou pendente, o efetivo e o clima. Ele nasce interno e só vai ao cliente quando você liberar.

{H_OBRA}"""),
    dict(slug="08-grupo-da-obra", arquivos=["grupo-da-obra-light.mp4"], titulo="O grupo da obra às 7h", pilar="dor nomeada", voz=True,
         legenda=f"""O grupo da obra, às sete da manhã.

Foto, áudio, pergunta do cliente e aviso de material, tudo na mesma conversa. Na Pilar, cada recado já tem lugar: diário, pendência ou cliente.

Marca aquele grupo que não para.

{H_OBRA}"""),
    dict(slug="09-planilha", arquivos=["planilha-light.mp4"], titulo="Qual versão é a certa?", pilar="dor nomeada", voz=True,
         legenda=f"""Controle_projetos_FINAL_v7 (2) - Cópia.xlsx

Qual versão é a certa? Na Pilar é uma só, com a margem de cada projeto na tela de todo mundo.

Marque quem tem uma dessas no computador.

{H_ESC}"""),
    dict(slug="10-chuva", arquivos=["chuva-dark.mp4"], titulo="Quem marcou a concretagem para o dia da chuva?", pilar="obra e clima", voz=True,
         uso="Antes de impulsionar: confirmar a licença comercial da previsão do tempo (plano 05, tarefa 6).",
         legenda=f"""Quem marcou a concretagem para o dia da chuva?

Marque a tarefa como sensível ao clima. A Pilar cruza o cronograma com a previsão do local da obra e avisa antes, com o motivo. Quem decide reprogramar é você.

{H_OBRA}"""),
    dict(slug="11-o-que-a-pilar-nao-faz", arquivos=["nao-faz-dark.mp4"], titulo="O que a Pilar não faz", pilar="confiança", voz=True,
         legenda=f"""O que a Pilar não faz.

Não aprova por você. Não manda nada ao cliente sem o seu ok. Não inventa número. Não assina a sua ART. E não cobra por usuário.

A IA prepara. O sistema confere. Você aprova.

{H_IA}"""),
    dict(slug="12-glossario", arquivos=["glossario-light.mp4"], titulo="Glossário do escritório de projeto", pilar="educativo", voz=True,
         legenda=f"""Glossário do escritório de projeto: ART, RRT, aditivo, curva S e margem em 15 segundos.

Salve e mande para o estagiário.

{H_ARQ}"""),
    dict(slug="13-mito-ou-fato", arquivos=["mito-fato-light.mp4"], titulo="IA no escritório: mito ou fato?", pilar="agentes", voz=True,
         legenda=f"""IA no escritório: mito ou fato?

Ela não decide pelo engenheiro, não inventa número e não é coisa de escritório grande. Na Pilar, a IA prepara, o sistema confere a conta e você aprova.

Qual outro mito você já ouviu? Comenta aqui.

{H_IA}"""),
    dict(slug="14-respondendo-comentario", arquivos=["comentario-light.mp4"], titulo="Funciona para escritório pequeno?", pilar="objeção", voz=True,
         uso="Troque o comentário do vídeo por um comentário real (público) quando houver.",
         legenda=f""""Isso funciona para escritório pequeno? Aqui somos quatro."

Funciona, e foi pensada para começar pequeno. Usuários ilimitados em todo plano: os quatro entram, e o próximo também. O Essencial custa R$ 299/mês, com até 10 projetos e 2 obras.

Tem uma pergunta? Comenta que a gente responde em vídeo.

{H_ESC}"""),
    dict(slug="15-planos", arquivos=["planos-light.mp4"], titulo="Planos", pilar="planos", voz=True,
         legenda=f"""Usuários ilimitados. A plataforma inteira. Em todo plano.

Essencial R$ 299, Profissional R$ 499, Escala R$ 899 por mês. O plano muda quanto, nunca o quê.

{CTA}"""),
    dict(slug="16-manifesto-engenharia-nao-e-planilha", arquivos=["manifesto-dark.mp4"], titulo="Manifesto #1", pilar="posicionamento", voz=False,
         legenda=f"""Engenharia não é planilha. Projeto não é WhatsApp. Lucro não é sorte.

É método. É sistema.

Gestão com agentes de IA para escritórios de engenharia e arquitetura.

{H_ESC}"""),
    dict(slug="17-manifesto-revisao-nao-e-favor", arquivos=["manifesto-2-gestao-dark.mp4"], titulo="Manifesto #2", pilar="posicionamento", voz=False,
         legenda=f"""Revisão não é favor. Aditivo não é vergonha. Prazo não é chute.

É combinado. É gestão.

Manda para quem ainda faz revisão de graça.

{H_ESC}"""),
    dict(slug="18-quiz-1-lucro", arquivos=["quiz-light.mp4"], titulo="Quiz #1: o que mais tira lucro?", pilar="engajamento", voz=False,
         legenda=f"""O que mais tira lucro de um escritório de projeto? A, B ou C?

Responde antes de ver o fim. A resposta está no vídeo, e o café pode ficar.

{H_ESC}"""),
    dict(slug="19-quiz-2-art", arquivos=["quiz-2-art-light.mp4"], titulo="Quiz #2: antes de começar o projeto", pilar="educativo", voz=False,
         legenda=f"""O que precisa estar registrado antes de começar um projeto? A, B ou C?

ART no CREA para engenharia, RRT no CAU para arquitetura. Comenta a sua letra antes de ver a resposta.

{H_ARQ}"""),
    dict(slug="20-quiz-3-revisao", arquivos=["quiz-3-revisao-light.mp4"], titulo="Quiz #3: revisão fora do escopo", pilar="conta aberta", voz=False,
         legenda=f"""O cliente pediu uma revisão fora do escopo. Qual é o primeiro passo?

Pedido registrado e hora estimada viram aditivo com base. Depois de feito, vira briga. Comenta a sua letra.

{H_ESC}"""),
    dict(slug="21-asmr-do-escritorio", arquivos=["asmr-light.mp4"], titulo="ASMR do escritório organizado", pilar="na tela", voz=False,
         uso="Sem música: peça para ouvir com som.",
         legenda=f"""Com som. 🎧

Uma proposta virando projeto, sem planilha no meio.

{H_ESC}"""),
    dict(slug="22-novidades-da-semana", arquivos=["novidades-dark.mp4"], titulo="Novidades da semana (série de sexta)", pilar="bastidores", voz=False,
         uso="Série semanal: atualizar os itens em video-v2/src/novidades.js e esta legenda toda sexta.",
         legenda=f"""O que mudou na Pilar esta semana.

[liste aqui as 3 ou 4 novidades da semana, uma por linha]

Toda sexta, o que entrou no sistema. {CTA}"""),
    dict(slug="23-contagem-lancamento", arquivos=["contagem-dark.mp4"], titulo="Contagem para o lançamento", pilar="lançamento", voz=False,
         uso="Modelo: troque o número de dias em video-v2/src/contagem.js (FALTAM) e gere de novo. Postar de 10/01 a 19/01.",
         legenda="""Faltam 10 dias.

19 de janeiro, a Pilar abre para todo escritório de engenharia e arquitetura. Ative o lembrete e acompanhe a contagem."""),
    dict(slug="24-conceito-carimbo", arquivos=["conceito-carimbo-light.mp4"], titulo="Conceito: o carimbo", pilar="agentes", voz=False,
         legenda=f"""A IA prepara. O sistema confere. Você aprova.

A assinatura da Pilar, literalmente.

{H_IA}"""),
    dict(slug="25-conceito-placa-de-obra", arquivos=["conceito-placa-light.mp4"], titulo="Conceito: a placa de obra", pilar="dor nomeada", voz=False,
         legenda=f"""Responsável técnico: você. Responsável pela planilha: ninguém.

Toda obra tem responsável técnico. E o controle do escritório?

{H_OBRA}"""),
    dict(slug="26-conceito-madrugada", arquivos=["conceito-madrugada-dark.mp4"], titulo="Conceito: 23h47", pilar="dor nomeada", voz=False,
         legenda=f"""23h47. Fechando o mês na planilha. De novo.

Marque o sócio que fecha o mês de madrugada.

{H_ESC}"""),
    dict(slug="27-conceito-nivel", arquivos=["conceito-nivel-light.mp4"], titulo="Conceito: o nível", pilar="posicionamento", voz=False,
         legenda=f"""Projeto e caixa no mesmo nível.

Escopo, prazo e financeiro de cada projeto na mesma tela.

{H_ESC}"""),
    dict(slug="28-conceito-betoneira", arquivos=["conceito-betoneira-dark.mp4"], titulo="Conceito: a betoneira", pilar="obra e clima", voz=False,
         legenda=f"""A betoneira já saiu. A previsão dizia chuva.

Marque quem precisa olhar a previsão antes da próxima concretagem.

{H_OBRA}"""),
    dict(slug="29-conceito-busca", arquivos=["conceito-busca-light.mp4"], titulo="Conceito: a busca", pilar="conta aberta", voz=False,
         legenda=f"""Como cobrar revisão... (todo escritório já pesquisou)

Resposta curta: aditivo, registrado no dia em que o pedido chega. Com data, quem pediu, o que muda e as horas estimadas.

Salve para a próxima vez que o cliente pedir "só um ajustezinho".

{H_ESC}"""),
    # Série 3D "planta vira obra" e motion de produto (gerador em docs/marketing/video/planta-vira-casa e reels-kit)
    dict(slug="30-planta-vira-casa-3d", arquivos=["planta-vira-casa-3d.mp4", ("planta-vira-casa-3d-capa.jpg", "capa.jpg"), ("planta-vira-casa-3d-16x9.mp4", "variacao-16x9.mp4"), ("planta-vira-casa-3d-sem-texto.mp4", "variacao-sem-texto.mp4")],
         titulo="Do traço no papel à casa pronta (3D)", pilar="educativo", voz=False,
         uso="Revisar a ordem técnica das etapas antes de postar. 16:9 para YouTube e LinkedIn; a versão sem texto serve para anúncio.",
         legenda=f"""Do traço no papel à casa pronta, em 11 segundos.

Locação, baldrame, pilares, alvenaria, vigas, reboco, esquadrias, telhado e paisagismo, na ordem em que a obra acontece. Na Pilar, cada uma dessas etapas vira tarefa no cronograma da obra, com prazo e responsável.

Qual etapa mais atrasa nas suas obras? Comenta aqui.

{CTA}

{H_OBRA}"""),
    dict(slug="31-quiz-pecas-da-obra", arquivos=["quiz-pecas-da-obra-3d.mp4", ("quiz-pecas-da-obra-3d-capa.jpg", "capa.jpg")],
         titulo="Você sabe o nome disso? (8 peças da obra)", pilar="engajamento", voz=False,
         legenda=f"""Oito peças de uma obra. Você sabe o nome de cada uma?

O vídeo pausa antes da resposta. Conta quantas acertou e deixa o número aqui embaixo.

Salva para mostrar ao estagiário.

{CTA}

{H_OBRA}"""),
    dict(slug="32-ache-o-erro", arquivos=["ache-o-erro.mp4", ("ache-o-erro-capa.jpg", "capa.jpg")],
         titulo="Tem um erro nesta planta (5 s)", pilar="engajamento", voz=False,
         legenda=f"""Tem um erro nesta planta. Você tem 5 segundos.

Achou em quantos segundos? Comenta o número (sem spoiler para quem ainda não viu).

Erro de projeto que chega na obra vira retrabalho. Revisão é etapa, não detalhe.

{CTA}

{H_ARQ}"""),
    dict(slug="33-uma-casa-cinco-projetos", arquivos=["casa-cinco-projetos-3d.mp4", ("casa-cinco-projetos-3d-capa.jpg", "capa.jpg")],
         titulo="Uma casa. Cinco projetos.", pilar="educativo", voz=False,
         legenda=f"""Uma casa. Cinco projetos.

Arquitetura, estrutural, elétrico, hidráulico e sanitário. Cada disciplina tem escopo, prazo e responsável, e quem coordena precisa ver todas ao mesmo tempo. É assim que a Pilar organiza o projeto: por disciplina.

Qual disciplina mais atrasa no seu escritório?

{CTA}

{H_ESC}"""),
    dict(slug="34-e-o-lucro", arquivos=["e-o-lucro.mp4", ("e-o-lucro-capa.jpg", "capa.jpg")],
         titulo="O projeto acabou. E o lucro?", pilar="conta aberta", voz=False,
         legenda=f"""O projeto acabou. E o lucro? (projeto de exemplo)

Contrato de R$ 158.000, 780 horas orçadas. O cliente trocou o forro, as horas de MEP passaram do previsto e o lucro do projeto foi para -1,5%. Na Pilar, esse número aparece enquanto ainda dá para agir, e o agente já prepara o aditivo para você aprovar.

Você descobre o lucro antes ou depois? Comenta.

{CTA}

{H_ESC}"""),
    dict(slug="35-so-uma-mudancinha", arquivos=["so-uma-mudancinha.mp4", ("so-uma-mudancinha-capa.jpg", "capa.jpg")],
         titulo="Cliente: só uma mudancinha", pilar="dor nomeada", voz=False,
         legenda=f"""Cliente: só uma mudancinha.

Tirar uma parede, virar a escada, transformar o banheiro em suíte, sem mudar o prazo. Toda mudancinha tem custo. Na Pilar, o agente prepara o aditivo com as horas do projeto, o sistema confere e você aprova.

Marca aquele colega que já recebeu essa mensagem.

{CTA}

{H_ARQ}"""),
    dict(slug="36-chuva-na-concretagem-3d", arquivos=["chuva-concretagem-3d.mp4", ("chuva-concretagem-3d-capa.jpg", "capa.jpg")],
         titulo="Concretagem marcada. Olha o céu. (3D)", pilar="obra e clima", voz=False,
         uso="Mesmo tema do 10-chuva: não postar os dois na mesma semana.",
         legenda=f"""Concretagem marcada para amanhã. Olha o céu.

A Pilar cruza o cronograma da obra com a previsão do tempo e avisa quando uma etapa sensível cai num dia de chuva. Quem decide reprogramar é o responsável.

Já perdeu concretagem por causa da chuva? Conta aqui.

{CTA}

{H_OBRA}"""),
    dict(slug="37-obra-e-cronograma", arquivos=["obra-e-cronograma-3d.mp4", ("obra-e-cronograma-3d-capa.jpg", "capa.jpg")],
         titulo="Na obra e no cronograma", pilar="na tela", voz=False,
         legenda=f"""Na obra e no cronograma, ao mesmo tempo.

Em cima, a casa subindo. Embaixo, o cronograma da obra na Pilar, etapa por etapa, com responsável, prazo e avanço. O alerta de clima fica no mesmo lugar.

{CTA}

{H_OBRA}"""),
    dict(slug="38-telhado-ou-laje", arquivos=["telhado-ou-laje-3d.mp4", ("telhado-ou-laje-3d-capa.jpg", "capa.jpg")],
         titulo="Mesma casa. Telhado ou laje?", pilar="engajamento", voz=False,
         legenda=f"""Mesma casa. Telhado ou laje?

Em cima, tesoura, terça e telha cerâmica. Embaixo, laje com platibanda. Você faria qual, e por quê? Comenta.

{CTA}

{H_OBRA}"""),
]

# ----------------------------------------------------------------------------------------------
# CARROSSÉIS: prefixo em posts/out/
# ----------------------------------------------------------------------------------------------
CARROSSEIS = [
    ("c1-hora-do-socio", "Quanto custa uma hora do sócio", "conta aberta", f"""Quanto custa uma hora do sócio? (números de exemplo, troque pelos seus)

R$ 24.000 por mês ÷ 140 horas produtivas = R$ 171 por hora. Seis horas por semana em retrabalho são R$ 4.400 por mês. Devolver duas já paga o sistema.

Salve para fazer a sua conta.

{H_ESC}"""),
    ("c2-cinco-sinais", "5 sinais de que o escritório passou da planilha", "dor nomeada", f"""Conte quantos você reconhece.

Versão certa que ninguém sabe qual é, prejuízo descoberto no fim, cliente ligando para saber, proposta redigitada, diário no WhatsApp. Três ou mais: o escritório cresceu e o controle ficou para trás.

Manda para o seu sócio.

{H_ESC}"""),
    ("c3-como-a-ia-trabalha", "Como a IA trabalha na Pilar", "na tela", f"""A IA prepara. O sistema confere. Você aprova.

Os passos, com a tela real. E o que já roda hoje: lançamento, aditivo, resumo da semana e diário da obra a partir do áudio.

{H_IA}"""),
    ("c4-preco-por-disciplina", "Quanto cobrar por um projeto, disciplina por disciplina", "conta aberta", f"""Quanto cobrar por um projeto, disciplina por disciplina? (números de exemplo)

Horas por disciplina × custo da hora da equipe = custo. Imposto e lucro entram por dentro: custo ÷ (1 − imposto − lucro). Depois, acompanhe as horas reais: o que passa do orçado é aditivo ou é lucro indo embora.

Salve para a próxima proposta.

{H_ESC}"""),
    ("c5-mito-fato", "4 mitos sobre IA no escritório", "agentes", f"""4 mitos sobre IA no escritório de engenharia.

Ela não decide por você, não inventa número, não exige aprender a "mexer em IA" e não é coisa de escritório grande. Arraste para ver o fato de cada um.

{H_IA}"""),
    ("c6-o-que-nao-faz", "O que a Pilar não faz", "confiança", f"""O que a Pilar não faz (e por quê).

Não aprova por você, não manda nada ao cliente sem o seu ok, não inventa número, não assina ART nem RRT e não cobra por usuário. Saber o limite é o que deixa você confiar no resto.

{H_IA}"""),
    ("c7-checklist-inicio", "6 coisas para ter antes de começar um projeto", "conta aberta", f"""6 coisas para ter antes de começar um projeto.

Checklist para salvar e usar na próxima proposta aceita.

{H_ARQ}"""),
    ("c8-aditivo", "Como pedir um aditivo sem perder o cliente", "conta aberta", f"""Como pedir um aditivo sem perder o cliente.

Registrar o pedido no dia, estimar as horas, mostrar a conta e combinar antes de fazer. Aditivo não é briga: é o combinado escrito.

Salve para a próxima revisão fora do escopo.

{H_ESC}"""),
    ("c9-honorario", "Honorário: por m², por hora ou por disciplina?", "conta aberta", f"""Por m², por hora ou por disciplina: como você cobra o projeto?

Cada modelo tem um risco escondido. Arraste para ver quando cada um faz sentido, e comenta qual você usa hoje.

{H_ARQ}"""),
    ("c10-curva-s", "Curva S em 5 slides", "educativo", f"""Curva S em 5 slides.

O que ela mostra, como ler o planejado contra o realizado e quando é hora de se preocupar. Salve para a próxima reunião de obra.

{H_OBRA}"""),
    ("c11-sete-documentos", "Os documentos que todo projeto deveria ter", "educativo", f"""Os documentos que todo projeto deveria ter, do contrato à entrega.

Salve como checklist e confira o projeto que está na mesa agora.

{H_ARQ}"""),
    ("c12-crescer", "O que muda no escritório de 5 para 15 pessoas", "dor nomeada", f"""O que muda no escritório quando ele passa de 5 para 15 pessoas.

O que funcionava na conversa para de funcionar. Arraste e veja em qual fase o seu escritório está.

{H_ESC}"""),
    ("c13-fechar-o-mes", "Como fechar o mês em 30 minutos", "conta aberta", f"""Como fechar o mês do escritório em 30 minutos.

O passo a passo, do recebido ao que sobrou. Salve para o próximo fim de mês.

{H_ESC}"""),
    ("c14-perguntas-do-cliente", "As 4 perguntas que todo cliente faz", "na tela", f"""As 4 perguntas que todo cliente faz (e onde ele deveria achar a resposta sozinho).

Como está o projeto, quando fica pronto, quanto falta pagar e o que mudou. Manda para quem atende o cliente no seu escritório.

{H_ARQ}"""),
    ("c15-carta-do-fundador", "Carta do fundador", "bastidores", f"""Por que eu estou construindo a Pilar.

Uma carta curta sobre o que eu vi em escritórios de engenharia e arquitetura, e o que a Pilar tenta resolver.

Matheus, fundador da Pilar."""),
    ("c16-glossario", "Glossário do escritório de projeto", "educativo", f"""Glossário do escritório de projeto.

Os termos que todo mundo usa e pouca gente explica. Salve e mande para o estagiário.

{H_ARQ}"""),
    ("c17-glossario-da-obra", "Glossário da obra: 5 peças que todo mundo vê", "educativo", f"""Você sabe o nome dessas peças?

Baldrame, verga, contraverga, cinta de amarração e tesoura: cinco partes da obra que todo mundo vê e pouca gente sabe explicar. Arraste para ver o que cada uma faz.

Salva para mostrar ao estagiário.

{CTA}

{H_OBRA}"""),
]
OBS_CARROSSEL = {"c15-carta-do-fundador": "Revisar o texto com o Matheus antes de postar."}

# ----------------------------------------------------------------------------------------------
# POSTS ÚNICOS: arquivo em posts/out/ (série E) ou posts/out/conceito/
# ----------------------------------------------------------------------------------------------
POSTS = [
    ("e1-numero-4x", "e1-numero-4x.png", "Número 4×", "dor nomeada", f"""Quantas vezes o mesmo número foi digitado no seu escritório esta semana?

Na proposta, na planilha, no financeiro e no relatório do cliente. Responde com um número.

{H_ESC}"""),
    ("e2-pergunta-chuva", "e2-pergunta-chuva.png", "Pergunta da chuva", "obra e clima", f"""Quem marcou a concretagem para o dia da chuva?

Conta nos comentários a pior que você já viu.

{H_OBRA}"""),
    ("e3-para-quem-projeta", "e3-para-quem-projeta.png", "Para quem projeta", "posicionamento", f"""Software de obra é feito para construtora. A Pilar é feita para quem projeta.

Escritórios de engenharia e arquitetura que vendem projeto por disciplina e acompanham a obra do próprio projeto.

{H_ESC}"""),
    ("e4-assinatura", "e4-assinatura.png", "A IA prepara. O sistema confere. Você aprova.", "agentes", f"""A IA prepara. O sistema confere. Você aprova.

Três frases que resumem como a Pilar trabalha: a IA faz o preparo, a conta é do sistema e nada grava sem o seu ok.

{H_IA}"""),
    ("e5-arquivo-final", "e5-arquivo-final.png", "Controle_projetos_FINAL_v7", "dor nomeada", f"""Controle_projetos_FINAL_v7 (2) - Cópia.xlsx

Marque quem tem um desses.

{H_ESC}"""),
    ("e6-enquete-margem", "e6-enquete-margem.png", "Você sabe a margem de cada disciplina?", "engajamento", f"""Você sabe a margem de cada disciplina?

A: sei, por projeto e por disciplina. B: sei do escritório inteiro. C: descubro no fim do ano. Responde com a letra.

{H_ESC}"""),
    ("e7-novidades", "e7-novidades-2026-11-14.png", "Novidades da semana", "bastidores", f"""O que mudou na Pilar esta semana.

[atualizar toda sexta com as novidades]

{CTA}"""),
    ("e8-preco", "e8-preco.png", "A partir de R$ 299", "planos", f"""A partir de R$ 299 por mês. Usuários ilimitados.

O estagiário, o mestre de obras e o sócio no mesmo plano. {CTA}"""),
    ("e9-engenharia-nao-e-interiores", "e9-engenharia-nao-e-interiores.png", "Gestão de escritório não é só interiores", "posicionamento", f"""Gestão de escritório de projeto não é só para interiores.

Estrutural, hidráulica, elétrica, arquitetura: a Pilar foi feita para quem vende projeto por disciplina.

{H_ESC}"""),
    ("e10-revisao-nao-e-favor", "e10-revisao-nao-e-favor.png", "Revisão não é favor", "posicionamento", f"""Revisão não é favor.

Revisão fora do escopo tem nome, prazo e valor. Manda para quem ainda faz de graça.

{H_ESC}"""),
    ("e11-previsao-x-cronograma", "e11-previsao-x-cronograma.png", "Previsão × cronograma", "obra e clima", f"""94% de trovoada no sábado. Concretagem da laje no sábado.

Marque quem precisa ser avisado antes.

{H_OBRA}"""),
    ("e12-frase-do-fundador", "e12-frase-do-fundador.png", "Frase do fundador", "bastidores", """Quem projeta merece ganhar pelo que projeta.

Matheus Rezende, fundador da Pilar."""),
    ("e13-dica-1-pedido", "e13-dica-1-pedido.png", "Dica rápida #1", "conta aberta", f"""Dica rápida #1: registre o pedido do cliente no dia em que ele chega.

Data, quem pediu e o que muda. É a base do aditivo que você ainda vai pedir.

{H_ESC}"""),
    ("e14-dica-2-parcela", "e14-dica-2-parcela.png", "Dica rápida #2", "conta aberta", f"""Dica rápida #2: ligue cada parcela a uma entrega.

Entregou o anteprojeto, fatura a parcela 2. O cliente entende, e o caixa agradece.

{H_ESC}"""),
    ("e15-enquete-dor", "e15-enquete-dor.png", "Qual é a sua maior dor hoje?", "engajamento", f"""Qual é a sua maior dor hoje no escritório?

Responde nos comentários. As respostas viram conteúdo aqui.

{H_ESC}"""),
    ("e16-lancamento-19-01", "e16-lancamento-19-01.png", "19.01", "lançamento", """Anote: 19 de janeiro.

A Pilar abre para todo escritório de engenharia e arquitetura. Ative as notificações do perfil."""),
    ("e17-por-usuario-x-pilar", "e17-por-usuario-x-pilar.png", "Por usuário × Pilar (exemplo)", "planos", f"""Faça a conta (exemplo): sistema cobrado por usuário × Pilar.

Com 8 pessoas, cobrar por cabeça faz o escritório deixar gente de fora. Na Pilar, todo plano tem usuários ilimitados.

{CTA}"""),
    ("e18-em-uma-frase", "e18-em-uma-frase.png", "Em uma frase", "posicionamento", f"""A Pilar, em uma frase: gestão com agentes de IA para escritórios de engenharia e arquitetura.

{H_ESC}"""),
]
CONCEITO = [
    ("01-tapume", "Tapume", "dor nomeada", "Se a obra para quando o grupo silencia, o problema não é o grupo.\n\nDiário, fotos e pendências da obra no mesmo lugar que o projeto.\n\n" + H_OBRA),
    ("02-escalimetro", "Escalímetro", "conta aberta", "Você mede tudo em milímetro. E a margem de cada projeto, quem mede?\n\nA precisão do projeto raramente chega na planilha do escritório.\n\n" + H_ESC),
    ("03-carimbo", "Carimbo", "agentes", "A IA prepara. O sistema confere. Você aprova.\n\nA assinatura da Pilar, literalmente.\n\n" + H_IA),
    ("04-betoneira", "Betoneira", "obra e clima", "A betoneira já saiu. A previsão dizia chuva.\n\nMarque quem precisa ver isso antes da próxima concretagem.\n\n" + H_OBRA),
    ("05-placa", "Placa de obra", "dor nomeada", "Toda obra tem responsável técnico. E o controle do escritório?\n\nMarque o responsável pela planilha (se houver um).\n\n" + H_OBRA),
    ("06-nivel", "Nível", "posicionamento", "Projeto e caixa no mesmo nível.\n\nEscopo, prazo e financeiro de cada projeto na mesma tela.\n\n" + H_ESC),
    ("07-capacete", "Capacete na mesa", "posicionamento", "De manhã, no escritório. À tarde, na obra.\n\nPara quem projeta e acompanha: a Pilar vai junto, no computador e no celular.\n\n" + H_OBRA),
    ("08-celular", "Celular sobre a prancha", "na tela", "Pediu pelo celular. Chegou pronto para você aprovar.\n\nO aditivo preparado pela IA, com a conta conferida (valor de exemplo).\n\n" + H_IA),
    ("09-planilhas", "Planilhas de madrugada", "dor nomeada", "23h47. Fechando o mês na planilha. De novo.\n\nMarque o sócio que fecha o mês de madrugada.\n\n" + H_ESC),
    ("10-ferramentas", "Caixa de ferramentas", "posicionamento", "Cada coisa no seu lugar.\n\nProposta, projeto, obra e financeiro também.\n\n" + H_ESC),
    ("11-vergalhoes", "Vergalhões", "posicionamento", "Estrutura não se improvisa.\n\nNem na obra, nem no escritório que projeta a obra.\n\n" + H_ESC),
    ("12-caixa-papeis", "Caixa de papéis", "dor nomeada", "Cadê o contrato da revisão 2? Na caixa. Em algum lugar.\n\nNa Pilar, cada documento fica dentro do projeto.\n\n" + H_ARQ),
    ("13-busca", "Busca: como cobrar revisão", "conta aberta", "O que todo escritório de projeto já pesquisou.\n\nResposta curta: aditivo, registrado no dia em que o pedido chega. Salve para mandar para o sócio.\n\n" + H_ESC),
    ("14-arquivos", "Pasta de propostas", "dor nomeada", "Qual dessas foi para o cliente?\n\nMarque quem salva assim. A gente não conta para ninguém.\n\n" + H_ARQ),
    ("15-laudo", "Relatório de ensaio", "conta aberta", "O concreto passou no ensaio. A gestão, não. (exemplo)\n\nO projeto é calculado. A margem também deveria ser.\n\n" + H_ESC),
    ("16-notificacoes", "Tela de bloqueio às 6:58", "dor nomeada", "O seu dia começa no grupo ou no planejamento?\n\nResponda com 🏗 ou 📋.\n\n" + H_OBRA),
    ("17-postit", "Post-it de 12/08", "conta aberta", "Hoje é 11/11. O post-it é de 12/08.\n\nLembrete não cobra ninguém. Aditivo, sim.\n\n" + H_ESC),
    ("18-agenda", "Agenda da semana", "dor nomeada", "Onde foi parar a semana?\n\nAjuste rápido de 14 horas tem nome: aditivo.\n\n" + H_ARQ),
    ("19-zebrada", "Planilha interditada", "dor nomeada", "Se ninguém pode mexer, não é controle. É risco.\n\nComenta quantas abas tem a sua.\n\n" + H_ESC),
    ("20-conversa", "Conversa com o cliente", "conta aberta", "A palavra que salva a margem.\n\nComo você responde o \"só um ajustezinho\"?\n\n" + H_ARQ),
]

# ----------------------------------------------------------------------------------------------
# STORIES: grupos por prefixo em posts/out/stories/
# ----------------------------------------------------------------------------------------------
STORIES = [
    ("st1-enquete-margem", "Enquete da margem (3 telas)", "Tela 1: adesivo de enquete \"Sei / Não sei\". Telas 2 e 3 em sequência, a 3 com o adesivo de link para os planos."),
    ("st2-quiz", "Quiz (2 telas)", "Tela 1: adesivo de quiz com as 3 opções. Tela 2 no dia seguinte, com a resposta."),
    ("st3-caixinha", "Caixinha: pergunte ao fundador", "Adesivo de perguntas. As melhores respostas viram vídeo do fundador (roteiro 12)."),
    ("st4-isso-ou-aquilo", "Isso ou aquilo (4 telas)", "Adesivo de enquete em cada tela, uma por dia ou as quatro em sequência."),
    ("st5-bastidor", "Bastidor (2 telas)", "Espaço reservado para foto real do escritório ou da tela. Adicione a foto antes de postar."),
    ("st6-contagem", "Contagem do lançamento (10, 7, 3, 1)", "Adesivo de contagem regressiva para 19/01 na tela de 10 dias. Postar no dia indicado."),
    ("st7-novidades", "Novidades da semana", "Toda sexta, junto com o post de novidades. Adesivo de link para o post."),
    ("st8-planos-link", "Planos com link", "Adesivo de link para a página de planos. Deixar nos destaques \"Planos\"."),
]


def copia(src: Path, dst: Path):
    if not src.exists():
        print("  falta:", src.relative_to(MKT))
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not dst.exists() or dst.read_bytes() != src.read_bytes():
        shutil.copyfile(src, dst)
    return True


def duracao(p: Path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], capture_output=True, text=True)
    try:
        return round(float(r.stdout.strip()))
    except ValueError:
        return None


def escreve_legenda(pasta: Path, titulo, tipo, pilar, legenda, uso=None, extra=None):
    linhas = [f"# {titulo}", "", f"**Formato:** {tipo} · **Pilar:** {pilar}", ""]
    if extra:
        linhas += [extra, ""]
    if uso:
        linhas += [f"> **Antes de postar:** {uso}", ""]
    linhas += ["## Legenda (copie e cole)", "", "```text", legenda.strip(), "```", ""]
    (pasta / "legenda.md").write_text("\n".join(linhas))


def main():
    indice = {"reels": [], "carrosseis": [], "posts": [], "stories": [], "fundador": []}

    # Reels
    for r in REELS:
        pasta = AQUI / "reels" / r["slug"]
        ok = True
        principal = None
        for a in r["arquivos"]:
            src, nome = (a if isinstance(a, tuple) else (a, "video.mp4"))
            ok &= copia(RENDERS / src, pasta / nome)
            principal = principal or pasta / nome
        if principal and principal.exists():
            capa = pasta / "capa.jpg"
            if not capa.exists():
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1.2", "-i", str(principal), "-frames:v", "1", "-q:v", "4", str(capa)], check=False)
        dur = duracao(principal) if principal and principal.exists() else None
        extra = f"**Duração:** {dur} s · **Voz:** {'narrado (Leda)' if r['voz'] else 'só música e efeitos'} · **Capa:** `capa.jpg` (ou escolha no Instagram)"
        escreve_legenda(pasta, r["titulo"], "Reel 9:16", r["pilar"], r["legenda"], r.get("uso"), extra)
        indice["reels"].append((r["slug"], r["titulo"], r["pilar"], f"{dur} s" if dur else "?", "narrado" if r["voz"] else "música"))

    # Carrosséis
    for pref, titulo, pilar, leg in CARROSSEIS:
        n = pref.split("-")[0][1:]
        pasta = AQUI / "carrosseis" / f"c{int(n):02d}-{pref.split('-', 1)[1]}"
        # slide em PNG (arte chapada) ou JPG (foto e 3D, bem mais leve)
        slides = sorted([*OUT.glob(f"{pref}-[0-9][0-9]*.png"), *OUT.glob(f"{pref}-[0-9][0-9]*.jpg")])
        for i, s in enumerate(slides, 1):
            copia(s, pasta / f"{i:02d}{s.suffix}")
        if not slides:  # sem a pasta de geração nesta máquina: vale o que já está na biblioteca
            slides = sorted([*pasta.glob("[0-9][0-9].png"), *pasta.glob("[0-9][0-9].jpg")])
        escreve_legenda(pasta, titulo, f"Carrossel 4:5, {len(slides)} slides", pilar, leg, OBS_CARROSSEL.get(pref),
                        "Poste os slides na ordem dos nomes (01, 02...). O 01 é a capa.")
        indice["carrosseis"].append((pasta.name, titulo, pilar, f"{len(slides)} slides", ""))

    # Posts únicos
    for slug, arq, titulo, pilar, leg in POSTS:
        n = slug.split("-")[0][1:]
        pasta = AQUI / "posts" / f"e{int(n):02d}-{slug.split('-', 1)[1]}"
        copia(OUT / arq, pasta / "post.png")
        uso = "Atualizar o texto da imagem (render-posts.mjs) e a legenda toda sexta." if slug == "e7-novidades" else None
        escreve_legenda(pasta, titulo, "Post único 4:5", pilar, leg, uso)
        indice["posts"].append((pasta.name, titulo, pilar, "imagem", ""))
    for slug, titulo, pilar, leg in CONCEITO:
        pasta = AQUI / "posts" / f"k{slug}"
        copia(OUT / "conceito" / f"{slug}.jpg", pasta / "post.jpg")
        serie = "foto-conceito" if int(slug[:2]) <= 12 else "objetos digitais"
        escreve_legenda(pasta, titulo, f"Post único 4:5 (série {serie})", pilar, leg)
        indice["posts"].append((pasta.name, titulo, pilar, serie, ""))

    # Stories
    for pref, titulo, como in STORIES:
        pasta = AQUI / "stories" / pref
        telas = sorted((OUT / "stories").glob(f"{pref}*.png"))
        for t in telas:
            resto = t.stem[len(pref):].lstrip("-")
            copia(t, pasta / (f"tela-{resto}.png" if resto else "tela.png"))
        if not telas:  # sem a pasta de geração nesta máquina: vale o que já está na biblioteca
            telas = sorted(pasta.glob("tela*.png"))
        (pasta / "como-usar.md").write_text(f"# {titulo}\n\n**Formato:** story 9:16, {len(telas)} tela(s). Story não tem legenda: o texto está na arte.\n\n**Como usar:** {como}\n\nDeixe livres os 250 px de cima e os 340 px de baixo (interface do Instagram).\n")
        indice["stories"].append((pref, titulo, "", f"{len(telas)} tela(s)", ""))

    # Vídeos do fundador (roteiros a gravar)
    for f in sorted(SRC.glob("fala-*.script.json")):
        d = json.loads(f.read_text())
        pasta = AQUI / "fundador" / d["id"]
        pasta.mkdir(parents=True, exist_ok=True)
        hook = d.get("hook", "").replace("*", "")
        falas = "\n".join(f"{i}. {ln['text']}" for i, ln in enumerate(d["lines"], 1))
        prev = RENDERS / f"{d['id']}-dark.mp4"
        tem_prev = copia(prev, pasta / "previa-sem-gravacao.mp4") if prev.exists() else (pasta / "previa-sem-gravacao.mp4").exists()
        (pasta / "roteiro.md").write_text(f"""# {hook}

**Formato:** Reel 9:16 do fundador, gravado no celular · **Status:** a gravar
{'**Prévia do formato:** `previa-sem-gravacao.mp4` (quadro-guia no lugar da gravação)' if tem_prev else ''}

## Roteiro (uma fala por respiração, olhando para a lente)

{falas}

## Como gravar e finalizar

1. Grave na vertical (câmera traseira, luz de janela, microfone de lapela). Teleprompter: `docs/marketing/gravacao/teleprompter.html`.
2. Salve como `docs/marketing/video-v2/footage/{d['id']}.mp4`.
3. Rode `./make.sh {d['id']} dark` em `docs/marketing/video-v2/`. A legenda palavra a palavra, as telas e a trilha entram sozinhas.
4. Rode `python3 docs/marketing/conteudo/organizar.py` para trazer o vídeo para esta pasta.

## Legenda (copie e cole)

```text
{hook}.

{d['lines'][0]['text']}

{H_ESC}
```
""")
        indice["fundador"].append((d["id"], hook, "", "a gravar", "prévia" if tem_prev else ""))

    # Pranchas (visão geral de cada leva)
    for p in (MKT / "posts").glob("prancha-*.jpg"):
        copia(p, AQUI / "pranchas" / p.name)

    escreve_indice(indice)
    print("ok: biblioteca em", AQUI.relative_to(MKT.parent.parent))


def escreve_indice(ix):
    t = lambda rows, cab: "\n".join([f"| {' | '.join(cab)} |", "| " + " | ".join("---" for _ in cab) + " |"] + [f"| {' | '.join(str(c) for c in r)} |" for r in rows])
    reels = [(f"[{s}](reels/{s}/)", ti, pi, d, v) for s, ti, pi, d, v in ix["reels"]]
    car = [(f"[{s}](carrosseis/{s}/)", ti, pi, n) for s, ti, pi, n, _ in ix["carrosseis"]]
    pos = [(f"[{s}](posts/{s}/)", ti, pi, se) for s, ti, pi, se, _ in ix["posts"]]
    sto = [(f"[{s}](stories/{s}/)", ti, n) for s, ti, _, n, _ in ix["stories"]]
    fun = [(f"[{s}](fundador/{s}/)", ti, st, pr) for s, ti, _, st, pr in ix["fundador"]]
    (AQUI / "README.md").write_text(f"""# Biblioteca de conteúdo da Pilar

Tudo o que foi produzido para o Instagram (@pilarsoft.app), pronto para postar: **cada peça tem a sua
pasta com a mídia final e o `legenda.md`** (legenda para copiar e colar, e o que fazer antes de postar).

Este índice e as pastas são gerados por [`organizar.py`](./organizar.py). Depois de criar ou refazer
uma peça, rode `python3 docs/marketing/conteudo/organizar.py`. Legenda nova ou ajuste de texto: edite o
`organizar.py` (não o `legenda.md`, que é regerado).

| Tipo | Quantidade |
| --- | --- |
| Reels | {len(reels)} |
| Carrosséis | {len(car)} |
| Posts únicos | {len(pos)} |
| Stories (grupos) | {len(sto)} |
| Vídeos do fundador (roteiro pronto, a gravar) | {len(fun)} |

**Como decidir o que postar:** estratégia em [05](../05-plano-de-marketing-2026-11.md), calendário e
regra de variedade em [06](../06-banco-de-conteudo.md), gente real em [07](../07-direcao-de-conteudo.md),
conceito, fim de vídeo e voz em [08](../08-direcao-criativa.md), séries 3D e quizzes de obra em
[09](../09-conteudo-viral.md). Visão geral de cada leva em [`pranchas/`](./pranchas/).

**Antes de postar qualquer peça:** primeira linha da legenda = gancho; link só na bio; número de exemplo
dito como exemplo; só o que roda em produção; nada de dado real de cliente sem autorização.

**De onde vem cada coisa** (para refazer): vídeos em `video-v2/src/` (`./make.sh <id> light|dark`),
posts em `posts/render-posts.mjs` e `posts/render-conceito.mjs`, fotos-fonte em `posts/fotos/`,
narrações em `video-v2/narration/`, teleprompter em `gravacao/teleprompter.html`. Reels `30` a `38` e o
carrossel `c17`: obra 3D em `video/planta-vira-casa/`, motion e variações em `video/reels-kit/`; os MP4 e as
capas entram em `video-v2/renders/` e os slides em `posts/out/` antes de rodar o `organizar.py`.

## Reels

{t(reels, ["Pasta", "Peça", "Pilar", "Duração", "Som"])}

## Carrosséis

{t(car, ["Pasta", "Peça", "Pilar", "Slides"])}

## Posts únicos

`e` = série de texto sobre a marca · `k01` a `k12` = foto-conceito · `k13` a `k20` = objetos digitais.

{t(pos, ["Pasta", "Peça", "Pilar", "Série"])}

## Stories

{t(sto, ["Pasta", "Peça", "Telas"])}

## Vídeos do fundador (a gravar)

{t(fun, ["Pasta", "Gancho", "Status", "Prévia"])}
""")


if __name__ == "__main__":
    main()
