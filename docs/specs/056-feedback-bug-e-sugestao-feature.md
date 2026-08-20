# SPEC: Feedback do usuário: bug report e sugestão de feature

**Data:** 2026-08-19
**Status:** Entregue
**Autor:** Matheus Rezende
**Módulo:** transversal (app inteiro) + ultra-admin

## Problema

Usuário que encontra um erro ou tem ideia de melhoria não tem canal dentro do
produto pra reportar isso. Hoje só chega por WhatsApp/e-mail direto, sem
contexto técnico (rota, erro, empresa) e sem lugar pra ele ver se a ideia já
foi sugerida por outro.

## Objetivo

Um único ponto de entrada ("Feedback" no dropdown do usuário na sidebar) abre
um modal com dois tipos, cada um indo pra um destino diferente:

1. **Bug:** texto livre vira um evento de User Feedback no Sentry via
   `Sentry.sendFeedback()` (API headless, sem UI própria do SDK), passando
   pelo mesmo scrub de PII de `src/lib/monitoring.ts`.
2. **Sugestão de feature:** vira uma linha em `feature_suggestions`, sem
   nenhuma UI voltada ao usuário depois do envio (sem lista, sem histórico,
   sem voto). Só o ultra admin vê e triagem em `/ultra-admin`.

**Fora de escopo:**

- Board público de sugestões, votação, e qualquer página `/feedback` (v1
  tinha isso, foi cortado depois de revisão: sem necessidade de histórico
  por usuário nem de engajamento via voto).
- Roadmap público com status "planejado/em progresso/entregue".
- Notificar o usuário quando a sugestão dele muda de status.
- Comentários dentro de uma sugestão.
- Categorização/tag da sugestão além de título + descrição livre.

## Requisitos

1. Um item "Feedback" no dropdown do usuário (`AppSidebar`) abre um modal
   único (`FeedbackDialog`) com um toggle "Reportar problema" / "Sugerir
   melhoria".
2. Tipo "Reportar problema": campo único de mensagem; ao enviar, chama
   `monitoring.submitBugFeedback(mensagem, { email, name })` (dados do
   usuário logado), que despacha `Sentry.sendFeedback(...)`.
3. Tipo "Sugerir melhoria": campos título + descrição; ao enviar, insere em
   `feature_suggestions` com `created_by = auth.uid()`.
4. Em qualquer um dos dois casos, sucesso fecha o modal e mostra um toast de
   confirmação; erro mantém o modal aberto com os campos preenchidos.
5. Um ultra admin vê as sugestões em `/ultra-admin` (aba "Feedback"): título,
   descrição, autor (e-mail), data, e um campo de status interno
   (`novo`|`em_analise`|`planejado`|`descartado`) só pra organização dele,
   nunca exposto de volta ao usuário que criou.

Requisitos não-funcionais:

- **Segurança / RLS:** `feature_suggestions` não é multi-tenant (sugestão é
  sobre o produto Pilar como um todo). `SELECT` só `is_ultra_admin()`: não
  existe mais tela de usuário que precise ler de volta. `INSERT` exige
  `created_by = auth.uid()`. `UPDATE` (status interno) só `is_ultra_admin()`.
- **Sentry:** `beforeSend` normal do SDK só roda pra eventos de erro: o
  evento de feedback (`type: "feedback"`) tem pipeline próprio
  (`client.on("beforeSendFeedback", ...)`), que é onde o scrub de PII do
  texto livre precisa estar registrado.
- **Validação na fronteira:** título vazio/só espaço e tamanho de
  título/descrição são rejeitados por `CHECK` no banco, não só no client.

## Critérios de aceite

- [x] Dado um usuário autenticado, quando ele abre o dropdown e clica
      "Feedback", então o modal abre com "Reportar problema" selecionado por
      padrão.
- [x] Dado o tipo "Reportar problema" com mensagem preenchida, quando ele
      envia, então `monitoring.submitBugFeedback` é chamado com a mensagem e
      um toast de confirmação aparece.
- [x] Dado o tipo "Sugerir melhoria" com título e descrição preenchidos,
      quando ele envia, então uma linha nova aparece em
      `feature_suggestions` com `created_by` do usuário atual.
- [x] Dado um ultra admin em `/ultra-admin` aba "Feedback", quando ele muda o
      status interno de uma sugestão, então a mudança persiste e não existe
      nenhuma tela de usuário comum que exponha esse campo.
- [x] Dado um usuário autenticado sem `is_ultra_admin()`, quando ele tenta
      `SELECT` em `feature_suggestions` via client direto, então a RLS
      devolve zero linhas.
- [x] Caso de borda: título vazio ou só espaço é rejeitado pelo `CHECK` do
      banco mesmo se o client não validar.

## Dados e contratos

Tabela (migration `20260851000000_feature_suggestions.sql`):

- `feature_suggestions`: `id`, `titulo` (`CHECK` não vazio, ≤200), `descricao`
  (`CHECK` ≤5000), `created_by` (uuid, FK `auth.users`), `created_at`,
  `status_interno` (`novo`|`em_analise`|`planejado`|`descartado`, default
  `novo`).

Sem `feature_suggestion_votes` nem view de contagem: cortados junto com o
board (não há voto nem listagem pro usuário).

Sentry: sem tabela nova. `src/lib/monitoring.ts` expõe
`submitBugFeedback(message, opts?): Promise<void>`, que chama
`Sentry.sendFeedback({ message, email, name })` (pacote `@sentry/feedback`,
re-exportado por `@sentry/react`) e registra
`Sentry.getClient()?.on("beforeSendFeedback", ...)` pro scrub de PII.

## Decisões e riscos

- Decisão (19/08, revisão pós-implementação inicial): board público com voto
  e histórico foi cortado. Motivo do Matheus: não precisa guardar histórico
  de feedback por usuário, só quer captar e triar internamente. Isso matou
  `/feedback`, `feature_suggestion_votes`, e a exposição de `SELECT` amplo
  pra `authenticated`.
- Decisão: bug e sugestão compartilham o mesmo botão/modal (`FeedbackDialog`)
  em vez de dois gatilhos separados, pra manter um único ponto de entrada
  simples na sidebar.
- Decisão: `Sentry.sendFeedback()` (headless) em vez de
  `Sentry.feedbackIntegration()` (widget visual do SDK): o modal é
  construído à mão, então a UI nativa do Sentry (com upload de screenshot)
  não é usada, trocando screenshot automático por simplicidade de UI única.
- Risco: sem moderação automática, sugestão pode virar spam/lixo se a base de
  usuários crescer rápido. Aceitável agora (poucos usuários, dá pra descartar
  manualmente via `status_interno`).
