# SPEC 095: Padronização do e-mail transacional (módulo único, marca, log, entrega)

**Data:** 2026-09-04
**Status:** Em implementação (Fases 0 e 1 em `feat/email-module-design-system`)
**Autor:** Matheus (CEO) + Claude
**Módulo:** transversal (edge functions, auth, financeiro, propostas, portal)
**Depende de:** [ADR 0039](../architecture/adr/0039-email-transacional-modulo-unico-resend-e-log.md), [ADR 0004](../architecture/adr/0004-edge-function-observability.md)

<!-- Origem: pedido do CEO em 04/09 ("quero abranger tudo a respeito de disparo de e-mails,
padronizar, reaproveitar, e ter controle do design"). Inventário completo está no Contexto do
ADR 0039. Esta spec é o COMO daquela decisão. A feature de notificação por e-mail é a SPEC 096,
que depende desta. -->

## Problema

O Pilar manda e-mail por três caminhos de template diferentes (string HTML, React Email órfão,
HTML inline em duas functions), sem escapar dado de usuário, sem `replyTo`, sem registro de
envio e com uma marca improvisada. Quem sente: o sócio do escritório, que manda cobrança e
proposta pro cliente dele e não consegue nem confirmar que chegou nem receber a resposta; e o
próprio Pilar, que não tem como mudar logo ou nome sem editar 3 lugares.

## Objetivo

Um e-mail novo no Pilar é um arquivo em `_shared/email/templates/`, renderiza com o mesmo shell,
escapa dado por padrão, sai com `replyTo` certo, fica registrado em `email_envios` com status
de entrega, e pode ser pré-visualizado no browser antes de ir pra staging. Marca em um arquivo.

**Fora de escopo:**

- E-mail de notificação da central (SPEC 096, depende desta).
- Domínio de envio por escritório (`from` com domínio do cliente). Continua domínio do Pilar.
- Editor de template pelo usuário final (empresa personalizar texto de cobrança). O escritório
  personaliza só logo, nome e e-mail de resposta, que já existem em `empresas`.
- Migrar o Supabase Auth para SMTP próprio: o `auth-email-hook` continua sendo a saída dos e-mails
  de auth.
- Rebrand Pilar → Prumeo. Esta spec deixa a troca como diff de um arquivo, não executa.

## Requisitos

Funcionais:

1. **Módulo único.** Criar `supabase/functions/_shared/email/` conforme o ADR 0039 (`index.ts`,
   `client.ts`, `brand.ts`, `escape.ts`, `layout.ts`, `templates/`). Remover `_shared/email.ts`
   (vira re-export temporário por uma fase, depois apagado) e apagar `_shared/emails/*.tsx` inteiro.
2. **Templates migrados 1:1, mesmo visual, agora escapando.** Os 8 de `email.ts` (recuperação de
   senha, convite, magic link, confirmação de cadastro, mensagem manual, cobrança direta, acesso ao
   portal do cliente, envio de proposta) mais os 2 inline (`trial-expiry-cron`,
   `send-data-deletion-notification`) viram `templates/<nome>.ts`. Todo dado de entrada passa por
   `escapeHtml()`; quebra de linha em texto livre vira `<br/>` DEPOIS do escape.
3. **`text/plain` sempre.** `sendEmail()` gera versão texto a partir do HTML (strip de tags,
   links como `Rótulo: URL`) quando o template não fornece `text`.
4. **Idempotência.** Todo envio manda `Idempotency-Key` ao Resend. Quem chama passa
   `idempotencyKey` quando tem chave natural (ex.: `fatura-<id>-lembrete-<data>`); senão o client
   gera `sha256(to+subject+html)` válido pela janela de retry.
5. **Duas classes e `replyTo` obrigatório.** `sendEmail({ classe: 'plataforma' | 'escritorio', ... })`.
   - `plataforma`: `from` e `replyTo` vêm de `brand.ts`.
   - `escritorio`: exige `empresa: { id, nome, email, logo_url }`. `from` =
     `"<nome> via Pilar" <no-reply@dominio>`, `replyTo` = `empresa.email`. Sem `empresa.email`
     válido a function devolve 422 `"Cadastre o e-mail da empresa em Configurações para enviar ao
cliente"` e o front mostra esse aviso com atalho para Configurações > Empresa.
   - Aplica a: `send-invoice-reminder`, `send-proposta-email`, `send-manual-client-email`,
     `invite-cliente-portal`, `reset-cliente-portal-password`.
6. **Co-branding no shell.** Para `escritorio`, o header mostra `logo_url` da empresa (img 44px,
   fallback: iniciais em quadrado neutro) e o nome; rodapé fixo "Enviado por <Empresa> via Pilar".
   Para `plataforma`, header com o logo do Pilar (PNG 2x hospedado, ver req. 9) e wordmark.
7. **Mensagem manual só para cliente da empresa.** `send-manual-client-email` passa a receber
   `cliente_id` (não e-mail livre), resolve o e-mail pelo `clientes` da `empresa_id` do caller e
   grava `referencia_tipo='cliente'`. Motivo: hoje qualquer usuário autenticado envia texto livre
   para qualquer endereço com remetente do Pilar.
8. **Log `email_envios` + supressão.** Migration cria `public.email_envios` e
   `public.email_supressoes` (shape no ADR 0039). `client.ts` insere antes do envio
   (`status='enviando'`) e atualiza para `enviado`/`falhou` com `resend_id`/`erro`. Antes de
   enviar, recusa destinatário presente em `email_supressoes` (retorna `{ skipped: 'suprimido' }`
   e loga `warn`).
9. **Webhook do Resend.** Edge function `resend-webhook` (`verify_jwt=false`, assinatura Svix
   verificada com `RESEND_WEBHOOK_SECRET`, mesmo padrão de `auth-email-hook/webhook.ts`) trata
   `email.delivered`, `email.bounced`, `email.complained`, `email.delivery_delayed`: atualiza
   `email_envios.status` pelo `resend_id`; `bounced` (hard) e `complained` inserem em
   `email_supressoes`.
10. **Kit de marca do e-mail = identidade da landing.** `brand.ts` guarda cores, URLs e a
    declaração de fonte (detalhe e trade-offs no ADR 0039):
    - Fonte **Geist** por `@font-face` apontando para `/fonts/geist-variable.woff2` do site, com
      fallback `Inter` e grotesca do sistema. Sem Google Fonts (SPEC 043).
    - `public/email/logo-v1.png` (símbolo, 96px, exportado de `public/pilar-logo.svg`) e
      `public/email/wave-v1.png` (faixa de morros da hero, 1200x225, exportada do mesmo SVG de
      `HeroBackdrop.tsx` com os tokens resolvidos em hex). Nada de SVG em `<img>` de e-mail.
    - Botão em pílula verde com seta, título com itálico de destaque, wordmark em peso 500.
    - Ao fechar o logo definitivo em `brand/visual.md`, troca-se o arquivo e sobe a versão
      (`-v2`), sem tocar em template.
11. **Preview local.** Script `scripts/email-preview.ts` (Deno) renderiza TODOS os templates com
    fixtures em `.email-preview/<template>.html` (gitignored) e imprime o caminho; `npm run
email:preview`. Script `npm run email:test-send -- --to <email> --template <nome>` envia pelo
    Resend de STAGING (usa `scripts/supabase-target.sh`, ADR 0007) para ver no Gmail/Outlook real.
12. **URLs com nome claro.** `APP_URL` é o app (`app.pilarsoft.com.br`); `PUBLIC_SITE_URL` é o
    site público, onde vive o portal do cliente (`www.pilarsoft.com.br/cliente/login`). Não são
    duplicatas: `brand.ts` lê as duas e nenhuma function monta URL a partir de `ALLOWED_ORIGINS`
    (hoje `trial-expiry-cron` faz isso).
13. **Falha alta.** Sem `RESEND_API_KEY` e sem `EMAIL_DRY_RUN=true`, `sendEmail()` lança. `.env`
    local ganha `EMAIL_DRY_RUN=true`; staging e prod não.
14. **Lint de fronteira.** Regra em CI (grep no job de lint, ou `deno lint` custom) que reprova
    `api.resend.com`, `<!DOCTYPE html>` e `<html` em `supabase/functions/**` fora de `_shared/email/`.

Não-funcionais:

- **Segurança / RLS:** `email_envios` e `email_supressoes` com RLS; SELECT para `ultra_admin`
  (tudo) e `has_role('admin')` restrito a `empresa_id = get_user_empresa_id()`; INSERT/UPDATE só
  service role (nenhuma policy para `authenticated`). `resend-webhook` rejeita assinatura inválida
  com 401 e nunca loga o corpo cru. Repo é público: nada de chave ou URL de webhook em doc.
- **Entrega (DNS, pré-requisito operacional, fora do repo):** SPF no apex de `pilarsoft.com.br`,
  DMARC (`p=none` com `rua` primeiro, `p=quarantine` depois de 2 semanas limpas), MX para o domínio
  receber resposta (Cloudflare Email Routing, gratuito, encaminhando `contato@` e `privacidade@`
  para uma caixa real). `replyTo` de plataforma só pode apontar para caixa que existe. Checklist
  vai para `docs/operations/DEPLOY_CHECKLIST.md`.
- **Multi-tenant:** `email_envios.empresa_id` obrigatório para classe `escritorio`; classe
  `plataforma` pode ter `empresa_id` nulo (ex.: recuperação de senha antes do login).
- **Performance:** insert no log é 1 linha por envio; índice `(empresa_id, created_at desc)` e
  `(resend_id)` único parcial.
- **Compatibilidade:** shell continua "light only" com MSO/VML para Outlook; testar no Gmail web,
  Gmail Android, Apple Mail, Outlook desktop via `email:test-send`.

## Critérios de aceite

- [ ] Dado um template qualquer, quando recebo um nome contendo `<b>x</b>`, então o HTML final
      contém `&lt;b&gt;x&lt;/b&gt;` e nenhum tag injetado (teste `deno test` por template).
- [ ] Dado `RESEND_API_KEY` ausente e `EMAIL_DRY_RUN` ausente, quando chamo `sendEmail`, então
      lança erro e nada é registrado como `enviado`.
- [ ] Dado `EMAIL_DRY_RUN=true`, quando chamo `sendEmail`, então nenhuma requisição sai e
      `email_envios` recebe linha `status='dry_run'`.
- [ ] Dado um lembrete de cobrança para empresa com `email` cadastrado, quando envio, então o
      payload ao Resend tem `reply_to = empresa.email` e `from` começa com `"<Empresa> via Pilar"`.
- [ ] Dado empresa sem `email`, quando tento enviar cobrança/proposta/mensagem, então recebo 422 e
      a UI mostra "Cadastre o e-mail da empresa em Configurações para enviar ao cliente".
- [ ] Dado um endereço em `email_supressoes`, quando qualquer function tenta enviar, então o
      envio é pulado, `email_envios` registra `status='suprimido'`, e a resposta não é erro 500.
- [ ] Dado evento `email.bounced` assinado corretamente, quando o webhook recebe, então
      `email_envios.status='bounce'` e o endereço entra em `email_supressoes`.
- [ ] Dado evento com assinatura inválida, quando o webhook recebe, então 401 e nada muda.
- [ ] Dado admin da empresa A, quando consulta `email_envios`, então só vê linhas da empresa A
      (pgTAP com `set role authenticated` + `request.jwt.claims`, não superuser).
- [ ] Dado `send-manual-client-email` com `cliente_id` de outra empresa, então 404/403 e nada é
      enviado.
- [ ] Dado `npm run email:preview`, então existe um `.html` por template e todos abrem com o
      mesmo header/rodapé.
- [ ] Dado o código final, então `grep -r "api.resend.com" supabase/functions` só bate em
      `_shared/email/client.ts` e `_shared/healthcheck.ts`; nenhum `<!DOCTYPE` fora de
      `_shared/email/`.
- [ ] Dado um e-mail de auth (recuperação) disparado em staging, então chega com o novo shell, o
      link funciona e o `email_envios` tem a linha `tipo='auth_recovery'`.
- [ ] Caso de borda: fuso horário do `email_envios.created_at` é UTC; a UI de auditoria formata em
      `America/Sao_Paulo` via `@/lib/format`.

## Dados e contratos

```sql
create table public.email_envios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete set null,
  classe text not null check (classe in ('plataforma','escritorio')),
  tipo text not null,                 -- auth_recovery, convite_usuario, cobranca_lembrete, proposta_envio, notificacao_imediata, ...
  destinatario text not null,
  assunto text not null,
  resend_id text,
  status text not null check (status in ('enviando','enviado','falhou','entregue','atrasado','bounce','reclamacao','suprimido','dry_run')),
  erro text,
  referencia_tipo text,
  referencia_id uuid,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index on public.email_envios (resend_id) where resend_id is not null;
create index on public.email_envios (empresa_id, created_at desc);

create table public.email_supressoes (
  email text primary key,
  motivo text not null check (motivo in ('bounce','reclamacao','manual')),
  created_at timestamptz not null default now()
);
```

```ts
// _shared/email/client.ts
export interface SendEmailInput {
  classe: "plataforma" | "escritorio";
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  tipo: string; // vai para email_envios.tipo e para tags do Resend
  empresa?: { id: string; nome: string; email: string | null; logo_url: string | null };
  referencia?: { tipo: string; id: string };
  idempotencyKey?: string;
  attachments?: { filename: string; content: string }[];
}
export type SendEmailResult =
  | { ok: true; resendId: string | null; envioId: string }
  | { ok: false; skipped: "suprimido" | "dry_run"; envioId: string };
export function sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
```

```ts
// _shared/email/brand.ts (único lugar de marca)
const appUrl = Deno.env.get("APP_URL") ?? "https://app.pilarsoft.com.br";
export const BRAND = {
  nome: "Pilar",
  dominio: "pilarsoft.com.br",
  appUrl,
  from: Deno.env.get("RESEND_FROM") ?? "Pilar <no-reply@pilarsoft.com.br>",
  replyTo: Deno.env.get("RESEND_REPLY_TO") ?? "contato@pilarsoft.com.br",
  logoUrl: `${appUrl}/email/logo-v1.png`,
  cores: { brand: "#A4EC86", ink: "#0A0A0A", bg: "#F5F5F5" }, // espelho de src/styles/tokens.css
} as const;
```

Edge functions novas: `resend-webhook` (POST, Svix). Secrets novos: `RESEND_WEBHOOK_SECRET`,
`RESEND_REPLY_TO`. Local: `EMAIL_DRY_RUN=true`.

## Plano de implementação

Fases pequenas, cada uma um PR para `staging`, testadas com envio real em staging.

1. **Fase 0, infra e marca (feita):** pasta `_shared/email/` com `brand.ts`, `html.ts` (escape),
   `layout.ts` (shell + componentes na identidade da landing), `client.ts` (`text/plain`,
   `Idempotency-Key`, classe, falha alta, `EMAIL_DRY_RUN`). `email.ts` e `_shared/emails/*.tsx`
   apagados. PNGs do logo e da faixa de morros em `public/email/`. Script `email:preview` com a
   Geist embutida na prévia. Testes Deno de escape, `text/plain`, remetente e identidade.
2. **Fase 1, templates (feita):** os 8 + os 2 inline em `templates/{auth,escritorio,plataforma}`,
   mais `notificacoes.ts` (para a SPEC 096), todos escapando e no shell novo. Falta o passo de
   staging: `email:test-send` de cada um para Gmail, Apple Mail e Outlook, e conferir a Geist e a
   faixa de morros no cliente real.
3. **Fase 2, log + webhook:** migration `email_envios`/`email_supressoes` (+ pgTAP de RLS),
   `client.ts` grava, `resend-webhook` atualiza. Registrar webhook no Resend de staging. UI mínima:
   aba "E-mails" em Administração (ultra admin) usando `DataTable`, filtro por status.
4. **Fase 3, classes e co-branding:** `classe`, `replyTo`, header de escritório nas 5 functions de
   cliente final; 422 sem e-mail da empresa; `send-manual-client-email` por `cliente_id` (ajuste
   no front que chama). Lint de fronteira no CI. Remover `PUBLIC_SITE_URL`.
5. **Operação (paralelo, fora do repo):** SPF no apex, DMARC `p=none`, Email Routing para
   `contato@`/`privacidade@`; anotar no `DEPLOY_CHECKLIST.md`. Depois de 2 semanas limpas de
   relatório DMARC, `p=quarantine`.

## Decisões e riscos

- Decisão registrada no [ADR 0039](../architecture/adr/0039-email-transacional-modulo-unico-resend-e-log.md).
- **Risco: auth hook.** Qualquer regressão no `auth-email-hook` derruba cadastro e recuperação de
  senha. Fase 1 testa recuperação, convite e confirmação em staging antes do release; o webhook
  test existente (`webhook.test.ts`) continua.
- **Risco: mudança de `from`** (`"<Empresa> via Pilar"`) pode cair em filtro de spam se o display
  name variar muito. Mitigação: endereço fixo, só o display name muda, DMARC alinhado.
- **Suposição:** Resend Idempotency-Key aceita janela de 24h por chave; conferir na doc atual antes
  da Fase 0.
- **Suposição:** `empresas.email` é preenchido pelas empresas ativas. Levantar em staging/prod na
  Fase 3; se estiver vazio na maioria, o 422 vira nudge no onboarding antes de bloquear.
- **Dívida assumida:** e-mail continua saindo por Deno `fetch` direto, sem SDK do Resend. Menos
  dependência, mais responsabilidade nossa em acompanhar a API.
