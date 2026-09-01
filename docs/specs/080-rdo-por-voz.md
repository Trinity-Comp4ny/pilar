# SPEC: RDO por voz + foto no diário do escritório

**Data:** 2026-09-01
**Status:** Draft
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** obras
**Estende:** [015 — Obras MVP](015-obras-mvp.md), [040 — Obra inteligente](040-obra-inteligente-cronograma-diario-clima.md), [062 — Diário efetivo/impedimento/visita](062-diario-efetivo-por-fornecedor-impedimento-visita.md)

<!-- Origem: benchmark competitivo do Obra Guru (produto focado em RDO), 01/09.
Duas ideias do concorrente: RDO por voz e feed tipo rede social. Esta spec cobre
só a primeira (menor risco, extensão direta do formulário existente). O feed foi
levado à parte porque colide com a decisão já registrada na spec 030 ("cliente
vê avanço e conta, não o diário operacional inteiro") — reabrir isso é decisão
de produto, não desta spec. -->

## Problema

Preencher o RDO no escritório hoje é digitar campo a campo (`atividades`,
`ocorrencias`, `pendencias`, clima, condição, efetivo) — no fim de um dia de
obra corrido, isso é fricção grande o bastante pra o registro atrasar ou nunca
acontecer. O responsável também não consegue anexar foto pelo formulário do
escritório: `obra_rdo_foto` só ganha linha via app de campo (Pilar Campo,
token de operário), então quem registra o dia pelo navegador não tem como
ilustrar o que descreve.

## Objetivo

No formulário do dia (`RdoFormDialog`), o usuário grava um áudio curto contando
o que aconteceu; a IA transcreve e preenche os campos de texto livre + clima +
condição + efetivo (total) automaticamente, revisáveis antes de salvar. O mesmo
formulário ganha upload de foto (o escritório passa a poder anexar imagem, não
só o campo).

**Fora de escopo:**

- **Preencher efetivo por fornecedor, impedimento tipado, visita ou vínculo de
  tarefa do cronograma via voz.** Mapear fala solta pra uma linha de fornecedor
  específica ou pra uma tarefa exata do cronograma é ambíguo demais pra
  confiar sem revisão estruturada — essas quatro estruturas continuam
  manuais, como hoje. A voz preenche só o que já é texto/enum solto no
  formulário (`atividades`, `ocorrencias`, `pendencias`, `clima`,
  `condicao_trabalho`, `efetivo` total).
- **Persistir o áudio bruto.** Só a transcrição (texto) e os campos extraídos
  chegam ao backend; o áudio grava e some da memória do navegador depois de
  processado. Reabrir isso (guardar o áudio como evidência) é extensão futura,
  não aqui — decisão consciente pra não abrir escopo novo de retenção/LGPD
  sobre voz gravada.
- **Foto no Pilar Campo.** Já existe (spec 042). Esta spec só abre o mesmo
  caminho pro escritório autenticado, reusando bucket/tabela que já têm RLS
  pronta para `authenticated` (ver "Dados e contratos" — nenhuma migration de
  Storage/RLS nova).
- **Feed tipo rede social (RDO visível ao cliente).** Ideia separada, levada à
  parte por colidir com a decisão da spec 030. Não faz parte desta spec.
- **Gravação/transcrição no Pilar Campo (app de operário offline).** Fica pra
  spec própria se a demanda aparecer — o campo já resolve o "preencher rápido"
  de outro jeito (formulário item-a-item enxuto), e áudio offline exige fila
  de sincronismo que esta spec não cobre.

## Requisitos

Funcionais:

1. No formulário do dia, um bloco "RDO por voz" permite gravar áudio pelo
   microfone do navegador (botão gravar/parar, indicador de tempo). Limite de
   3 minutos por gravação (corta sozinho ao atingir o teto).
2. Ao parar a gravação, o áudio sobe para uma edge function que devolve a
   transcrição e os campos extraídos: `clima`, `condicao_trabalho`, `efetivo`
   (número), `atividades`, `ocorrencias`, `pendencias` — qualquer um pode vir
   `null` se não foi mencionado na fala.
3. Os campos do formulário são preenchidos com o resultado, mas continuam
   **editáveis**: nada salva sozinho, o usuário revisa e ajusta antes de
   clicar em salvar o dia (mesmo botão/fluxo de hoje). A transcrição bruta
   fica visível (texto colapsável) para conferência.
4. Se o usuário já tinha digitado algo em algum desses campos antes de gravar,
   a extração da voz **sobrescreve** só os campos que a IA identificou com
   conteúdo; campo que a IA devolveu `null` não apaga o que já estava escrito.
5. `efetivo` (total) só é preenchido pela voz quando não há nenhuma linha de
   efetivo por fornecedor lançada (mesma regra que já existe hoje: com linhas
   lançadas, o total é derivado e o campo fica desabilitado).
6. O formulário ganha um bloco "Fotos": adicionar uma ou mais imagens
   (jpg/png/webp, até 8MB cada), preview local, remover antes de salvar. As
   fotos sobem para o Storage e viram linha em `obra_rdo_foto` **junto do
   salvamento do dia** (mesmo padrão dos outros blocos: fica em estado local
   até o `onSubmit`, que só tem o `rdo.id` real depois de criar/atualizar o
   RDO).
7. Editando um dia existente, as fotos já lançadas (pelo escritório ou pelo
   Pilar Campo) aparecem no bloco, com opção de remover.
8. Erro de transcrição (Gemini fora do ar, áudio vazio, timeout) não bloqueia
   o resto do formulário: toast de erro, campos ficam como estavam, usuário
   pode preencher à mão ou tentar gravar de novo.
9. **Clima automático** (adendo 01/09, feedback do teste ao vivo): ao abrir o
   formulário do dia (ou trocar a data), o campo `clima` é sugerido a partir
   da previsão do tempo real da data escolhida, usando a coordenada da obra
   (já geocodificada a partir do CEP, spec 040). A sugestão só entra enquanto
   o campo estiver "Não informado" — nunca sobrescreve escolha manual nem o
   que a voz já preencheu (mesma regra de não-sobrescrita do requisito 4). Sem
   coordenada da obra, previsão indisponível para a data (fora do alcance da
   API) ou falha de rede: o campo simplesmente fica "Não informado" como hoje,
   sem toast de erro — é atalho, não obrigação.

Não-funcionais:

- **Segurança / RLS:** nenhuma tabela nova. Fotos usam o bucket `obra-campo` e
  a tabela `obra_rdo_foto` que **já têm** policy `authenticated` de
  INSERT/SELECT/DELETE por `empresa_id` (migration `20260832000000_campo_foto.sql`,
  spec 042) — o escritório só nunca teve UI pra exercitar esse caminho.
  Revalidar no plano que a policy de INSERT do Storage aceita o path
  `${empresa_id}/${obra_id}/${rdo_id}/...` que o front vai montar (mesmo
  formato que a edge de campo já usa).
- **IA / custo:** chamada ao Gemini passa pelo mesmo gate de tokens
  (`verificarTokens`) e rate limit (`checkRateLimit`) dos outros agentes
  `ai-*` (ADR 0035, spec 075). Débito via `debitarTokens` com
  `agentKey: "rdo-voz"`.
- **Privacidade:** áudio nunca grava em disco/Storage; só a base64 em memória
  do request até a resposta do Gemini, depois é descartado (nem no client nem
  no servidor).
- **Multi-tenant:** `empresa_id` da sessão autenticada, igual a todo agente
  `ai-*` existente (perfil → `empresa_id`, sem confiar em input do cliente).
- **Performance:** gravação limitada a 3min mantém o payload base64 pequeno
  (áudio comprimido opus/aac nessa duração fica bem abaixo do teto de 8MB já
  usado em `ai-cotacao-import`).

## Critérios de aceite

- [x] Dado que gravo "hoje choveu de manhã, trabalho ficou parcial, 8 pessoas
      na obra, concretamos a laje do 2º andar", quando a gravação processa,
      então `clima=chuvoso`, `condicao_trabalho=parcial`, `efetivo=8` e
      `atividades` contém a menção à concretagem, todos editáveis. Verificado
      ao vivo pelo usuário (01/09), com áudio real de RDO ("80m³ de concreto,
      8 pessoas, clima nublado, sem chuva"): `clima=nublado`,
      `condicao_trabalho=normal`, `efetivo=8`, atividades/ocorrências
      corretas.
- [x] Dado um campo "Ocorrências" já preenchido à mão, quando gravo um áudio
      que não menciona ocorrência nenhuma, então o campo preenchido à mão
      permanece intacto (a IA devolveu `null` ali, não sobrescreve). Coberto
      por teste unitário (`mesclarExtracaoVoz`, `obras.test.ts`).
- [x] Dado que já lancei 2 linhas de efetivo por fornecedor, quando gravo um
      áudio mencionando um número de pessoas, então o campo "Efetivo total"
      continua desabilitado/derivado da soma das linhas (a fala não sobrescreve).
      Coberto por teste unitário.
- [x] Dado que anexo 2 fotos no formulário e salvo o dia, quando reabro o RDO
      para editar, então as 2 fotos aparecem no bloco Fotos com opção de remover.
      Verificado no browser (dev local): upload real pro Storage, card do dia
      exibindo a foto, reabertura em edição e remoção — ida e volta completa.
- [ ] Caso de borda: gravação de 3min+ é cortada automaticamente e processada
      normalmente (não trava nem perde o que já foi dito). _(não testado — exige
      gravação real de 3min)._
- [ ] Caso de borda: Gemini retorna erro/timeout — toast de erro aparece, os
      campos do formulário ficam como estavam antes da gravação, o resto do
      formulário continua utilizável. _(não testado; código segue o mesmo
      padrão de try/catch de `ai-cotacao-import`, já em produção)._
- [ ] Caso de borda: usuário nega permissão de microfone — mensagem clara
      ("Permita o microfone pra gravar" + orientação), sem quebrar o resto do
      formulário. _(não testado — prompt nativo do browser, fora do alcance de
      automação; revisar manualmente)._
- [ ] Multi-tenant: token de outra empresa (se aplicável ao teste de RLS do
      projeto) não consegue ler/escrever foto de RDO de empresa diferente —
      já coberto pela policy existente (spec 042); confirmar que nenhuma
      mudança nova nesta spec reabre a policy. _(não testado com 2ª empresa
      nesta spec.)_
- [x] Dado uma obra com CEP cadastrado (lat/long geocodificados) e um RDO novo
      sem clima informado, quando abro "Registrar dia" (ou troco a data),
      então o campo `clima` é sugerido a partir da previsão real da data,
      editável, com a dica "Sugerido pela previsão do tempo". Pipeline
      validado ponta a ponta contra a API real do Open-Meteo (hoje e datas
      passadas via `past_days`) + teste unitário do parser (`climaDoDiaEmSerie`,
      `clima.test.ts`); não exercitado no formulário renderizado com uma obra
      real de CEP cadastrado.
- [x] `npm run test:run` e `npm run typecheck` verdes.

## Dados e contratos

**Nenhuma migration nova.** Fotos reusam `obra_rdo_foto` + bucket `obra-campo`,
já com RLS `authenticated` pronta (ver seção Segurança acima).

Edge function nova `ai-rdo-voz`, no padrão de `ai-cotacao-import` (multimodal,
`callGeminiStructured`, gate de tokens, rate limit):

```
POST /functions/v1/ai-rdo-voz
Body: { audioBase64: string, mimeType: string }
Resposta 200: {
  transcricao: string,
  clima: "ensolarado" | "nublado" | "chuvoso" | "chuva_forte" | null,
  condicao_trabalho: "normal" | "parcial" | "paralisada" | null,
  efetivo: number | null,
  atividades: string | null,
  ocorrencias: string | null,
  pendencias: string | null,
}
Resposta 402: tokens do ciclo esgotados (mesmo formato dos outros ai-*)
Resposta 429: rate limit (mesmo formato dos outros ai-*)
```

Front:

- Hook novo `useTranscreverRdoVoz()` (mutation, chama a edge, sem cache).
- `RdoFormDialog.tsx`: bloco de gravação (MediaRecorder), estado local
  `File[]` para fotos staged, upload direto pro Storage via `supabase-js`
  (sem edge function — a policy já autoriza `authenticated`) dentro do
  `Promise.all` do `onSubmit`, junto dos outros blocos satélite.
- `useObraFotos.ts` ganha (ou hook irmão) a mutation de upload +
  `insert` em `obra_rdo_foto`, e de delete (remove do Storage + da tabela).

Isto **não muda schema** — sem `gen:types` obrigatório, a menos que o plano
revele necessidade de coluna nova (não previsto).

## Plano de implementação

A confirmar em plan mode antes de codar, mas o esqueleto:

1. **Edge function `ai-rdo-voz`**: copiar o esqueleto de `ai-cotacao-import`
   (auth, rate limit, gate de tokens, `callGeminiStructured` com schema Zod
   dos 6 campos). Prompt instrui o modelo a responder só com o que foi dito
   (campos não mencionados = `null`), no vocabulário exato dos enums
   (`CLIMA_OPCOES`/`CONDICAO_OPCOES` de `src/lib/obras.ts`).
2. **Validar o formato de áudio do `MediaRecorder`** contra o que a Gemini
   API aceita de fato (documentação lista wav/mp3/aiff/aac/ogg/flac; o
   default do Chrome é `audio/webm;codecs=opus`). Testar direto contra a API
   antes de escrever o resto — se `webm` não for aceito, gravar como
   `audio/ogg;codecs=opus` (`MediaRecorder.isTypeSupported`) ou revisar a
   abordagem. **Risco que pode mudar o resto do plano — checar primeiro.**
3. **Hook `useTranscreverRdoVoz`** (`src/hooks/`): mutation que recebe o Blob,
   converte pra base64, chama a edge, devolve o JSON tipado.
4. **`RdoFormDialog.tsx`**: bloco de gravação com `MediaRecorder` (permissão,
   timer, corte em 3min), estado de "processando", aplica o resultado nos
   campos do form (`setValue`) respeitando a regra de não sobrescrever campo
   já preenchido quando a IA devolve `null`, e a regra do efetivo derivado.
   Transcrição em bloco colapsável (`<details>` ou accordion simples).
5. **Bloco "Fotos"**: input de arquivo múltiplo + preview local (`URL.createObjectURL`),
   estado `fotosNovas: File[]` + `fotosExistentes` (via `useObraFotos` filtrado
   pelo `rdoId`), remover local antes de salvar ou remover já persistida
   (delete direto). No `onSubmit`, depois de `criar`/`atualizar` devolver
   `rdo.id`, sobe cada arquivo novo pro Storage (`${empresa_id}/${obraId}/${rdo.id}/${uuid}.${ext}`)
   e insere em `obra_rdo_foto`, em paralelo com os outros `salvar*`.
6. **`ObraDiarioTab.tsx`**: nenhuma mudança funcional esperada — o card do dia
   já lista fotos de `useObraFotos` (spec 042); só passa a mostrar também as
   que o escritório subiu.
7. **Testes**: unit do parsing/regra de merge dos campos extraídos (não
   sobrescrever campo preenchido quando IA devolve `null`); se o projeto tiver
   um jeito de testar edge function isolado (mock do fetch ao Gemini), cobrir
   o schema/parse; `npm run typecheck` e `npm run test:run` verdes.
8. **Verificação manual**: gravar um áudio real no browser (dev local),
   conferir preenchimento; anexar foto e reabrir o RDO pra confirmar que
   persiste.

## Adendo (01/09): fluxo em 2 etapas + copy mais clara

Feedback direto do usuário testando ao vivo: o formulário denso escondia o
"RDO por voz" (a peça central da feature) atrás de vários campos técnicos, e
rótulos como "Efetivo por fornecedor" confundiam quem não é do meio.

Mudou, sem tabela/migration nova:

- **Dialog em 2 etapas** (padrão de stepper já usado em `ClienteFormDialog`/
  `ProjetoFormDialog`/`PessoaFormDialog` — `Dialog`/`DialogContent` cru, não
  `FormDialog`, conforme a seção 4 do design system pra wizard): "Gravar" abre
  focado só no áudio (botão grande, indicador visual de gravação); "Revisar"
  mostra os campos, só alcançado depois de gravar (ou do atalho "Prefiro
  preencher manualmente"). Editar um dia já existente pula direto pra
  "Revisar" — forçar gravação num dado que já existe não faz sentido.
- **Indicador de gravação reativo ao volume real da voz** (não decorativo):
  `AnalyserNode` da Web Audio API no mesmo `MediaStream` que o `MediaRecorder`
  já usa, sem lib nova (nenhuma outra tela do projeto tinha esse padrão até
  aqui). Barras sobem/descem com o volume de fato.
- **Cancelar e regravar**: durante a gravação, "Cancelar" descarta o áudio e
  volta pro estado pronto-pra-gravar, sem transcrever nada.
- **Copy mais clara**: "Efetivo por fornecedor" virou "Equipes no canteiro"
  com a legenda "Quantas pessoas de cada empresa trabalharam hoje"; blocos de
  Impedimentos e Visitas ganharam legenda de uma linha explicando o que cada
  um cobre.

Verificado no browser (dev local): as duas etapas renderizam, a navegação de
volta pelo stepper funciona, "Prefiro preencher manualmente" pula pra
revisão com tudo funcionando (incluindo o clima automático). Não testado: a
gravação real com microfone de verdade (permissão nativa do browser, fora do
alcance de automação — mesma limitação já registrada acima).

## Decisões e riscos

- **Decisão:** áudio bruto não persiste. Só transcrição + campos extraídos.
  Evita abrir escopo de retenção/consentimento sobre gravação de voz antes de
  validar se a feature pega.
- **Decisão:** voz preenche só campo de texto livre + clima/condição/efetivo
  total — não tenta resolver fornecedor/tarefa/impedimento por fala. Reduz
  risco de a IA "inventar" um vínculo errado (ex.: ligar a fala a um
  fornecedor que não é o certo).
- **Risco (bloqueante do plano, não do objetivo):** formato de áudio do
  `MediaRecorder` do browser pode não ser aceito literalmente pela Gemini
  API — validar no passo 2 do plano antes de construir o resto.
- **Risco:** qualidade de transcrição em ambiente de obra (ruído de fundo,
  sotaque, jargão de canteiro) pode ser baixa. Mitigado por a extração
  continuar 100% editável — pior caso é o usuário corrigir manualmente, não
  perde o registro do dia.
- **Decisão (adendo 01/09, feedback do teste ao vivo):** clima automático
  reusa `climaPorCodigo()` de `src/lib/clima.ts`, que já existia com o
  comentário "para autofill futuro do diário" (spec 015) — a tabela WMO→RDO
  já estava pronta, só faltava o gatilho. Nova função pura
  `climaDoDiaEmSerie()` (testável sem mock de rede) + `buscarClimaDoDia()`
  (fetch direto do browser à Open-Meteo, sem edge function — mesmo padrão já
  usado por `buscarPrevisao`/`buscarHistorico`, grátis e com CORS liberado).
  Usa a coordenada já salva na obra (`latitude`/`longitude`, geocodificada do
  CEP na criação, spec 040) — nenhuma chamada nova de geocoding.
- **Decisão:** a sugestão de clima só entra quando o campo está "Não
  informado" (nunca sobrescreve escolha manual ou da voz) e falha em
  silêncio (sem toast) quando a obra não tem coordenada ou a API não cobre a
  data — é um atalho que economiza um clique no caso comum, não uma feature
  que pode travar ou confundir o usuário no caso raro.
- Nenhuma decisão de arquitetura transversal (extensão de padrão `ai-*` e do
  padrão de fetch de clima já existentes); não abre ADR novo.
