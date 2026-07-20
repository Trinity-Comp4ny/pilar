# Catálogo QA — Auth / Onboarding / Conta / RBAC / Nova Empresa

Ambiente: banco LOCAL (Supabase 127.0.0.1), app http://localhost:8080. MFA bypassado no dev local (`mfaDevBypass`), então casos de MFA passam direto no browser local — anotados com "[MFA só em staging/prod]" onde relevante. Credenciais em `qa-report/CONTEXT.md`.

Convenção de roles: o app está em transição. Roles de contrato = `owner | coordenador | colaborador`. Roles legados = `user | admin | ultra_admin`. `admin` NÃO é bloqueado pelo `RequireRole` (passa direto, ver ACH-AUTH-... e nota do CONTEXT). A barreira real é a RLS do backend; estes guards são só UX.

---

## PARTE A — Casos de teste para o browser (Camada B)

### Login (`/login`, `src/pages/Login.tsx`)

**AUTH-01 · Login caminho feliz**
- Rota/onde: `/login`
- Passos: entrar com `admin@pilar.local` / `Pilar@2026`, submeter.
- Input adversarial: —
- Esperado: toast "Login realizado com sucesso"; vai pra `/dashboard`; ultra_admin cai em `/ultra-admin` só se for esse o role.
- Prioridade: P0

**AUTH-02 · Email inválido bloqueado no cliente**
- Rota: `/login`
- Passos: digitar `admin`, `admin@`, `a@b`, submeter.
- Adversarial: string sem `@`, com espaços, unicode.
- Esperado: zod (`loginSchema`) mostra "Email inválido"; botão não chama a API.
- Prioridade: P1

**AUTH-03 · Campos obrigatórios vazios**
- Rota: `/login`
- Passos: submeter com email e/ou senha vazios.
- Esperado: "Email inválido" / "Informe a senha"; sem request.
- Prioridade: P1

**AUTH-04 · Credenciais erradas**
- Rota: `/login`
- Passos: email válido + senha errada.
- Adversarial: senha certa de outro usuário; email não cadastrado.
- Esperado: toast "Erro ao fazer login / Verifique suas credenciais". Mensagem NÃO deve revelar se o email existe (anti-enumeração). Ver ACH-AUTH-13 (mensagem é genérica demais e mascara rate-limit/rede).
- Prioridade: P0

**AUTH-05 · Duplo submit no login**
- Rota: `/login`
- Passos: clicar "Entrar" e apertar Enter rápido / clicar 2x.
- Adversarial: 2 Enters antes do re-render.
- Esperado: só uma tentativa; botão vira "Entrando..." e desabilita. Verificar no Network que não saem 2 `signInWithPassword`.
- Prioridade: P2

**AUTH-06 · Rate limit de login**
- Rota: `/login`
- Passos: errar senha várias vezes até `guard_login_attempt` bloquear.
- Adversarial: verificar se após reset de 15min libera; verificar mensagem quando o RPC falha (ver ACH-AUTH-01).
- Esperado: toast "Muitas tentativas / Aguarde 15 minutos". Não deve aparecer esse toast quando o RPC está indisponível (bug).
- Prioridade: P1

**AUTH-07 · Já logado acessando /login**
- Rota: `/login` com sessão ativa.
- Passos: abrir `/login` logado.
- Esperado: `useEffect` redireciona pra `/dashboard`.
- Prioridade: P2

**AUTH-08 · Toggle mostrar/ocultar senha + "Lembre-me"**
- Rota: `/login`
- Passos: clicar no olho; marcar/desmarcar "Lembre-me".
- Esperado: senha alterna text/password; `pilar_remember_me` gravado/removido no localStorage.
- Prioridade: P3

### Esqueci a senha (`/forgot-password`, `ForgotPassword.tsx`)

**AUTH-09 · Envio de link feliz**
- Passos: email cadastrado → "Enviar link".
- Esperado: tela de confirmação com o email; email chega no Mailpit (http://127.0.0.1:54334).
- Prioridade: P0

**AUTH-10 · Email inexistente (anti-enumeração)**
- Adversarial: email que não existe.
- Esperado: mesma tela de sucesso (não revelar existência da conta). Confirmar que o comportamento é idêntico ao AUTH-09.
- Prioridade: P1

**AUTH-11 · Email inválido / vazio**
- Adversarial: formato quebrado, vazio.
- Esperado: zod "Email inválido"; sem request.
- Prioridade: P2

**AUTH-12 · Rate limit / erro de envio**
- Adversarial: reenviar em rajada.
- Esperado: toast de erro. Atenção: `translateAuthError` pode vazar mensagem técnica crua se o erro não estiver mapeado (ACH-AUTH-05).
- Prioridade: P2

### Redefinir senha (`/reset-password`, `PasswordReset.tsx`)

**AUTH-13 · Reset feliz (sem MFA)**
- Passos: abrir link do Mailpit → step "password" → nova senha forte + confirmação → salvar.
- Esperado: "Senha alterada"; signOut; vai pra `/login`.
- Prioridade: P0

**AUTH-14 · Token de reset expirado/inválido**
- Adversarial: abrir `/reset-password` direto sem token; usar link velho; adulterar o hash na URL.
- Esperado: após ~3s sem sessão → step "expired" com "Solicitar novo link". Testar link válido em rede lenta (ver ACH-AUTH-06: pode marcar "expirado" indevidamente).
- Prioridade: P1

**AUTH-15 · Senha fraca / curta**
- Adversarial: `abc`, `12345678`, só minúsculas, sem número/símbolo, 11 chars.
- Esperado: checklist de requisitos (12+, maiúscula, número, especial) não completa; botão "Salvar" desabilitado (`!form.formState.isValid`).
- Prioridade: P1

**AUTH-16 · Senha ≠ confirmação**
- Adversarial: senha válida, confirmação diferente.
- Esperado: "As senhas não coincidem" no campo confirmar; submit bloqueado.
- Prioridade: P1

**AUTH-17 · Step MFA no reset [MFA só em staging/prod]**
- Passos: conta com TOTP verificado → link de reset → exige código TOTP antes de liberar senha.
- Adversarial: código errado, código de 5 dígitos, backup code inválido/já usado.
- Esperado: código errado → "Código inválido"; backup válido → reseta fatores e manda pra `/mfa/setup`.
- Prioridade: P1

### MFA setup (`/mfa/setup`, `MfaSetupPage.tsx`) [MFA só em staging/prod]

**AUTH-18 · Fluxo de setup completo (5 passos)**
- Passos: 1 instalar → 2 abrir → 3 QR/secret → 4 código → 5 códigos de recuperação → dashboard.
- Esperado: passo 5 (backup codes) é obrigatório antes de liberar; enrollment persiste em sessionStorage entre reloads.
- Prioridade: P1

**AUTH-19 · Código TOTP errado / duplo submit**
- Adversarial: código errado; colar 6 dígitos 2x.
- Esperado: "Código inválido"; `hasSubmitted` ref evita submit duplo; campo limpa.
- Prioridade: P1

**AUTH-20 · Retomar enrollment já verificado**
- Passos: já com fator verificado, abrir `/mfa/setup`.
- Esperado: redireciona pra `/dashboard` (não regenera à toa).
- Prioridade: P2

### MFA challenge (`/mfa`, `MfaChallengePage.tsx` + `MfaChallenge.tsx`) [MFA só em staging/prod]

**AUTH-21 · Challenge feliz**
- Esperado: código correto → "MFA verificado" → `/dashboard`.
- Prioridade: P1

**AUTH-22 · Estados sem fator / fator não confirmado**
- Adversarial: sessão AAL1 sem fator; fator "unverified" (QR lido pela câmera).
- Esperado: "MFA não configurado" ou "Configuração incompleta" com botão de reiniciar → `/mfa/setup`.
- Prioridade: P2

**AUTH-23 · Backup code no challenge**
- Adversarial: código inexistente, já usado, com espaços/case.
- Esperado: normaliza (trim/upper); inválido → "Código inválido ou já utilizado"; válido → reset fatores + `/mfa/setup`.
- Prioridade: P2

**AUTH-24 · Sair do challenge**
- Passos: botão "Sair" → signOut → `/`.
- Prioridade: P3

### Onboarding — Perfil (`/profile-setup`, `ProfileSetup.tsx`)

**AUTH-25 · Setup de perfil feliz**
- Passos: nome, sobrenome, telefone, senha forte + confirmação → Continuar.
- Esperado: profile atualizado, `onboarding_completed=true`, senha trocada; admin vai pra `/company-setup`, demais pra `/dashboard`.
- Prioridade: P0

**AUTH-26 · Campos vazios / telefone curto**
- Adversarial: nome/sobrenome vazios; telefone `< 10` dígitos.
- Esperado: "Nome é obrigatório" / "Sobrenome é obrigatório" / "Telefone obrigatório".
- Prioridade: P1

**AUTH-27 · Senha fraca / mismatch no perfil**
- Adversarial: senha curta; confirmação diferente.
- Esperado: erros de política e "As senhas não coincidem".
- Prioridade: P1

**AUTH-28 · Falha ao salvar senha depois do perfil (estado inconsistente)**
- Rota: `/profile-setup`
- Passos: forçar erro no `updateUser` (ex.: política server rejeitando) após o profile já ter sido gravado.
- Adversarial: cortar rede entre o update do profile e o updateUser.
- Esperado (correto): NÃO marcar onboarding como concluído se a senha não foi definida. Observado: ver ACH-AUTH-02 (marca `onboarding_completed=true` antes da senha → usuário fica "onboarded" sem senha real).
- Prioridade: P1

**AUTH-29 · Sair no meio do onboarding**
- Passos: no `/profile-setup`, navegar pra outra rota por URL antes de finalizar.
- Esperado: `PrivateRoute` devolve pra `/profile-setup` enquanto `onboarding_completed=false`.
- Prioridade: P2

**AUTH-30 · XSS em nome/sobrenome**
- Adversarial: `<img src=x onerror=alert(1)>`, `"><script>`, em nome/sobrenome/telefone.
- Esperado: renderizado como texto (React escapa) em Perfil/Company/menu; nenhum script executa. Confirmar também no card de Company e no header.
- Prioridade: P1

### Onboarding — Empresa (`/company-setup`, `CompanySetup.tsx`)

**AUTH-31 · Setup de empresa feliz**
- Passos: nome + CNPJ válido → Finalizar.
- Esperado: empresa atualizada, `onboarding_completed=true` → `/dashboard`.
- Prioridade: P0

**AUTH-32 · Nome vazio**
- Esperado: "Nome é obrigatório".
- Prioridade: P1

**AUTH-33 · CNPJ inválido (checksum)**
- Adversarial: `11.111.111/1111-11` (dígitos iguais), CNPJ com dígito verificador errado, 13 dígitos.
- Esperado: "CNPJ inválido" (valida checksum em `validCnpjChecksum`).
- Prioridade: P1

**AUTH-34 · CNPJ vazio é permitido**
- Passos: deixar CNPJ vazio, nome preenchido → Finalizar.
- Esperado: aceita (campo opcional, "pode preencher depois"). Confirmar que não bloqueia.
- Prioridade: P2

**AUTH-35 · Colaborador/coordenador não deve cair em company-setup**
- Adversarial: logar como `colab@pilar.local` e abrir `/company-setup` por URL.
- Esperado: só admin/ultra_admin passam pelo gate de company-setup no `PrivateRoute`; não-admin é mandado pra `/dashboard`.
- Prioridade: P1

### Conta — Perfil (`/profile`, `Profile.tsx`)

**AUTH-36 · Editar perfil**
- Passos: Editar Perfil → alterar nome/contato → Salvar.
- Adversarial: nome vazio; XSS.
- Esperado: "Perfil atualizado"; email e empresa são read-only.
- Prioridade: P1

**AUTH-37 · Cards de MFA / troca de email / troca de senha**
- Passos: exercitar `MfaSetup`, `EmailChangeCard`, `PasswordChangeCard`.
- Esperado: funcionam; troca de senha aplica política de 12+; [MFA só em staging/prod].
- Prioridade: P2

### Conta — Empresa (`/company`, `Company.tsx`) — atrás de `RequireAal2`

**AUTH-38 · Gate AAL2 na rota /company [staging/prod]**
- Adversarial: sessão AAL1 abrir `/company` por URL.
- Esperado: sem fator → `/mfa/setup`; com fator e AAL1 → `/mfa`. No local, bypass libera.
- Prioridade: P1

**AUTH-39 · Convidar usuário**
- Passos: aba Usuários → nome + email + role → convidar.
- Adversarial: email inválido; nome vazio; estourar limite do plano; role = `admin`.
- Esperado: email inválido barrado pela edge (`invite-user`); sucesso mostra "Convite enviado" e email no Mailpit; limite de plano → 422. Requer AAL2 (`useRequireAal2`).
- Prioridade: P0

**AUTH-40 · Editar usuário / mudar role**
- Adversarial: tentar editar um `ultra_admin`; setar role de outro user.
- Esperado: editar ultra_admin bloqueado ("Usuário protegido"); mudança de role depende de RLS (ver ACH-AUTH-10). Requer AAL2.
- Prioridade: P1

**AUTH-41 · Remover usuário**
- Adversarial: remover a si mesmo; remover último admin.
- Esperado: confirmação em dialog; remove. Atenção: é hard delete (ver ACH-AUTH-09) — validar que não deixa auth.user órfão e que auto-remoção não trava a conta.
- Prioridade: P1

**AUTH-42 · Suspender/cancelar a própria empresa (auto-lockout)**
- Passos: aba Dados → status "suspended"/"cancelled" → Salvar.
- Esperado: `ConfirmDialog` forte avisando risco de bloquear o próprio acesso; após confirmar, `PrivateRoute` mostra tela "Acesso suspenso" (ver AUTH-52).
- Prioridade: P1

### RBAC — navegação direta por URL (guards)

**AUTH-43 · Não autenticado em rota protegida**
- Adversarial: deslogado abrir `/dashboard`, `/financeiro`, `/company`, `/admin`, `/ultra-admin`.
- Esperado: `PrivateRoute` redireciona pra `/` (landing).
- Prioridade: P0

**AUTH-44 · Colaborador tentando /financeiro por URL**
- Passos: logar `colab@pilar.local`, abrir `/financeiro`.
- Esperado: `FeatureRoute feature="financeiro"` + `RequireRole roles=["owner"]`. Colaborador é role de contrato → `RequireRole` manda pra `/dashboard` (ou `/sem-acesso` se não tiver a feature). Confirmar que NÃO renderiza Financeiro.
- Prioridade: P0

**AUTH-45 · Coordenador tentando /financeiro e /fornecedores**
- Passos: `coord@pilar.local` → `/financeiro`, `/fornecedores`.
- Esperado: bloqueado (só `owner`). Redireciona pra `/dashboard`.
- Prioridade: P0

**AUTH-46 · Owner acessa /financeiro**
- Passos: `owner@pilar.local` → `/financeiro`.
- Esperado: acessa (assumindo empresa com feature financeiro).
- Prioridade: P0

**AUTH-47 · Admin (legado) acessa /financeiro**
- Passos: `admin@pilar.local` → `/financeiro`.
- Esperado: passa (admin é legado, `RequireRole` não bloqueia — design de transição, ver nota CONTEXT). Documentar como esperado.
- Prioridade: P1

**AUTH-48 · Colaborador/coordenador tentando /admin e /ultra-admin**
- Adversarial: `colab@`/`coord@` abrir `/admin` e `/ultra-admin` por URL.
- Esperado: `/admin` → `can("admin_portal")` false → `/sem-acesso?recurso=admin_portal`; `/ultra-admin` → `isUltraAdmin` false → `/sem-acesso?recurso=ultra_admin`.
- Prioridade: P0

**AUTH-49 · /equipe (AdminOnlyRoute)**
- Adversarial: `colab@`/`coord@` abrir `/equipe`.
- Esperado: não-admin → `/sem-acesso?recurso=admin_portal`. `/pessoas` redireciona pra `/equipe`.
- Prioridade: P1

**AUTH-50 · Página Sem Acesso (`/sem-acesso`, `SemAcesso.tsx`)**
- Passos: abrir `/sem-acesso?recurso=financeiro`, `?recurso=ai_chat`, sem param, com param lixo.
- Esperado: mostra recurso e motivo; botão "Voltar ao dashboard". Atenção: role de contrato mostra "Seu perfil" em branco e `ai_chat` não é reconhecido (ACH-AUTH-11).
- Prioridade: P2

**AUTH-51 · Menu por role (visibilidade)**
- Passos: para cada role (owner, coordenador, colaborador, admin), inspecionar itens do menu lateral.
- Esperado: itens seguem `usePermissions().can(...)`; colaborador/coordenador não veem Financeiro/Fornecedores; só admin/ultra vê Admin Portal e Assinatura; itens dormentes (timesheet, capacidade, templates, ai_hub, metas) escondidos por feature-flag da empresa.
- Prioridade: P1

### Assinatura / Billing (`/billing`, atrás de `RequireAal2`)

**AUTH-52 · Empresa suspensa/cancelada bloqueia o app**
- Passos: com `pilar_subscriptions.status` = `canceled`/`expired`, navegar em qualquer rota.
- Esperado: `PrivateRoute` mostra "Acesso suspenso" exceto em `/billing`. Ver ACH-AUTH-07 (fail-open em erro de query e cache entre usuários).
- Prioridade: P1

**AUTH-53 · Billing: admin vs não-admin**
- Passos: admin vê "Mudar plano"/"Cancelar"; colaborador vê "Apenas o admin pode gerenciar".
- Esperado: ações destrutivas só pra admin; cancelar/mudar plano abrem dialog.
- Prioridade: P1

### Nova empresa — Planos & Checkout (`/planos`, `/checkout`)

**AUTH-54 · Checkout sem plano / plano inexistente**
- Adversarial: `/checkout` sem `?plano=`; `?plano=xyz`.
- Esperado: `<Navigate to="/planos">`.
- Prioridade: P1

**AUTH-55 · Checkout CPF/CNPJ inválido**
- Adversarial: CPF com dígito errado, CNPJ dígitos iguais, 10 dígitos.
- Esperado: toast "CPF/CNPJ inválido"; não submete.
- Prioridade: P1

**AUTH-56 · Checkout cartão inválido / expirado**
- Adversarial: número curto, validade `01/20` (passado), CVV vazio.
- Esperado (correto): rejeitar antes de chamar o gateway. Observado: só CPF/CNPJ é validado no cliente; cartão/validade vão crus pro gateway (ACH-AUTH-08). Verificar mensagem de erro do gateway.
- Prioridade: P2

**AUTH-57 · Checkout PIX/Boleto (local não fecha)**
- Passos: escolher PIX/Boleto → confirmar.
- Esperado: no local o webhook não chega (CONTEXT); testar UI do QR/linha digitável e polling. Fluxo pago completo precisa simular `pilar_pending_signups`.
- Prioridade: P2

**AUTH-58 · Nova empresa self-service (trigger)**
- Passos: simular `pilar_pending_signups` pago + `empresa_owners_pending` + invite → abrir link → `/profile-setup`.
- Adversarial: token forjado; convite de outro email; insert direto em `empresa_owners_pending` sem pagamento.
- Esperado: `handle_new_user` cria empresa+admin só com token válido + pagamento confirmado; caso contrário exception "Cadastro não autorizado"/"sem pagamento confirmado".
- Prioridade: P0

---

## PARTE B — Achados estáticos (bugs no código)

**ACH-AUTH-01 · 🟠 alto · silent-failure/corretude · `src/pages/Login.tsx:46-53`**
O resultado de `guard_login_attempt` é lido sem checar erro: `const { data: loginAllowed } = await (supabase.rpc as any)("guard_login_attempt", ...)`. Se o RPC falhar (função ausente no ambiente, erro de rede, RLS), `data` vem `undefined`, e `loginAllowed !== true` dispara o caminho de rate-limit.
Cenário de falha: RPC indisponível → todo usuário vê "Muitas tentativas / Aguarde 15 minutos" e fica travado sem nunca ter errado a senha. Erro real (do RPC) some.
Evidência:
```ts
const { data: loginAllowed } = await (supabase.rpc as any)("guard_login_attempt", { p_email: values.email });
if (loginAllowed !== true) { toast.error("Muitas tentativas", {...}); setIsLoading(false); return; }
```

**ACH-AUTH-02 · 🟠 alto · estado/corretude · `src/pages/ProfileSetup.tsx:85-101`**
`onboarding_completed` é gravado `true` ANTES do `updateUser({password})`. Se o update de senha falhar, o profile já está marcado como onboarded, mas o usuário nunca definiu uma senha própria (segue com a senha temporária do convite).
Cenário: erro/queda de rede entre o update do profile e o `updateUser` → catch mostra toast, usuário permanece na tela, mas `onboarding_completed=true` persistido. No próximo acesso o `PrivateRoute` o trata como onboarded e libera o app.
Evidência:
```ts
await supabase.from("profiles").update({ ..., onboarding_completed: true }).eq("id", user.id);
// ...
const { error: pwdError } = await supabase.auth.updateUser({ password: values.password });
if (pwdError) throw pwdError; // profile já foi marcado completo
```

**ACH-AUTH-03 · 🟠 alto · silent-failure/estado · `src/contexts/AuthContext.tsx:49-64,150-156`**
`fetchProfile` engole o erro (`setProfile(null); return;`) e o callback de `onAuthStateChange` tem `.catch(() => { /* silencia erros de rede */ })`. Resultado: usuário fica `isAuthenticated=true`, `loading=false`, `profile=null`, sem nenhum sinal de erro.
Cenário: falha transitória ao buscar `profiles` no login → `PrivateRoute` pula todo o bloco `if (profile)` (onboarding, MFA-setup) e renderiza `<Layout/>` com `profile` nulo; páginas que assumem `profile`/`empresa_id` quebram, e a UI não explica por quê.
Evidência:
```ts
if (error) { setProfile(null); monitoring.setUser(null); return; }   // fetchProfile
// ...
.catch(() => { /* silencia erros de rede */ })                       // onAuthStateChange
```

**ACH-AUTH-04 · 🟠 alto · segurança · `supabase/migrations/20260507000000_secure_handle_new_user.sql:126-132` + `supabase/migrations/20260715000002_convite_token_hash.sql:16-17`**
O branch de CONVITE de funcionário passou a comparar por hash do token (migration 20260715). O branch de NOVO OWNER (`empresa_owners_pending`) continua comparando o token em PLAINTEXT e o plaintext segue armazenado — a própria migration diz "owner_pending/pending_signup ficam para follow-up".
Cenário: vazamento da tabela `empresa_owners_pending` = account takeover do owner de uma empresa nova (mesma classe de bug já corrigida no portal e no convite).
Evidência:
```sql
-- handle_new_user, cenário 2 (owner):
WHERE token = v_token AND email = v_email AND usado_em IS NULL AND expira_em > NOW();
-- migration hash: "owner_pending/pending_signup ficam para follow-up"
```

**ACH-AUTH-05 · 🟡 médio · segurança/validação-de-fronteira · `src/lib/authErrors.ts:30`**
`translateAuthError` retorna a mensagem crua (`return raw;`) quando o erro não está no `ERROR_MAP`. Diferente de `getSafeErrorMessage` (que tem fallback seguro), aqui detalhe técnico do Supabase/GoTrue/Postgres vaza direto no toast de ForgotPassword, PasswordReset e MFA.
Cenário: qualquer erro não mapeado (ex.: mensagem de constraint, "Database error saving new user", detalhe de rate-limit interno) aparece pro usuário final.
Evidência:
```ts
for (const [needle, pt] of Object.entries(ERROR_MAP)) { if (raw.includes(needle)) return pt; }
return raw; // vaza mensagem técnica
```

**ACH-AUTH-06 · 🟡 médio · corretude/estado · `src/pages/PasswordReset.tsx:70-77`**
O estado "expired" é decidido por um timeout fixo de 3s: se `checkSession()` não achar sessão em 3s, marca `expired`.
Cenário: hidratação de sessão lenta (rede ruim, aba em background) com link VÁLIDO → usuário vê "Link expirado / Solicitar novo link" sem o link ter expirado. Falso negativo intermitente.
Evidência:
```ts
timeoutId = window.setTimeout(() => {
  checkSession().then((readyNow) => { if (!readyNow) setStep("expired"); });
}, 3000);
```

**ACH-AUTH-07 · 🟡 médio · segurança/estado · `src/components/PrivateRoute.tsx:17,71-74,131-135`**
Dois problemas na checagem de assinatura:
1) Fail-open: qualquer erro na query de `pilar_subscriptions` → `subStatusCache.v=null; setSubStatus(null)` → não é tratado como suspenso → empresa cancelada/expirada ganha acesso.
2) Cache em módulo (`subStatusCache`) nunca é limpo no `signOut`; na mesma aba, ao trocar de usuário, o status da empresa anterior é servido até um reload.
Cenário: erro transitório de rede deixa empresa suspensa entrar; ou usuário B vê estado de assinatura da empresa do usuário A.
Evidência:
```ts
const subStatusCache: { v: SubStatus | undefined } = { v: undefined }; // módulo, não limpo no signOut
// ...
} catch { subStatusCache.v = null; setSubStatus(null); } // fail-open
```

**ACH-AUTH-08 · 🟡 médio · validação-de-fronteira · `src/pages/checkout/components/CheckoutForm.tsx:135-177`**
Só CPF/CNPJ é validado no cliente. Número do cartão não tem checagem de comprimento/Luhn, validade não é checada contra data passada, e `expiryYear` é montado ingenuamente como `20${expiryDigits.slice(2,4)}`.
Cenário: cartão de 12 dígitos, validade `01/20`, ou ano `2099` seguem crus pro gateway; erro só volta (se voltar) do Asaas, com UX pior. Sem defesa de fronteira no pagamento.
Evidência:
```ts
const card: CreditCardData = { number: onlyDigits(ccNumber), expiryMonth: expiryDigits.slice(0,2), expiryYear: `20${expiryDigits.slice(2,4)}`, ccv: ccCcv.trim() };
// nenhuma validação de cartão/validade antes do onSubmit(payload)
```

**ACH-AUTH-09 · 🟡 médio · corretude/estado · `src/pages/Company.tsx:284` (vs `supabase/functions/invite-user/index.ts:170-174`)**
Remoção de usuário é HARD delete (`supabase.from("profiles").delete()`), enquanto o resto do sistema usa soft-delete: o `invite-user` conta usuários ativos com `.is("deleted_at", null)`.
Cenário: divergência — hard delete não incrementa espaço no limite do plano de forma consistente, pode deixar `auth.users` órfão (sem profile), e perde trilha de auditoria do registro.
Evidência:
```ts
const { error } = await supabase.from("profiles").delete().eq("id", deleteUserId); // hard delete
```

**ACH-AUTH-10 · 🟡 médio · segurança · `src/pages/Company.tsx:257-265,204-231`**
Mudança de role, edição e convite são mutações client-side em `profiles`/edge, gated só por `isAdmin` do cliente + RLS. O `RequireAal2` protege a rota, mas `handleSaveUser` grava `role: editUserRole` direto na tabela. A prevenção de escalada (ex.: admin promovendo alguém, ou o próprio, a role indevida) depende inteiramente da RLS — não verificável neste escopo estático.
Cenário: se a policy de UPDATE em `profiles` não restringir a coluna `role`/os valores permitidos, um admin pode alterar roles além do previsto. Recomendo auditar a RLS (rls-auditor) e mover troca de role pra uma RPC com gate de role no servidor.
Evidência:
```ts
await supabase.from("profiles").update({ ..., role: editUserRole } as never).eq("id", editUserId);
```

**ACH-AUTH-11 · ⚪ baixo · copy/a11y/corretude · `src/pages/SemAcesso.tsx:62,8-26,85`**
Três defeitos menores: (1) `ROLE_LABEL[role]` não tem `owner|coordenador|colaborador`, então "Seu perfil" fica em branco para roles de contrato; (2) `ai_chat` está em `FEATURE_LABEL` mas não em `KNOWN_FEATURES`, então `/sem-acesso?recurso=ai_chat` não é reconhecido e cai em "esta página"; (3) `motivo.replace("Requer permissão: ", "")` é código morto — `reasonFor` nunca retorna esse prefixo.
Evidência:
```ts
const roleLabel = role ? ROLE_LABEL[role] : "sem perfil"; // undefined p/ owner/coordenador/colaborador
const KNOWN_FEATURES: Feature[] = [ ... /* sem "ai_chat" */ ];
<span>{motivo.replace("Requer permissão: ", "")}</span> // replace nunca casa
```

**ACH-AUTH-12 · ⚪ baixo · segurança (dev-only) · `src/lib/roles.ts:19-28`**
`isUltraAdmin` honra `localStorage["pilar-ultra-admin-preview"]==="1"` quando `import.meta.env.DEV`. No QA local (que roda `npm run dev`) qualquer conta pode forjar UI de ultra-admin setando essa chave. É removido por tree-shake em prod e a RLS ainda barra no backend, mas vale registrar para não confundir resultado de RBAC no ambiente local.
Evidência:
```ts
if (!import.meta.env.DEV) return false;
return window.localStorage.getItem(ULTRA_ADMIN_PREVIEW_KEY) === "1";
```

**ACH-AUTH-13 · 🟡 médio · silent-failure/corretude · `src/pages/Login.tsx:60-66`**
O login usa uma única mensagem genérica ("Verifique suas credenciais") para TODOS os erros de `signInWithPassword`, ignorando `translateAuthError` (usado nas outras telas de auth). Estados acionáveis (email não confirmado, rate-limit do GoTrue, falha de rede) ficam indistinguíveis e o erro real é descartado.
Cenário: usuário com "Email not confirmed" ou sem internet recebe a mesma mensagem de senha errada e não sabe o próximo passo.
Evidência:
```ts
if (error) { toast.error("Erro ao fazer login", { description: "Verifique suas credenciais e tente novamente." }); ... }
```

**ACH-AUTH-14 · ⚪ baixo · estado · `src/pages/Company.tsx:216-219` (vs `supabase/functions/invite-user/index.ts:155`)**
O update otimista da lista de usuários usa o role escolhido no formulário, mas a edge (`invite-user`) rebaixa qualquer role fora de `["admin","user"]` para `"user"` (`ASSIGNABLE_ROLES`). A UI pode mostrar um role que o servidor não concedeu até um reload.
Evidência:
```ts
setUsers([ ...users, { id: "pending-"+Date.now(), name: fullName, email: inviteEmail.trim(), role: inviteRole } ]);
```

**ACH-AUTH-15 · ⚪ baixo · consistência/manutenção · `AdminRoute.tsx:19`, `UltraAdminRoute.tsx:18`, `RequireAal2.tsx:22-33`, `useRequireAal2.ts:26-27`**
A checagem de step-up AAL2 (`!mfaDevBypass() && mfaCurrentLevel !== "aal2"`) é reimplementada em 4 lugares com pequenas variações (uns usam só `currentLevel`, `RequireAal2` cruza `currentLevel!=="aal2" && nextLevel==="aal2"`). Não é bug hoje, mas é fonte provável de divergência futura (uma rota exigir AAL2 e outra não, para o mesmo estado).
Evidência: comparar `AdminRoute.tsx:19` (`mfaCurrentLevel !== "aal2"`) com `RequireAal2.tsx:30` (`stepUpNeeded = mfaCurrentLevel !== "aal2" && mfaNextLevel === "aal2"`).

---

### Notas de contexto para quem for exercitar no browser
- MFA está bypassado no local (`mfaDevBypass` → `import.meta.env.DEV` + URL 127.0.0.1). Casos AUTH-17..24, 38 e o step-up de Company/Billing só falham/passam de verdade em staging/prod.
- `admin@pilar.local` é role LEGADO; ele fura `RequireRole` por design (AUTH-47). Para testar bloqueio de contrato use `coord@`/`colab@`.
- Emails (convite, reset, nova empresa) caem no Mailpit http://127.0.0.1:54334.
