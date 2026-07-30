# SPEC: Agentes com ferramentas sob demanda (tool-calling)

**Data:** 2026-07-30
**Status:** Proposta (salto futuro; gatilho de volume abaixo)
**Autor:** Matheus Rezende
**Módulo:** agentes (ai_chat)

## Problema

Hoje o `ai-chat` usa **coletores de pacote fixo**: dado o domínio classificado pelo
orquestrador (financeiro / projetos / comercial / geral), busca um conjunto pré-definido
de dados e entrega tudo ao modelo. Isso tem dois limites:

1. **Não escala com volume.** Os coletores limitam (ex.: 30 projetos ativos). Num
   escritório com centenas de registros, o que passa do teto some do contexto.
2. **Não busca o específico.** Se o usuário pergunta por uma entidade nomeada que não
   está no pacote (um projeto fora do top, uma folha de um mês, um cliente específico), o
   agente não tem como ir buscá-la sob demanda.

Para o volume do ICP atual (dezenas de registros), os coletores ricos (spec 007, iteração
2026-07-30) cobrem bem. Esta spec é o **salto para escala**.

## Objetivo

Dar aos agentes **ferramentas de busca sob demanda**: em vez de receber um pacote fixo, o
agente decide o que consultar conforme a pergunta, chama a busca, recebe o resultado e
segue até responder. Cada busca vira um passo em `agent_actions` — alimentando o modal de
raciocínio em tempo real que já existe (spec 007, Fase 2).

## Gatilho (quando fazer)

Não fazer por ora. Reabrir quando **qualquer** um ocorrer:

- Um design partner (VRZ/BM3) passar de ~30 projetos ativos ou volume equivalente em
  lançamentos, e perguntas começarem a cair no que ficou fora do teto do coletor.
- As lacunas de resposta pararem de ser resolvidas por ampliar coletor (i.e., o problema
  virar "preciso buscar o específico", não "faltou esse campo").

Enquanto o gatilho não dispara: **iterar por lacunas reais** — o usuário testa, reporta
onde o agente erra/falta dado, e ampliamos o coletor daquele ponto. Baixo risco, ganho
contínuo, sem reescrever o núcleo que funciona.

## Estado atual (o que já existe)

- Orquestrador classifica intenção (agente + modo) em 1 chamada (`IntentSchema`).
- Coletores ricos por domínio (`coletarFinanceiro/Projetos/Comercial`, + `geral` que
  combina os três), com datas, vencidos, prazos, pipeline.
- `agent_actions` + modal de raciocínio em tempo real (Realtime) — a UI para mostrar cada
  passo de busca JÁ existe.
- Contexto de projeto em foco (dropdown "Escolher projeto") injeta o projeto no prompt.
- **Falta:** o `ai-client` (`callGemini*`, `streamGeminiText`) não tem function-calling do
  Gemini (nada de `tools`/`functionDeclarations`/parsing de `functionCall`).

## Decisão de arquitetura (duas opções, escolher na hora)

**Opção A — Function-calling nativo do Gemini.** Adicionar `tools` ao `fetchGeminiRaw`,
parsear `functionCall`, e rodar um loop (modelo pede tool → executa → devolve
`functionResponse` → repete até texto final). Mais poderoso e verdadeiro; mais trabalho no
client + loop; risco de latência multi-turno.

**Opção B — Plan-and-execute via structured output (menor risco).** Reusar
`callGeminiStructured` (que já funciona): um passo que devolve a lista de buscas a executar
(`{tool, args}[]`), o servidor executa, e um segundo passo redige a resposta. Sem tocar no
client. Custo: 1 chamada LLM a mais por consulta (latência). Alternativa: fundir a escolha
de buscas no **próprio orquestrador** (que já roda) via um campo `buscas` no `IntentSchema`
— zero chamada extra.

Recomendação inicial: **B fundido no orquestrador** (sem latência extra), migrando para A
se o loop multi-turno se provar necessário.

## Catálogo de ferramentas (rascunho)

Cada tool é uma função determinística no servidor, respeita RLS (client autenticado), e
grava um `agent_action`. Exemplos:

- `listar_projetos(filtro?)`, `projeto_por_nome(nome)`, `projetos_atrasados()`
- `financeiro_resumo()`, `financeiro_vencidos()`, `financeiro_do_projeto(projeto_id)`
- `folha_do_mes(mes)`, `disciplinas_do_projeto(projeto_id)`, `marcos_do_projeto(projeto_id)`
- `leads_pipeline()`, `propostas_resumo()`, `cliente_por_nome(nome)`, `inadimplencia()`

## Riscos

- **Latência/custo:** cada chamada LLM extra pesa; o ICP abandona se ficar lento (Red
  Team). Preferir a variante sem chamada extra; medir wall-clock.
- **Contexto:** tools devem devolver resultados enxutos (agregados/limitados), não dumps.
- **Tenancy:** cada tool usa o client autenticado (RLS por empresa) — nunca `service_role`
  sem checagem. Nenhuma tool pode ler dado de outra empresa.
- **Reescrever o que funciona:** o chat atual funciona; a migração precisa de deploy +
  testes (pgTAP não cobre isto) antes de confiar. Fazer atrás de flag se possível.

## Não-objetivos

- Não é para o volume atual do ICP (os coletores ricos bastam).
- Não dar autonomia de escrita nova ao agente aqui (escrita segue com aprovação humana).

## Relacionados

- `spec 007-mesa-de-trabalho-agentes` (o modal de raciocínio que exibe cada tool)
- `research/themes/agent-ux-patterns.md` (streaming de raciocínio, evidence panel)
- `supabase/functions/ai-chat/index.ts` (coletores atuais a virar tools)
- `supabase/functions/_shared/ai-client.ts` (onde entra o function-calling)
