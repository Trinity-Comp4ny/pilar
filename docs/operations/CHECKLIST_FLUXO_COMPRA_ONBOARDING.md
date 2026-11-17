# Checklist: fluxo compra → onboarding (revisão 17/11/2026)

Origem: teste ponta a ponta feito pelo dono. Cada item tem o arquivo provável.
Marcar `[x]` ao mergear em `staging`.

## A. Checkout e pagamento confirmado
- [x] A1. Tela travada em "Enviando email..." após o pagamento (nunca vira "Email enviado"). Investigar polling de `inviteDispatched` em `pilar-checkout-status` / `pilar-checkout-webhook` (`invite_dispatched_at`). `src/pages/checkout/components/PaymentSuccess.tsx`
- [x] A2. Texto: "entrar no Pilar" → "entrar na Pilar" (marca é feminina). Varrer o fluxo todo por "o Pilar".
- [x] A3. Resumo do pedido: lista de checks (dashboard, projetos, clientes…) deve vir do que a landing oferece em cada plano, não de chaves técnicas. Fonte única de features por plano (landing + checkout + /planos). `src/pages/checkout/index.tsx`, `src/lib/features.ts`
- [x] A4. Na tela "Pagamento confirmado", esconder "Trocar plano" (só antes de pagar). `src/pages/checkout/index.tsx:134`

## B. E-mail pós-compra
- [x] B1. Hoje usa `inviteUserByEmail` (template "Seu convite chegou", parece convite de equipe). Trocar por e-mail de boas-vindas + "Criar minha conta/senha". `supabase/functions/pilar-checkout-webhook/index.ts:249`, `auth-email-hook`, `_shared/email`
- [ ] B2. Validar que o link leva direto a definir senha e cair no onboarding.

## C. Onboarding passo 2 ("Seu escritório")
- [x] C1. Site: placeholder `meusite.com.br`, sem valor pré-preenchido do e-mail. `src/pages/CompanySetup.tsx`
- [x] C2. Remover botão "Usar <domínio>".
- [x] C3. Remover campo "Disciplinas do escritório".

## D. Onboarding passo 3 ("Por onde começar")
- [ ] D1. "Chame seu time": uma linha só + botão "+" para adicionar mais.
- [ ] D2. Explicar cada nível (Usuário, Coordenador, Administrador) com os acessos de cada um.
- [ ] D3. Decidir: "Gestão/Projetos/Obras" como seleção vira explicação dos módulos? (decisão do dono). Se mantiver seleção, borda de seleção no verde da marca (hoje preta). `src/pages/inicio/CartaoBoasVindas.tsx`, `src/lib/onboarding/steps.ts`

## E. Primeiro acesso ao sistema
- [ ] E1. Banner "Atualizamos os termos…" não aparece para conta nova: o aceite do cadastro/checkout já grava a versão vigente. `src/components/AceiteTermosBanner.tsx`, `src/pages/Signup.tsx`
- [ ] E2. Checklist lateral estoura a altura da tela: respeitar viewport (scroll interno, vir minimizado). `src/components/OnboardingChecklist.tsx`
- [ ] E3. Checkmarks do checklist no verde da marca (token), não no verde atual.
- [ ] E4. Cada item do checklist abre a tela e guia passo a passo (spotlight/tour: onde clicar), e acompanha mudanças do sistema (teste que reprova se o alvo do passo some).

## F. Plano dentro do Admin
- [ ] F1. Nomes dos planos iguais aos da landing (hoje aparece "Starter"; é "Essencial" etc.). `src/pages/admin/tabs/Plano.tsx`, `src/lib/features.ts`, tabela de planos
- [ ] F2. Trocar "Falar com comercial" por **upgrade de plano** self-service (checkout/Asaas). `src/pages/admin/components/FalarComercialDialog.tsx`
- [ ] F3. Ao bater limite do plano (ex.: projetos), o aviso traz botão direto de upgrade.

## Ordem sugerida (PRs pequenos, de `origin/staging`)
1. A1 + B (bug + e-mail): o fluxo de compra funcionando de verdade.
2. A2–A4 + C (cópia e limpeza rápida).
3. E1 + E2 + E3 (primeiro acesso limpo).
4. D (passo 3 do onboarding).
5. F (planos/upgrade, depende de pricing).
6. E4 (checklist guiado, o maior).
