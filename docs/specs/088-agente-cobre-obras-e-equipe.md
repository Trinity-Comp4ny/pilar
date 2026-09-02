# SPEC: Orquestrador dos Agentes ganha domínio Obras e Equipe

**Data:** 2026-09-02
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** agentes / obras / pessoas

<!-- Origem: usuário testando a tela /agentes perguntou "se eu perguntar de obra, ele não
responde?" e "esse agente deveria cobrir toda a plataforma". Conferido no código
(`ai-chat/index.ts`): o orquestrador só classifica em financeiro/projetos/comercial/geral.
Obras (tabelas `obras`/`obra_frente`/`obra_rdo`, migration 20260730165000) nunca é consultada em
nenhum ramo. Isso já era um gap conhecido e documentado: a spec 084 lista "Cobertura de Obras no
chat" explicitamente como fora de escopo. Fica mais crítico porque Obras é a frente prioritária do
produto desde a decisão do CEO de 25/08 (DECISOES.md), e o hero de /agentes promete "os agentes
consultam seus dados e respondem na hora" sem qualificar quais dados de fato têm cobertura. -->

## Problema

Quem pergunta sobre obra (status, RDO, frente, efetivo, atraso) em `/agentes` não recebe uma
resposta com dado real: o orquestrador só reconhece financeiro/projetos/comercial como domínios;
qualquer outra coisa cai no fallback "geral", que nem sequer busca dado de obra. A pergunta pode
ser mal-classificada como "projetos" (nome de obra e nome de projeto se confundem) e responder com
dado incompleto (status/prazo do projeto, sem nada de RDO/frente), ou cair em "geral" e receber uma
resposta genérica. Nos dois casos, a promessa da tela ("pergunte e os agentes consultam seus
dados") não se sustenta pro domínio que hoje é prioridade da empresa.

## Objetivo

O orquestrador passa a reconhecer **"obras"** e **"equipe"** como domínios de primeira classe, cada
um com coleta de dados real: Obras busca status/atraso/RDO mais recente das tabelas
`obras`/`obra_frente`/`obra_rdo`; Equipe promove o coletor `coletarEquipe()` que já existe no
código mas hoje só roda dentro do bundle do fallback "geral", nunca como domínio dedicado. A copy
do hero de `/agentes` passa a listar os domínios reais.

**Fora de escopo:**

- **Fornecedores como domínio de consulta.** Não existe hoje nenhuma coleta de dados de
  fornecedor no orquestrador, e o que vale perguntar ali (preço histórico? avaliação? atraso de
  entrega?) precisa de desenho próprio antes de virar domínio. Entra em spec separada.
- **Criar/editar obra ou lançar RDO via chat.** Adicionar "obra"/"rdo" em `ENTIDADES_CRIAVEIS`
  (draft de ação) é uma mudança mais arriscada — RDO tem campos condicionais (clima, condição de
  trabalho, efetivo) que pedem um desenho de extração próprio. Esta spec cobre só **consulta**
  (modo "consulta" do orquestrador), não criação.
- **Registry dinâmico de domínios.** O orquestrador continua com switch/case hardcoded por
  domínio, mesma decisão já tomada na spec 084: existem ~6 domínios reais, generalizar antes disso
  é abstração prematura.
- **Cobertura de Mapa, Relatórios, Portal Cliente.** Nenhum tem uma pergunta natural de chat óbvia
  hoje; ficam de fora até aparecer um caso de uso real.

## Requisitos

Funcionais:

1. O orquestrador reconhece **"obras"** como domínio: perguntas sobre status de obra, atraso,
   frentes de serviço, RDO (clima, efetivo, condição de trabalho, ocorrências).
2. O orquestrador reconhece **"equipe"** como domínio: perguntas sobre pessoas, cargos, tipo de
   contrato, quantidade de gente no time.
3. Nova função `coletarObras(db, empresaId)` retorna, por empresa: total de obras por status,
   obras atrasadas (`data_fim_prevista < hoje` e `data_fim_real IS NULL`), e o RDO mais recente de
   cada obra ativa (data, clima, condição de trabalho, efetivo, ocorrências) — limite de 30 obras
   no payload pro contexto do modelo não estourar.
4. O fallback "geral" (pergunta fora de todo domínio específico) passa a incluir obras e equipe na
   visão agregada, junto com financeiro/projetos/comercial que já roda hoje.
5. O texto do hero de `/agentes` (estado vazio, `src/pages/chat/index.tsx`) reflete os domínios
   reais em vez de "3 agentes prontos: Financeiro, Projetos e Comercial".
6. `DOMINIOS`/`ICONE_DOMINIO` no front (`src/pages/chat/index.tsx`) ganham entradas para obras e
   equipe, usadas no rótulo com ícone que aparece acima da resposta do agente.

Não-funcionais:

- **Segurança / RLS:** `coletarObras`/promoção de `coletarEquipe` seguem exatamente o padrão dos
  coletores existentes (`coletarFinanceiro`/`coletarProjetos`/`coletarComercial`): client
  autenticado da edge function, filtro `empresa_id` explícito na query. Nenhuma policy nova — as
  tabelas `obras`/`obra_frente`/`obra_rdo` já têm RLS (migration `20260730165000_obras_mvp.sql`).
- **Multi-tenant:** toda query nova filtra por `empresa_id`, igual às existentes.
- **Performance:** RDO mais recente por obra não pode virar N+1 nem carregar todo o histórico de
  RDO no contexto do LLM — uma query por obra com `.order("data", { ascending: false }).limit(1)`
  (ou `distinct on` via RPC se a lista de obras for grande) e cap de 30 obras no payload.

## Critérios de aceite

- [ ] Dado "como estão minhas obras", quando o usuário pergunta em `/agentes`, então o
      orquestrador classifica como `obras` e a resposta usa status/atraso reais, não texto genérico.
- [ ] Dado uma obra com RDO registrado ontem com `clima = 'chuvoso'`, quando o usuário pergunta
      "teve chuva na obra X ontem", então a resposta reflete esse dado.
- [ ] Dado "quantas pessoas tenho na equipe", quando perguntado, então classifica como `equipe` e
      responde com a contagem real de `pessoas`.
- [ ] Dado uma pergunta fora de todos os domínios (ex.: "oi, tudo bem?"), quando cai no fallback
      `geral`, então a orientação sobre o que o agente sabe responder inclui obras e equipe.
- [ ] Caso de borda: empresa sem nenhuma obra cadastrada, quando pergunta sobre obras, então o
      agente diz honestamente que não há obras cadastradas, sem inventar número.
- [ ] Caso de borda: empresa com obra mas sem nenhum RDO registrado, quando pergunta sobre o RDO
      de uma obra, então o agente diz que não há RDO registrado, sem inventar clima/efetivo.
- [ ] O hero de `/agentes` (tela vazia) lista os domínios reais, incluindo obras e equipe.

## Dados e contratos

- Sem migration — tabelas `obras`, `obra_frente`, `obra_rdo` já existem
  (`supabase/migrations/20260730165000_obras_mvp.sql`).
- `supabase/functions/ai-chat/index.ts`:
  - `AGENTES` ganha `"obras"` e `"equipe"`.
  - `AGENTE_LABEL` ganha os dois rótulos (ex. "Agente de Obras", "Agente de Equipe").
  - `ORQUESTRADOR_PROMPT` ganha as duas descrições de domínio, com exemplo explícito
    distinguindo "obra" (execução em campo: RDO, frente, efetivo, clima) de "projeto" (contrato,
    escopo, prazo comercial) — mitiga confusão de classificação entre os dois.
  - Nova função `coletarObras(db, empresaId)`.
  - `coletarDados()` ganha os casos `"obras"` e `"equipe"` (equipe já reaproveita
    `coletarEquipe`, hoje só usada dentro do bundle `"geral"`).
  - `coletarDados()` caso `"geral"` passa a incluir `obras` e `equipe` no `Promise.all`.
  - `respostaPrompt`/`respostaPromptStream` (branch `"geral"`) atualizam a frase que lista os
    domínios cobertos.
- `src/pages/chat/index.tsx`: `DOMINIOS` ganha entradas obras/equipe (ícone Lucide a definir na
  implementação — `HardHat` já é o ícone usado no módulo Obras, reaproveitar); hero copy
  atualizada.

## Plano de implementação

1. `coletarObras()` na edge function: contagem por status, obras atrasadas, último RDO por obra
   ativa (cap 30 obras).
2. Promover `"equipe"` de bundle-only pra domínio de primeira classe: tipo `Agente`, `AGENTE_LABEL`,
   caso em `coletarDados()`.
3. Atualizar `ORQUESTRADOR_PROMPT` com as duas novas descrições de domínio (com o exemplo
   obra-vs-projeto para reduzir confusão de classificação).
4. Atualizar `respostaPrompt`/`respostaPromptStream` (branch `"geral"`) e incluir obras/equipe no
   `Promise.all` desse ramo.
5. Front: `DOMINIOS`/`ICONE_DOMINIO` + hero copy em `src/pages/chat/index.tsx`.
6. Testes: vitest de `coletarObras` (obra atrasada, obra sem RDO, cap de 30) se a função for
   extraível/testável; senão, verificação manual cobre os critérios de aceite.
7. Deploy da function em staging (`npm run functions:deploy:staging`) e teste manual das perguntas
   dos critérios de aceite direto em `/agentes`.

## Decisões e riscos

- **Risco de classificação confusa obra vs. projeto.** Uma obra pertence a um projeto e os dois
  compartilham nome/contexto no discurso do usuário. Mitigação: o prompt do orquestrador precisa
  de exemplos concretos separando os dois vocabulários (RDO/frente/efetivo/clima = obra;
  contrato/escopo/prazo comercial = projeto). Se a confusão persistir em uso real, considerar architetura de resposta combinada (obra + projeto no mesmo payload) em vez de forçar uma classificação binária — decisão adiada até haver sinal de uso.
- **Decisão: manter switch/case hardcoded**, mesma linha da spec 084 — poucos domínios reais não
  justificam um registry genérico.
- **Risco aceito: maioria das empresas ainda não tem obra cadastrada** (módulo reaberto
  recentemente). O agente vai responder "sem dado" na maior parte dos casos hoje — é o
  comportamento correto (honesto, sem inventar), não um bug desta spec.
