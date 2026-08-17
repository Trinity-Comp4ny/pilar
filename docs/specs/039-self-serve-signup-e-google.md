# Spec 039 — Cadastro self-serve + login/cadastro com Google

Status: **draft, aguardando validação** · 2026-08-13

## Problema

Hoje ninguém cria conta sozinho: o trigger `handle_new_user` (`20260720000010_owner_pending_token_hash.sql:45-47`) dá `RAISE EXCEPTION` sempre que o cadastro não traz um `invite_token` válido (de convite ou de checkout pago). Isso é deny-by-default de propósito, fechou a brecha em que qualquer um se tornava admin de empresa alheia forjando `raw_user_meta_data`.

Com pagantes já validados à mão, o CEO quer **abrir o self-serve**: o usuário cria a própria conta (email/senha ou Google), vira dono de uma empresa nova, e usa 14 dias de trial grátis antes de pagar. Convites continuam existindo para adicionar membros a uma empresa existente.

## Decisões de produto (confirmadas)

- **Trial de 14 dias sem cartão.** Cria conta, usa grátis, e um gate de pagamento bloqueia depois.
- **Signup = nova empresa + dono.** Cadastro sem convite cria um tenant novo com o usuário como `admin`/owner. Convite continua sendo o único jeito de entrar numa empresa **existente**.
- **Confirmar email ligado** (config Supabase): o usuário confirma o email antes de entrar. Corta contas falsas no trial grátis E é o que torna o linking automático seguro (senha vira email verificado).
- **Cruzamento automático de contas (identity linking).** Mesmo email por Google e por senha = **mesmo usuário**. É o comportamento **nativo** do Supabase (`auth-identity-linking` → Automatic Linking), que **só vincula email verificado** — a proteção contra pre-account-takeover já é embutida. Como o Google sempre verifica o email e a senha tem confirm-email ligado, os dois lados são verificados; um email não verificado é recusado pelo próprio Supabase. Não requer código de linking, é config.
- **Tag "último método usado".** Guardar qual método o usuário usou por último para destacar na tela de login ("você entrou com Google da última vez").

## Desenho

### 1. Trigger `handle_new_user` — novo Cenário 3 (self-serve)

Hoje: sem token → exception. Muda para: **sem token → cria empresa nova + profile admin + subscription em trial.** Os Cenários 1 (convite) e 2 (checkout pago) ficam intactos.

Esqueleto (a migration final passa pelo `rls-auditor` antes de aplicar):

```sql
-- dentro de handle_new_user, onde hoje há RAISE por token ausente:
if v_token is null then
  -- CENÁRIO 3: self-serve. Empresa SEMPRE nova, nunca uma existente.
  insert into empresas (owner_id, nome, features, onboarding_completed)
    values (NEW.id, coalesce(v_company_name, 'Minha empresa'), <features_default>, false)
    returning id into v_empresa_id;

  insert into profiles (id, empresa_id, role, nome, onboarding_completed)
    values (NEW.id, v_empresa_id, 'admin', v_nome, false);  -- role FIXO, nunca do metadata

  insert into pilar_subscriptions (empresa_id, plan_id, status, trial_ends_at)
    values (v_empresa_id, <plano_default>, 'trialing', now() + interval '14 days');

  return NEW;
end if;
-- senão: caminhos de token (convite / owner pago) como hoje.
```

**Invariantes de segurança preservadas (o motivo do trigger existir):**
1. Empresa **sempre nova** (`owner_id = NEW.id`); self-serve é incapaz de tocar empresa existente.
2. `role = 'admin'` **fixado no servidor**, jamais lido de `raw_user_meta_data`.
3. `features` **fixadas no servidor** (mesmo default do Cenário 2).
4. Nenhuma flag de tenant/role é lida do metadata. Só se lê `nome` (do usuário) e opcionalmente `company_name` (nome de exibição da empresa nova, não é seleção de tenant, não é risco).
5. Teste de segurança dedicado: tentar forjar `empresa_id`/`role`/`is_company_owner` no metadata de um self-signup deve ser **ignorado** (o usuário cai numa empresa nova como admin, nunca na empresa da vítima).

### 2. Trial e gate de pagamento

- A empresa self-serve nasce com `pilar_subscriptions.status = 'trialing'` + `trial_ends_at = now()+14d`, apontando para o **plano padrão** (o plano principal ativo de `pilar_subscription_plans`).
- O gate do `PrivateRoute` já bloqueia em `canceled`/`expired` (abre o modal de pagamento) e libera em `trialing`/`overdue`. O cron `trial-expiry-cron` vira o status quando o trial vence → após 14 dias, o gate bloqueia até assinar. Sem tocar o `PrivateRoute`.

### 3. Front — tela de cadastro (nova)

Hoje não existe `signUp` no client nem tela de cadastro (o rodapé do Login manda "falar com o comercial"). Adicionar:

- Rota pública `/cadastro`: form com **nome, email, senha** e (opcional) **nome da empresa**, + botão "Continuar com Google". Chama `supabase.auth.signUp({ email, password, options: { data: { nome, company_name }, emailRedirectTo } })`.
- Link recíproco Login ↔ Cadastro (trocar o "fale com o comercial" por "Criar conta").
- Pós-signup, dois caminhos conforme a config de confirmação de email (ver Decisões abertas):
  - **Confirm email ON**: tela "confira seu email para confirmar" → ao confirmar, cai logado no onboarding.
  - **Confirm email OFF**: já entra logado, direto no onboarding.
- O onboarding pós-signup **reusa o que já existe**: `ProfileSetup` → `CompanySetup` (preenche o nome/CNPJ da empresa nova) → checklist + tour. `PrivateRoute` já roteia isso.

### 4. Google OAuth (login + cadastro)

- **Setup externo (você faz, gratuito):** criar OAuth Client no Google Cloud Console (client id/secret + redirect URIs), e habilitar o provider Google no Supabase (Auth → Providers → Google) nos **dois** projetos (staging e prod). Eu te passo o passo a passo exato.
- **Código:** botão "Continuar com Google" em `/login` e `/cadastro` → `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '<app>/auth/callback' } })`.
- **Rota `/auth/callback`** (nova): o `detectSessionInUrl` (default do supabase-js) processa a sessão; a rota espera e redireciona para `/inicio` (o `PrivateRoute` manda para `/profile-setup` se o onboarding estiver incompleto).
- **Usuário Google chega sem senha.** O `ProfileSetup` atual **força** `updateUser({ password })` (`:87-90`); tornar o campo senha **opcional** quando a conta é OAuth (detectar por `user.app_metadata.provider === 'google'` ou `user.identities`).
- **Email novo via Google** → dispara `handle_new_user` sem token → Cenário 3 → empresa nova + trial. Consistente com o self-serve por senha.
- **Email que já existe via Google** → o Supabase **vincula automaticamente** a identidade Google ao usuário existente (mesmo email, ambos verificados). Vira o mesmo usuário; não cria empresa nova, não dispara o Cenário 3 (não há INSERT em `auth.users`, só uma identidade nova no user existente). Seguro por design (só linka email verificado).

### 5. Tag "último método usado"

Guardar, por dispositivo, o método do último login bem-sucedido para a tela de login destacar a opção ("você entrou com Google da última vez", padrão Google/Booking).

- Ao logar com sucesso (senha ou Google), gravar `localStorage["pilar:ultimo-login"] = { metodo: "google" | "senha", ts }`. Por dispositivo, sem PII além do método.
- Em `/login`: se há um último método, dar destaque visual ao botão correspondente (ex.: um selo "usado por último" no botão do Google, ou realçar o campo de senha). Sem revelar identidade (não mostra email de outra pessoa num device compartilhado).
- Opcional (telemetria, fora do MVP): também gravar `profiles.ultimo_metodo_login` no login, para métricas de adoção do Google vs senha.

## Config externa do Supabase (você faz, gratuito)

Antes/junto da implementação, no painel dos DOIS projetos (staging e prod):

1. **Auth → Providers → Google**: habilitar, com o Client ID/Secret do OAuth app criado no Google Cloud Console (te passo o passo a passo). Redirect URL: `https://<ref>.supabase.co/auth/v1/callback`.
2. **Auth → confirmar email ligado** (Confirm email). É o que torna o linking seguro.
3. **Prevent duplicate emails / automatic linking**: manter o padrão (email único; linking automático por email verificado). Nada a desligar; é o comportamento que queremos.

## Faseamento da implementação

1. **Migration do trigger** (Cenário 3 + subscription trial) — a parte de maior risco. Passa pelo `rls-auditor` + teste de segurança (forjar metadata) + aplica em staging via MCP + `gen:types`.
2. **Front self-serve por senha** — tela `/cadastro`, `signUp`, `ProfileSetup` com senha opcional, links Login↔Cadastro.
3. **Google OAuth** — botão + rota `/auth/callback` + (você) config do provider.

## Riscos

- **Reabrir a brecha de tenancy** se o Cenário 3 ler qualquer coisa de tenant/role do metadata. Mitigado pelas invariantes + teste de segurança dedicado.
- **Contas falsas no trial grátis** sem cartão. Mitigado por confirm email + (futuro) rate limit por IP no signup.
- **Inconsistência já existente** (fora desta spec, mas anotada): `create-company-owner` cria `empresa_owners_pending` sem `pilar_pending_signups` pago, mas o Cenário 2 do trigger exige `paid`. Confirmar em runtime; não bloqueia o self-serve.
