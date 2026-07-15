# Visão — Copiloto Agêntico do Pilar (rascunho para debate do time)

> Status: **visão do CEO + refino inicial**, aberto para debate da equipe de agentes. 2026-07-13.
> NÃO é decisão nem roadmap ainda. É o material que o time vai discutir.

## A visão, nas palavras do CEO (Matheus)

"Entrar na plataforma e cair numa tela como se fosse o ChatGPT / um chatbot. O usuário escreve —
por exemplo, *'fiz uma compra para o escritório'* — e o sistema chama os agentes responsáveis por
essa tarefa (agente financeiro, agente de despesas, etc.). Os agentes conversam entre si depois do
pedido do usuário e executam. Quero criar diversos, **centenas de agentes especializados** em cada
parte das funcionalidades do sistema, tudo **centralizado**, para que em **um único prompt** o
usuário consiga ver/fazer o que quer. Isso subiria o patamar da plataforma, inclusive vs. concorrentes."

## Por que faz sentido (estratégico)

- Alinhado à tese já adotada em [SAAS_IS_DEAD_ANALISE_PILAR.md](./SAAS_IS_DEAD_ANALISE_PILAR.md) e na memória `agentic-strategy-2026-06`: **"agentes que executam o trabalho"** (service-as-software).
- Diferencial competitivo real: a Vobi tem 3 agentes de IA pontuais; uma **camada conversacional que atravessa todo o produto** é um salto, não paridade.
- Casa com o ICP: engenheiro ocupado que não quer navegar 12 telas — quer dizer o que aconteceu e seguir.

## Refino de arquitetura (o que muda de "centenas conversando" para construível)

A **experiência** da visão é mantida; o **motor** é diferente. "Centenas de agentes conversando entre si"
é a armadilha nº1 (custo, latência, imprevisibilidade, bug — pior sobre dinheiro). O padrão robusto:

| Elemento da visão | Implementação realista |
|---|---|
| Tela tipo ChatGPT | Barra de comando / chat como camada SOBRE o produto (não substitui a UI) |
| "Chama os agentes responsáveis" | **1 orquestrador (roteador)** + **poucos agentes de domínio** (financeiro, projetos, propostas, clientes...) |
| "Centenas de agentes por funcionalidade" | Centenas de **tools/funções determinísticas** (criar despesa = função que valida e grava). Especialização mora nas tools, não em centenas de LLMs |
| "Um prompt e ele vê o que quer" | Sim — com **confirmação antes de gravar** o que mexe em dinheiro: extrai → mostra o que entendeu → usuário aprova → grava (reversível + audit log) |
| "Agentes conversam entre si" | Orquestração coordenada pelo roteador, não diálogo livre entre LLMs |

## Armadilhas a resolver (o time deve atacar)

1. **Confiabilidade financeira.** LLM interpretando "comprei material, 3 mil" pode errar categoria/projeto/fornecedor. Exige saída estruturada (schema), validação e **humano no loop no que é irreversível**.
2. **Custo e latência.** Cada prompt que aciona LLMs custa tokens e tempo. Amarra direto ao modelo de **créditos de IA** ([PRICING.md](./PRICING.md)). "Faça tudo por prompt" pode ficar caro/lento se mal arquitetado.
3. **Segurança / multi-tenant.** Toda ação do agente tem que respeitar RLS por `empresa_id` e as permissões (feature-flags, role). Agente não pode virar bypass de autorização.
4. **Não matar a UI.** Chat acelera tarefas; não substitui ver tabela, editar, navegar. Modelo híbrido.
5. **Escopo.** "Centenas de agentes no dia 1" mata o projeto. Começar por 1-2 fluxos dolorosos e de alto valor.

## Infra que já existe (não é do zero)

- 11 edge functions `ai-*` (diagnóstico, proposta-copilot, aditivo-copilot, relatório etc.).
- Tabelas `agent_runs` / `agent_actions` (fundação de execução de agente).
- `_shared/ai-client.ts` (Gemini estruturado + Zod) e `ai_usage_logs` (logging de tokens).
- ⚠️ Estado real (prod 2026-07-13): IA **nunca rodou** (`ai_usage_logs` = 0 linhas); IA Hub **dormente** (`ai_hub` off em todas as empresas). É fundação, não produto vivo.

## MVP estreito proposto (para o time criticar)

Um fluxo, ponta a ponta, com guardrails: **"lançar despesa/compra por linguagem natural"**.
Usuário digita → orquestrador roteia ao agente financeiro → extrai {valor, categoria, projeto, data, fornecedor}
→ mostra card de confirmação → usuário aprova → grava com audit log. Mede custo real de tokens (destrava o pricing de créditos). Se funcionar e o cliente confiar, expande para propostas, relatórios, etc.

## Perguntas para o time debater

1. **PM:** isso é a próxima aposta ou distração das pendências (elo plano→features, ativar Timesheet, Asaas UI)? Qual o MVP mínimo defensável?
2. **Engenheiro do ICP:** você confiaria num chat pra lançar sua despesa? O que te ganha e o que te faz desconfiar?
3. **Crítico/Red Team:** onde isso quebra — custo, confiabilidade financeira, "centenas de agentes", segurança, manutenção?
4. **Market Scout AEC:** é diferencial real ou os concorrentes já vão chegar lá? O que existe de interface agêntica no vertical?
5. **Pricing:** como isso muda o modelo de créditos? Um prompt pode custar caro — quem paga?

---

## Conclusão do debate do time (2026-07-14)

Debate conduzido com 5 agentes (product-manager, engenheiro-icp, critico-red-team, market-scout-aec, pricing).

### Consenso
- **"Centenas de agentes conversando" está descartado.** Todos aprovam o refino: 1 orquestrador + poucos agentes de domínio + centenas de *tools* determinísticas + humano no loop. (Crítico: 5 LLMs em cadeia = ~77% de acerto — inaceitável sobre dinheiro.)
- **Card de confirmação antes de gravar dinheiro é obrigatório.** A IA nunca rodou em prod; a fundação é ~1 agente (orçamento), não "11 agentes prontos".
- **Chat CAPTURA e PERGUNTA; tela REVISA, EDITA em lote e DECIDE** (regra do ICP).

### Decisões que ficam com o CEO
1. **Timing:** o PM diz que é distração antes do 1º pagante (priorizar Asaas/Timesheet/margem); o Scout diz que o relógio corre (Gartner: 40% das apps com agentes até fim de 2026; **Vobi já lançou** Agente Financeiro em nov/2025).
2. **MVP em disputa:** "despesa por linguagem natural" (dor do ICP) **é paridade tardia** — a Vobi já tem. Só vale com **cruzamento de margem em tempo real** (Scout). PM prefere o **agente de orçamento na proposta** (serve a North Star + fundação já existe no código).

### Pricing sob copiloto (resolvido conceitualmente)
- Conversar/consultar = **grátis** (fair-use); **só ação que grava debita crédito**, com custo mostrado no card antes de executar. Mata o medo do ICP de "medidor rodando na cabeça".
- Crédito ancorado no **resultado**, precificado contra o **P75/P90** do custo (não a média); tetos de loop + roteamento de modelo (barato p/ roteador, caro só p/ raciocínio) protegem margem.
- Recalibrar cota (20/100/500 foi dimensionada p/ ação atômica) só **após medir** custo real no MVP.

### Guardrails obrigatórios (Definition-of-Done de qualquer fluxo que grava)
Ver [../security/ACHADOS_SEGURANCA_AGENTES_2026-07-13.md](../security/ACHADOS_SEGURANCA_AGENTES_2026-07-13.md). Resumo:
1. Gate de role/feature **no servidor** (`user_has_feature`) — hoje o RPC de aprovação **não tem** (furo A1 confirmado).
2. Gravar via RLS, não `service_role` (furo A2).
3. Custo medido por **token/run**, log não-silencioso (furo A3).
4. Idempotência + reversibilidade + eval (30 casos) antes de expor.

### Sequência recomendada (VP Ops)
1. **Agora:** corrigir os furos A1/A2 (segurança em prod, independem do copiloto). Seguir o plano do pagante #1.
2. **Depois do pagante:** ativar **1 agente** (orçamento na proposta) com os 4 guardrails como DoD; medir custo real → destrava o pricing de créditos.
3. **Só então:** decidir a camada conversacional — e, se despesa, com diferencial de margem, não cópia da Vobi.

---

## Refinamento da experiência (visão do CEO, 2026-07-14)

### Os 3 modos de interação

| Modo | Exemplo | Comportamento | Grava? |
|---|---|---|---|
| **Consultivo** (read-only) | "quantos projetos vendi mês passado? quanto de lucro?" | Responde no chat, na hora | Não → **grátis** (fair-use, não debita crédito) |
| **Ação com confirmação** | "adicione um novo projeto" | Orquestrador roteia → agente pensa → monta **tela/modal editável** → usuário confirma/edita → grava | Sim → **card de confirmação obrigatório, para TUDO (não só financeiro)** |
| **Import em lote** | joga PDF do extrato / nota fiscal / planilha no chat | Extrai, classifica receita vs despesa, monta **sumário em tabela** → confirma em lote | Sim → **tela de revisão, não chat** |

Regra de ouro (do Engenheiro do ICP): **chat CAPTURA e PERGUNTA; tela REVISA, EDITA em lote e DECIDE.** Não forçar "conversa" em cadastro estruturado.

### "Mostrar os agentes trabalhando"
O orquestrador identifica o domínio e exibe os agentes acionados ("💰 Financeiro… 📊 Projetos…"). Bom para transparência (confiança) e como marketing dentro do produto. **Ressalva do ICP:** não pode virar teatro lento — a animação acompanha o trabalho real; se passar de poucos segundos, o cliente abandona e volta pra planilha.

### Consolidação de agentes
O CEO concorda em **consolidar em poucos agentes de domínio** (financeiro, projetos, propostas/comercial, clientes) — NÃO centenas. A especialização mora nas tools. O orquestrador roteia por intenção.

## O diferencial competitivo (o que importa)

A interface conversacional **é commodity** (Gartner: 40% dos SaaS a terão até fim de 2026; Vobi já lançou foto→despesa em nov/2025). Copiar isso = chegar ~12 meses atrás do líder. O diferencial do Pilar **não é a interface — é o cérebro embaixo dela**, em 4 ângulos que Vobi (obra) e Procore (GC enterprise) não ocupam:

1. **🥇 Agente PROATIVO de margem (a grande aposta).** Todos os concorrentes são reativos (você pergunta, responde). O Pilar cutuca sem pedir: *"projeto X já usou 78% das horas com 50% do escopo — vai fechar 12% no vermelho. Aditivo?"*. É a tagline virando agente e ataca a dor nº1 do ICP ("descobri o prejuízo 3 meses depois").
2. **🥈 Agente do aditivo que vaza.** Capta aditivo por voz/chat em 10s e **detecta scope creep** (revisões além do escopo → sugere aditivo). Dinheiro real, específico de engenharia de projeto (Vobi/obra não tem esse conceito).
3. **🥉 Onboarding por conversa.** "Manda sua planilha/extrato que os agentes populam o sistema." Mata a objeção de entrada do ICP (digitar 20 projetos à mão) e vira ativação-diferencial.
4. **🏅 Moat de dados.** Margem real por **disciplina** do nicho de engenharia multidisciplinar. Quanto mais uso, melhor os agentes preveem margem e sugerem preço na proposta. Vobi mira obra, Procore mira GC gigante — ninguém acumula esse dado no nicho. **A interface é a porta; o dado é o moat.**

### Ideias adicionais no radar
- **Digest proativo semanal** (sem pedir): projetos em risco + a receber atrasado + aditivos pendentes.
- **Proposta que aprende:** sugere horas/preço com base na margem real de projetos similares já feitos.
- **Fechamento mensal assistido:** agente prepara, humano revisa.
- **Post-mortem automático:** "por que esse projeto deu prejuízo?" ao fechar.

### Princípio-norte
> O concorrente dá agentes que **executam tarefas**. O diferencial do Pilar é um agente que **protege a margem** — vigia, avisa e sugere antes de o cliente perder dinheiro. Reativo = paridade; **proativo = diferencial**.

### Verificação de mercado — o espaço "agente proativo de margem" está ABERTO (não virgem) — 2026-07-14

Escala: (1) reativo (chat responde) → (2) automação (executa sob gatilho) → (3) proativo/monitor (vigia e empurra alerta sozinho). O diferencial visado é **nível 3 aplicado a margem por projeto**.

| Player | Nível | Nota |
|---|---|---|
| **Vobi** (BR, direto) | 2 automação | Lê nota/boleto, lança, concilia. Diz "protege margem" mas é bookkeeping — **não prevê nem alerta margem** |
| **Deltek Dela** (US) | 3 proativo | O único explícito: "alert on budget overruns or profit target misses". MAS **enterprise US** (fora do ICP/preço/idioma) |
| **Procore Helix** (US) | 3 proativo | Proativo, mas risco de **OBRA** (RFI, submittal, cronograma), não margem financeira |
| **Monograph / BQE** (US) | 1-2 | Sem push proativo |
| **Prevision/Sienge** (BR) | ~forecast | Planejado×realizado antecipa estouro, mas **construção-cêntrico** (avanço físico), não agente autônomo |

**Conclusão:** o **agente proativo de margem por projeto para engenharia multidisciplinar SMB no Brasil está aberto** — ninguém entrega ao ICP do Pilar. Mas não é tese não-testada: **Deltek prova que vende** (validação + ameaça de longo prazo se descer de mercado) e **Prevision mostra que o pitch "avise antes do prejuízo" ressoa no BR**. Fronteira 2026, **janela aberta mas fechando** (Vobi lança IA rápido).

**Implicações de produto:**
- Exige **nível 3 de verdade** — job persistente que varre projetos e empurra alerta —, NÃO reaproveitar o IA Hub reativo dormente.
- O moat é o **loop preditivo + dado de margem por projeto/disciplina**, não mais um chat.
- Priorizar o monitor de margem sobre ativar outro chat reativo.

Detalhe e fontes: `research/aec/proactive-margin-agent-landscape.md` e seção nova em [ANALISE_COMPETITIVA_VOBI.md](./ANALISE_COMPETITIVA_VOBI.md).
