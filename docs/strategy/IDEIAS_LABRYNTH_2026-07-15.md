# Ideias e arquitetura: o que a Labrynth ensina ao Pilar

> Consolidação da mineração PROFUNDA dos repos internos da Labrynth (5 agentes, 2026-07-15),
> na lente de **ideias e formas de melhorar** o Pilar (arquitetura, abordagens, insights) —
> não um plano de porte literal. Muita coisa da Labrynth não cabe num SaaS de engenharia;
> o valor está no *jeito de resolver*, que pode abrir caminho aqui.
> ← [voltar ao índice de estratégia](./README.md) · porte concreto de superfície em [`../architecture/REUSO_LABRYNTH.md`](../architecture/REUSO_LABRYNTH.md)

**Este doc é insumo para rodar com o time de agentes especializados** (Produto, Crítico, Engenheiro-ICP,
Market Scout, Accelerator Intel, Pricing): eles vão tirar insights, apontar o que vale implementar e
gerar novas ideias a partir daqui.

---

## Reality check (leia primeiro)

Dois achados reorganizam tudo:

1. **Em admin/ops, o Pilar já tem quase tudo — às vezes à frente da Labrynth.** Impersonation com banner+log,
   features em 2 níveis com cascade, validação de subset, guard destrutivo, audit log com escritores reais,
   health check externo: **já existem no código**. A lição da Labrynth ali é padrão/ideia, não reconstrução.
   Minerar mais "capacidade de admin" tem retorno decrescente. O que falta é **verdade e coerência** da
   superfície que já existe (tese do `TODO_CONFIG_ADMIN_2026-07-14.md`), mais **ligar o que está morto**.
2. **O maior valor não está em admin — está em duas capacidades que o Pilar NÃO tem e que batem direto na
   North Star:** revisar o escopo/proposta antes de fechar (margem na origem) e responder sobre os dados do
   escritório com fontes auditáveis (confiança). São features novas, não polimento.

---

## Parte 1 — Princípios de arquitetura transferíveis (o "DNA" da Labrynth)

Independente de qual feature vire realidade, estes 6 princípios aparecem em todos os motores da Labrynth e
valem como padrão de engenharia do Pilar:

1. **Regra é dado versionado, não código.** Rule-sets/checklists em JSON/tabela com `weight` e citação da
   fonte, resolvidos por evaluators plugáveis por nome. Muda a regra = muda o dado, sem deploy. Casa direto
   com o elo plano→feature e o pricing por tier. (fonte: `pmd-mvp/regulatory/*.json` + `registry.py`)
2. **Estágios idempotentes com cache no banco.** Cada estágio lê do DB e grava com uma `UNIQUE` que É a chave
   de cache; reexecutar é `ON CONFLICT`, não nova chamada de LLM. É o que faz um pipeline longo caber no
   timeout curto de edge function (1 estágio por invocação, retomável). (fonte: `code_compliance` +
   `patent-intelligence`)
3. **Citação como contrato.** Rastreabilidade não é enfeite no fim: é imposta em 3 camadas (regra no system
   prompt + bloco "cite só estes valores, marque N/A" no contexto + saída estruturada `cited_references`).
   O modelo só cita o que existe nas linhas retornadas; validação server-side descarta id inventado.
   (fonte: `platform/chatbot/graphrag_service.py`)
4. **LLM-as-judge / humano no loop.** Ação de risco passa por um 2º agente que julga contra a política e
   devolve `{allowed, risco, motivo}` tipado; alto risco não aplica, devolve para confirmação. Falha soft.
   (fonte: `patent-intelligence/agents/prior_art_judge.py`)
5. **Workflow sério = state machine pura + optimistic lock + rollback compensatório + auditoria.** Transição
   é um mapa fechado; update com `.eq(status, atual)` → 409 se alguém mexeu; criação multi-passo desfaz em
   falha; nunca deixa órfão silencioso. (fonte: `local-aid/lib/*/state-machine.ts` + `provisioning.ts`)
6. **Aplicabilidade forçada + veredito × confiança.** O que é crítico é revisado mesmo que a IA diga "não se
   aplica"; o veredito (compliant/não) é separado do score de confiança, com faixas calibradas por
   falso-positivo. (fonte: `code_compliance/schemas.py`)

---

## Parte 2 — Capacidades → ideias de feature (ranqueadas por impacto × alinhamento à North Star)

### A. Revisor de completude de proposta/escopo 🥇 (o mais alinhado à tagline)
- **Ideia:** antes de enviar a proposta/fechar o escopo, rodar contra um checklist por disciplina
  (civil/estrutural/MEP) e apontar o que falta ("escopo não delimita interface com fundação", "sem critério
  de medição"), com o trecho citado e sugestão. Roda em documento que o escritório JÁ produz no Pilar.
- **Por que importa:** a causa nº1 de projeto que sangra margem é escopo mal delimitado (vira trabalho grátis
  e aditivo não cobrado). Isto ataca a margem **na origem, antes de assinar** — é a North Star em modo
  preventivo, não retrospectivo. Vendável em "horas de sócio".
- **Arquitetura:** checklist = regra-como-dado (template→itens com peso/criticidade); motor de estágios
  idempotentes em 3 edge functions (start/item/bundle) reusando o `_shared/ai-client.ts` (Gemini + rate limit
  + `ai_usage_logs`); citação validada (trecho é substring do doc). Sem NBR, sem pgvector na v1.
- **Esforço:** MVP ~1 sprint (1 checklist curado, 1 tipo de doc). Não depende de ingerir ABNT.
- **Fonte:** `platform/code_compliance/*` (motor) + `pmd-mvp` (regra-como-dado).

### B. Copiloto rastreável (dados do escritório com fontes clicáveis) 🥈
- **Ideia:** evoluir o `ai-chat` para responder sobre projetos/lançamentos/propostas/rentabilidade com **toda
  cifra ligada a uma entidade clicável** ("margem −15% · Marcos #12/#15, Lançamentos #456/#489"). Números
  sempre vêm de SQL; o modelo narra e cita, nunca calcula.
- **Por que importa:** engenheiro não age sobre número que não pode auditar. Transforma o chat de "IA que
  chuta" em "IA que eu assino". Justifica cobrar (responde "e se errar?" com "clique na fonte").
- **Arquitetura:** retrieval-as-tool com budget; MVP **sem pgvector** — só fazer `coletarDados` retornar
  linhas com id+rótulo e travar citação ("cite só ids presentes"). Completo: pgvector para resolver
  referência difusa + loop de tools + tool de rentabilidade por projeto.
- **Esforço:** MVP 3-5 dias (grande salto de valor, zero infra nova). Completo 2-3 semanas.
- **Fonte:** `platform/chatbot/graphrag_service.py`.

### C. Judge / segurança do agente que escreve 🥉 (urgente, não vendável sozinho)
- **Ideia:** o agente conversacional que **cria e age** no app (já mergeado) precisa de um gate semântico:
  antes de aplicar ação de risco (aprovar orçamento, mexer em dinheiro, deletar, converter proposta), um
  2º agente-juiz valida e devolve veredito tipado; alto risco → confirmação humana.
- **Por que importa:** fecha o furo de segurança já registrado (RPC `aprovar_orcamento_agente` sem gate) e o
  risco de "dinheiro errado" (classe de bug recorrente na memória). É o "humano no loop" que a
  `VISAO_AGENTICA_PRODUTO` já aprovou, mecanizado. Sem isso, agente que age em produção é risco.
- **Arquitetura:** edge function `ai-action-judge` + state machine da ação (PROPOSTA→VALIDADA→APLICADA, nunca
  pula) + retry-cap. Combina com backoff/telemetria nos 12 `ai-*`.
- **Esforço:** ~1 semana (judge nas 2-3 ações mais perigosas + retry-cap/estado FAILED nos jobs).
- **Fonte:** `patent-intelligence` (judge + state machine + resiliência).

### D. Scorecard de saúde de projeto config-driven
- **Ideia:** um número + o que falta + a fonte, determinístico: "Projeto X 62% completo, faltam ART estrutural
  e compatibilização MEP". Rule-set por escritório (Starter usa default, Pro customiza) → amarra ao pricing.
- **Por que importa:** mecanismo mais literal da tagline, e **não depende de IA** (confiável, barato). Pega
  o bug conhecido "conversão proposta→projeto não popula disciplinas" como um evaluator.
- **Esforço:** MVP ~1 semana (rule-set default hard-coded + score + card no dashboard). Config completa ~3 sem.
- **Fonte:** `pmd-mvp` (registry + scoring ponderado + StepStatus com 3 estados).

### E. Follow-ups = CRM leve (menor esforço, dor declarada)
- **Ideia:** fila durável de follow-up sobre lead/cliente/proposta (`due_at`, `assigned_to`, `reason`,
  `outcome_notes`, status). Resolve "sem CRM/follow-up" quase 1:1, código-fonte praticamente pronto.
- **Por que importa:** proposta que não morre no limbo vira projeto vira receita (alimenta o topo do funil).
  Impacto na North Star indireto mas real; melhor relação valor/esforço de todos.
- **Esforço:** baixo — 1 migration (RLS por empresa + os 2 CHECK de integridade) + tela de lista; talvez sem
  edge function.
- **Fonte:** `local-aid/lib/admin/follow-ups.ts` + migration de follow-ups.

### F. Verificação/aprovação de documentos (Portal)
- **Ideia:** entregável/ART/RRT/contrato sobe no Portal em `pending` → sócio aprova/rejeita numa fila com
  histórico de revisor; `expire` cobre validade de ART/apólice. Matriz de "documentos exigidos por disciplina".
- **Arquitetura:** a joia de engenharia do `local-aid` — state machine pura + optimistic lock + seeding
  idempotente. Uma engine serve vários tipos de doc.
- **Esforço:** médio. **Fonte:** `local-aid/lib/workers/state-machine.ts` + rotas de review.

### G. Revisão de proposta antes do envio (QA)
- **Ideia:** proposta entra rascunho→em_revisão→aprovada_para_envio; bloquear `send-proposta-email` enquanto
  não aprovada. Reusa a página `revisao-ia` existente e a mesma engine de state machine do item F.
- **Por que importa:** vínculo direto com a North Star (confere escopo/preço antes de sair). **Esforço:** médio.

### H. "Propostas similares" via pgvector (spike de validação)
- **Ideia:** ao precificar uma proposta nova, mostrar as 3 mais parecidas do histórico com a margem
  **realizada** delas ("projetos assim deram 8%, não os 20% que você orçou"). É `ORDER BY embedding <=> $1`.
- **Por que importa:** testa barato a hipótese "rentabilidade por tipologia" antes de investir em
  clustering pesado (UMAP/HDBSCAN — Python, adiar, gated por volume de dados). **Esforço:** 4-5 dias.
- **Fonte:** `patent-intelligence` (gap-detection; MVP é só a similaridade).

### I. Conteúdo / help center (única capacidade genuinamente nova em admin/GTM)
- **Ideia:** tabela `posts` (slug, excerpt, body markdown, status, grupo SEO) com RLS read-público-se-publicado.
  Reusa o *schema* do Payload sem trazer Payload/RDS/Fargate.
- **Por que importa:** SEO + onboarding/help; **tangencial à North Star**. Fazer depois do 1º pagante.
- **Fonte:** `labrynth-cms/collections/Posts.ts` (só o modelo de dados).

---

## Parte 3 — NÃO reconstruir (o Pilar já tem) / apenas ligar-traduzir

- **Já existe, não tocar:** impersonation com banner+log (`log-impersonation`), features 2 níveis + cascade
  (`tg_cascade_feature_revocation`, `tg_validate_profile_features`), guard destrutivo, feature flag por empresa
  (`empresas.features jsonb`), health check externo (`functions/health`).
- **Ligar o que está morto:** `src/lib/planFeatures.ts` (`PLAN_FEATURES`) é código morto — ligá-lo no
  `canDo`/`usePermissions` faz o gating por plano virar verdade (pré-requisito do pricing v1). Atrás de teste
  (base com ~5% de cobertura).
- **Traduzir (frontend puro):** `Auditoria.tsx` mostra `target_table` cru e `JSON.stringify(diff)` — mapa
  tabela→rótulo + diff → "Campo X: de A para B". Poucas horas, máxima percepção de profissionalismo.
- **Congelado pelo founder (não recomendar agora):** observabilidade multi-tenant, notification matrix,
  MRR/churn dashboard, RBAC no god panel, paginação de empresas, API keys, ABAC.

---

## Parte 4 — Ranking consolidado e sequência sugerida

| # | Ideia | Impacto North Star | Esforço | Depende de |
|---|---|---|---|---|
| 1 | **Revisor de completude de proposta/escopo** (A) | Alto (margem na origem) | ~1 sprint | checklist curado |
| 2 | **Judge/segurança do agente que escreve** (C) | Alto/urgente (risco) | ~1 semana | — |
| 3 | **Copiloto rastreável — MVP sem pgvector** (B) | Alto (confiança) | 3-5 dias | — |
| 4 | **Follow-ups / CRM leve** (E) | Médio (funil) | baixo | — |
| 5 | **Scorecard de saúde de projeto** (D) | Alto (determinístico) | ~1 semana | rule-set default |
| 6 | Verificação de documentos (F) / Revisão de proposta (G) | Médio | médio | engine state machine |
| 7 | Propostas similares via pgvector (H) | Médio (spike) | 4-5 dias | pgvector |
| — | Conteúdo/help (I) | Baixo (GTM) | médio | depois do 1º pagante |

**Higiene barata em paralelo (não são "capacidade", mas fecham o TODO do founder):** traduzir auditoria,
ligar `planFeatures.ts`, unificar `CompanyFeatureToggles` no modelo draft+Salvar, `reason` no log de
impersonation.

**Sequência:** #1 e #2 primeiro (produto que vende + segurança que protege; não competem). #3 e #4 como
ganhos rápidos de alto valor. #5 quando houver dado de projeto. #7 como spike após o 1º pagante.

---

## Parte 5 — Perguntas abertas para o time de agentes

1. Dado o estágio (0 pagantes, 1 design partner), qual das capacidades #1–#5 realmente destrava a primeira
   venda vs. qual é "bonito mas cedo"?
2. O revisor de completude de escopo (A) é feature ou é o próprio produto? Vale reposicionar em torno dele?
3. Checklists curados por nós vs. pelo escritório: onde nasce o switching cost defensável?
4. O copiloto rastreável muda a objeção "IA erra" o suficiente para virar argumento de venda/pricing?
5. Que ideia NOVA (não listada aqui) esses padrões abrem para o ICP de engenharia?

---

## Leitura do time (painel de 6 agentes) — veredito consolidado

> Rodado em 2026-07-15 por Head de Produto, Crítico/Red Team, Engenheiro-ICP, Market Scout AEC,
> Accelerator Intel e Pricing sobre este documento. Abaixo, onde convergiram, onde divergiram, as
> ideias novas que surgiram e a recomendação final. **Esta seção corrige o ranking da Parte 4.**

### Convergências (≥4 dos 6 concordam)

1. **Não construir as 9. Foco brutal.** No estágio (0 pagantes, 1 design partner) a doutrina early-stage
   e o Crítico batem: 9 frentes = 0 aprendizados profundos. Escolher uma, narrar o resto como roadmap.
2. **A (revisor de completude de escopo) é o centro estratégico** — a cunha, o herói do pitch, o único
   território **vazio no AEC BR** para o ICP (concorrentes miram obra/GC ou A&E anglo; ninguém faz revisão
   preventiva pré-assinatura do projetista). Ataca a margem na origem = a tagline literal.
3. **A e D são o MESMO primitivo (checklist-como-dado). Construir a versão DETERMINÍSTICA (D) primeiro,
   sem LLM**, aplicada a proposta (pré-assinatura) E projeto vivo. D não tem COGS, materializa a tagline
   com risco zero, e testa a máquina de tiering. A (LLM + citação de trecho) vem por cima depois.
4. **Validar A no papel ANTES de codar.** Teste concierge: rodar o checklist à mão sobre 5–10 propostas
   reais que sangraram margem; go/no-go se ≥60% pegaria uma omissão que virou aditivo não cobrado + o
   sócio disser "isso eu pagaria". Zero código antes disso. É o founder saindo da tela e falando com o cliente.
5. **C (judge de IA) NÃO é feature, e sua premissa está desatualizada.** O furo A1
   (`aprovar_orcamento_agente` sem gate) **já foi fechado** (migration `20260714200000` + cartão de
   confirmação humana no commit `7db5aa5`). Um 2º LLM como gate de dinheiro é **teatro de segurança**
   (gate probabilístico que "falha soft" é pior que nada). O trabalho real e barato: **cobertura de teste
   das 6 ações de dinheiro do agente** (hoje ~5%) e/ou **desligar as ações de escrita por feature flag**
   para o design partner até haver uso validado. Reclassificar C de "ideia #2" para dívida de risco/infra.
6. **B (copiloto) vale pela CITAÇÃO, não pelo chat.** "Chat sobre seus dados" já é paridade em curso
   (Vobi, Deltek Dela) e commoditiza em ~12 meses. O único ângulo defensável é o **contrato de citação**
   (toda cifra clicável, número sempre de SQL). É o *enabler de confiança que vende A*, não wedge próprio.
7. **O moat não é o motor de IA** (replicável) — é o **checklist co-curado/aprendido com o escritório**
   (switching cost) + o **dado de margem realizada por tipologia** que compõe com o tempo. Amarrar o
   design partner a um acordo onde o histórico dele alimenta o checklist, desde já.
8. **Tudo assenta num dado que o ICP talvez não tenha.** O Engenheiro-ICP e o Head de Produto travam:
   *o design partner consegue ver margem viva no Pilar hoje?* Apontamento de hora é o gargalo real. Se o
   dado não flui, a prioridade #1 vira **ativar o que já existe** (Financeiro/Escopos vivos), não feature nova.

### Divergências (honestas, para você decidir)

- **O que codar já, se algo:** Crítico → **E (CRM)**, único item com dor declarada, barato, risco zero.
  Accelerator/Produto → **nada de A ainda** (validar concierge); se codar, o primitivo determinístico (D).
  Consenso real: **A se valida antes de codar; o que for codado agora é barato/baixo-risco** (D-mecânica
  ou E), nunca o motor de IA de A no escuro.
- **E (CRM) importa neste estágio?** Crítico/ICP: sim (funil = receita). Produto/Market Scout: não com 1
  partner (é ativação, não funil; e Vobi já está à frente). Empate → tratar E como higiene de tier barata,
  não bandeira.
- **F (verificação de docs / ART) subvalorizada?** Market Scout eleva F muito acima do ranking: é o
  **"moat by boredom"** — gestão de ART/RRT/acervo técnico é dor regulatória BR concreta (baixa obrigatória,
  multa por atraso, acervo para licitação/CAT), vazia no SMB, chata de copiar. Vale reconsiderar F como
  aposta de retenção defensável, não item médio.

### Ideias novas que a leitura abriu (o que você pediu: abrir a cabeça)

- **Detector de scope-drift / alarme de aditivo no projeto vivo** (Produto+Market Scout): cruzar o escopo
  assinado com o que está sendo executado e sinalizar "isto é fora do escopo, fature um aditivo" **no
  momento em que acontece**. É a ponte entre A (preventivo) e a North Star (margem viva), e resolve a dor
  nº1 do ICP: o aditivo que evapora no WhatsApp.
- **Matriz de interface entre disciplinas** (Produto+Market Scout): civil↔estrutural↔MEP — a interface é
  o que mata margem em multidisciplinar ("de quem é a furação da laje?"). Cunha que construtora/arquitetura
  não têm. Elevar de "exemplo dentro de A" a estrela do produto.
- **Template que aprende margem realizada por tipologia, SEM pgvector** (Produto+Market Scout+Pricing):
  cada projeto fechado grava sua margem por disciplina de volta no checklist; a próxima proposta já avisa
  "estruturais assim sangram 8% no item X". É o valor do H via agregado determinístico sobre dado que já
  existe — o moat de dado que compõe.
- **Margem com veredito × confiança** (Produto): "margem 9%, confiança BAIXA: 40% das horas não lançadas".
  Aplica o princípio 6 à própria métrica-mãe; resolve a objeção de confiança sobre o número principal.
- **Achados em R$ / horas de sócio, não em %** (Produto+Pricing): "R$ 8k em risco neste escopo", não "62%".
  Fala a língua que o ICP sente e vira ancoragem de preço.
- **Captura de hora sem fricção** (ICP): puxar do calendário/do que a pessoa já faz — "essas 12h foram no
  projeto X, confirma?". É a **fundação** sem a qual toda feature de margem é construída na areia.
- **Cofre de acervo técnico + licitação-ready (CAT)** (Market Scout): extensão de F; organiza ART baixadas
  e gera atestado de capacidade técnica. Dor aguda em engenharia de obra pública, vazia no SMB.
- **Reposicionar em torno de A, sem virar plugin** (Accelerator+Produto): narrativa "o Pilar revisa seu
  escopo antes de você assinar, pra você não trabalhar de graça"; mas o produto **continua sendo margem**
  (A é o slide-herói, o motor financeiro que já existe é a retenção). Ancorar preço no **aditivo não
  cobrado evitado** (R$ milhares), não em mensalidade — "seguro de margem", não "mais um SaaS de R$690".

### Restrição regulatória (Market Scout, muda o desenho)

- **NBR não é protegida por direito autoral** (STF/STJ), mas a ABNT litiga. Caminho seguro: checklist
  **derivado de requisitos de engenharia** (citar "diretriz X da NBR YYYY", nunca reproduzir o texto da
  norma). O "sem NBR na v1" do doc está certo; nunca ingerir PDF de NBR.
- **Nunca emitir "conforme/aprovado".** Isso assume responsabilidade técnica que é do engenheiro (ART). O
  produto **aponta lacunas e lembra requisitos; o engenheiro decide e assina.** Conecta o "humano no loop"
  como proteção de responsabilidade, não só de segurança de dado.

### Bloqueadores de receita (Pricing) — não são "higiene"

`planFeatures.ts` morto + ausência de ledger de créditos: **A e B não são cobráveis sem eles** (a revisão
de escopo vazaria de graça para o Starter). Ligar o elo plano→feature e o ledger é pré-requisito de
monetizar, não opcional. A provavelmente custa **2–3 créditos/revisão** (multi-estágio), não 1 — medir no
`ai_usage_logs`. Chat (B) por **fair-use**, nunca por mensagem (senão o cliente tem medo de perguntar).

### Recomendação final (sequência)

0. **Esta semana, ~0 código — validar fundação + cunha:** (a) confirmar com o design partner se ele vê
   margem viva no Pilar hoje e se o dado está populado; (b) teste concierge de A no papel sobre propostas
   reais que sangraram margem, com gate go/no-go e âncora de willingness-to-pay no último aditivo não cobrado.
1. **Fechar o risco autoinfligido (não é feature):** desligar ações de escrita/dinheiro do agente por flag
   para o design partner **ou** escrever a cobertura de teste das 6 ações de dinheiro. Corrigir o framing de C.
2. **Se validado, construir o primitivo D→A (checklist-como-dado), determinístico primeiro**, em proposta +
   projeto vivo. Reposicionar o marketing em torno de A, mantendo o produto na margem.
3. **Em paralelo, barato:** os fixes já em PR (#79–83: `errors.ts`, hash do portal, etc.) + o elo
   plano→feature e o ledger (bloqueadores de receita, antes de cobrar A/B).
4. **Protótipos após #2 provar sinal:** scope-drift/alarme de aditivo, matriz de interface, template que
   aprende margem, cofre de acervo/ART (F elevado). Captura de hora sem fricção é a fundação a resolver.
5. **Congelar / narrar sem construir:** B além do MVP de citação, H (clustering pgvector), F/G completos,
   I (CMS), Cluster 5 pesado, judge-como-IA.

**Uma linha:** o achado do painel não foi "construa o motor da Labrynth" — foi *"você já tem quase tudo;
o que falta é validar, com o design partner e no papel, a única cunha que ninguém no AEC BR ocupa (revisar
o escopo antes de assinar), e fechar o risco do agente que já mergeou. Não construa IA no escuro."*

