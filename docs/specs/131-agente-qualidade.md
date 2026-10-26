# SPEC 131: Agente Qualidade

**Data:** 2026-10-16
**Status:** Em implementação
**Autor:** Matheus Rezende + Claude
**Módulo:** ultra-admin (Time)

## Problema

Erro em produção só chega ao fundador quando ele abre o Sentry ou quando o cliente reclama. O
Sentry já marca cada erro do app com o escritório (`empresa_id`, `src/lib/monitoring.ts`), mas
ninguém cruza isso com quem é cliente pagante. Quando o erro é corrigido, o escritório que passou
por ele nunca fica sabendo.

## Objetivo

Todo dia às 7h03 o agente Qualidade transforma os erros das últimas 24 h em tarefas ordenadas por
cliente atingido e, quando um erro que atingiu escritório é resolvido, rascunha o aviso de "já
corrigimos" para cada um.

**Fora de escopo:** abrir issue no GitHub (executor `issue`, fase posterior), sessões sem erro
(crash-free), painel próprio com números na ficha (precisa de protótipo no Claude Design).

## Requisitos

1. **Leitura do Sentry.** A Edge Function `ops-agente-run` lê, com o secret `SENTRY_READ_TOKEN`
   (só leitura), os erros abertos com atividade em 24 h no ambiente do deploy (`SENTRY_ENV`, que o
   CI já define como `staging` ou `production`), do projeto `pilar` da organização
   `bez-company`. Para os 10 erros que mais atingem pessoas, lê os escritórios da tag
   `empresa_id`. Resposta fora do contrato vira erro claro na execução.
2. **Sem token, falha clara.** Sem `SENTRY_READ_TOKEN` a execução falha com "Sentry não
   configurado" (a ficha mostra o motivo); token recusado mostra "Sentry recusou o token (401)".
3. **Tarefas (N2).** Viram tarefa com link para o erro no Sentry:
   - erro novo (primeira vez nas últimas 24 h);
   - regressão (erro resolvido que voltou), no máximo uma vez por semana;
   - erro antigo que atingiu escritório cliente (pagante, em teste, convidado ou em atraso).
     Prioridade alta para regressão e para erro que atingiu pagante. Erro antigo que não atinge
     cliente fica quieto.
4. **Baixa automática.** Tarefa pendente de erro que foi resolvido no Sentry recebe baixa sozinha
   (`resultado.fechada_por = "sentry"`).
5. **Aviso de "já corrigimos" (N1).** Erro resolvido que tinha atingido escritório vira rascunho de
   WhatsApp para cada escritório que ainda é cliente, uma vez por erro e escritório. Sem detalhe
   técnico, sem código de erro, sem prazo, sem culpa. Roda antes do Clientes (7h05) para ocupar o
   contato do dia (um contato por escritório, SPEC 129).
6. **Indicadores.** Erros com atividade em 24 h, novos, regressões, pessoas e escritórios
   atingidos, incidentes abertos na status page. Vão para o retrato diário.
7. **Ficha.** Cabeçalho, briefing, "Erros para olhar" (a fila que já existe) e histórico. Tarefa do
   Sentry abre em outra aba ("Ver no Sentry").

Não-funcionais:

- **Segurança:** token só de leitura, guardado como secret da Edge Function; nunca no banco nem no
  front. O modelo recebe contagens e o título do erro, nunca ids de escritório (ficam em
  `evidencia`, fora do prompt).
- **Custo:** até 1 + 1 + 10 + 20 chamadas ao Sentry por dia; um briefing por dia dentro do teto de
  R$ 30 por mês.

## Critérios de aceite

- [x] Sem token: execução `falhou` com "Sentry não configurado" (teste local da Edge).
- [x] Token, ambiente e projeto vão nos parâmetros certos; só 10 erros consultam escritórios; 401
      e resposta fora do contrato viram erro claro (Deno, `fetch` simulado).
- [x] Antigo sem cliente fica quieto; novo, regressão e cliente atingido viram tarefa na ordem e
      prioridade certas; o modelo não recebe a lista de empresas (Deno).
- [x] Resolvido vira aviso só para quem ainda é cliente, texto sem termo de cobrança (Deno).
- [x] Ponta a ponta com Sentry falso: tarefa com link do Sentry; erro resolvido dá baixa na tarefa e
      cria o aviso com o telefone do escritório; rodar de novo não duplica.
- [x] Agente ligado com cron `3 10 * * *` e WhatsApp em N1 (pgTAP); ficha mostra "todo dia às 7h03"
      e "Ver no Sentry" (vitest).

## Dados e contratos

- Migration `20261109000000_time_de_agentes_qualidade.sql`: cron `ops-qualidade` e agente ligado.
- `ops-agente-run` aceita `agente_id: "qualidade"`. Secrets: `SENTRY_READ_TOKEN` (obrigatório),
  `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_API_URL` (opcionais, padrão `bez-company`, `pilar`,
  `https://us.sentry.io`).
- `ops_acoes.evidencia` da tarefa guarda `sentry_issue_id`, `empresas_afetadas` e `culprit`.

## Como gerar e cadastrar o token

1. **Sentry:** Settings da organização `bez-company` › Developer Settings › Custom
   Integrations › Create New Integration › **Internal Integration**. Nome "Pilar Time Qualidade",
   sem webhook. Permissões: **Project: Read**, **Issue & Event: Read**, **Organization: Read**
   (o resto em No Access). Salvar e copiar o token na seção Tokens. Integração interna não depende
   da conta de uma pessoa; dá para revogar ali mesmo.
2. **Supabase (staging e produção):** no projeto, Edge Functions › Secrets › Add new secret, nome
   `SENTRY_READ_TOKEN`, valor o token. Ou pelo terminal:
   `npx supabase secrets set SENTRY_READ_TOKEN=<token> --project-ref <ref>` (refs em
   `scripts/supabase-target.sh`). O mesmo token serve aos dois: o ambiente separa os erros.
3. **Conferir:** Ultra › Time › Qualidade › Rodar agora. Briefing com "erros com atividade em
   24 h" está certo; "Sentry recusou o token" pede revisar as permissões.

## Plano de implementação

1. [x] `sentry.ts`: leitura com validação na fronteira + `sentry.test.ts`.
2. [x] `regras.ts`: `candidatosQualidade`, `areaDaRota`, indicadores e resumo + testes.
3. [x] `index.ts`: área Qualidade, baixa automática e aviso de corrigido; `prompt.ts`.
4. [x] Migration + pgTAP; front: Qualidade executável, link externo na fila, `TarefasDaArea`.
5. [x] Playbook [qualidade.md](../operacao/agentes/qualidade.md).
6. [ ] Token cadastrado em staging e produção (Matheus).

## Decisões e riscos

- Fronteira e autonomia: [ADR 0060](../architecture/adr/0060-agentes-de-operacao-medem-no-pilar-publicam-fora.md).
- A tag `empresa_id` vem do front com usuário logado; erro de Edge Function em geral não traz
  escritório e entra só como erro novo ou regressão.
- "Resolvido" depende de alguém marcar no Sentry (ou `Fixes PILAR-X` no commit). Sem isso não há
  aviso; a tarefa fica pendente até ser resolvida ou descartada.
