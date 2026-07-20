# QA Backend — Email, Convite e Nova Empresa

Ambiente: LOCAL (Supabase 127.0.0.1:54331, Mailpit 54334, DB `supabase_db_rizaklgstyfrwgmdsldf`).
Data: 2026-07-17. Executado direto no backend (curl + psql + docker logs), sem browser.
Empresa base: `937f6812-e91c-4747-a345-b98f0bba0d41` ("Pilar Local"). Ator: admin@pilar.local.

## Resumo (PASS/FAIL)

| # | Fluxo | Resultado |
|---|---|---|
| 1 | Convite de equipe (funcionário) | **FAIL** (convite gravado OK; email nunca sai) |
| 2 | Convite de portal do cliente | **PARTIAL** (conta+hash OK; email vai pro Resend, não pro Mailpit) |
| 3 | Reset de senha | **FAIL** (HTTP 500 no hook; nenhum email; + vaza existência da conta) |
| 4 | Nova empresa / owner | **FAIL e2e** pelo caminho admin; mecanismo do trigger PASS quando há signup pago |
| 5 | Casos adversariais | **PASS** (todos os gates de RBAC/CSRF/validação respondem certo) |

**Descoberta central: nenhum email chega ao Mailpit neste setup.** Emails de auth (convite, reset, magic link, signup) passam pelo Auth Hook `send_email`, que está quebrado no runtime local; e mesmo funcionando, o hook e os emails transacionais (portal, proposta, cobrança) saem pela API real do Resend, nunca pelo inbucket/Mailpit local. A premissa do CONTEXT.md ("email local cai no Mailpit") não vale com o hook habilitado.

---

## Mecanismo real (lido do código)

- **Convite funcionário** (`invite-user`): valida admin -> RPC `create_convite` (grava `convites` com `token_hash` sha256, coluna `token` = NULL, retorna token plaintext) -> `auth.admin.inviteUserByEmail(...)` -> GoTrue dispara o Auth Hook `send_email` (`auth-email-hook`) -> `sendEmail` (Resend) com `templateConviteUsuario`.
- **Convite portal** (`invite-cliente-portal`): valida admin -> RPC `_portal_create_account` (grava `cliente_portal_accounts` com `senha_hash` bcrypt) -> `sendEmail` (Resend) direto, `templateAcessoPortalCliente`. Não usa GoTrue.
- **Reset senha**: `POST /auth/v1/recover` -> GoTrue -> Auth Hook `send_email` (`recovery`) -> Resend.
- **Nova empresa (admin)** (`create-company-owner`): exige header `X-Super-Admin-Key` + Origin em `ALLOWED_ORIGINS` + `Content-Type: application/json`. Insere `empresa_owners_pending` e chama `inviteUserByEmail`. A empresa só nasce depois, no trigger `handle_new_user` (CENÁRIO 2), quando o owner completa o signup com o token.
- **`handle_new_user`** (trigger em auth.users): CENÁRIO 1 (funcionário) consome `convites`; CENÁRIO 2 (owner) **exige** um `pilar_pending_signups` com `payment_status='paid'` ligado por `empresa_owner_pending_id`, senão `RAISE EXCEPTION 'Cadastro de novo owner sem pagamento confirmado'`.

---

## Fluxo 1 — Convite de equipe — FAIL

Chamada: `POST /functions/v1/invite-user` como admin, `{email: qamail-func@pilar.local, role: user, features:{projetos:viewer}}`.

- **Resposta:** `HTTP 400 {"success":false,"error":"Falha ao enviar convite"}`.
- **(a) Linha em `convites` com token_hash (não plaintext):** PASS. Row gravada: `token` = (vazio/NULL), `token_hash = a72e920d...23978` (sha256, 64 hex), `features {"projetos":"viewer"}`, não usada, não expirada. `create_convite` gera token plaintext e grava só o hash. Confirmado.
- **(b) Email no Mailpit:** FAIL. Mailpit `total: 0`. Log do GoTrue:
  `"error":"500: Hook requires authorization token","hook":".../auth-email-hook" ... "msg":"Hook errored out"` e depois `AuthRetryableFetchError` no `invite-user`.
- Log do edge runtime: `Error: Missing authorization header` ao servir `auth-email-hook`.
- Nenhum usuário órfão em `auth.users` (a transação de invite do GoTrue faz rollback quando o hook falha), **mas** a row em `convites` fica (commit separado via RPC antes do envio) -> convite pendente órfão sem email. Ver ACH-EMAIL-07.

## Fluxo 2 — Convite de portal do cliente — PARTIAL

Preparação: criei `clientes` "QAEMAIL-cliente" (id `3a810cf0-...`). Chamada `POST /functions/v1/invite-cliente-portal`.

- **Resposta:** `HTTP 200 {"success":true,"email":"qamail-cli@pilar.local"}`.
- **Linha em `cliente_portal_accounts` (bcrypt, não plaintext):** PASS. `senha_hash` = `$2a$06$...` (60 chars, bcrypt), `ativo=t`, `must_change_password=t`.
- **Email no Mailpit:** FAIL. Mailpit `total: 0`. A função retornou 200 e **não** logou `RESEND_API_KEY not configured`, ou seja `sendEmail` chamou a API real do Resend e recebeu OK. O email foi despachado ao Resend de produção (destinatário `@pilar.local` não entrega), nunca ao Mailpit. Conteúdo do email não é verificável localmente. Ver ACH-EMAIL-02 e ACH-EMAIL-03.

## Fluxo 3 — Reset de senha — FAIL

- `POST /auth/v1/recover` para usuário real (colab@pilar.local): **`HTTP 500 {"msg":"Hook requires authorization token"}`**. Nenhum email; Mailpit vazio. Mesma causa raiz do Fluxo 1 (hook de auth quebrado).
- Adversarial, email inexistente (`nao-existe-qamail@pilar.local`): `HTTP 200 {}`.
- **Sub-achado de segurança:** o diferencial 500 (conta existe -> tenta chamar o hook -> falha) vs 200 (conta não existe -> GoTrue nem chama o hook) permite **enumeração de contas** localmente. É consequência do hook quebrado; com o hook OK ambos dariam 200. Revalidar em staging. Ver ACH-EMAIL-06.

## Fluxo 4 — Nova empresa / owner — FAIL e2e (admin); mecanismo PASS com signup pago

- **Caminho admin (`create-company-owner`):**
  - Sem chave: `HTTP 400 {"error":"SUPER_ADMIN_KEY não configurada no ambiente"}` — `SUPER_ADMIN_KEY` não está no env local. Fluxo intestável por aqui sem configurá-la (ACH-EMAIL-05).
  - Mesmo com a chave, quebraria: (i) o email de convite passa pelo hook quebrado; (ii) a função insere só `empresa_owners_pending`, **não** cria `pilar_pending_signups` pago -> ao completar o signup, `handle_new_user` CENÁRIO 2 dá `RAISE EXCEPTION 'Cadastro de novo owner sem pagamento confirmado'`. Confirmado empiricamente (tentativa de criar o owner sem signup pago retornou `P0001: Cadastro de novo owner sem pagamento confirmado`, HTTP 500). Dessincronia confirmada (ACH-EMAIL-04).
- **Caminho pago (trigger) — simulação e2e:** semeei um `pilar_subscription_plans` (a tabela estava vazia — ACH-EMAIL-08), inseri `empresa_owners_pending` + `pilar_pending_signups(payment_status='paid', billing_type='PIX')` ligados, e criei o usuário via `POST /auth/v1/admin/users` com `user_metadata.invite_token`. **Resultado PASS:** empresa "QAEMAIL-Empresa-E2E" criada, profile do owner com `role=admin`, `empresa_owners_pending.usado_em` consumido. O mecanismo do trigger funciona quando os pré-requisitos existem — o que falta localmente é o webhook de pagamento (Stripe/Asaas não fecha no local).

## Fluxo 5 — Adversariais — PASS

| Caso | Esperado | Obtido |
|---|---|---|
| invite-user email inválido | 400 | `400 Invalid email format` PASS |
| invite-user por não-admin (colab) | 403 | `403 Only admins can invite users` PASS |
| invite-user role=owner (escalada) | coerção p/ user | convite gravado como `cargo=user` (sem escalada) PASS |
| invite-portal cliente já ativo | 409 | `409 Este cliente já possui acesso ao portal` PASS |
| create-company-owner Origin hostil | 403 | `403 Origin not allowed` PASS |
| create-company-owner sem chave | rejeição | `400 SUPER_ADMIN_KEY não configurada` PASS (gate) |
| recover email inexistente | não vazar | `200 {}` (ver ressalva ACH-EMAIL-06) |

---

## Achados

- **ACH-EMAIL-01 (BLOCKER local):** `auth-email-hook` rejeitado com `Missing authorization header` / GoTrue `500: Hook requires authorization token`. O `config.toml` tem `verify_jwt = false` (linha 67) para a função, mas o edge runtime em execução está aplicando verificação de JWT mesmo assim — config em execução defasada (mudou depois do `supabase start`). Quebra TODOS os emails de auth locais: convite de funcionário, reset de senha, magic link, confirmação de signup. Correção: reiniciar o stack (`supabase stop && supabase start`) para recarregar o config, ou re-servir as functions. É estado de ambiente, não bug de código. (Não reiniciei para não derrubar outros QAs em paralelo.)

- **ACH-EMAIL-02 (alto):** Com o Auth Hook `send_email` habilitado, o GoTrue delega os emails de auth ao hook -> Resend, **contornando o inbucket/Mailpit local**. Mailpit nunca recebe email de auth mesmo com o hook consertado. Para QA de conteúdo de email localmente, desabilitar `[auth.hook.send_email]` no config local (GoTrue volta a usar SMTP do inbucket) ou apontar o Resend para um sink local.

- **ACH-EMAIL-03 (alto — custo/privacidade):** O dev local faz chamadas AO VIVO para a conta Resend de produção nos emails transacionais (portal, proposta, cobrança). Verificado: convite de portal retornou 200 sem log de "não configurado" -> `sendEmail` chamou a API real do Resend, enviando de `no-reply@pilarsoft.com.br` para `@pilar.local` (bounce, gasta cota, from de domínio de produção). Local deveria usar chave fake/sandbox ou sink.

- **ACH-EMAIL-04 (médio):** `create-company-owner` dessincronizado: insere `empresa_owners_pending` mas não cria `pilar_pending_signups` pago. `handle_new_user` CENÁRIO 2 exige `payment_status='paid'` -> o owner nunca completa o signup por esse caminho (`Cadastro de novo owner sem pagamento confirmado`). Admin não tem caminho funcional para criar empresa. Confirma a memória prévia.

- **ACH-EMAIL-05 (médio):** `SUPER_ADMIN_KEY` ausente no env de functions local -> `create-company-owner` retorna 400 antes de qualquer ação. Fluxo de nova empresa via admin intestável localmente sem configurá-la.

- **ACH-EMAIL-06 (médio — segurança):** `/auth/v1/recover` vaza existência de conta localmente pelo diferencial de erro: conta real -> HTTP 500 (tenta o hook e falha), conta inexistente -> HTTP 200. Causa raiz é ACH-EMAIL-01; em produção com hook OK ambos dariam 200. Revalidar em staging/prod.

- **ACH-EMAIL-07 (baixo):** Convite pendente órfão em falha de email. `create_convite` (RPC) faz commit da row em `convites` antes do `inviteUserByEmail`; quando o hook falha, a row persiste (válida, não usada) sem email enviado e sem usuário em auth.users. Deixa convites pendentes pendurados. O endpoint de `resend`/`DELETE` do `invite-user` permite recuperar.

- **ACH-EMAIL-08 (nota):** `pilar_subscription_plans` vazia no local + FK de `pilar_pending_signups.plan_id` -> o caminho de checkout/assinatura/nova-empresa não roda localmente sem semear um plano.

## Verificações positivas (o que está certo)

- `convites.token_hash` = sha256, coluna `token` NULL (sem plaintext). PASS.
- `cliente_portal_accounts.senha_hash` = bcrypt `$2a$06$`. PASS.
- RBAC do `invite-user`: não-admin 403, email inválido 400, escalada a owner coagida para `user`. PASS.
- Gates CSRF do `create-company-owner` (Origin allowlist, Content-Type, chave). PASS.
- Mecanismo do trigger `handle_new_user` para nova empresa funciona quando há `pilar_pending_signups` pago. PASS.

## Entidades de teste criadas (prefixo QAEMAIL)

- `clientes` "QAEMAIL-cliente" (`3a810cf0-2ea1-4f33-8d43-9be242535ec3`) + `cliente_portal_accounts` ativo.
- `convites` pendentes: qamail-func@pilar.local, qamail-owner@pilar.local (órfãos, sem email — ACH-EMAIL-07).
- Simulação nova empresa: `pilar_subscription_plans` "qamail-plan", `empresa_owners_pending` + `pilar_pending_signups` pago, `empresas` "QAEMAIL-Empresa-E2E" + owner `qamail-owner-e2e@pilar.local` (auth.users + profile role admin). Entidades base intocadas.
