# Pontos fortes, pontos fracos e leitura de founder

**Data:** 2026-07-14 · **Formato:** discussão multi-agente (Crítico/Red Team + Head de Produto)
**Origem:** continuação de [DISCUSSAO_TIME_2026-07-14.md](./DISCUSSAO_TIME_2026-07-14.md)
← [voltar ao índice](./README.md)

> Inventário honesto: o que quebra o pagante #1, o que é moat real, e onde o comportamento de founder solo está atrapalhando o negócio. Ancorado em código verificado. Não é plano assinado; as decisões operacionais devem ser confirmadas antes de virar backlog.

**A linha que amarra tudo:** o ponto fraco (fuga para código, empilhar features) e o ponto forte (margem automática sobre dado conectado) são o mesmo eixo. Pare de construir superfície nova e afie a única coisa que fecha o pagante #1: a margem que aparece sozinha.

---

## Pontos fracos do produto/negócio (ranqueado por "quebra o pagante #1")

### 🔴 O fix de segurança A1 está preso na branch congelada
`aprovar_orcamento_agente` em PROD (`20260610010000_aprovar_orcamento_agente.sql`) NÃO tem gate de role: só checa `empresa_id`. Qualquer usuário `authenticated` da empresa (viewer, portal comprometido) materializa orçamento e mexe em `valor_venda`. O fix correto (`IF NOT user_has_feature('financeiro','editor')`) existe, mas só na migration `20260714100000`, na branch `feat/ai-chat-consultivo`. **Congelar a branch congela o fix de um furo já aberto em PROD.** Ação: cherry-pick só do bloco do gate para `main`, isolado, esta semana.

### 🔴 Não há como provisionar o pagante #1
Sem UI para criar empresa; `create-company-owner` dessincronizado (não cria `pending_signup` pago); super-admin não cria empresa. Quando alguém disser "quero pagar", o caminho de ativação hoje é SQL na mão. Quebra a **primeira** venda, não a décima. (Backlog já aberto em `TODO_CONFIG_ADMIN_2026-07-14.md`.)

### 🟠 Teste no dinheiro é ilusório
18 arquivos de teste para 405 fontes. No financeiro os testes cobrem `buildLancamentoPayload`, schemas e `useFinanceData`. A lógica que **move dinheiro** vive em SQL (`rpc_grupo_parcela_quitar_antecipado`, rateio de desconto, `pagar_fatura`, fatura de cartão) e tem ZERO teste. O rateio de desconto foi corrigido sem um teste que trave a regressão. O ICP confere planilha: um centavo errado numa quitação e a confiança evapora.

### 🟡 Páginas-deus (dívida de velocidade, não de cliente)
`clientes/index.tsx` (1071), `Relatorios.tsx` (1005), `Projetos.tsx` (980), `Contas.tsx` (907). Freiam a velocidade solo, não quebram cliente. Fila de refactor, não emergência.

### O que o Crítico DERRUBOU (não são pendências)
- **"Quitar antecipado ignora desconto"** já corrigido em `20260713000002_fix_quitar_antecipado_desconto.sql` (rateio proporcional + guard).
- **A2 / ai-chat:** a função nova (`supabase/functions/ai-chat/index.ts`) foi feita certa, com token do usuário e RLS ("nunca service_role"). O A2 residual é só nos 11 `ai-*` legados dormentes (OFF) = dívida fria, não sangramento.
- **CORS** está fail-closed e correto (`_shared/cors.ts`). Gap de domínio staging é config de env, não código.

---

## Pontos fracos do founder (Matheus, dev solo) — o antídoto da câmara de eco

O sintoma está no `git status`, não é hipótese:

1. **Fuga para o código.** Orquestrador que cria lead, projeto, folha, aditivo e despesa de cartão, com RLS bem-feito, antes de UMA pessoa confirmar que paga. A branch é sofisticada e não aproxima do primeiro contrato.
2. **Misturar higiene com aposta.** O fix de A1 (devia ir pra prod já) ficou embutido na aposta especulativa (agentes), de modo que um não sobe sem o outro. Separar sempre: higiene ≠ aposta.
3. **Não matar nada.** 11 `ai-*` dormentes + 10 write-agents novos + WIP/DRE/Aging empilhados. Cada linha dormente é código que se mantém, audita e explica, sem receita. A pergunta que fica: qual foi a última coisa deletada?

---

## Pontos fortes (o que afiar de subutilizado para arma)

### O moat real (confirmado no código)
Não é a tela de rentabilidade, é o **grafo de dados conectado**: lead → proposta → projeto → disciplina → despesa → fatura numa mesma base multi-tenant. Nenhum concorrente BR do nicho junta operação + dinheiro assim (Omie/Conta Azul têm dinheiro sem projeto; Pipefy/Runrun têm workflow sem financeiro). Copiar a tela é trivial; copiar o dado já ligado exige refazer o produto inteiro. Confirmado em `rpc_dashboard_rentabilidade` (`useRentabilidade.ts`), que cruza receitas, despesas diretas e horas por projeto numa consulta só.

### Como afiar (esforço vs impacto)
1. **Margem que aparece SOZINHA** (esforço M, prioridade 1). Hoje o número só existe se o usuário lançou despesa e orçou horas; pré-PMF ninguém alimenta. O custo por alocação tem que popular `despesas_diretas` automaticamente (pessoa alocada × custo/hora × período). Vira "mais uma dashboard" em "abri e já vi qual projeto me paga". É o que transforma a demo em "uau" e destrava a North Star.
2. **Número proativo** (esforço S-M). `useProjetosDrenandoCaixa` já filtra margem negativa; o dado existe. Falta o gatilho que avisa antes ("projeto X passou de 80% das horas com 40% entregue, margem caiu para 8%"). É a diferenciação sentida, a janela do agente de margem que Vobi (reativo) e Deltek (enterprise) deixam aberta.
3. **Aditivo ligado à margem** (esforço S, depois da #1). Aditivo isolado é burocracia; aditivo que recalcula a margem na hora ("esse aditivo devolve o projeto ao azul") usa o forte principal para dar sentido ao escopo→aditivo.

### O alerta sobre a própria força
> Não confundir **superfície** (features que existem) com **filo** (o dado que só o Pilar tem ligado). O moat é o segundo.

Risco concreto: gastar semanas ativando AI Hub e módulos dormentes para "parecer 3x maior" (o `STRATEGY_V2` celebra isso). Toda hora ativando dormente que não alimenta a margem automática é hora tirada da única vantagem defensável.

**Nota técnica:** a fundação do agente de margem está a UM passo, não pronta. Hoje o custo vem de `despesas_diretas` à mão + horas orçadas (`calcularMargens`, `useRentabilidade.ts:39-46`). O custo por alocação decidido ainda não é o input do motor. Ligar isso é a prioridade 1 acima.

---

## O que o time ainda precisa discutir (higiene que precede a venda)

1. **Descolar higiene da aposta:** cherry-pick do gate A1 para `main` + smoke test, esta semana, independente do destino dos write-agents.
2. **Provisionamento do pagante #1:** script ou UI mínima reproduzível para criar empresa + owner. Pré-requisito da venda, não pós.
3. **Contrato de teste do dinheiro:** as ~5 RPCs financeiras que, se quebrarem, queimam confiança. Escopo mínimo, não coverage vaidoso.
4. **LGPD / isolamento:** staging aponta pro Supabase de PROD. Rodar agente contra dado real de cliente sem isolamento precisa de decisão explícita antes do primeiro pagante.

---

## Referências de código citadas
- `supabase/migrations/20260610010000_aprovar_orcamento_agente.sql` — furo A1 vivo em PROD
- `supabase/migrations/20260714100000_agent_write_criar_lead.sql` — fix de A1 preso na branch
- `supabase/migrations/20260713000002_fix_quitar_antecipado_desconto.sql` — bug de desconto já corrigido
- `supabase/functions/ai-chat/index.ts` — padrão bom (token do usuário + RLS)
- `src/hooks/useRentabilidade.ts` — motor de margem + `useProjetosDrenandoCaixa`
- `src/pages/capacidade/components/AlocacaoVsReal.tsx` — alocação vs real (base do custo automático)
- `src/pages/financeiro/` — dinheiro sem teste
- `docs/strategy/STRATEGY_V2.md` — seção 3 (ativos), seção 6 (concorrência)
