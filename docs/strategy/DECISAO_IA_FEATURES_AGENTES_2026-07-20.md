# Decisão — Features de IA e a consolidação em agentes

> Status: **discussão de time concluída, decisão registrada**. 2026-07-20.
> Origem: o CEO quer centralizar as features de IA dentro de agentes (copiloto conversacional).
> Antes de codar, promoveu a discussão: as 11 features fazem sentido? O que sobrevive?
> Cadeiras ouvidas: Head de Produto, Crítico/Red Team, Engenheiro-ICP, Pricing.
> Vínculos: [VISAO_AGENTICA_PRODUTO.md](./VISAO_AGENTICA_PRODUTO.md) · [PRICING.md](./PRICING.md) · [DISCUSSAO_TIME_2026-07-14.md](./DISCUSSAO_TIME_2026-07-14.md)

## TL;DR

Não existem "11 features de IA para centralizar". Existe **1 orquestrador que funciona (`ai-chat`) + 10 one-shots quebrados por construção**. A IA nunca rodou em produção (`ai_usage_logs` = 0 linhas). Portanto "centralizar tudo em agentes" é, na prática, **enterrar o que está morto e consolidar na única superfície que já funciona**, não migrar 11 coisas.

Decisão: **sim à visão agêntica, mas não como reescrita e não como corrida de lançamento.** Cortar as features que não servem ao ICP, manter só a espinha "lucro por projeto", e ligar o copiloto conversacional (read-only primeiro) **quando o core estiver mais sólido e reutilizável**.

> **Contexto (2026-07-21):** o produto já está em uso real — VRZ Engenharia usando, BM3 testando, mais um escritório fechando. A régua **não** é "pré-pagante". A postura do CEO é aprimorar continuamente (mais escalável, reutilizável em código/componentes/back/lógica/módulos, estável) a serviço desses usuários, não lançar/expandir às pressas.

## Estado real do código (verificado)

- Os 10 one-shots (`ai-fechamento-mensal`, `ai-radar-cliente`, etc.) chamam `saveInsight()` em `_shared/ai-client.ts:475`, que faz `throw` ao inserir em `ai_insights` — tabela **dropada** em `20260429400000_drop_dormant_tables.sql`. Ligar hoje = **queima a chamada do Gemini e falha ao salvar** (armadilha de custo).
- `ai-chat` é o único no padrão certo: orquestrador → agentes de domínio (financeiro, projetos, comercial, geral) via **anon-key + RLS/JWT do usuário** (não `service_role`), e usa `recordAiUsage` (RPC atômico + `ai_usage_logs`), que não depende de `ai_insights`.
- No front, `src/hooks/useAiInsight.ts` já stubba histórico/quota (`[]` e `0/100`), com comentário "IA Hub dormente".
- `ai_hub = false` em toda empresa, em toda migration de seed. A IA nunca foi usada uma vez.
- O furo A1 (`aprovar_orcamento_agente` sem gate de role) **já foi tapado** em `20260714200000`. O risco real não é o A1: é que cada tool de escrita futura (`criar_lead_agente` etc., hoje congeladas em `feat/ai-chat-consultivo`) precisa do seu próprio gate manual, e os 10 legados rodam via `service_role` (bypassa RLS) — confused-deputy sobre dinheiro real.

## Veredito feature a feature

Âncoras: North Star = lucro por projeto (antes/durante a entrega) · ICP = engenharia multidisciplinar · módulo vivo vs dormente.

| Feature | Veredito | Razão |
|---|---|---|
| Co-piloto de Aditivo | **MANTER (tool)** | Vivo. Escopo muda o tempo todo em multidisciplinar; aditivo não cobrado é sangramento. Dor #1 do ICP, se paga sozinho no 1º mês. |
| Diagnóstico de Precificação | **MANTER (tool)** | Vivo (Financeiro+Propostas). Responde "estou precificando pra bater margem?". Núcleo da North Star. |
| Co-piloto de Proposta | **MANTER (tool)** | Vivo. A margem nasce no preço da proposta. Sobrepõe parcialmente ao Diagnóstico. |
| Previsão de Atraso | **ADIAR** | Depende de horas/progresso reais; `timesheets`/`alocacoes` foram dropadas. Sem dado, mente com confiança. |
| Fechamento Mensal | **ADIAR → vira chat** | Vivo, mas é retrovisor. Vira "me resume o mês" no copiloto, não card. |
| Simulação de Impacto | **ADIAR** | Forward e toca margem, mas pesada e não move o 1º pagante. |
| Radar de Clientes | **MATAR** | É CRM/cobrança, não margem-antes-da-entrega. Fora da North Star. |
| Relatório Executivo | **MATAR** | Agregação backward; o chat responde sem card dedicado. "Diretoria com deck" é linguagem de empresa grande, não do ICP. |
| Gerador de Documentos | **MATAR** | Gerador de conteúdo genérico (atas/memoriais). ChatGPT genérico faz. Scope creep. |
| Pauta de Reunião | **MATAR** | Produtividade genérica, zero elo com lucro por projeto. |
| Planejador de Contratação | **MATAR** | Assenta 100% sobre Capacidade+Timesheet dormentes. Construir sobre dado morto. |

**Núcleo defensável: 2-3 tools** na espinha da margem (aditivo + precificação + proposta). No limite, 2: margem-na-venda e margem-no-aditivo.

## O insight que a discussão expôs

A feature que o ICP abriria **primeiro** (Previsão de Atraso) é a mais **bloqueada** — e o bloqueio não é IA, é **captura de horas**. Palavras do ICP:

> "Apontamento de hora que meu time realmente use. Se você resolver isso e me der margem real por projeto, aí Previsão de Atraso e Diagnóstico de Preço param de ser chute e viram verdade. Previsão sem dado real = irrita e destrói minha confiança no resto do produto."

Um agente que prevê atraso sem dado de horas mente com fluência e mata a tagline ("número confiável"). **Um chute bem-escrito é mais perigoso que um card vazio.** Isso é uma decisão maior que a de IA e corre em trilha própria.

O ICP também definiu a forma certa do copiloto: prefere perguntar ("quais projetos estão furando margem?") a caçar em 11 botões — **mas** exige poder clicar e ver a conta por trás do número. Copiloto como camada sobre número auditável, não no lugar dele.

## Pricing (resumo; adendo formal pendente no PRICING.md)

- **Unidade de cobrança continua "tarefa concluída"** (não consulta, não token, não conversa). O metering atual "teto de consultas" está obsoleto sob orquestrador (1 pergunta → N chamadas).
- **Dois regimes:** conversa consultiva (read-only) **incluída** com fair-use; **tarefa executada** (gera orçamento/aditivo) custa **1 crédito**.
- **Embutir o copiloto no tier, meter a execução** (playbook a16z). Add-on desligado é o pior dos mundos.
- **Antes de cobrar:** falta `task_id`/`outcome`/custo-R$ no `ai_usage_logs` + ledger de créditos. Rodar **grátis-medido** com o design partner primeiro. E o elo plano→features ainda não está ligado (toda empresa tem tudo hoje).
- **Pendência:** adendo na Camada 2 do PRICING.md refletindo consultivo-incluído vs tarefa-crédito e o custo por fan-out (p90, não média).

## Decisão e sequência

1. **Agora (XS, zero risco):** reduzir `AI_TIPOS` de 11 → 3 em `useAiInsight.ts` (as demais queimam Gemini e falham no `saveInsight`). Manter no código só o que vira tool (proposta, aditivo, precificação). Não deletar as edge functions `ai-*` (regra: manter funções dormentes). `ai-chat` continua dormente atrás da flag, intacto. IA fora da venda/landing.
2. **Quando o core estiver sólido/reutilizável:** ligar `ai-chat` **consultivo read-only** (anon-key + RLS). Só leitura = zero risco de mexer em dinheiro. Nenhuma tool de escrita descongelada.
3. **Por último:** aditivo como 1 tool de escrita, **atrás de gate de role + confirmação humana** (o agente aponta e linka, o humano clica).
4. **Trilha paralela (provavelmente mais importante que a IA):** resolver captura de horas que o time use. Sem isso, Previsão de Atraso e metade do valor "forward" nascem mortos.

## O que NÃO fazer

- Reescrever plataforma de agentes numa corrida de lançamento, antes do core estar sólido e reutilizável.
- Recriar `ai_insights`, histórico bonito, quota visual ou os 11 cards.
- Descongelar tools de escrita sem gate de role + teste no CI provando que `viewer` recebe 403.
- Expor Previsão de Atraso / Planejador enquanto não houver dado de horas/alocação.
- Vender "11 IAs" como diferencial (ICP: "cheira a startup empurrando enfeite; me vende uma coisa que funciona").
