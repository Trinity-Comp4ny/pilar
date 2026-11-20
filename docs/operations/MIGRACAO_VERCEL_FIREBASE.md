# Migração Vercel → Firebase Hosting

**Por quê:** o plano gratuito da Vercel estoura build/preview (crédito acabou em 13/10) e é
só para uso não comercial. O app e a landing são sites estáticos (Vite); o backend é o
Supabase. Firebase Hosting serve estático com CDN, HTTPS e canal de preview por PR, dentro do
projeto GCP que já existe. Custo esperado com ~20 usuários: zero (cota grátis de ~10 GB/mês).

**Regra de ouro:** a Vercel continua servindo produção até o último passo. Nada aqui derruba
o sistema se seguido em ordem. Reverter = reapontar o DNS de volta.

## Arquivos

| Arquivo | Papel |
|---|---|
| `firebase.app.json` | Config de hosting do app (headers, CSP, fallback SPA) |
| `apps/marketing/firebase.marketing.json` | Idem para a landing (+ 3 redirects para o app) |
| `scripts/gerar-firebase-config.mjs` | Gera os dois acima a partir dos `vercel.json`. Não editar à mão |
| `.github/workflows/deploy-firebase-hosting.yml` | Build + deploy. PR que mexe nos arquivos do Firebase publica canal de preview; `live` só por `workflow_dispatch` até o passo 6 |

Diferença deliberada em relação ao `vercel.json`: o Firebase cacheia HTML por 1 h por padrão
(a Vercel revalida). Os configs gerados forçam `Cache-Control: no-cache` no HTML e mantêm
`immutable` nos assets. Sem isso, aba aberta após deploy pediria chunk que não existe mais.

## Verificado localmente (emulador do Firebase Hosting)

- CSP e HSTS idênticos ao `vercel.json` (comparação byte a byte).
- `/assets/*` imutável; `/`, rotas do SPA e `index.html` revalidam; `sw.js` e `version.json` sem cache.
- Fallback de SPA para `/index.html` (app) e `/spa.html` (landing).
- Landing: `/dashboard` e as rotas do app respondem 307 para `app.pilarsoft.com.br`.
- O helper de releases usa um nome distinto da página `Releases.tsx`, inclusive no macOS.
- Verificar o comportamento no Firebase real no passo 4.

## Estado (19/11/2026)

Feito: projeto `pilarsoft-prod` com faturamento (Blaze), Firebase ativo, sites `pilarsoft-app` e
`pilarsoft-landing`, alerta de orçamento de R$ 50/mês, service account de deploy com federação
restrita a este repo, e variáveis de infra no GitHub (passos 1 a 3, exceto as `VITE_*`).
A conta de faturamento tem teto de 5 projetos; `ekoai-staging` saiu para abrir a vaga.
Falta: `VITE_*` e `SENTRY_*` nos Environments, ensaio em preview (4), domínio de teste (5), cutover (6).

## Passos

1. **Projeto GCP e Firebase.** Habilitar Firebase no projeto da Pilar, plano Blaze, e **alerta de
   orçamento** (sugestão US$ 10/mês) antes de qualquer deploy.
2. **Dois sites** de hosting no projeto (app e landing). Anotar os IDs.
3. **Federação de identidade do GitHub** (sem chave JSON): Workload Identity Pool + provider do
   GitHub restrito a este repo, e uma service account com o papel `Firebase Hosting Admin`.
   Variáveis nos Environments `staging` e `production` do GitHub: `FIREBASE_PROJECT_ID`,
   `FIREBASE_SITE_APP`, `FIREBASE_SITE_MARKETING`, `GCP_WORKLOAD_IDENTITY_PROVIDER`,
   `GCP_DEPLOY_SERVICE_ACCOUNT`, mais as `VITE_*` (copiar do painel da Vercel, uma por
   ambiente) e `SENTRY_ORG`/`SENTRY_PROJECT`. `SENTRY_AUTH_TOKEN` como **secret** em `production`.
4. **Ensaio em preview.** Rodar o workflow manual com `canal=preview` para `marketing` e `app`.
   O workflow testa as rotas do app e a versão publicada, o HTML pré-renderizado e o sitemap da
   landing, o redirecionamento de checkout com parâmetros, e os headers do HTML e dos bundles.
   O resumo do job mostra a URL validada. Abra a URL e complete o ensaio com login, uma tela com
   dados de staging, recarga da rota e inspeção do console para verificar o CSP no navegador.
5. **Domínio em teste.** Conectar um subdomínio de teste (ex. `app-fb.pilarsoft.com.br`) ao site
   do app, validar com um usuário real, sem tocar `app.pilarsoft.com.br`.
6. **Cutover**, em horário de baixo uso e com a Vercel ainda de pé:
   1. Publicar `canal=live` nos dois sites.
   2. Baixar o TTL do DNS para 300 s, com 24 h de antecedência.
   3. Adicionar o domínio de produção no Firebase (ele pede os registros de verificação) e esperar o certificado emitir **antes** de trocar o apontamento.
   4. Trocar o DNS da landing, conferir; depois o do app, conferir.
   5. Só então ligar os gatilhos `pull_request` (preview) e `push` (staging/main) no workflow.
7. **Reversão.** Reapontar o DNS para a Vercel (TTL de 300 s). Por isso o projeto Vercel só é
   desligado depois de ~2 semanas sem incidente.
8. **Limpeza.** Remover `vercel.json`, `scripts/vercel-ignore.sh` e as referências em
   `DEPLOY_CHECKLIST.md`; trocar o fallback `VERCEL_*` do `vite.config.ts` pelas variáveis do workflow.

## Riscos conhecidos

- **Variáveis `VITE_*` erradas** geram bundle que builda e abre, mas aponta para o Supabase errado.
  O workflow confere a URL antes do build e aceita `live` somente em disparo manual a partir da main. Validar o fluxo no preview antes do cutover.
- **Sentry** perde `VERCEL_ENV`/`VERCEL_GIT_COMMIT_SHA`; o workflow seta `SENTRY_ENV` e `SENTRY_RELEASE`.
- **Firewall / Attack Challenge Mode** da Vercel (DEPLOY_CHECKLIST) não existe no Firebase Hosting.
  O Turnstile já protege o login; se quiser WAF, é Cloudflare na frente (decisão à parte).
- **Preços** citados em conversa (US$ 0,15/GB, cota de ~10 GB) eram de memória: conferir na página do Firebase.
