# SPEC 169: Cérebro de reuniões no Ultra

**Data:** 2026-11-19
**Status:** Rascunho (fase 0 e 1; sem código ainda)
**Autor:** Matheus Rezende
**Módulo:** ultra-admin + edge function (operação da Pilar)
**Relacionada:** [SPEC 126](126-time-de-agentes-no-ultra.md) (Time de agentes), [ADR 0050](../architecture/adr/0050-agente-que-grava-rascunho-cita-evidencia.md) (evidência citada), [ADR 0051](../architecture/adr/0051-modelo-de-ia-por-configuracao-com-gateway.md) (modelo por configuração), `DoresMercado` e `Feedback` do Ultra

## Problema

O que os escritórios dizem nas reuniões (dores, ideias, objeções, pedidos) vive no Granola e na
cabeça do fundador. Não vira base consultável, não se soma entre reuniões e não vira decisão de
produto com evidência. Hoje o fundador lembra do último cliente e constrói para ele.

## Objetivo

O ultra admin cola o transcript de uma reunião e o sistema classifica, extrai cada ponto com a
citação literal e guarda numa base que cresce a cada reunião. Depois de algumas reuniões, o agente
"Inteligência de Clientes" agrega, cruza com `DoresMercado` e `Feedback` e deixa recomendações em
rascunho, cada uma com a evidência que a sustenta.

## Decisão de ingestão (2026-11-19)

O Granola do fundador é gratuito. A API oficial exige Business ou Enterprise; o MCP gratuito lê só
os últimos 30 dias, sem transcript e sem pasta. Portanto a **fase 1 é colagem manual**. A ingestão
automática (cron à meia-noite lendo a pasta Pilar) fica para a fase 2, condicionada a assinar o
Business, e só troca a fonte: tabelas e agente não mudam. Não usar API reversa não oficial.

## Fora de escopo

- Ingestão automática do Granola (fase 2).
- CRM de contas, contatos e oportunidades (fase 3, spec própria; ver Pergunta aberta 3).
- Envio de qualquer coisa a cliente. O agente só deixa rascunho para aprovação (N2).
- Gravar áudio ou transcrever. O texto vem pronto do Granola.

## Fluxo da fase 1

1. Ultra › Time › Reuniões › "Nova reunião": campos título, data, origem (nome do escritório,
   opcional) e a caixa do transcript (ou do resumo, se o transcript não existir).
2. Salvar passa o texto pela redação (credencial, telefone, e-mail, valor de contrato) e grava só
   a versão redigida em `reuniao`, com status `pendente`. O campo `origem_contato` é obrigatório.
3. Edge `reuniao-analisar` (admin do Ultra, rate limit) roda o analista e grava a classificação e os
   insights. Status `analisada`.
4. Tela da reunião mostra tipo, confiança e os insights com a citação. O fundador **corrige** o
   tipo e remove ou edita insight. A correção vira rótulo para medir o erro do agente.
5. Tela "Cérebro": filtra por tipo de insight, módulo do Pilar e escritório; mostra quantas
   reuniões e quantos escritórios distintos sustentam cada tema.

## Achados da Fase 0 (3 reuniões reais, 2026-11-19)

Testada a extração à mão sobre a demo para um arquiteto solo de Marília. Classificação e citações
funcionaram; problemas viram requisito da fase 1 (itens 1 a 4 vieram da 1ª reunião; 5 a 9 das
reuniões 2 e 3, com uma loja de móveis planejados e um gestor de obra):

1. **Redação antes de gravar.** O transcript trazia uma sequência ditada que parece senha de Wi-Fi.
   Antes de salvar, passa por uma etapa de detecção de credencial, telefone, e-mail e valor de
   contrato. O transcript cru nunca é persistido; só a versão redigida.
2. **Sem identificação de quem fala.** O Granola não separa as vozes. O insight guarda
   `falante` com valor `provavel_*` ou `incerto`, e o agente nunca afirma autoria.
3. **Erro de transcrição que muda o sentido** ("Access" por IA, "Synapse" por SINAPI, "36
   clientes"). O analista usa um glossário (SINAPI, CUB, módulos do Pilar, concorrentes) e marca
   `texto_duvidoso` no insight.
4. **Viés de relação.** Elogio de parente ou conhecido pesa pouco como evidência de mercado.
   `reuniao.origem_contato` (parente, indicacao, frio, inbound) reduz a confiança do insight e
   aparece na recomendação. Nas 3 primeiras reuniões, 100% dos contatos vieram da rede pessoal do
   fundador ou do irmão; o Cérebro mostra essa proporção como aviso fixo.
5. **Reunião com mais de um trecho.** A reunião 3 juntou demo com um gestor de obra, conversa de
   avaliação só com o irmão depois que ele saiu, e papo solto. Classificar por trecho
   (`reuniao_segmento`: tipo, início, fim), não uma etiqueta só por reunião. Só o trecho de cliente
   alimenta insight de mercado; o de avaliação interna alimenta aprendizado de venda e produto.
6. **Rótulo de falante não confiável.** Na reunião 2 todas as falas vieram como "Me" (5 pessoas);
   na 3, um aviso da ferramenta de videochamada ("modo picture-in-picture...") apareceu como nome
   de quem fala e escondia falas do cliente. O normalizador descarta rótulo que é texto de
   interface e, sem nome confiável, marca `falante = incerto`.
7. **Ruído e dado de terceiros.** Cerca de um quarto da reunião 2 era conversa paralela (família,
   café, quem deve dinheiro a quem). A redação remove dado pessoal de terceiros que não faz parte do
   negócio e guarda `proporcao_ruido`. Um e-mail falado em voz alta também precisa de máscara.
8. **Glossário obrigatório.** Confirmado em 2 reuniões: "Cloud" é Claude, "Kube" é CUB, "Inha" e
   "Access" são IA, "Synapse" é SINAPI. Sem o glossário o agente erra o sentido.
9. **Promessas do fundador.** As reuniões trazem compromissos (implementar "acompanhamento de
   clientes", enviar proposta, abrir grupo, preencher dados da demo). Entidade `compromisso`
   (quem prometeu, a quem, o quê, prazo, status) com lembrete no Time. O agente também compara
   o que o fundador afirmou entre reuniões e marca contradição: na reunião 1 o cronograma "já gera
   físico-financeiro" e na 3 "por enquanto só físico".

Leituras para os agentes de Receita e Produto: o prospect achou "legal" mas ainda não sentia a dor
de gestão (poucos projetos); a dor aguda foi aditivo, aprovação e prazo. A reunião terminou sem
próximo passo datado, o que o agente de Receita deve sinalizar.

## Modelo de dados (rascunho)

Todas com RLS restrita ao ultra admin (padrão de `ultra-admin`); nenhuma é lida por empresa cliente.

- `reuniao`: `id`, `titulo`, `ocorreu_em`, `origem_nome`, `tipo` (discovery, demo, venda,
  onboarding, suporte, alinhamento_interno, parceiro, outro), `tipo_confianca`, `tipo_corrigido`,
  `origem_contato` (parente, indicacao, frio, inbound), `proximo_passo` e `proximo_passo_em`
  (nulos sinalizam risco), `transcript_redigido` (nunca o cru), `redacoes` (contagem por tipo, sem
  o valor), `granola_note_id` (nulo na fase 1, único quando preenchido), `status`, `criado_por`.
- `reuniao_insight`: `id`, `reuniao_id`, `categoria` (dor, ideia, objecao, decisao,
  pedido_feature, elogio, risco, pratica_negocio, concorrencia), `texto`, `citacao`,
  `modulo_pilar` (nulável), `falante` (provavel_cliente, provavel_fundador, incerto),
  `texto_duvidoso`, `removido`.
- `reuniao_recomendacao`: `id`, `titulo`, `descricao`, `insight_ids[]`, `escritorios_distintos`,
  `status` (rascunho, aceita, descartada). Só existe com evidência de 2 ou mais escritórios; menos
  que isso é `hipotese` e não aparece como recomendação.
- `reuniao_segmento`: `reuniao_id`, `tipo`, `inicio`, `fim`, `proporcao_ruido`.
- `compromisso`: `id`, `reuniao_id`, `prometido_por`, `para` (escritório ou pessoa), `descricao`,
  `prazo`, `status` (aberto, cumprido, cancelado).

## Regras do agente

Seguem a ADR 0050:

1. **Citação literal ou descarte.** Cada insight traz um trecho que o código confere por busca no
   transcript recebido. Citação que não aparece no texto é descartada e rebaixa a confiança.
2. **Contagem sai do código.** Quantas reuniões e escritórios sustentam um tema é calculado do
   banco, não declarado pelo modelo.
3. **Rotular a origem.** Toda recomendação mostra o tamanho e o viés da amostra (reuniões
   conduzidas pelo fundador, com quem aceitou conversar).
4. **Modelo por configuração** (ADR 0051), com modelo menor para a extração por reunião e o maior
   só para o resumo semanal. Gasto entra em `ai_token_ledger` e aparece em `CustosIa`, com teto.

## Privacidade e LGPD

- Transcript contém dado pessoal de terceiros. Base legal e aviso de gravação aos escritórios
  precisam estar resolvidos antes de guardar reunião com cliente (Pergunta aberta 1).
- Transcript nunca vai para log, Sentry ou PostHog. O erro registra só `reuniao_id`.
- Retenção: transcrição redigida apagada após 12 meses; pontos ficam (cron `limpar-transcricoes-reuniao-daily`). `reuniao` entra no fluxo de exclusão de titular
  (`excluir-dados-titular`) quando houver vínculo com pessoa identificável.
- Acesso só pelo ultra admin; teste de RLS com usuário comum deve falhar na leitura.

## Fases

| Fase | Entrega                                                                         | Critério de saída                                           |
| ---- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 0    | Rodar 5 transcripts reais e ler o resultado (3 de 5 feitas, ver Achados)        | Extração e citações boas o bastante para seguir             |
| 1    | Tabelas, colagem manual, analista por reunião, tela da reunião e do Cérebro     | O fundador usa por 10 reuniões e a taxa de correção é baixa |
| 2    | Edge `granola-ingest` por `pg_cron`, `created_after` + `folder_id`, idempotente | Exige plano Business; reunião nova entra sem ação manual    |
| 3    | CRM do Pilar (contas, contatos, oportunidades) alimentado pelas reuniões        | Reunião atualiza conta e próximo passo sozinha              |
| 4    | Estrategista semanal: padrões, recomendação de feature, cruzamento com Dores    | Recomendação aceita com frequência                          |

## Plano de implementação da fase 1

**Ponto de partida.** Branch `feat/cerebro-reunioes-fase-1` de `origin/staging`, numa worktree
limpa (a branch de obras tem trabalho em andamento). Um card ClickUp (BEZ-N) antes do primeiro
commit, o N no título de cada PR. PR sempre para `staging`, `--assignee @me`.

**Reaproveitado do repo (nada de infraestrutura nova):**

- Auth: `requireUltraAdmin` (`_shared/admin-auth.ts`), com MFA e papel lido no banco.
- Rate limit: `_shared/db-rate-limit.ts`. Modelo: `callGeminiStructured` e `modeloEmUso` do
  `_shared/ai-client.ts` (ADR 0051). Confirmar qual modelo está configurado e se há chave no
  ambiente antes de começar; a premissa anterior de "chave da Anthropic" não vale aqui.
- Custo e teto: linha nova em `ops_agentes` (`inteligencia`) e registro em `ops_execucoes`
  (`tokens_in`, `tokens_out`, `custo_brl`), com `estourouTeto` de `ops-agente-run/regras.ts`.
- RLS: padrão da migration `20261104000000_time_de_agentes_fase_0.sql` (leitura por
  `is_ultra_admin()`, escrita só por service role). Tela no Ultra: `PilarPage`, `FormDialog`,
  `DataTable`, `EmptyState`, `PageLoader`, tokens de `tokens.css`.

### Três PRs em sequência

Cada um entra em `staging` antes de o próximo começar. A migration só chega ao banco de staging
pelo deploy do CI depois do merge do PR 1, então os PRs 2 e 3 esperam esse deploy.

**PR 1: banco, tipos e funções puras (sem IA, sem tela)**

- Migration `20261234340000_cerebro_de_reunioes.sql`: `reuniao`, `reuniao_segmento`,
  `reuniao_insight`, `compromisso`, a linha `inteligencia` em `ops_agentes` e a função
  `cerebro_resumo()` (contagem de reuniões e escritórios distintos por tema e proporção por
  `origem_contato`, calculada em SQL, nunca pelo modelo). RLS: `is_ultra_admin()` lê;
  atualização só de `tipo_corrigido` e `removido` pelo ultra admin; insert só pelo service role.
- `npm run gen:types:local` e commit de `types.ts` (o job `types-sync` reprova sem isso).
- Biblioteca pura em `supabase/functions/_shared/cerebro/`, com teste para cada arquivo:
  `redacao.ts` (e-mail, telefone BR, CPF/CNPJ, URL com token, sequência ditada perto de "senha",
  valor de contrato em R$, dado pessoal de terceiros fora do negócio), `falantes.ts` (descarta
  rótulo que é texto de interface, marca `incerto`), `glossario.ts` (Cloud→Claude, Kube→CUB,
  Inha e Access→IA, Synapse→SINAPI, módulos e concorrentes) e `aterrar.ts` (a citação precisa
  existir no transcript redigido, por busca normalizada; sem ela o insight é descartado e a
  confiança cai, ADR 0050).
- Teste de RLS: usuário comum e `admin` de empresa não leem nem escrevem nenhuma das tabelas.

**PR 2: Edge Function `reuniao-analisar`**

1. `requireUltraAdmin` + rate limit + validação do corpo (texto até um teto de caracteres;
   acima disso, recusa com mensagem clara). Janelas com sobreposição para transcripts longos,
   resultados juntados antes de gravar.
2. Pipeline: redigir, normalizar falantes, aplicar glossário, chamar o modelo (esquema Zod:
   segmentos com tipo, insights com categoria, citação, módulo, falante, `texto_duvidoso`,
   compromissos), aterrar, gravar. O transcript cru nunca é persistido nem logado; erro registra
   só `reuniao_id`.
3. Custo no `ops_execucoes`; teto mensal do agente bloqueia com `pausada_teto`.
4. Teste do handler com o modelo simulado, cobrindo: falha do modelo, citação inventada,
   transcript acima do teto, usuário sem MFA.
5. Fixtures **sintéticas** que reproduzem as falhas reais (todas as falas como "Me", aviso da
   videochamada como nome de falante, e-mail ditado, conversa paralela, três vozes). Transcript
   real nunca entra no repositório (público).

**PR 3: telas no Ultra**

- `Reunioes.tsx`: lista (`DataTable`) e "Nova reunião" em `FormDialog` (título, data, origem do
  contato obrigatória, nome do escritório, texto). `Button loading` durante a análise.
- `ReuniaoDetalhe.tsx`: trechos com tipo e confiança, corrigir tipo, insights com citação e
  botão de remover, compromissos abertos, aviso de ruído e de redação aplicada (só a contagem).
- `Cerebro.tsx`: filtros por categoria, módulo e escritório; para cada tema, quantas reuniões e
  quantos escritórios; aviso fixo com a proporção de contatos da rede pessoal; nenhum item é
  chamado de "recomendação" nesta fase.
- Registro: rota lazy em `src/App.tsx` (junto de `UltraDoresMercado`), export em
  `src/pages/ultra-admin/index.ts`, item no `UltraShell`, tipo `AgenteId` em `time/lib.ts`.
- Testes Vitest de hooks e diálogos (a base mantém piso de cobertura). Mudança visual: não há
  "antes" para tela nova; o PR leva a imagem do depois (1440 px e 390 px) com dados sintéticos.

### Antes de colar a primeira reunião de cliente

A feature pode ir a `staging` e `main` sem isso, porque só o ultra admin acessa. Mas **nenhum
transcript de cliente é colado em produção** até as perguntas abertas 1 (aviso de gravação e base
legal) e 2 (retenção) estarem respondidas e registradas em DECISOES.md.

### Como saber se a fase 1 funcionou

Medido pelo próprio sistema, em `ops_execucoes` e nas tabelas:

- Taxa de correção do tipo (`tipo_corrigido` diferente de `tipo`) e de insights removidos.
- Percentual de citações descartadas no aterramento.
- Custo médio por reunião e total do mês contra o teto.
- Uso: reuniões coladas por semana. Sem uso por 2 semanas seguidas, corta-se (SPEC 126).
- Saída da fase: 10 reuniões, taxa de correção baixa e pelo menos 3 com contato frio ou inbound.

### O que fica fora da fase 1

Estrategista semanal e recomendação de feature, ingestão do Granola, CRM de contas e
oportunidades, lembrete de compromisso no painel do Time e cruzamento automático com
`DoresMercado` e `Feedback`.

## Perguntas abertas

1. ~~Os escritórios sabem que as reuniões são gravadas?~~ Resolvida (19/11): o fundador sempre pergunta antes de gravar. Ver DECISOES.md.
2. ~~Por quanto tempo guardar o transcript?~~ Resolvida (19/11): pontos sem prazo; transcrição redigida por 12 meses (`limpar_transcricoes_reuniao`, cron diário).
3. CRM: o SPEC 126 prevê prospecção outbound no módulo Leads do Pilar numa empresa interna.
   Reaproveitar isso ou tabelas próprias? Decidir antes da fase 3.
4. O agente entra como "Inteligência de Clientes" no Time ou como modo do agente Produto?
5. Loja de móveis planejados e gestão de obra aparecem nas reuniões, fora do ICP escrito em
   DECISOES.md (engenharia e arquitetura). Decisão do CEO: tratar como adjacente (aprende, não
   constrói para) ou ampliar o ICP? O Cérebro só mostra a frequência; não decide.

## Riscos

- Virar sistema que o fundador não abre: medir uso na fase 1 e cortar se não houver.
- Viés de amostra virando "o mercado quer". Mitigado pela regra 3.
- Custo de IA: transcript longo; teto em `CustosIa`.
