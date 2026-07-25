# Decisão: split em produtos, UX de agentes e sequência — 2026-07-25

**Contexto.** Após a demo para o design partner de Angola (2026-07-24, análise em
`research/aec/` e memória do projeto), o CEO levou a mesma discussão a outro assistente
de IA, que propôs: (A) separar o Pilar em 3 produtos (Gestão / Projetos / Obras),
(B) reconstruir a experiência dos agentes com execução visível por etapas (padrão
chapter-processing do plg-api), (C) desligar módulos dormentes, (D) centralizar
documentos, (E) sequência em 5 movimentos. Doc de referência da tese B:
`~/Downloads/Pilar_agentes_execucao_inteligente.md` (46 seções).

Este documento consolida o veredito de um painel de 4 agentes (Produto, Red Team,
ICP simulado, Arquitetura) que reconciliou essa visão com o veredito do painel de
2026-07-24. É a fonte de verdade para as decisões abaixo.

---

## 1. Vereditos por tese

### Tese A — Split em 3 produtos: taxonomia interna SIM, anúncio NÃO

- O split é boa arquitetura mental e péssima decisão de marca agora: 1 produto existe
  (Projetos), 1 é embrião sem código (Gestão: não há tabela de tarefa/iniciativa/
  departamento), 1 é anti-persona declarada (`brand/personas.md`: construtora).
- Adotar JÁ: (a) princípio de pricing "pacote cheio, nunca feature avulsa";
  (b) split como taxonomia de roadmap — todo item novo é classificado
  Projetos/Gestão/Obras e **só Projetos recebe código em 2026**.
- ICP: dois produtos de R$400 ele compara isoladamente e recusa ("R$400 só pra
  tarefas? Monday custava menos e abandonei"). Um produto de R$690 com a promessa
  inteira ele defende pro sócio. "Pilar Obras" na home o AFASTA ("classifico como
  Sienge, já saí de demo assim").
- Gatilho para anunciar produto 2: existe + 1 cliente pagando por ele + promessa numa
  frase que a VRZ reconheceria. Antes disso é slide, não SKU.

### Tese B — UX de agentes: SIM, no corte mínimo, DEPOIS do número certo

O que a arquitetura descobriu: **~40% já está construído**.

- `agent_runs` existe com máquina de estados completa
  (`supabase/migrations/20260610000000_agent_runs_foundation.sql`); `agent_actions`
  = agent_tool_calls; aprovação = `reviewed_by/reviewed_at`; ações propostas =
  `agent_type='acao'` + `executar_acao_agente` (`20260714180000_agent_acoes.sql`);
  8 cards de confirmação prontos em `src/pages/chat/`; SSE ponta a ponta.
- Gap real: `ai-chat/index.ts` só emite `token/final/error` e abre o stream NO FIM
  do pipeline. Correção: abrir o stream no topo e emitir 2 eventos novos (`run`,
  `step`) com plano **determinístico definido em código** (não pelo LLM). Custo de
  token do progresso: zero. O front já ignora eventos desconhecidos
  (`useChat.ts:318`) → retrocompatível de graça.
- Corte mínimo (fase 1, 6-8 dias): split mecânico do monólito (schemas/prompts/
  entidades/sse em arquivos, 1 dia, zero mudança de comportamento) → stream no topo
  - eventos run/step nos 3 modos → reducer no front + `<AgentExecutionTimeline />`
    usado SÓ no chat + snapshot da timeline no `meta` da chat_message. Trocar timeout
    de 45s do front por timeout de inatividade (`useChat.ts:213`).
- Fase 2 (5-8 dias, quando houver execução >60s): `ALTER TABLE agent_runs ADD COLUMN
steps jsonb, current_step text` + aplicar `jobs_queue` (migration NUNCA aplicada,
  `20260715000010`) + consumer via Cron (um estágio por invocação) + polling estilo
  plg-api. Ligar `ai_usage_logs` (0 linhas em prod) ANTES de execução multi-step.
- Das 8 tabelas propostas no doc: criar ZERO. Não fazer agora: agentes proativos,
  Caixa de Decisões, planos dinâmicos por LLM, timeline transversal em 5 módulos,
  registry de tools.
- Condição de entrada da fase 1: margem reconhecida como verdadeira pela VRZ.
  ICP: "etapa visível consultando hora que ninguém lançou é teatro. Primeiro o dado,
  depois o palco." Pela animação ele paga zero; por número certo + fonte clicável,
  é o motivo de assinar.
- O que muda confiança segundo o ICP: fonte clicável + cálculo fora do LLM
  ("transforma resposta em parecer verificável; eu assino ART, vivo de memória de
  cálculo"). A animação sem isso dá autoridade visual a um erro.

### Tese C — Dormentes: DESLIGAR JÁ (flag, nunca delete)

- Esconder da sidebar (`src/components/AppSidebar.tsx:79-87`): Timesheet, Capacidade,
  Templates, AI Hub (grupo Inteligência some).
- Esconder tabs do Financeiro: Projeção de caixa, Aging, DRE, Rentabilidade, WIP;
  tab Asaas se não estiver ponta a ponta.
- Fundir: AI Hub → Agentes (commits 09114fc/9798fc3 já começaram). Rentabilidade não
  volta como tab: volta como número com drill-down no detalhe do projeto.
- NÃO deletar: edge functions `ai-*`, `ultra-admin-*`, migrations `agent_write_*`
  (congeladas até gate B de 14/07), backend Asaas, nenhuma rota (flag off = rollback
  de 1 clique). Memória: feedback_keep_dormant_functions.

### Tese D — Documentos: geração ANTES de repositório

- Fura a fila: export xlsx + memorial descritivo/de cálculo via docxtemplater (dados
  que o Pilar já tem; dor declarada do ICP; hoje só há PDF via jspdf).
- Central de documentos (tabela documents, versionamento, TUS, StorageProvider,
  permissões) = custódia de dados. Só com pagante pedindo + Supabase Pro assinado
  junto com o pagante 1 (nunca arquivo de cliente em free tier: 1GB, 50MB/arquivo,
  pausa por inatividade). Buckets privados + URL assinada desde o dia 1 quando vier.
- Insight do ICP a preservar no design futuro: upload de revisão pergunta "pedida
  pelo cliente? Gerar aditivo?" → documento vira dinheiro, não storage. Inegociáveis
  dele: export completo ao cancelar (ART = responsabilidade legal por anos), DWG/IFC
  > 50MB, zero risco de pausa.

### Pilar Gestão — não é produto, é uma VIEW

- Versão mínima: tela "Meu trabalho" agregando o que já existe por responsável
  (disciplinas, etapas de Fluxos, Calendário). Zero tabela nova. Esforço S.
- É o lugar natural da captura de horas de 30s/dia: **Gestão mínima e captura de
  horas são o MESMO item de roadmap.**
- Critério do ICP (ele abandonou Trello e Monday): a tarefa nasce do projeto que já
  está no sistema e alimentá-la é o mesmo gesto que lançar a hora ("concluí a revisão
  do hidráulico" = hora + disciplina + gatilho de cobrança). Quadro paralelo morre em
  2 semanas. Posicionar captura como "saber quanto o escritório ganha", nunca ponto
  eletrônico ("senão meu sênior sabota").
- Iniciativas/departamentos/processos/carga: não antes do pagante 1. A dor real de
  hora não faturável é retrabalho DENTRO de projeto que não vira aditivo, não a
  reforma da sede.

### Pilar Obras — ADIADO com gatilho (não morto)

- Semente técnica aprovada em 24/07 para o ICP: dependência entre etapas com lead
  time (sondagem SPT, concessionária, revisão do arquiteto) sobre
  Fluxos+Gantt+Fornecedores. Isso é o Radar de Prontidão v0 e NÃO é módulo de obra.
- Gatilho de reabertura do módulo completo (Estoque Lite, clima, PWA campo):
  3 pagantes BR pedindo obra espontaneamente, OU 1 pagante do ICP com obra própria
  (VRZ se qualifica) topando design partner com upgrade de preço.
- Hospital de Angola não é validação (fora do ICP, não pagante, sem trilho de
  cobrança). Termos de 24/07 mantidos: testa projetos/equipe/cronograma, uso medido
  em audit_logs até 24/08.

---

## 2. Os alertas do Red Team (registrar para não esquecer)

1. A lista completa de decisões declaradas pelo CEO soma **10-15 meses full-time**
   (2-3 anos em ritmo de noites). As ressalvas do próprio assistente ("núcleo
   vendável primeiro", "piloto pago antes de obra") não entraram nas decisões
   declaradas; as features entraram.
2. Os exemplos do doc de 46 seções são majoritariamente de OBRA (concretagem,
   estoque, clima) — vocabulário de obra ~2x o de margem/proposta. O doc foi escrito
   para a anti-persona.
3. Pelo critério do próprio doc ("mostrar trabalho, não pensamento privado"):
   orquestração animada de 6 agentes quando o trabalho real é uma query É pensamento
   encenado. `ai_usage_logs` = 0 linhas: a UX da IA não é o gargalo de adoção.
4. Alerta proativo sobre dado errado é o pior perfil de risco: chega sem ser pedido,
   com autoridade, na tela central. Ordem obrigatória: dado certo → cálculo certo →
   alerta determinístico → só então investigação por agente.
5. Os 5 itens de prioridade de 24/07 (margem, horas, cobrar VRZ, bugs da demo,
   preços velhos no ar em `src/lib/features.ts:207` e no banco) somam 2-3 semanas e
   não entraram em nenhuma lista nova. Frase-espelho: "você prefere desenhar três
   produtos a mandar uma cobrança."

### Testes baratos antes de grandes apostas

- Proposta de R$690 por escrito para a VRZ esta semana. Multiplicar zero por três
  produtos dá zero.
- Margem corrigida com drill-down vs mock em vídeo de 60s da timeline animada:
  perguntar à VRZ qual das duas pagaria mês que vem.
- VRZ + BM3: "onde controlam tarefas internas hoje, quanto pagam, o que faria
  migrar?" (comportamento, não opinião). Decide o destino de Gestão por 6 meses.

---

## 3. Sequência única — 90 dias (gates encadeados)

| #   | Semanas                    | Entrega                                                                                                                                                 | Critério de saída (gate)                                                                            |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | 1-2                        | Margem verdadeira (`useRentabilidade.ts:42` com mão de obra) + bugs da demo (folha, CEP fallback, saveCoords empresa_id) + preços 97/197/397 fora do ar | Margem de 3 projetos da VRZ bate com a planilha deles; sócio diz "esse número é meu"                |
| 2   | 2-4                        | Captura de horas 30s/dia + view "Meu trabalho" (agrega disciplinas/etapas/calendário por responsável)                                                   | 2 semanas consecutivas de horas reais em 80% dos projetos ativos da VRZ                             |
| 3   | 3-4 (paralelo, sem código) | Proposta R$690 para a VRZ                                                                                                                               | Assinatura, ou "não" com motivo escrito que vira roadmap                                            |
| 4   | 5-8                        | Faxina de dormentes + agentes vivos fase 1 (corte mínimo do item Tese B)                                                                                | 3 perguntas core rodam com plano visível; VRZ usa sem tutorial; taxa de aprovação sem edição medida |
| 5   | 8-10                       | Export xlsx + memorial via docxtemplater                                                                                                                | VRZ/BM3 entrega a um cliente deles 1 documento real gerado pelo Pilar                               |
| 6   | 10-13                      | Radar de Prontidão v0 (dependência com lead time)                                                                                                       | 1 alerta em projeto real que antecipou um bloqueio, confirmado pelo usuário                         |

Cada item só abre quando o gate do anterior fecha. Se o item 3 der "não", o plano
para e o motivo é entendido antes de codar o item 4.

## 4. Os 3 NÃO (mesmo com vontade)

1. Não construir nem anunciar Pilar Obras (Estoque, clima, PWA de campo) por causa
   do hospital de Angola.
2. Não criar as 8 tabelas de agentes, agentes proativos nem Caixa de Decisões antes
   do pagante 1 e do gate de uso do chat. Jsonb aguenta.
3. Não construir Pilar Gestão como produto nem a central de documentos com
   versionamento/TUS. A view "Meu trabalho" e o docxtemplater cobrem 80% da dor com
   10% do custo.

## 5. Princípios adotados do doc de 46 seções (valem como ADR informal)

- Mostrar trabalho operacional, nunca pensamento privado do modelo.
- Front reage a eventos estruturados, nunca a texto livre do LLM.
- Cálculo objetivo (saldo, prazo, margem) NUNCA no LLM: query/regra; o LLM
  interpreta e explica.
- Insight ≠ recomendação ≠ ação proposta; ação sensível = confirmação contextual
  (ação + motivo + impacto + dados).
- Confiança categórica justificada (alta/moderada/baixa), nunca percentual.
- Fontes clicáveis em toda conclusão relevante; declarar dado desatualizado.
- IA transversal nos módulos, não destino "IA Hub".
- Norte de longo prazo (pós-gates): Caixa de Decisões semanal ("3-4 itens na segunda
  de manhã", 8/10 pertinentes, erros explicáveis) — endossada pelo ICP como "o
  e-mail que eu queria receber e nunca recebi de sistema nenhum".
