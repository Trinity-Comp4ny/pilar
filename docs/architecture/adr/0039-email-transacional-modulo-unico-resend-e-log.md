# ADR 0039: Todo e-mail sai por um módulo único (`_shared/email/`), via Resend, com log em `email_envios`

**Data:** 2026-09-04
**Status:** Proposed

## Contexto

Hoje (04/09/2026) o Pilar dispara e-mail por 100% Resend, mas por três caminhos de template
que não conversam entre si:

1. `supabase/functions/_shared/email.ts`: `sendEmail()` (fetch direto na API do Resend, retry
   com backoff) + 8 templates em string HTML, tema claro. Usado por 8 edge functions, inclusive
   o `auth-email-hook`, que intercepta todo e-mail do Supabase Auth (confirmação, recuperação,
   convite, magic link, troca de e-mail). Os 6 call sites de `inviteUserByEmail` caem nele.
2. `supabase/functions/_shared/emails/*.tsx`: 12 templates React Email, tema ESCURO, importando
   `@react-email/components` sem o pacote estar em `deno.json`. Zero importadores. Código morto
   de uma tentativa anterior; 4 templates dali (próxima etapa, disciplina/projeto concluído,
   status de projeto) nunca ganharam equivalente vivo.
3. HTML inline dentro da própria function: `send-data-deletion-notification` (tema escuro, layout
   próprio) e `trial-expiry-cron` (cópia parcial do layout claro). Divergem do shell comum e não
   acompanham mudança de marca.

Problemas medidos nessa auditoria:

- Nenhum template escapa HTML. Nome de usuário, nome de cliente, descrição de fatura, mensagem
  livre e texto de proposta entram crus no HTML do e-mail.
- `replyTo` existe na interface e nunca é usado. Templates de cobrança e proposta dizem
  "responda este e-mail", mas a resposta vai para `no-reply@pilarsoft.com.br`, domínio sem MX.
- Não há registro de envio. O único rastro de um e-mail é o Sentry quando falha. Não dá pra
  responder "o cliente recebeu a cobrança?" nem detectar bounce (webhook do Resend não consumido).
- Sem `text/plain` alternativo, sem `Idempotency-Key`, sem `tags`. Retry pode duplicar envio.
- `sendEmail()` retorna silenciosamente quando `RESEND_API_KEY` falta: em produção isso vira
  "e-mail não saiu e ninguém soube".
- Duas variáveis para a mesma coisa (`APP_URL` e `PUBLIC_SITE_URL`) montando links.
- A marca no e-mail é um quadrado preto com "P": o ativo real (`public/pilar-logo.svg`) não é usado,
  e `brand/visual.md` ainda tem o logo como `[A DEFINIR]`. O rebrand para "Prumeo" está pendente.
- E-mail que o escritório manda ao cliente final (cobrança, proposta, acesso ao portal, mensagem
  manual) sai com a cara do Pilar, não do escritório. `empresas.email` existe e não é usado, então
  a resposta do cliente final não chega ao escritório.

Opções consideradas para o motor de template:

- **A. String HTML com shell comum (o que já funciona em `email.ts`)**: zero dependência no
  Deno, já à prova de Outlook (VML/MSO), fácil de testar com `deno test` e de pré-visualizar com
  um script que grava `.html`. Contra: sem JSX, componentes são funções que retornam string.
- **B. React Email no Deno (`npm:@react-email/components`)**: DX de preview (`email dev`) e JSX.
  Contra: dependência pesada no edge runtime, preview server é Node, e a tentativa anterior
  (pasta `emails/`) morreu sem ser ligada. Ganho não justifica trocar o que já está em produção.
- **C. Templates no dashboard do Resend / broadcast**: tira o template do repo, sem type-check,
  sem teste, sem versionamento junto do código. Descartado.

## Decisão

1. **Um módulo, uma saída.** Todo e-mail do produto passa por `supabase/functions/_shared/email/`
   (pasta, substitui o arquivo `email.ts` e apaga a pasta `emails/`):

   ```
   _shared/email/
     index.ts        # re-exporta sendEmail + templates
     client.ts       # sendEmail(): Resend, retry, Idempotency-Key, text/plain, log em email_envios
     brand.ts        # nome do produto, logo URL, domínio, from/replyTo padrão, APP_URL. ÚNICO lugar de marca
     escape.ts       # escapeHtml(); todo template escapa por padrão
     layout.ts       # shell (header, footer, botão, card, hr, title, body...) em string HTML, tema claro
     templates/      # um arquivo por e-mail: recuperacao-senha.ts, convite-usuario.ts, cobranca-direta.ts...
   ```

   Edge function não monta HTML. Se precisa de e-mail novo, cria `templates/<nome>.ts`. Lint de
   CI barra `api.resend.com` e `<!DOCTYPE html>` fora de `_shared/email/`.

2. **Motor de template = string HTML com shell comum (opção A).** React Email fica fora até haver
   motivo novo. Tema claro é o padrão (decisão já tomada em `email.ts`; "light only" evita
   inversão em dark mode de cliente de e-mail).

3. **Duas classes de e-mail, um shell, um cabeçalho.**
   - **Plataforma** (Pilar → usuário do Pilar): auth, trial, LGPD, notificação. `from` =
     `Pilar <no-reply@...>`, `replyTo` = caixa suportada do Pilar.
   - **Escritório** (Empresa → cliente final, via Pilar): cobrança, proposta, acesso ao portal,
     mensagem manual. `from` = `"<Empresa> via Pilar" <no-reply@...>`, `replyTo` =
     `empresas.email` (obrigatório para enviar; sem e-mail cadastrado a function devolve 422 com
     instrução). O escritório aparece **nomeado no texto** ("A Meridiana Engenharia enviou esta
     cobrança"), no rodapé e no remetente. **Não** há logo de terceiro no cabeçalho: seria um
     ativo por cliente para curar (proporção, fundo, resolução), quebra quando a imagem é
     bloqueada e confunde a origem do e-mail. O cabeçalho é sempre o da Pilar, que é quem
     entrega. Domínio de envio continua o do Pilar (sem domínio por tenant nesta decisão: DMARC
     alinhado e um só DNS pra cuidar).

4. **Escapar é o padrão.** Funções de template recebem dados crus e escapam tudo. Só `raw()`
   explícito passa HTML, e só o layout usa.

5. **Log append-only `public.email_envios`** escrito pelo `client.ts` em todo envio (sucesso ou
   falha): `id, empresa_id, tipo, classe ('plataforma'|'escritorio'), destinatario, assunto,
resend_id, status ('enviado'|'falhou'|'entregue'|'bounce'|'reclamacao'), erro, referencia_tipo,
referencia_id, idempotency_key, created_at, updated_at`. RLS: `ultra_admin` vê tudo; admin da
   empresa vê os da própria `empresa_id`; ninguém insere via API (só service role). Edge function
   `resend-webhook` (assinatura Svix verificada) atualiza `status`; bounce e reclamação entram em
   `public.email_supressoes(email pk, motivo, created_at)` e `sendEmail()` recusa endereço
   suprimido.

6. **Falha alta.** `sendEmail()` lança erro quando `RESEND_API_KEY` falta, a menos que
   `EMAIL_DRY_RUN=true` (só em `.env` local): nesse modo grava o HTML em log e no `email_envios`
   com `status='dry_run'`. `APP_URL` é a única variável para link de app; `PUBLIC_SITE_URL` sai.

7. **Marca em um arquivo, e a identidade é a da landing.** `brand.ts` concentra nome, cores
   (hex espelhando `src/styles/tokens.css`), URLs de asset e a declaração da fonte. O e-mail
   deixa de ter visual próprio e passa a ser a landing traduzida para tabela HTML:

   - **Fonte Geist**, a mesma da landing, autohospedada no site (`/fonts/geist-variable.woff2`),
     sem `fonts.googleapis.com` (regra da SPEC 043). Apple Mail, iOS Mail e Outlook macOS
     renderizam a Geist; Gmail e Outlook Windows ignoram `@font-face` e caem no fallback
     (`Inter`, depois a grotesca do sistema), que tem o mesmo desenho. Aceito: nenhum cliente
     recebe fonte errada, só fonte menos específica.
   - **Faixa de morros da hero** fechando o cabeçalho, como PNG (`apps/marketing/public/email/wave-v1.png`,
     1200x225 servido a 600px) gerada a partir do mesmo SVG de `HeroBackdrop.tsx`. É imagem
     decorativa, nunca com texto por cima: cliente que bloqueia imagem mostra o céu claro
     (`#EFF9FB`, o mesmo `bgcolor` do bloco do título) e nada quebra.
   - **Botão em pílula verde** (`--brand-accent`) com tinta escura e seta à direita, igual ao
     `SplitButton`. Verde é fundo, nunca texto: para verde em texto existe `C.brandStrong`.
   - **Título grande com itálico de destaque** (peso 500, tracking -0.035em), a assinatura
     tipográfica da landing, em lugar do antigo destaque com fundo verde na palavra-chave.
   - Wordmark ao lado do símbolo em peso 500, não 700; domínio no rodapé como link.

   Rebrand Pilar → Prumeo é um diff nesse arquivo mais a troca dos PNGs.

## Consequências

**Positivas:**

- Visual único, igual ao da landing, e mudança de marca em um lugar. Preview de todos os templates com um comando
  (`npm run email:preview`, script Deno que renderiza fixtures em `.email-preview/`).
- Auditoria de envio: "o e-mail saiu? entregou? quicou?" respondido por query, não por Sentry.
- Bounce não queima reputação do domínio duas vezes.
- Injeção de HTML em e-mail deixa de ser possível por construção.
- Cliente final do escritório sabe de quem é a cobrança pelo remetente e pelo texto, e a resposta chega no escritório, não num `no-reply`.

**Negativas:**

- Refactor toca 8 edge functions + auth hook: precisa de teste em staging com envio real (dev
  local não sai e-mail). Fases pequenas, ver SPEC 095.
- Tabela nova e webhook novo = mais uma superfície pública (`resend-webhook`) para proteger.
- String HTML segue menos ergonômico que JSX para quem for escrever template novo. Mitigado pelo
  `layout.ts` com componentes prontos e pelo preview.
- Sem domínio por tenant, o `from` sempre é o Pilar. Escritório que quiser "de verdade" o próprio
  domínio fica pra decisão futura (custo: DNS por cliente, suporte).

## Decisões relacionadas

- [ADR 0004](./0004-edge-function-observability.md): logger/Sentry que o `client.ts` reutiliza.
- [ADR 0015](./0015-notificacoes-por-destinatario.md): a tabela `notificacoes` vira o outbox do
  e-mail de notificação ([SPEC 096](../../specs/096-notificacao-por-email.md)).
- [ADR 0036](./0036-sentry-cron-monitoring-profiling-deploy-tracking.md): monitoramento dos crons de envio.
- [SPEC 095](../../specs/095-padronizacao-de-email-transacional.md): implementação desta decisão.
- Pré-requisitos de DNS (SPF no apex, DMARC, MX) documentados na SPEC 095; hoje `pilarsoft.com.br`
  só tem SPF em `send.` (Resend) e não recebe e-mail.
