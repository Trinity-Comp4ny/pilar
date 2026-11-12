# Decisões de direção (log vivo)

Log das decisões de direção do CEO, mais recente primeiro. **Fonte de verdade quando conflitar
com qualquer outro doc de estratégia**: os docs longos (STRATEGY_V2, ESTRATEGIA_PRODUTO, ICP,
PRICING) descrevem o quadro; este arquivo registra o que mudou desde que foram escritos.

Regras de manutenção:

- Toda decisão de direção nova entra aqui NA HORA, no topo, com data, decisão em 1 frase,
  contexto em 2-3 linhas e o que ela supera.

---

## 2026-11-12 · Google Agenda conectado, por pessoa, com aviso 30 minutos antes

**Decisão:** cada usuário conecta o próprio Google Agenda. As reuniões aparecem na Agenda de Tarefas, junto dos
prazos, e o sino avisa 30 minutos antes de cada uma. A Pilar só lê a agenda (escopo `calendar.events.readonly`).
Plano e ordem das próximas ideias (convite do portal, arquivos sem Drive) na SPEC 164.

Contexto: o CEO quer o dia do usuário dentro da Pilar ("daqui meia hora você tem uma reunião") para ele não precisar
sair da plataforma. Diferente do Drive (uma conta do escritório), agenda é pessoal: ninguém vê a do colega.

**Supera:** nada; é a segunda integração Google, depois do Drive (2026-11-10).

---

## 2026-11-11 · Fluxo do projeto vira grafo com dependências e caminho crítico

**Decisão:** a aba Fluxo do projeto passa a funcionar como o grafo de um pipeline de CI: etapas, o que roda em
paralelo, status, datas previstas e reais, previsão de conclusão projetada pelo andamento real e caminho crítico.
Disciplinas ganham dependência explícita (fase 2), com a coluna anterior inteira como padrão. Plano em fases na
SPEC 162.

Contexto: hoje o sócio abre disciplina por disciplina para saber se um atraso empurra a entrega; a lista de
disciplinas não responde isso. Continua sem biblioteca de grafo (ADR 0020): layout em colunas, desenhado à mão.

**Supera:** o fora de escopo da SPEC 071 ("DAG genérico com dependências arbitrárias") e o da SPEC 051 ("recalcular
datas futuras quando uma etapa atrasa").

---

## 2026-11-10 (mais tarde) · Google Drive conectado à Pilar; a Pilar segue sem guardar arquivo

**Decisão:** o escritório conecta o Google Drive dele à Pilar (botão em Configurações, só admin) e cada projeto
ganha uma pasta no Drive, com uma subpasta por disciplina, que a equipe navega, alimenta e baixa na aba Arquivos do
projeto. O arquivo vai do navegador direto para o Google; a Pilar não guarda binário. Escopo `drive.file` (só o que a
Pilar cria): sem auditoria anual do Google. Detalhe na SPEC 163.

Contexto: na reunião com a VRZ o sócio pediu para ver e gerenciar as pastas do Drive dentro da Pilar; colar link já
existe e não basta. Guardar os arquivos na Pilar (opção C da SPEC 163) ficou para depois.

**Supera:** nada; confirma a de 2026-07-30 (a Pilar não hospeda binário) e acrescenta a integração.

---

## 2026-11-10 (mais tarde) · Bônus da folha quando a disciplina é concluída; portal liberado também ao coordenador

**Decisão:** o bônus de produtividade (m² e percentual) entra na folha do mês em que a disciplina da pessoa é
concluída, não mais no mês em que o projeto começou. Como a base do bônus é do projeto, cada projeto paga uma vez por
pessoa: no mês da primeira disciplina dela concluída ali; projeto já pago numa folha fechada não volta. Projeto
cancelado não paga. Dar acesso ao portal do cliente passa a ser possível de dentro do projeto, por admin e
coordenador (antes só admin, só pela tela de Clientes).

Contexto: na VRZ um projeto fechado na semana anterior, que nem tinha começado, já aparecia no bônus da folha. O sócio
pediu "quando concluir a disciplina". O coordenador é quem fala com o cliente; o portal precisava estar a um clique,
no projeto.

**Supera:** a regra "projeto que começou no mês da folha" (SPEC 032, migration 20261209000000) e o "só admin" do convite
ao portal.

---

## 2026-11-10 (mais tarde) · Conector da Pilar vai para os diretórios oficiais do Claude e do ChatGPT

**Decisão:** o usuário final não vai colar URL de conector. O conector da Pilar será publicado no diretório de
conectores do Claude e no diretório de apps do ChatGPT, para o usuário conectar pedindo na conversa ("conecte a
Pilar") ou com um clique no diretório. Fica como próximo passo planejado, depois da fase 1 validada: tem revisão
externa e exige domínio próprio, produção, política de privacidade do conector, página pública, material de listagem
e conta de teste. Checklist completo na SPEC 151, "Próximos passos".

Contexto: o ICP usa Claude e ChatGPT pelo app, não por configuração técnica; é assim que Notion, Canva e Slack
distribuem os conectores deles.

**Supera:** a URL colada à mão como forma de o cliente conectar (fica só para teste e piloto).

---

## 2026-11-10 · Profissionalizar a relação com o usuário: novidades, voz do cliente, ajuda e confiança

**Decisão:** entra no roadmap o bloco de profissionalização da plataforma, com prioridade nesta ordem: "O que mudou"
no aviso de nova versão + "Você pediu, entregamos" (SPEC 152); faixa de incidente e manutenção no app; central de
ajuda + assistente de agentes no canto da tela (mesmo motor do `/chat`, com botão que leva à tela); bug zero com
prazo; NPS com limite de frequência; prévia de recursos opcional. Regra editorial: só vai para o usuário o que muda
o que ele vê ou faz; infra, refatoração e teste ficam internos.

Contexto: com mais de um escritório, avisar mudança por WhatsApp não escala e o feedback não volta para quem pediu.
Análise do código + referências globais (Linear, GitHub, Intercom, Canny, Omie) em
`research/themes/profissionalizacao-saas-referencias.md`.

**Supera:** o adiamento de "What's New", central de novidades e NPS no `SCORECARD_MATURIDADE_2026-08` ("com 1 design
partner, WhatsApp entrega o mesmo").

---

## 2026-11-10 · A Pilar vira conector para ChatGPT e Claude (MCP), começando só leitura

**Decisão:** a Pilar ganha um conector MCP para o cliente consultar os dados do escritório de dentro do ChatGPT,
do Claude (claude.ai e Desktop) e de outros clientes MCP. A conexão é por OAuth na tela da Pilar, com o login de
sempre. A fase 1 só lê (projetos, aditivos, propostas, leads, clientes, resumo financeiro); escrita vem depois, como
rascunho que o usuário aprova no app. O usuário não deve ver o endereço do provedor: o conector usa o domínio próprio
(`api.pilarsoft.com.br`, add-on de domínio do Supabase) antes de abrir para cliente.

Contexto: o ICP já usa ChatGPT e Claude no dia a dia (não Claude Code); empresas buscam serviço, não só software, e o
conector leva a Pilar para onde o sócio já conversa. Detalhe e runbook na SPEC 151.

**Supera:** nada; é a primeira decisão sobre integração com assistentes externos.

---

## 2026-11-09 (mais tarde) · Menção com @ sai por e-mail na hora, junto com o sino

**Decisão:** quando alguém marca uma pessoa com @ num comentário (projeto, disciplina ou tarefa), o e-mail sai no
mesmo instante em que a notificação aparece no sino, sem a janela de 5 minutos e sem esperar o resumo de segunda.
Vale para toda categoria, inclusive tarefa; só não sai para quem desligou o e-mail daquela categoria. O ciclo de
5 minutos fica como rede de segurança, se o envio na hora falhar.

Contexto: o cliente reclamou que as pessoas marcadas "não recebiam nada"; o CEO quer o e-mail no mesmo instante do app.

**Supera:** o "por e-mail em ~5 min se não for lida" da decisão de Equipe logo abaixo.

---

## 2026-11-09 · Equipe é onde se dá acesso ao Pilar; o @ só oferece quem tem login

**Decisão:** cadastrar alguém na Equipe é também dar o acesso: o cadastro de pessoa nova já envia o convite (caixa
"Dar acesso ao Pilar", marcada por padrão, só para admin) e a ficha da pessoa mostra se ela tem login, convida ou liga a
um login que já existe com outro e-mail. O menu de @ das atividades lista só quem tem login (sai a etiqueta "sem
acesso"). Menção chega no sistema e por e-mail em ~5 min se não for lida.

Contexto: num escritório cliente, pessoas com login corporativo estavam na Equipe com o e-mail pessoal; o vínculo era só por
e-mail idêntico, então apareciam "sem acesso" no @ e não recebiam menção. Os dois casos foram ligados à mão em produção.

**Supera:** a etiqueta "sem acesso" no menu de menção (SPEC 132) e a menção só no resumo semanal por e-mail (SPEC 096).

---

## 2026-11-08 · Landing leva aos planos; assinatura direta pelo site, demonstração como caminho secundário

**Decisão:** os botões principais da landing passam a ser "Ver planos" e "Entrar". Cada plano tem "Assinar", que
leva direto ao checkout do app: o escritório paga, recebe o convite e entra. "Agendar demonstração" vira caminho
secundário: uma linha discreta abaixo dos botões na hero, nas páginas de módulo e comparativo e no fecho, um link
em cada plano e o link do rodapé. Segue sem teste grátis; a cena dos agentes na hero é a amostra do produto (sem
vídeo gravado por ora).

Contexto: os preços já são públicos e o checkout existe, mas a landing não levava ninguém até ele; todo botão de
plano ia para o Google Agenda. Quem já decidiu comprar não precisa passar por uma conversa.

**Supera:** a parte "entrada só por demonstração" de 2026-11-06 e o comentário da SPEC 133 de que o checkout era só
"para o link que o time envia". O cadastro com teste grátis (`/cadastro`) continua fechado.

---

## 2026-11-07 (mais tarde) · Tagline: "Gestão com agentes de IA para escritórios de engenharia e arquitetura."

**Decisão:** a frase principal do Pilar passa a ser **"Gestão com agentes de IA para escritórios de engenharia e
arquitetura."** "Do contrato à execução, num fluxo só." sai: não é mais tagline nem headline e não aparece em título,
meta, imagem de compartilhamento, tela de entrada ou material de venda.

Contexto: a frase do fluxo soava como slogan de marketing; a nova diz o que o sistema é e para quem, e põe os agentes
na frente. A assinatura dos agentes ("A IA prepara. O sistema confere. Você aprova.") continua. Trocado no app (telas de
entrada e cadastro), na landing (subtítulo da hero, fecho e rodapé), nas metas e og:image, no `CLAUDE.md`, em `brand/`
e no agente de vendas. "Do contrato à execução" fica só como termo do glossário (`voice-tone.md`) em texto corrido.

**Supera:** a tagline "Do contrato à execução, num fluxo só." de 2026-10-28. O resto daquela decisão (agentes como
primeiro pilar, lucro e prazo como prova) segue valendo.

---

## 2026-11-07 · Logo: coluna de três caneluras e apresentação clara sobre a paisagem

**Decisão:** o símbolo passa a ter três caneluras (eram quatro), com a do meio no eixo: três apoios
sustentando o capitel, a ideia de trindade e de base. A apresentação padrão da marca deixa o fundo preto
e passa a ser clara, sobre a paisagem de morros verdes da hero da landing, com o símbolo em Ink como foco.

Contexto: o ícone do app era um disco verde num tile preto, e o preto não conversava com a landing, que é
clara. Entram variações claras (ícone paisagem, verde e disco sobre papel; lockups horizontal, empilhado e
banner sobre a paisagem), todas geradas por `scripts/brand/build.py`. Regras em `brand/logo.md` (seção 7.1).
O **ícone verde** (coluna em Ink sobre o tile verde) é o ícone do produto: app instalado, tela inicial,
favicon e foto de perfil. A paisagem fica para a imagem de compartilhamento (og:image) e peças grandes.

**Supera:** a coluna de quatro caneluras e o ícone verde sobre Ink de `brand/logo.md` (BEZ-385). As versões
`white` e `brand` sobre Ink seguem válidas para fundo escuro, só não são mais a cara da marca.

---

## 2026-11-07 · Onboarding: perfil do escritório na entrada, três pilares iguais e origem do lead

**Decisão:** a entrada no Pilar passa a coletar quem é o escritório e quem é a pessoa, e o primeiro uso trata
Gestão, Projetos e Obras com o mesmo peso. O ultra-admin anota na criação o que soube na demonstração (site,
CNPJ, disciplinas, porte, origem); o dono confirma e responde "Como você conheceu o Pilar?"; cada pessoa informa
a função (obrigatória) e o LinkedIn (opcional). Celular segue obrigatório para dono e convidado. Cada clique em
"Agendar demonstração" registra o canal de origem (UTM ou site: Google, ChatGPT, LinkedIn...).

Contexto: o escritório entrava num sistema vazio e o Pilar não sabia nada dele além do nome. Como toda entrada é
por demonstração (2026-11-06), o dado de lead vem de quem já conversou com o cliente, sem pesar no formulário. O
primeiro passo segue o pilar que o dono escolher; Obras não é módulo de segunda classe no onboarding.

**Supera:** o onboarding de 2 etapas (perfil + só CNPJ) e o checklist só para admin da SPEC 034. Detalhe e o que
ficou pendente (escritório de exemplo, consulta à Receita, evento de ativação) na SPEC 149.

---

## 2026-11-07 · Papel `owner` aposentado

**Decisão:** o acesso dentro da empresa tem só administrador, coordenador e usuário. O papel `owner` sai de uso.

Contexto: desde agosto nenhum perfil tinha `owner` (backfill para admin achou zero linhas em staging e produção), mas o
valor seguia no enum e em listas do código, com tratamento diferente em cada lugar (um hook tratava como admin, o
`canDo` não). **Aplicado** pela migration `20261202000000_papel_owner_aposentado`: rede de segurança owner → admin e
trava (CHECK) em `profiles.role` e `convites.cargo`. O valor continua no enum porque removê-lo exige recriar o tipo
usado por políticas de RLS; com a trava, ninguém volta a recebê-lo.

---

## 2026-11-06 (mais tarde) · Capacidade por módulo: projetos, obras e leads ativos

**Decisão:** o plano limita os três módulos, não só projetos. Essencial: 10 projetos, 2 obras, 50 leads ativos.
Profissional: 30 projetos, 5 obras, 200 leads. Escala: projetos e leads ilimitados, 15 obras. Usuários seguem
ilimitados e toda empresa segue com a plataforma inteira (ADR 0026): o plano muda quanto, nunca o quê.

Contexto: o Pilar deixou de ser só Projetos; Gestão e Obras são produto real, e cobrar tudo pela régua de projeto
sub ou superprecifica o escritório que toca poucas obras ou muito comercial. Ativo = em andamento (projeto, obra) ou
aberto no funil (lead); concluído, cancelado, ganho ou perdido não conta.

**Supera:** as faixas 15/40/ilimitado de projetos da tabela v3 de PRICING.md e a coluna "obras ativas" (2/5/12) que
lá era só diretriz. **Aplicado** pela migration `20261130000000_planos_v4_preco_e_capacidade_por_modulo`: colunas
`max_obras` e `max_leads` no plano, `limites_empresa()` devolvendo as três faixas e o trigger
`enforce_capacidade_leads`. Quem bate na faixa vê o diálogo de limite do plano, com o caminho para subir de plano.
Assinatura que já está acima da faixa nova não perde nada: o bloqueio vale só para criar o próximo.

---

## 2026-11-06 · Preço R$ 299/499/899, IA vendida em créditos e entrada só por demonstração

**Decisão:** os planos passam a R$ 299 (Essencial), R$ 499 (Profissional) e R$ 899 (Escala). A cota de IA é
comunicada em **créditos**, não em tokens, na razão fixa de 1 crédito = 5 mil tokens: 100, 400 e 1.600 créditos por
mês. A landing não fala mais em teste grátis: a entrada é por convite, depois de agendar a demonstração.

Contexto: "500 mil tokens" não diz nada ao sócio do escritório; um número pequeno e redondo de créditos é palpável. O
motor de tokens continua contando token por baixo; crédito é só a unidade exposta ao cliente (a razão fixa permite
converter sem mudar o motor). Cadastro por convite já valia desde 19/10 (SPEC 133).

**Supera:** os preços R$ 490/690/1.290 da tabela v3 de PRICING.md e a entrada de 2026-08-31 na parte "token é a
unidade exposta". **Aplicado no app** pela migration `20261130000000_planos_v4_preco_e_capacidade_por_modulo` (preço
do checkout) e pela UI em créditos (`src/lib/creditos.ts`). O preço do pacote avulso não mudou (só o rótulo, em
créditos). As notificações geradas no banco ("Créditos de IA acabando", "Pedido de mais créditos de IA") passaram
a créditos na migration `20261201000000_notificacoes_ia_em_creditos`.

---

## 2026-11-04 · Conexão bancária: por enquanto só arquivo CSV; sem OFX, sem Open Finance

**Decisão:** o Financeiro continua recebendo extrato só por arquivo CSV (SPEC 017, tela "Importar"). Não entram OFX,
agregador de Open Finance nem Asaas por empresa agora. Reabrir quando 3 ou 4 clientes pedirem conexão automática.

Contexto: não existe conexão bancária gratuita para um produto. Agregador (Pluggy, Belvo, Celcoin) custa a partir de
R$ 2.500/mês mais cerca de R$ 5 a 10 por conta conectada (valores de relatos de desenvolvedores, sem tabela oficial),
e Open Finance direto exige ser instituição autorizada pelo Banco Central. O CSV já funciona e não tem custo.

**Supera:** a recomendação de "OFX + CSV primeiro" do card BEZ-539; fica só o CSV. A SPEC 017 mantém PDF e XLSX como
pendências de importação, sem prazo.

---

## 2026-11-03 · Sai o backend do Asaas por empresa; fica só o Asaas que cobra a assinatura do Pilar

**Decisão:** removidas as edge functions `asaas-config`, `asaas-criar-cobranca` e `asaas-webhook`, as tabelas
`asaas_config` e `asaas_webhook_logs` e as RPCs `set_asaas_api_key`/`get_asaas_api_key`. Não vai haver UI de cobrança
pelo Asaas de cada empresa. Conexão bancária e conciliação seguem outro caminho (card BEZ-539).

Contexto: a decisão de 2026-09-03 já abandonou a integração por empresa, mas deixou o backend de pé. Sem tela e sem
chamador, era superfície de ataque e custo de manutenção sem uso. O Asaas da plataforma (checkout, assinatura, pacote
de tokens, reconciliação diária) não muda.

Também saíram (BEZ-553): as colunas `asaas_*` de `receitas` (e da view `lancamentos`), `clientes.asaas_customer_id` e o
botão "Pagar" do portal, que só aparecia com `asaas_payment_url` preenchido. Em produção só a Bez Company tinha dado, de
um teste em sandbox de 16/04/2026 (1 receita pendente, 1 cliente, 1 config). Correção da nota de 2026-09-03: havia 1
`asaas_config` em produção, não zero.

**Supera:** a nota de 2026-09-03 que deixava essas functions e tabelas "para auditoria separada".

---

## 2026-10-30 · Agentes: pendência vem de regra em SQL; o chat consulta registros e age com confirmação

**Decisão:** o agente de acompanhamento detecta por regra (parcela e conta vencidas ou a vencer, prazo de projeto e
disciplina, orçamento incorreto ou ausente, tarefa da obra vencendo, o que falta planejar) e mantém a fila na aba
Pendências com idade e fechamento automático. A IA fica no chat: escolhe entre ferramentas de leitura fechadas e
responde com os registros e link. Ação continua com card de confirmação. Detalhes na SPEC 146, SPEC 147 e ADR 0065.

Contexto: a aba estava vazia porque o guardião de margem só olha projeto com orçamento por disciplina e nenhum dos 21
projetos em andamento tinha. O agente de projetos do chat respondia "0 projetos" desde que `valor_contrato` perdeu o
SELECT (ADR 0034). O sino avisava de receita excluída (129 de 139 avisos de recebimento atrasado). Cards: BEZ-508 a 513.

---

## 2026-10-28 · Marca: promessa "Do contrato à execução" e agentes como primeiro pilar (tagline superada em 2026-11-07)

**Decisão:** a promessa-mãe do Pilar passa a ser "Do contrato à execução, num fluxo só". Agentes de IA viram o primeiro
pilar de mensagem, com a assinatura "A IA prepara. O sistema confere. Você aprova." Lucro e prazo continuam, como prova
do fluxo e não como promessa única. O nome fica **Pilar** e o domínio `pilarsoft.com.br`: a troca para "Prumeo" (19/08)
está cancelada. O Clima é feature de Obras, não um quarto módulo (os módulos seguem Gestão, Projetos e Obras, mais
Portal do cliente, Pilar Campo e Agentes).

Contexto: o discurso "saiba se o projeto dá lucro antes de terminar" cobria só uma parte do produto, que já tem comercial,
projetos, obra (diário, cronograma, cotação, estoque, conta da obra, estimativa), portal, Campo offline e agentes. Só se
promete o que roda em produção. Supera a tagline de 2026-06 e o "não posicionar como ERP de construção" do
`messaging.md`: o Pilar é o sistema do escritório que projeta e acompanha a obra, não o ERP da construtora. Cards:
BEZ-398 (pai), BEZ-399 (brand book), BEZ-400 (landing), BEZ-401 (microcopy do app e e-mails).

---

## 2026-10-20 · Estimativa de obra: itens com origem do preço, catálogo fechado e IA depois

**Decisão:** toda linha de custo da estimativa mostra de onde veio o preço (CUB, SINAPI, tabela da empresa, valor do
usuário, referência provisória do Pilar ou "a definir"). O usuário descreve a obra escolhendo itens de um catálogo
curado; a IA vem depois e só preenche esse catálogo a partir de texto. Item sem fonte fica "a definir" ou recebe o
valor informado pela empresa ou pelo usuário. O valor de referência do Pilar só aparece marcado como provisório e
sai à medida que as outras fontes entram.

Contexto: no teste da obra Canaã (R$ 2,5 mi esperado) o provável saiu R$ 2,27 mi, com cerca de 35% do total em
adicionais provisórios e faltando climatização, aquecimento, energia solar, automação e terraplenagem. O SINAPI de
set/2026 cobre fundação, estrutura e instalações, mas não painel fotovoltaico, automação, churrasqueira, paisagismo nem
móveis planejados. Estende a decisão de 2026-10-20 sobre leitura de texto por IA (que a retirou da ficha): agora a IA
volta como intérprete sobre o catálogo, nunca como fonte de preço. Virou [SPEC 137](../specs/137-estimativa-de-obra-itens-com-origem-do-preco.md)
e [ADR 0064](../architecture/adr/0064-toda-linha-da-estimativa-tem-origem-do-preco-e-a-ia-so-preenche-o-catalogo.md).
Cards: BEZ-82, BEZ-83, BEZ-69.

---

## 2026-10-20 · Diário de obra: registro nasce interno e o áudio fica 12 meses

**Decisão:** os registros do diário nascem internos (só vão ao portal do cliente quando o gestor liga "Mostrar ao
cliente") e o áudio de cada registro é guardado por 12 meses, depois só o texto fica. O Matheus mandou assumir os
dois padrões.

Contexto: no protótipo os registros apareciam como "Cliente vê"; o padrão interno evita vazar texto de campo ao
cliente por descuido. Fecha as suposições da [SPEC 135](../specs/135-diario-de-obra-em-registros.md) e da
[ADR 0062](../architecture/adr/0062-guardar-o-audio-do-registro-de-obra.md) (agora Accepted). Registrado em
[BEZ-67](https://linear.app/bez-company/issue/BEZ-67).

---

## 2026-10-20 · Estimativa de obra: terreno inclinado, padrão médio e SINAPI como próximo passo

**Decisão:** a ficha da estimativa passa a informar o relevo do terreno (inclinado soma muro de arrimo e deixa
terraplenagem e fundação especial a definir), o padrão "normal" do CUB aparece como "Médio", e a Caixa (SINAPI) é o
próximo passo para tirar os valores provisórios dos adicionais.

Contexto: o primeiro teste real (casa de 461 m² em SP, terreno inclinado) mostrou que o modelo ignorava o relevo. O
valor do muro de arrimo é provisório (não achei percentual confiável em fonte pública, só faixa de mercado de R$ 300 a
R$ 2.500 por m²). Registrado em [BEZ-68](https://linear.app/bez-company/issue/BEZ-68).

---

## 2026-10-20 · Estimativa de obra: CUB com e sem desoneração

**Decisão:** o Pilar guarda o CUB nas duas versões que os Sinduscons publicam, sem desoneração (série clássica) e
com desoneração da folha, e cada estimativa escolhe qual usar. Sem escolha, vale sem desoneração, a mais cara.
Mais adiante a tela mostra as duas cotações lado a lado.

Contexto: os valores diferem uns 3% (R-8 normal de SP em set/2026: R$ 2.238,58 sem e R$ 2.162,78 com), e há
cliente que trabalha em cada regime. Fica registrado em [BEZ-51](https://linear.app/bez-company/issue/BEZ-51).
Acrescenta a coluna `regime` em `cub_valores`; a SPEC 136 foi atualizada.

---

## 2026-10-20 · Estimativa de obra: sem leitura de texto livre por IA

**Decisão:** a estimativa não terá o campo de texto livre lido por IA. A ficha é preenchida só pelo assistente
(contadores e opções). A IA entra uma vez, na fase seguinte, lendo o PDF da planta.

Contexto: o assistente já cobre a ficha com poucos cliques, e o texto livre só duplicaria o passo 3. Supera o
item 4 da entrada de 2026-10-19 na parte do texto livre; a regra de que tudo que usa token consome os tokens do
usuário continua valendo para a leitura do PDF. Cancela o BEZ-15.

---

## 2026-10-19 · Cadastro por convite: o teste grátis self-serve acaba agora

**Decisão:** o Pilar deixa de ser aberto ao público. Toda empresa nova entra conversando com o
time: a landing troca "Testar grátis" por "Agendar demonstração" (WhatsApp do time) e o banco
recusa conta nova sem convite. Quem já tem conta, convite de membro, empresa criada pelo
ultra-admin e checkout pago pelo link que o time envia continuam. Reabrir é uma flag
(`platform_settings.cadastro_aberto`), sem migration.

Contexto: o único cadastro orgânico de produção usou o produto 5 minutos e sumiu; com poucos
clientes e venda de alto contato, a conversa converte melhor que o trial sozinho. Virou
[SPEC 133](../specs/133-cadastro-por-convite.md). Supera a decisão de 2026-09-08 ("cadastro fica
aberto, sem demo obrigatória") e a parte self-serve de 2026-10-08 (trial de 3 dias continua valendo
para as empresas que o time cria). Um bot de WhatsApp que qualifica e agenda fica para depois, como
produto dentro do Pilar; até lá vale a decisão de 2026-10-15 (sem API oficial do WhatsApp).

---

## 2026-10-19 · Gate D2 reaberto: estimativa de obra na proposta (CUB/SINAPI + cronograma)

**Decisão:** o Pilar passa a gerar uma **estimativa paramétrica de obra** para o escritório de
projeto levar ao cliente na fase de proposta: o usuário descreve a obra (tipo, padrão, área, o
que ela tem; na fase 2, enviando o PDF do projeto) e recebe custo em faixa, com fonte de preço
(CUB no MVP, SINAPI depois), e um cronograma pré-montado em fase, etapa e serviço, editável. O
resultado vira a obra (árvore de cronograma e previsto por etapa que já existem) ou um PDF para o
cliente.

Contexto: reunião do CEO de 18/10 ("melhorar drasticamente o módulo Obra"). Enquadramento que
mantém o ICP: quem usa é o escritório de projeto respondendo "quanto custa e quanto tempo leva",
não a construtora fazendo orçamento executivo. Regras: a IA só interpreta a descrição e monta a
ficha técnica; preço e prazo saem de um motor determinístico com a fonte citada; sempre faixa,
nunca número único, com o aviso "não substitui orçamento executivo"; previsto x realizado só por
grande etapa, sem curva ABC de insumo.

Supera o gate D2 de 2026-08-26 nos itens "template por tipo de obra", "IA de leitura de planta" e
"catálogo de composição" (este só como base de preço de referência, não como orçamento editável
item a item), os guardrails "sem SINAPI" da ADR 0011 e das specs 015, 016 e 019, e o item SINAPI e
leitura de planta da lista "não vender" do PRICING.md (só entra em material de venda quando estiver
na branch principal). Orçamento por ambiente continua fora. Próximo passo: protótipo no Claude
Design, depois spec.

**Decisões de escopo do MVP 1 (mesmo dia, depois do protótipo v0):**

1. A estimativa é um item próprio (Obras › Estimativas), ligado a lead ou proposta. Vira obra com um
   clique; a obra não exige projeto (ADR 0012), e o vínculo com projeto é opcional.
2. O preço de referência é o CUB por UF e padrão, e o ultra admin importa a planilha todo mês.
   Automação de coleta fica para depois. A fonte exata é confirmada com o Claudio.
3. Os adicionais (fundação, piscina, marcenaria, paisagismo, elevador) têm valor de referência do
   Pilar, e cada empresa ajusta os seus.
4. Tudo que usa token (leitura do texto livre e, na Fase 2, do PDF do projeto) consome os tokens
   do usuário, pelo motor de tokens. O cálculo de preço e prazo não usa IA.
5. A faixa padrão é de ±12%, editável em cada estimativa.

---

## 2026-10-19 · Diário de obra vira timeline de registros e o áudio passa a ser guardado

**Decisão:** o diário deixa de ser um formulário por dia e vira uma timeline de registros curtos
(áudio, foto, texto), quantos a equipe quiser por dia, inclusive do Pilar Campo. A IA organiza cada
registro em segundo plano e monta o "Resumo do dia", que o gestor revisa e fecha como RDO. O áudio
original fica guardado junto do registro.

Contexto: reunião de 18/10. O RDO por voz demorava (a pessoa esperava a transcrição terminar), só
existia no escritório e pedia campos fixos. Guardar o áudio permite processar depois sem prender a
pessoa na tela e deixa o registro original ouvível. Supera a decisão da [SPEC 080](../specs/080-rdo-por-voz.md)
("áudio bruto não persiste"); retenção, acesso e exclusão do áudio estão na [ADR 0062](../architecture/adr/0062-guardar-o-audio-do-registro-de-obra.md). Junto
disso, o mobile do app ganha casca própria (barra flutuante, lista em cards, formulário em sheet)
em vez de encolher o desktop ([SPEC 134](../specs/134-casca-mobile-barra-flutuante-lista-em-cards-e-sheet.md); o diário é a [SPEC 135](../specs/135-diario-de-obra-em-registros.md)). Protótipo aprovado no Claude Design em 19/10.

---

## 2026-10-16 · Marketing é produto próprio; o Pilar só abre a plataforma e devolve o funil

**Decisão:** tudo de marketing (campanhas, posts, carrosséis, vídeos, agendamento, analytics de
redes, anúncios e Search Console, e o agente de marketing) vive na plataforma web do repo
`post-automation`, como produto que pode ser vendido a outros escritórios. A Pilar é o primeiro
cliente dela. Dentro do Pilar fica só o botão "Abrir plataforma de marketing" no Ultra › Time, e o
Pilar devolve à plataforma cadastros, ativados e pagantes por link publicado (UTM), sem dado pessoal.

Contexto: decidido nos chats do `post-automation` (ADR 0002 de lá) e confirmado aqui. Supera parte
da decisão de 2026-10-15 e da ADR 0060: a ficha de Marketing no Ultra com números das redes e o
`ops-ingest` (o Pilar recebendo métrica social) saem do plano. Receita, Clientes, Produto, Qualidade
e Finanças continuam no Ultra, porque leem o banco do Pilar. Virou [ADR 0061](../architecture/adr/0061-marketing-e-produto-proprio-o-pilar-devolve-o-funil.md)
e [SPEC 128](../specs/128-plataforma-de-marketing-externa-e-funil-por-utm.md).

---

## 2026-10-15 · Lançamento público mira janeiro de 2027, com um time de agentes no Ultra

**Decisão:** três decisões que valem juntas:

1. O lançamento público tem data guia em janeiro de 2027 (T0 = terça, 19/01/2027). É data de
   referência para o calendário, não promessa a ninguém: antecipar é permitido.
2. Toda automação de conteúdo (gerar, renderizar, agendar e publicar post, carrossel e vídeo,
   e coletar métricas de redes, anúncios e Search Console) fica no repo `post-automation` e no
   banco dele. O Pilar recebe só os números e devolve o funil por UTM (ADR 0060).
3. Contato com cliente pelo agente é por link `wa.me` com o texto pronto; quem envia é o
   fundador. Sem API oficial do WhatsApp por enquanto.

Contexto: founder solo perto do lançamento quer agentes de receita, clientes, marketing,
produto e qualidade que rodem sozinhos e um painel único (grupo "Time" no Ultra). Virou
[SPEC 126](../specs/126-time-de-agentes-no-ultra.md) e [SPEC 125](../specs/125-telemetria-de-produto-e-erros.md).
Atualiza o roster de `docs/AGENTS_TEAM.md`, que só previa agentes chamados no Claude Code.

---

## 2026-10-14 · Release: o que fica manual de propósito

**Decisão:** três pontos do pipeline de release ficam como estão, por escolha:

1. `enforce_admins` continua desligado na `main`. O release usa `gh pr merge --admin --squash`
   para passar o review obrigatório de um time de uma pessoa. Ligar bloquearia o próprio release.
   O que protege no lugar: os dois checks obrigatórios (`CI OK` e `CodeQL`, este desde hoje) e o
   gate humano do Environment `Production` no deploy.
2. O CLI do Supabase fica pinado em 2.109.1 (`ci.yml`, `backup-nightly.yml`, `drill-restore-mensal.yml`).
   Subir é mudança que só um release prova: depois de trocar o pin, rodar `workflow_dispatch` do
   backup e do drill antes de confiar. Reproduzir build vale mais que aviso de versão nova.
3. O smoke de `/health` pós-deploy passa a falhar quando falta o secret (`SMOKE_OBRIGATORIO`), em
   staging e produção. Antes, secret ausente pulava o teste e o job saía verde.

Contexto: auditoria de produção de 14/10 (docs/operations/AUDITORIA_PRODUCAO_2026-10-14.md). O CI
passou a subir o Postgres em 17, a mesma versão major de produção; o `config.toml` do repo segue em 15
porque é o stack local de dev, compartilhado entre sessões.

---

## 2026-10-14 · Sem disciplinas "padrão do sistema"

**Decisão:** o Pilar não entrega mais disciplinas prontas. A lista de disciplinas nasce vazia, cada
empresa cria as suas e pode editar ou excluir qualquer uma. O estado vazio orienta a primeira ação
com um exemplo ("Arquitetônico"), sem card criado.
Contexto: feedback de 14/10, o usuário não conseguia excluir as "padrão do sistema" (RLS só deixa
apagar a da própria empresa). Quem já usava uma delas em projeto recebeu uma cópia própria na
migration, então ninguém perdeu opção. Supera o modelo de semente global da SPEC 058 (follow-up).

---

## 2026-10-14 · Tarefas visíveis para toda a empresa

**Decisão:** todo usuário da empresa vê as tarefas de todos (estilo Trello/ClickUp) e filtra por
pessoa quando quiser; sem filtro, vê o quadro inteiro. Editar e excluir seguem com admin,
coordenador, criador e responsáveis.
Contexto: tarefa sem responsável sumia de todas as telas e o usuário comum só enxergava as próprias.
Supera a regra "usuário comum só vê onde é responsável" (SPEC 118).

---

## 2026-10-08 · 2FA desligado por padrão; senha de 12 com tipos em todas as telas

**Decisão:** autenticação em dois fatores fica desligada para todo mundo e cada usuário ativa,
se quiser, em Configurações > Segurança (só o ultra-admin continua obrigado). O Pilar não vai
ter ação de suporte para desligar o 2FA de outra pessoa: a saída de quem perde o celular é o
código de recuperação, que agora é gerado ao ativar e desliga o 2FA ao ser usado. A senha
segue 12+ caracteres com maiúscula, minúscula, número e caractere especial, e essa regra passa
a valer em todas as telas, inclusive Configurações e Pilar Campo, que aceitavam 8. Contexto:
usuários reclamaram do código a cada login; eram as 7 contas que cadastraram o 2FA quando ele
era obrigatório e nunca saíram dele. Completa o [ADR 0031](../architecture/adr/0031-mfa-opcional-aal2-so-cross-tenant.md).

## 2026-10-08 · Trial cai para 3 dias; empresa convidada não paga e pode perder o convite

**Decisão:** o teste grátis do self-serve passa de 14 para 3 dias. Depois disso a empresa
consegue pagar a qualquer momento, inclusive já em somente leitura. Empresa convidada pelo
Pilar não paga e mostra o selo "Empresa convidada"; o ultra-admin pode tornar convidada
qualquer empresa que não paga e pode cancelar o convite, o que abre um prazo para assinar
(padrão 7 dias) com a mesma regra do trial vencido. Contexto: o primeiro cadastro orgânico de
produção (23/09) usou o produto 5 minutos e sumiu; o trial dele venceu sem expirar porque o
cron de produção nunca teve os secrets do Vault. Virou
[SPEC 104](../specs/104-trial-3-dias-e-empresa-convidada.md). Supera os "14 dias" da decisão
de 2026-09-08 (o resto dela, níveis Bronze/Prata/Ouro e retenção de 90 dias, continua) e o
prazo padrão de 14 dias da conversão de isenta (SPEC 078).

## 2026-10-06 · Notificação de pessoa volta; ordem das disciplinas fica com o fluxo

**Decisão:** toda ação que coloca trabalho no colo de alguém notifica essa pessoa: virar
responsável de disciplina ou tarefa, ter a etapa liberada porque a anterior concluiu, ser
mencionado num comentário (com link direto para a conversa). O aviso "você é responsável"
volta, apesar da remoção de 01/09 por 0% de leitura: aquela medição foi feita com o sino de
todo membro comum afogado em alerta financeiro indevido (corrigido no PR #511). Ordenar ou
arrastar disciplinas e cards **não** entra: a ordem é a do fluxo definido nas disciplinas e
não deve ser mexida à mão. Origem: VRZ (Larissa marcada em dez disciplinas sem aviso).
Virou [SPEC 102](../specs/102-notificacoes-de-pessoas.md) e
[SPEC 103](../specs/103-conversa-no-lugar-certo.md). Supera a remoção de `disciplina_atribuida`
em `20260894000000`.

## 2026-09-08 · Cadastro fica aberto; o trial sobe por nível de confiança (Bronze, Prata, Ouro)

**Decisão:** o cadastro self-serve continua aberto no lançamento (outubro/2026). Não haverá
waitlist, convite nem demo obrigatória antes do acesso. Em troca, o trial deixa de liberar a
capacidade de um plano pago para qualquer e-mail: a conta nasce no plano de entrada
(Essencial), entra na hora com o básico (Bronze: 2 projetos, 1 obra, 2 usuários, teto total
de IA), sobe ao informar CNPJ verificado na Receita ou CPF (Prata: 5 / 2 / 5) e chega à
capacidade do plano ao "ativar plano" com forma de pagamento sem cobrança ou ser aprovada no
ultra-admin (Ouro, 10 usuários no teste). Ativar plano torna o trial opt-out: no dia 14 cobra
o plano escolhido, sem nova aprovação, com consentimento datado no ato, aviso D-3 e D-1 e
arrependimento de 7 dias. Um trial por e-mail e um por CNPJ. Trial vencido sem pagar fica 90
dias em somente leitura com export, depois é excluído. Cada verificação é pedida no momento
em que o admin bate no limite, nunca adiantada no cadastro; usuário comum só avisa o admin.
Export liberado em todo nível; nenhuma feature é gateada; só capacidade (ADR 0026 mantido).
Virou [SPEC 098](../specs/098-trial-em-niveis-de-confianca.md)
e [ADR 0041](../architecture/adr/0041-acesso-no-trial-por-nivel-de-confianca-derivado-de-fatos.md).

**Contexto:** discussão do CEO com o time (mercado, vendas, pricing, red team) em 08/09
sobre exposição do software com cadastro aberto e trial tudo liberado. Convergência: fechar
cadastro protege de um risco que não existe na escala atual (zero pagante, ninguém acha o
Pilar organicamente) e mata a indicação que quer testar na hora; gate por feature contradiz
o ADR 0026 e converte pior para o sócio do escritório, que decide vendo o produto inteiro. O
risco real é abuso (várias contas queimando cota de IA) e ausência de degrau até o pagamento.
O modelo em níveis do gov.br resolve os dois sem fechar a porta. Proteção contra cópia de
interface foi explicitamente descartada como objetivo: UI é visível na landing e em demo; a
proteção real é o que roda no servidor mais a cláusula de uso restrito nos termos.

**Ordem de entrega:** Fase 0 (trial nasce no Essencial, cota de IA por nível, circuit
breaker, e-mail confirmado obrigatório, recusa de domínio descartável, contas existentes
marcadas como Ouro legado) é bloqueadora do lançamento. Níveis com capacidade, Ouro via
Asaas e retenção podem entrar depois do lançamento sem quebrar nada.

**O que isso supera:** a decisão de 13/08 de deixar o trial "aberto por ora" com controle
manual, e a leitura de que "14 dias grátis com tudo liberado" era o desenho de lançamento.
Também descarta, por ora, SMS como verificação (custo e sinal fraco) e qualquer forma de
waitlist.

---

## 2026-09-04 · `/inicio` vira painel de gestão da empresa, não página de atalho

**Decisão:** `/inicio` deixa de ser porta de entrada com atalhos e passa a ser o painel
informativo que a empresa monitora, inclusive numa TV na parede do escritório: comercial
(conversão de proposta, motivo de perda, origem de lead), entrega (prazo, atraso por
disciplina, pontualidade histórica) e dinheiro (faturamento previsto vs real, margem por
projeto, concentração de cliente). Os blocos de atalho de hoje (barra dos agentes, radar,
calendário) continuam, no rodapé.

**Contexto:** pedido do Bruno (VRZ) em 04/09: quer indicador de gestão numa tela só, com
gráfico ou porcentagem, "porque aí a gente consegue entender onde a gente tá indo mal e
onde precisa melhorar". O CEO expandiu o pedido: além das métricas que ele listou, a tela
tem que servir de painel de TV para o escritório inteiro. Virou [SPEC 092](../specs/092-painel-de-gestao-no-inicio.md)
e [ADR 0037](../architecture/adr/0037-inicio-e-painel-de-gestao-nao-atalho.md).

**Sem nenhum dado financeiro (decidido no mesmo dia, depois do primeiro mockup):** o
painel não exibe receita, custo, margem, caixa nem faturamento, e a RPC não seleciona
coluna monetária de tabela alguma. Dinheiro tem acesso restrito por eixo próprio
(`financeiro_delegado`, ADR 0034) e a tela é para ficar numa TV do escritório, vista por
estagiário, cliente e visitante. Onde a medida natural seria dinheiro, o painel usa a
medida física: proposta em contagem, esforço em horas, escopo pendente em quantidade e
dias de espera. O eixo que entrou no lugar é **produtividade**: ritmo de entrega semanal,
horas estimado contra real, carga da equipe (em dia contra atrasada), fila de aprovação
de escopo e retrabalho por disciplina. Em modo TV, nome de pessoa vira iniciais.

**O que isso supera:** a intenção original da spec 001 para o Início (página de atalho
centrada na barra dos agentes). A barra continua existindo, mas não é mais o herói da
tela: o número é. Supera também a primeira versão da SPEC 092, que tinha uma seção
Dinheiro (faturamento previsto vs real, margem por projeto, aging, concentração de
cliente, aditivos); os blocos seguem válidos como ideia, e o lugar deles é o Financeiro.

**Consequência de produto que ficou registrada:** dois indicadores só podem existir depois
de migration, porque o schema atual não guarda a informação. `propostas` não registra
quando foi enviada nem quando foi decidida (só o status atual), então "propostas enviadas
no mês" e ciclo de venda não são calculáveis hoje. E `projetos.data_previsao` é editável
sem baseline, então medir pontualidade contra ela faz todo projeto com prazo empurrado
contar como entregue no prazo. Indicador de prazo só entra com `data_previsao_original`
congelada.

---

---

## 2026-09-04 · Valor de contrato é campo de quem tem Financeiro; quem só cadastra projeto não informa

**Decisão:** quem cadastra projeto sem acesso ao módulo Financeiro não vê nem informa valor de
contrato e margem. Cadastra o projeto sem valor e um admin completa depois. Não vamos abrir
exceção para o momento da criação nem delegar financeiro só para liberar esse campo.

**Contexto:** a Liz (VRZ) é quem cadastra todos os projetos do escritório e tem role `user`. O
hardening da SPEC 073 / ADR 0034 passou a barrar escrita de `valor_contrato` sem
`can_view_financeiro()`, e em produção o campo continuava visível para ela porque o guard de
front ficou em staging: ela preenchia e tomava erro. Considerada a alternativa de dar
`financeiro_delegado` para ela, foi recusada porque a flag libera o Financeiro inteiro, não só o
campo de valor, e a VRZ tem três admins que podem preencher.

**Supera:** nada anterior. Fecha a dúvida de fluxo que o PR #448 deixou aberta.

## 2026-09-03 · Asaas não conecta por empresa; serve só para a Pilar cobrar seus clientes

**Decisão:** a integração de Asaas por empresa (cada cliente do Pilar traz sua própria conta/API
key Asaas para cobrar os próprios clientes deles) é abandonada. Asaas serve exclusivamente para
a Pilar cobrar SEUS clientes (checkout, assinatura, compra de pacote de tokens) — o que já é como
o motor de tokens e o checkout funcionam hoje.

**Contexto:** achado em QA no admin da empresa (`/admin` → aba Integrações) — a tela de config
por empresa (`AsaasConfigForm`) nunca foi ligada a nenhum caso de uso real: nenhuma empresa em
produção tem `asaas_config` preenchido, e o hook que a alimentava (`useAsaasConfig`) não tinha
outro consumidor. Confirmado com o CEO: não é prioridade, não entra no roadmap.

**O que isso supera:** qualquer menção a "empresa conecta o próprio Asaas" em docs de estratégia
mais antigos. Removidas do admin da empresa as abas Parâmetros, Automações e Integrações (a
segunda mostrava "Integrações ativas" redundante com a terceira; a primeira eram só atalhos para
telas que já existem em outro lugar) — `ParametrosTab`, `AutomacoesTab`, `IntegracoesTab`,
`AsaasConfigForm` e `useAsaasConfig` removidos do código. `asaas_config` (tabela), o RLS, e as
edge functions `asaas-config`/`asaas-webhook`/`asaas-criar-cobranca` NÃO foram tocados nesta
limpeza (risco de quebrar o motor de tokens/checkout de plataforma, que pode reusar a mesma
tabela para a config da própria Pilar) — se sobrar código morto ligado a cobrança por empresa
(`useAsaasCriarCobranca`, não tinha consumidor nem antes desta limpeza), é auditoria separada.

O que substitui "Parâmetros/Automações/Integrações" no admin da empresa (provavelmente uso por
usuário e consumo de tokens) ainda não foi decidido — o CEO vai pensar numa seção nova.

---

## 2026-09-01 (mais tarde ainda) · Diário da obra vira feed visual (tipo Instagram), interno + versão curada no portal do cliente

**Decisão:** o Diário (RDO) ganha uma segunda forma de exibição, tipo feed de rede social
(um card por dia: data, status, resumo curto, fotos, quem lançou) — em duas superfícies:

1. **Dentro do sistema** (aba Diário, interno): feed mostra tudo, sem filtro — mesmo dado
   operacional que já existe hoje (efetivo, impedimento, visita, tarefas), só num formato mais
   visual.
2. **No portal do cliente**: feed com **resumo curado**, não o RDO cru. Mostra atividades do
   dia + fotos + clima; impedimento, efetivo por fornecedor e fornecedor específico ficam de
   fora. Mantém a fronteira que a spec 030 já tinha fechado ("cliente vê avanço e conta, não o
   diário operacional inteiro") — não reabre essa decisão, só adiciona um formato novo de
   exibir o que já era permitido mostrar.

**Contexto:** benchmark competitivo do Obra Guru (que expõe até ocorrência/impedimento como
card próprio no feed do cliente — considerado e descartado aqui) + pedido direto do CEO:
reduzir a pergunta recorrente do dono da obra pro gestor ("como foi hoje?"), que hoje só se
resolve com o cliente ligando ou o gestor mandando mensagem solta. RDO por voz (specs 080/086,
01/09) já captura o material bruto pro feed funcionar sem esforço extra de lançamento: resumo
de atividades, fotos, clima.

**Supera:** nada de direção — é uma extensão aditiva da spec 030 (que continua valendo pro que
NÃO aparece no portal), não uma reversão.

---

## 2026-09-01 (mais tarde) · Pacote de tokens vira 4 tiers fixos com desconto por volume

**Decisão:** a compra avulsa de tokens deixa de ser "quantidade livre de pacotes de 500k a
R$49 cada" e vira 4 tiers fixos, com preço por milhão de tokens caindo conforme o tier sobe:

| Tier | Tokens     | Preço | R$/milhão | Desconto vs. tier 1       |
| ---- | ---------- | ----- | --------- | ------------------------- |
| 1    | 500 mil    | R$49  | R$98,00   | — (preço-base inalterado) |
| 2    | 1,5 milhão | R$129 | R$86,00   | ~12%                      |
| 3    | 3 milhões  | R$228 | R$76,00   | ~22%                      |
| 4    | 6 milhões  | R$399 | R$66,50   | ~32%                      |

**Contexto:** feedback direto do CEO testando o fluxo de compra em staging — selecionar
quantidade num campo numérico e forma de pagamento num radio genérico "ficou muito ruim"
perto do padrão de mercado (OpenAI, Anthropic Console: tiers fixos como cards clicáveis).
Com o COGS medido (~R$3,50/milhão, ver MOTOR_DE_TOKENS.md §3), mesmo o tier 4 com 32% de
desconto mantém margem ~95% — desconto por volume aqui é alavanca de ticket médio e
conversão, não sacrifício de margem.

**Supera:** o modelo de "1-20 pacotes de 500k a R$49 cada" fixado nesta mesma sessão mais
cedo (SPEC 077). O preço do tier 1 (R$49/500k) não muda — só deixa de ser o único ponto
da curva.

**Como aplicar:** catálogo de tiers fica hardcoded no backend (`pilar-token-pack-create`),
nunca aceita preço do cliente. UI mostra os 4 tiers como cards, sem campo de quantidade
livre (SPEC 080). Recalibrar os números quando a Fase 0 (dado real de uso em produção)
confirmar o COGS medido.

---

## 2026-09-01 (mais tarde) · ICP expande de "engenharia multidisciplinar" para incluir arquitetura

**Decisão:** arquitetura deixa de ser anti-persona. O ICP passa a ser escritórios de projeto
técnico em geral — engenharia multidisciplinar (civil/estrutural/MEP) e arquitetura — que vendem
projeto por proposta e têm fluxo de disciplina/etapa, não só engenharia pura.

**Contexto:** Rafael (Mawe Arquitetura) é design partner desde 18/08 e é hoje o sinal de produto
mais forte que o Pilar tem: validou a metodologia de cronograma com pausa por etapa de forma
cruzada (prototipou o mesmo padrão fora do Pilar, sem ver o código), é a primeira reação
espontânea positiva forte ao portal do cliente (0% de adoção nas outras 4 empresas), e gerou
stories promovendo o Pilar por conta própria. `brand/personas.md` (mesa redonda 13/05) descartava
arquitetura por "fluxo criativo, fases diferentes" — na prática, o fluxo de disciplina→etapa que
o Pilar já modela serve os dois igualmente bem; a divergência prevista não se confirmou com uso
real.

**Supera:** a linha ❌ "Não é: arquitetura pura" de `brand/personas.md` e a tensão #1 de
`brand/BRAND.md` ("recomendo alinhar a copy pra engenharia") — o caminho inverso venceu: expandir
o ICP oficial, não estreitar a copy. Construtora/incorporadora (gestão de obra como núcleo)
continua fora — isso não mudou.

**Como aplicar:** copy, onboarding e priorização de feature passam a considerar arquitetura como
público primário, não caso lateral. `personas.md` e `BRAND.md` atualizados nesta mesma entrada.
Não implica perseguir arquitetura ativamente em GTM ainda — é ICP oficial, a validar com mais
design partners antes de virar mensagem de aquisição.

---

## 2026-09-01 · Ativação do Asaas de plataforma é iniciativa própria, sandbox primeiro

**Decisão:** ligar o Asaas que cobra a assinatura do Pilar (não o Asaas por-empresa, que já
tem UI e é opt-in do cliente) é trabalho separado do motor de tokens, começando por sandbox.
Produção só entra com um cliente concreto pronto pra pagar de verdade.

**Contexto:** testando o motor de tokens em staging, ficou claro que nenhum ambiente
(staging ou produção) tem qualquer credencial `ASAAS_PLATFORM_*` configurada — o checkout de
assinatura (`pilar-checkout-create`/`pilar-subscription-manage`) nunca foi ligado em lugar
nenhum, o que bate com "zero pagante". Levantamento completo em
`docs/operations/AUDITORIA_ATIVACAO_ASAAS_2026-09-01.md`, que também corrige um erro anterior:
a Fase 3 do motor de tokens (compra de pacote) tinha sido descrita usando o Asaas por-empresa
(`asaas-criar-cobranca`); o certo é o Asaas de plataforma, o mesmo da assinatura.

**Supera:** a suposição registrada nas specs 074/075 do motor de tokens sobre qual Asaas a
Fase 3 usaria.

**Como aplicar:** próximo passo é o checklist de sandbox da auditoria (chave sandbox +
3 secrets + webhook de teste); a Fase 3 de tokens só volta à mesa depois disso estar rodando,
e reusa a mesma base de credencial.

- Decisão que muda arquitetura/stack vira ADR (`docs/architecture/adr/`) e ganha só um ponteiro aqui.
- Decisão sensível (segurança, marca não registrada, dado de cliente) NÃO entra aqui: o repo é
  público. Fica na memória do projeto e é passada no prompt quando relevante.
- Os agentes de time (`.claude/agents/`) leem este arquivo antes de qualquer análise, por
  protocolo escrito nos próprios agentes.

---

## 2026-08-31 · IA Hub inteiro sai do repo, junto com Capacidade e Templates: matar em vez de deixar apodrecer

**Decisão:** removidas as 11 edge functions do IA Hub (`ai-aditivo-copilot`, `ai-diagnostico-precificacao`,
`ai-proposta-copilot`, `ai-documentos`, `ai-fechamento-mensal`, `ai-pauta-reuniao`,
`ai-planejador-contratacao`, `ai-previsao-atraso`, `ai-radar-cliente`, `ai-relatorio-executivo`,
`ai-simulacao-impacto`), a página `/gestao/ai`, a flag `ai_hub`, a fila de revisão de orçamentos
dentro de `/agentes` (só existia pra aprovar output do `ai-proposta-copilot`), e as páginas de
Capacidade e Templates. ~7.400 linhas de código morto saíram junto (PRs #370, #371, #372).
`ai-chat`, `ai-cotacao-import` e `ai-import-financeiro` (as 3 IA vivas de verdade) não foram
tocadas.

**Contexto:** achado ao investigar o "núcleo defensável" de 3 tools que a discussão de 20/07
(`docs/strategy/DECISAO_IA_FEATURES_AGENTES_2026-07-20.md`) mandou manter (Aditivo, Precificação,
Proposta): as 3 estavam quebradas contra o schema atual, liam `.from("timesheets")`/
`.from("billing_milestones")`, tabelas renomeadas para `timesheet_lancamentos`/
`marcos_faturamento`. Ninguém ia ligar `ai_hub` (desligada em toda empresa) nos próximos 60 dias.
Em vez de consertar 2 queries pela metade pra uma feature que não vai ser usada, decidiu-se
deletar tudo. Capacidade e Templates saíram pelo mesmo padrão: `addon: true, dormant: true`,
desligadas desde a adoção, zero uso real.

**Supera:** o veredito "manter (tool)" de Aditivo/Precificação/Proposta na discussão de 20/07 —
essas 3 especificamente. As outras 8 já tinham veredito "matar"/"adiar" lá, sem mudança.

**Como aplicar:** se o IA Hub voltar a ser discutido, o ponto de partida não é "religar" o código
deletado (git guarda o histórico se precisar de referência) — é reconstruir contra
`projeto_disciplinas.horas_realizadas`/`tarefas.horas_reais`, que já capturam horas previstas e
reais por disciplina e por tarefa hoje (achado paralelo: não é o "Timesheet" dormente, é um campo
manual mais leve, editável em Projetos/Meu Trabalho, que só não estava plugado na conta de
margem — reconectado em Rentabilidade pelo PR #373).

---

## 2026-08-31 · Camada 2 de IA vira "token", não "ação de IA": reverte a doutrina de nunca expor token

**Decisão:** a unidade de uso de IA visível e comprável pelo cliente passa a ser **token**, pelo
nome, em toda superfície (saldo, cota do plano, compra de pacote extra). Não existe mais camada
de tradução "ação de IA" para o usuário final.

**Contexto:** `docs/strategy/PRICING.md` (decisão 17/08, item 3) registrava o oposto: "o cliente
nunca vê 'token'", com "ação de IA" como unidade traduzida e o token escondido como COGS
interno. O CEO decidiu direto o contrário: o termo "token" já é conhecido do cliente (mercado de
IA generalizou o termo) e não precisa de tradução.

**Supera:** o item 3 da revisão 17/08 do PRICING.md e a linha 166-168 ("Camada 2: Ações de IA")
do mesmo doc — ambos ficam obsoletos nesse ponto específico; o resto da Camada 2 (cota no plano,
pacote extra, margem ~2,5x custo) continua valendo, só troca a unidade e o nome. Todo texto de
produto, UI, e checkout que viesse a dizer "ação de IA" usa "token" em vez disso.

**Como aplicar:** o ledger de uso de IA (ver estrutura técnica combinada em 31/08, arquitetura
descrita na memória do projeto) usa `tokens` como unidade de cota, saldo e cobrança — sem
`peso_acao` nem conversão. `PRICING.md` precisa de um bloco de atualização apontando pra esta
entrada na próxima revisão do documento.

---

## 2026-08-26 (à noite) · Gate D2 fechado: orçamento continua por disciplina/etapa, não por ambiente

**Decisão:** o Pilar não migra pra orçamento paramétrico por ambiente (pavimento → ambiente →
composição de custo, no espírito do Time 2 Build). O modelo atual (Escopo/Aditivo, por
disciplina e etapa) é o certo pro ICP de engenharia multidisciplinar.

**Contexto:** o gate D2 do backlog T2B→Pilar estava em aberto desde 25/08, com recomendação da
mesa de agentes de só reabrir com sinal comportamental de design partner pagante (a amostra de
validação disponível é viciada: Mawe é escritório de arquitetura, anti-ICP declarado; VRZ não
paga). O CEO decidiu direto, sem esperar essa validação: disciplina/etapa é o modelo certo.

**Supera:** fecha definitivamente a trilha C do Mapa de Melhorias (catálogo de composição de
custo, templates por tipo de obra, composição global por pontos, BDI em cascata, orçamento por
ambiente, IA de leitura de planta) — deixa de ser "gated D2, aguardando validação" e vira "não
faz, decisão tomada". OBR-7 fecha. O item H4 do backlog original (perguntar aos design
partners) fica sem objeto: a resposta não muda mais a decisão.

**Como aplicar:** qualquer pedido futuro de "orçamento por ambiente" ou "catálogo de
composição" nasce contra esta decisão; um agente pode discordar, mas citando este registro,
não uma comparação genérica com concorrente. OBR-3 (medição → fatura) segue como indicador de
avanço junto ao marco de faturamento (Opção A), nunca como motor automático de cobrança
derivado de composição de preço, porque essa peça de infraestrutura (catálogo com preço
unitário por item) não vai existir.

---

## 2026-08-26 · Correção factual: Obras não está tão fraco quanto a entrada de 25/08 supõe

**Não é uma nova decisão de direção** (a de 25/08 abaixo continua valendo: Obras é prioridade),
é uma correção de premissa que mudaria a leitura de quem ler só a entrada de 25/08. Ao escrever
a spec 062, a leitura de `docs/specs/040-obra-inteligente-cronograma-diario-clima.md`,
`018-cotacoes-na-obra.md` e `042-pilar-campo-app-de-campo.md` (todas "Entregue" ou "Em
implementação") mostrou que o diário já reporta contra o cronograma com alerta de clima, a
cotação já compara fornecedores e decide, e existe um **PWA offline completo para o campo**
(Pilar Campo, spec 042, credencial gerada pelo gestor, foto, fila de sincronização) que a
memória de 11-13/08 registrava como pendente e já está nas fases 1-5 entregues.

**Como isso muda a execução (não a prioridade):** o gap real em Obras é mais estreito e mais
barato do que "diário estruturado do zero" sugeria: ver spec 062 (efetivo por fornecedor,
impedimento tipado, visita ligada ao cadastro) como o primeiro corte, não um redesenho do
módulo. Antes de especificar a próxima peça de Obras, ler as specs 015/018/020/027/040/042
inteiras, não só a memória de sessões passadas.

---

## 2026-08-25 · Módulo Obras é a frente prioritária de melhoria do produto

**Decisão:** melhorar o módulo Obras (hoje o mais fraco do produto) é a prioridade de roadmap,
minerando o bloco de execução mapeado na auditoria competitiva do Time 2 Build: diário de obra
estruturado, fluxo formal de cotação/compras em volta do `ai-cotacao-import`, e medições,
adaptados ao ICP do Pilar.

**Contexto:** a mesa de agentes de 25/08 recomendou não atacar Obras (proteção de ICP contra
"soar construtora"). O CEO rejeitou esse veredito: o módulo existe, está em produção, é o mais
fraco, e é onde ele quer melhorar agora.

**Supera:** o gate D1 do backlog T2B→Pilar ("não entrar em operação de canteiro") deixa de ser
um não; vira uma questão de PROFUNDIDADE, ainda aberta (até onde entrar: acompanhamento
estruturado já decidido; PCP por ciclos completo e orçamento por ambiente seguem em avaliação,
ver gate D2). Agentes devem argumentar a partir desta decisão, podendo discordar dela, mas da
versão atual, não da antiga.

---

## 2026-08-26 (mais tarde) · Achado: OBR-3 (medição vira fatura) tem dependência de arquitetura não resolvida

**Não é uma decisão de direção**, é um achado técnico que muda a ordem de execução dentro da
Frente Obras. Ao escopar a spec seguinte (OBR-3, medições por período ligadas à fatura), a
leitura de `marcos_faturamento` (`005_orcamento_marcos_faturas.sql`) mostrou que o marco é
vinculado a **`projeto_id`** (não a `obra_id`), tem `valor` fixo definido na proposta/orçamento,
e vira receita via `rpc_faturar_marco` sem depender de medição física nenhuma.

"Medição de obra fecha em fatura", no espírito do T2B, não tem onde encaixar nesse modelo sem
uma decisão real: um marco pode nascer do progresso medido, ou a medição só serve de evidência
pra decidir manualmente faturar um marco já existente? Isso é decisão de produto (como o Pilar
liga execução física a faturamento), não implementação.

**Ordem revisada:** OBR-4 (Curva S da obra) entra antes de OBR-3, por ser autocontido — usa
`obra_rdo_tarefa` (spec 040) e as datas do cronograma de 2 níveis (spec 027), sem tocar em
faturamento. OBR-3 volta à fila quando essa decisão de marco↔medição estiver tomada.
