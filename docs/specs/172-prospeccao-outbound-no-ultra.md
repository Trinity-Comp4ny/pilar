# SPEC 172: Prospecção outbound no Ultra (mapear leads e disparo semi-manual por WhatsApp)

**Data:** 2026-11-19
**Status:** Fase 0 em implementação (branch `feat/prospeccao-fase-0`); fases 1 a 3 pendentes
**Autor:** Matheus Rezende
**Módulo:** ultra-admin + edge functions + `pg_cron` (operação da Pilar)
**Relacionada:** [SPEC 126](126-time-de-agentes-no-ultra.md) (Time de agentes; cita este CRM como "spec própria"), [ADR 0050](../architecture/adr/0050-agente-que-grava-rascunho-cita-evidencia.md), [ADR 0051](../architecture/adr/0051-modelo-de-ia-por-configuracao-com-gateway.md), [ADR 0056](../architecture/adr/0056-edge-function-por-endpoint-uniforme-por-regra.md) (`cronAutorizado`)

## Problema

A venda da Pilar é founder-led e hoje a prospecção é manual: achar escritório, achar o número,
escrever a mensagem, mandar. O fundador mandou uma base de 300+ leads de Marília e região
(scraping próprio) e quer escalar para o Brasil inteiro, em mais de um segmento, sem gastar o dia
nisso. Meta de partida: **10 mensagens por dia (50 por semana, ~200 por mês)**.

## Objetivo

Toda semana o sistema mapeia leads novos sozinho. Todo dia o ultra admin abre uma fila com 10
cards já prontos (escritório, nome ou "responsável", telefone, mensagem preenchida) e dispara cada
um com um toque, que abre o WhatsApp com o texto pronto. Quem envia é sempre o fundador.

## Fora de escopo

- API do WhatsApp e qualquer envio automático (decisão da SPEC 126; mensagem fria por API fere a
  política da Meta e derruba o número). O botão só abre `https://wa.me/<tel>?text=<msg>`.
- Raspar LinkedIn ou redes sociais para achar decisor (viola termos de uso). Decisor vem de fonte
  pública cadastral (quadro societário do CNPJ) e do que o próprio contato responder.
- Cadência automática de follow-up. Fase 3, depois de medir resposta.
- Mudar o ICP do produto (ver "Segmentos").

## Segmentos

| Segmento                                                                                  | Tratamento                                            | Mensagem enfatiza                                              |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| Arquitetura, engenharia (civil, estrutural, MEP), projeto técnico                         | **ICP vigente**                                       | orçamentos, projetos, equipe e financeiro (texto atual)        |
| Engenharia com obra                                                                       | ICP vigente                                           | gestão de obras                                                |
| Marcenaria, móveis planejados, marmoraria, vidraçaria, esquadrias e alumínio, serralheria | **Teste de mercado**, marcado `segmento_teste = true` | orçamento, medição, produção, instalação e cobrança por pedido |
| Construtoras                                                                              | **Teste de mercado** (fora do ICP)                    | etapas, equipes, atividades e financeiro da obra               |

O ICP em `DECISOES.md` é escritório de projeto técnico, não construtora. Os segmentos de teste
são **adjacentes**: entram na prospecção como experimento, medidos por taxa de resposta e
reunião marcada por segmento. Só viram ICP se os números pedirem, por decisão registrada no
DECISOES.md. Nada no produto muda por causa deste teste.

## Base existente (importada na fase 0)

O fundador entregou 3 arquivos de 2026-11-18 com a **mesma base de 362 leads** (kit de WhatsApp, base
de Marília e região, CSV para ClickUp). O importador lê a planilha "Todos os leads" e deduplica por
telefone normalizado. Retrato da base, sem nenhum dado de lead neste repositório público:

- **Cidades:** Marília 264, Garça 55, Tupã 18, Oriente 12, Pompéia 10, Vera Cruz 3.
- **Segmentos (8):** arquitetura 86, móveis planejados e marcenaria 83, construtoras 70, engenharia 37,
  vidraçarias 34, marmorarias 19, esquadrias e alumínio 19, serralherias e estruturas 14.
- **Telefone:** 254 leads com celular e 108 só com fixo. Apenas 10 têm WhatsApp indicado na fonte.
- **Contato:** 24 com nome de pessoa público e 23 com e-mail. Fonte principal: diretório Solutudo (260).
- **Qualidade:** a maioria está como "checar antes de abordar"; o importador guarda esse campo e só
  promove à fila o que passar na validação mínima (telefone válido, segmento reconhecido).

Como quase nenhum lead tem nome de pessoa confirmado, a **variante `empresa` é a padrão** na fase 0.

## Canal por lead

Telefone de diretório não é opt-in (a própria aba "Política e processo" do kit diz isso, e a Meta
restringe número que recebe denúncia). O risco do envio frio não some; a spec o reduz por regra:

| Lead                            | Canal sugerido no card       |
| ------------------------------- | ---------------------------- |
| Celular válido                  | WhatsApp (botão `wa.me`)     |
| Só fixo, com e-mail             | E-mail (modelo do kit)       |
| Só fixo, sem e-mail             | Ligação (roteiro do kit)     |
| Pediu para parar, ou sinalizado | Nenhum (`prospec_bloqueios`) |

Mitigações obrigatórias: **chip e WhatsApp Business dedicados** (não o número pessoal), 10 por dia em
horário comercial, mensagem curta com uma pergunta, parar no primeiro "não" e no primeiro sinal de
denúncia (o painel mostra "número em risco" se vierem 2 bloqueios na semana e pausa a fila).

## Os agentes

Reusam o executor e o padrão da SPEC 126 (`ops-agente-run`, `ops_agentes`, `ops_execucoes`,
heartbeat em `agent_cron_heartbeats`). Novo agente `prospeccao` com três papéis em sequência:

1. **Mapeador** (cron semanal, domingo 22h BRT): consome a fila de "células" cidade × segmento e
   busca estabelecimentos. Fontes: **Google Places** (telefone atual, site, avaliação) e **base de
   CNPJ** (razão social, CNAE, quadro societário). Deduplica por `place_id`, CNPJ e telefone
   normalizado. Respeita um teto de gasto por semana (`ops_agentes.teto_mensal_brl`).
2. **Qualificador** (logo após o mapeador): classifica segmento, nota de encaixe 0 a 100, tipo do
   número (celular ou fixo), existência de site e a certeza sobre quem atende o telefone (ver
   "Pessoa ou empresa"). Descarta o que não encaixa e o que está em `prospec_bloqueios`.
3. **Redator** (todo dia 07h): escolhe os 10 melhores leads prontos e preenche a mensagem. O
   texto é montado por **modelo com variáveis**, não escrito livre pelo LLM: o modelo de linguagem
   só ajusta o `[ramo]` e valida a coerência (ADR 0050: ação sem evidência é descartada).

### Cascata geográfica

A fila de células avança em ordem de prioridade, sempre dentro do teto semanal:

1. Marília e cidades num raio de 100 km
2. Resto do estado de SP, por população
3. Capitais e regiões metropolitanas do país
4. Demais municípios por população decrescente

Cada célula guarda `ultima_busca_em` e só repete depois de 90 dias. A tela mostra cobertura por
região (células feitas ÷ total) e leads por cidade, estado e região.

## Pessoa ou empresa (dois tipos de mensagem)

O telefone raramente é da pessoa. Por isso há duas variantes, escolhidas por `confianca_contato`:

- **`pessoa`**: só quando há certeza razoável de que o número é de uma pessoa nomeada (MEI ou
  empresário individual com celular no cadastro, sócio-administrador com celular, ou lead já
  marcado como pessoa na base importada). Usa `[nome]`.
- **`empresa`**: qualquer outro caso. Cumprimenta pelo nome do escritório e **pergunta quem cuida
  da gestão/contratação**, para chegar ao tomador de decisão. A resposta preenche `decisor_nome` e
  o lead passa a `pessoa` nas próximas mensagens.

### Modelos (rascunho; editáveis na tela, versionados em `prospec_modelos`)

**Pessoa** (texto do fundador, com a saudação automática por horário):

> {saudacao}, {nome}! Tudo bem?
> Sou o Matheus, fundador da Pilar, um software de gestão para escritórios de {ramo} que nasceu {origem}.
> A Pilar reúne orçamentos, projetos, equipe e financeiro em um só lugar, e estamos apresentando para empresas da região.
> Podemos marcar uma reunião para te apresentar?

**Empresa:**

> {saudacao}! Aqui é o Matheus, fundador da Pilar. Falo com a {escritorio}?
> A Pilar é um software de gestão para escritórios de {ramo} que nasceu {origem}: reúne orçamentos, projetos, equipe e financeiro em um só lugar.
> Com quem eu falo sobre a gestão do escritório? Queria te apresentar rapidinho.

Variáveis: `{saudacao}` por horário (Bom dia, Boa tarde, Boa noite; o texto do fundador fixa
"Bom dia" e só serve de manhã); `{ramo}` por segmento (arquitetura, engenharia, marcenaria...);
`{origem}` é "aqui em Marília" num raio de 100 km e "em Marília (SP)" fora dele, para não afirmar
proximidade que não existe. Toda mensagem termina o ciclo com a opção de parar: a linha final de
saída ("se não fizer sentido, é só me avisar que eu não escrevo mais") entra na **segunda**
mensagem e em qualquer follow-up, não na primeira, para manter o tom do fundador.

## Tela (mobile primeiro, o dono trabalha pelo celular)

`/ultra-admin/time/prospeccao`, na ficha padrão do agente, mais a aba **Hoje**:

- Fila de 10 cards: escritório, cidade, segmento, nome ou "responsável", telefone, nota de
  encaixe, prévia da mensagem (editável antes de enviar).
- Botão principal **Abrir no WhatsApp** (`wa.me`), depois do toque o card pergunta "Enviou?"
  (Enviei, Pular, Número errado, Pediu para parar). Só "Enviei" conta na meta do dia.
- Resultado por lead: `sem_resposta`, `respondeu`, `reuniao_marcada`, `nao_tem_interesse`,
  `parar` (vai para `prospec_bloqueios`, nunca mais entra na fila).
- Abas Leads (busca e filtro por cidade, estado, região, segmento), Cobertura e Configuração
  (limite diário, janela de horário, modelos, teto de gasto).

## Modelo de dados (rascunho)

Tabelas próprias do Ultra, não de tenant, no mesmo padrão da SPEC 126: leitura só `is_ultra_admin()`,
escrita só pelo service role. **Diverge de uma linha da SPEC 126** ("usa o módulo Leads numa empresa
interna"): o módulo Leads é por empresa e não guarda geografia em células, dedupe nacional, nota de
encaixe nem decisor. Ao marcar `reuniao_marcada`, o lead é **promovido** (copiado) para Leads
numa empresa interna, para o pipeline comercial seguir lá.

- `prospec_celulas` (`uf`, `cidade`, `ibge`, `segmento`, `prioridade`, `ultima_busca_em`, `status`)
- `prospec_leads` (`id`, `origem` enum `import | places | cnpj`, `place_id`, `cnpj`, `nome`,
  `segmento`, `segmento_teste`, `uf`, `cidade`, `regiao`, `telefone_e164`, `tipo_telefone`,
  `site`, `decisor_nome`, `confianca_contato` enum `pessoa | empresa`, `nota_encaixe`,
  `status`, `resultado`, `ultimo_contato_em`, `evidencia jsonb`)
- `prospec_envios` (`lead_id`, `modelo_id`, `texto_final`, `enviado_em`, `resultado`)
- `prospec_modelos` (`variante`, `segmento`, `texto`, `versao`, `ativo`)
- `prospec_bloqueios` (`telefone_e164` ou `cnpj`, `motivo`, `criado_em`)

## Privacidade e LGPD

- Base legal: legítimo interesse em contato B2B com dado público de empresa. O telefone de MEI
  pode ser dado pessoal; por isso `parar` é definitivo e imediato, e o titular pode pedir exclusão
  (reusa o fluxo de `excluir-dados-titular`).
- Guardar só o necessário: nome da empresa, telefone, cidade, nome do decisor quando ele mesmo disse.
- Teto de 10 por dia (configurável), janela 08h às 18h em dias úteis, nunca o mesmo lead em menos de
  90 dias, e número que nunca respondeu não recebe segunda mensagem na fase 1.
- Repo é público: nenhum lead real, telefone ou chave em fixture, doc ou teste. Seeds sintéticos.

## Custo (estimativa; confirmar na tabela de preços do Google antes de ligar)

| Item                                                                                                                                     | Custo                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Google Places, busca com telefone (faixa Enterprise: 1.000 buscas grátis por mês, depois ~US$ 35 por 1.000; confirmar na tabela oficial) | **R$ 0** no ritmo de 200 leads/mês; 5.000 buscas/mês ≈ US$ 140; **teto semanal e cota diária no GCP obrigatórios** |
| Base de CNPJ (BrasilAPI ou dump da Receita)                                                                                              | R$ 0                                                                                                               |
| Modelo de linguagem (qualificar e conferir 200 leads/mês)                                                                                | ~US$ 2 a 5                                                                                                         |
| WhatsApp                                                                                                                                 | R$ 0 (o fundador envia do próprio aparelho)                                                                        |

**Termos do Google (a confirmar antes da fase 1):** pelo que se conhece, guardar conteúdo do Places além
do `place_id` é restrito. Se for o caso, `prospec_leads` guarda só `place_id` para leads vindos do
Places e o telefone é buscado (Place Details) quando o lead entra na fila do dia: ~10 por dia, dentro
da cota grátis. Leads da base importada e do CNPJ não têm essa restrição.

O mapeador **para sozinho** ao atingir o teto da semana e registra o que ficou de fora; nunca
estoura a conta. Cobertura nacional completa é o que mais custa, por isso a cascata acima.

## Fases

0. **Importar a base existente** (362 leads, 254 com celular) + canal por lead + tela Hoje + modelos
   - botão `wa.me` + resultados. Já dá para disparar 10 por dia sem nenhuma API nova (≈ 25 dias úteis
     só de celular). Sem Places, sem cron. O arquivo de origem não entra no repositório.
1. **Mapeador Places + cascata** + cron semanal + teto de gasto + cobertura por região.
2. **Enriquecimento por CNPJ** (decisor pelo quadro societário, segmento por CNAE).
3. **Medição**: taxa de resposta e de reunião por segmento, por modelo e por região; teste A/B de
   mensagem; follow-up com aprovação; decisão sobre os segmentos adjacentes.

## Fase 0: o que foi construído e onde diverge do rascunho

- Rota `/ultra-admin/prospeccao` (grupo Produto do menu, junto de Reuniões), abas **Hoje** e **Leads**, e
  botão **Importar leads** (XLSX ou CSV lido no navegador; o arquivo nunca sobe).
- Migration `20261234920000_prospeccao_fase_0.sql`: `prospec_leads`, `prospec_envios`,
  `prospec_bloqueios` e as RPCs `prospec_montar_fila` e `prospec_registrar` (toda mudança de estado
  passa por elas). `prospec_celulas` e `prospec_modelos` ficam para a fase 1.
- **Modelos de mensagem ficam em código** (`prospeccaoLib.ts`, versionados no git) e a mensagem é
  editável em cada card antes de enviar. A tabela `prospec_modelos` entra quando houver A/B (fase 3).
- **Risco de bloqueio avisa em vez de pausar**: com 2 ou mais "parar" ou "número errado" em 7 dias,
  a aba Hoje mostra um alerta. A pausa automática da fila fica para a fase 1.
- Fila: completa até 10 por dia contando o que já foi enviado hoje, ICP antes de segmento de teste,
  nunca traz bloqueado e só traz lead de WhatsApp. E-mail e ligação aparecem na aba Leads com o canal;
  o envio por esses canais fica para a fase seguinte.
- `types.ts` foi editado à mão (sem Docker na máquina): rodar `npm run gen:types:local` e commitar o
  resultado antes do merge, que é o que o job `types-sync` confere.

## Perguntas abertas

1. ~~Onde está a base~~ Respondida em 2026-11-19: 3 arquivos em `~/Downloads` (ver "Base existente").
   Falta decidir só **como subir o arquivo**: tela de importação no Ultra (recomendado, CSV/XLSX
   processado no navegador, sem passar por repo).
2. **Chave da Google Places API**: projeto GCP dedicado (`pilar-prospeccao`), faturamento ligado,
   Places API (New), chave restrita a essa API, **cota diária** definida e alerta de orçamento. A chave
   entra como secret da Edge, gravada pelo fundador, nunca no repo nem no chat.
3. **Qual aparelho envia**: o WhatsApp Business do celular do fundador? Recomendado, pelo perfil
   comercial e pelo catálogo de mensagem rápida.
4. **Segmentos adjacentes**: confirmar que entram só como teste, sem mexer no ICP.
5. **Mensagem de saída** na segunda mensagem: aprovar o texto.
