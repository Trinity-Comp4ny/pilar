# SPEC: Consentimento de cookies unificado entre landing e app

**Data:** 2026-08-20
**Status:** Em implementação
**Autor:** Matheus Rezende + Claude
**Módulo:** auth / privacidade / marketing

## Problema

Quem aceita cookies em `pilarsoft.com.br` e clica em "Entrar" leva o mesmo
banner de novo em `app.pilarsoft.com.br`. A decisão vive em
`localStorage["pilar_cookie_consent"]`, que é por origem, e os dois apps são
origens diferentes (ADR 0022 assumiu essa duplicação como aceitável; na prática
ela aparece no fluxo mais comum do produto, que é justamente LP → cadastro).

Dois problemas menores no mesmo pacote:

- Dentro do app, o banner é a única forma de decidir, e ele fica preso ao
  navegador: o mesmo usuário logando de outra máquina responde de novo.
- Não existe registro de quem consentiu o quê. Sob a LGPD, o controlador
  precisa conseguir demonstrar o consentimento (Art. 8º, §1º) e hoje a única
  prova é uma chave de `localStorage` no navegador do titular.

## Objetivo

O usuário decide sobre cookies de análise **uma vez**, e essa decisão vale nos
dois domínios e em qualquer navegador em que ele logue, com registro auditável
no banco.

**Fora de escopo:**

- Segunda categoria de cookie (ads, heatmap, chat). Continua uma categoria só,
  `analytics`, como no ADR 0022.
- Re-consentimento periódico (pedir de novo depois de N meses). O cookie tem
  validade de 1 ano; quando expira, o visitante anônimo é perguntado de novo na
  LP, mas o usuário logado continua com a preferência da conta. Um gate formal
  de renovação fica para quando houver política de retenção definida.
- Consentimento para o Portal do Cliente (origem própria, sem PostHog hoje).
- CMP de terceiro. O ADR 0022 já descartou e nada aqui muda esse cálculo.

## Requisitos

1. A decisão de cookies passa a ser gravada em um cookie de primeira parte no
   domínio pai (`.pilarsoft.com.br`), não em `localStorage`, de modo que a LP e
   o app leiam a mesma decisão. Em `localhost` (dev) o cookie é gravado sem
   atributo `domain`, valendo para a porta corrente.
2. Quem já decidiu antes desta mudança (valor em `localStorage`) não é
   perguntado de novo: na primeira leitura, a decisão antiga é migrada para o
   cookie e a chave de `localStorage` é removida.
3. O banner de consentimento existe **só na LP**. O app não exibe banner: sem
   decisão registrada, o padrão continua fail-closed (não rastreia).
4. No app, o controle de cookies fica em Configurações → Privacidade, como um
   toggle de estado real ("Cookies de análise", ligado/desligado), não como um
   botão que reabre um banner.
5. Para usuário autenticado, a fonte de verdade é o banco (`cookie_consents`),
   não o cookie do navegador:
   - ao estabelecer sessão, a preferência mais recente do usuário é lida e
     aplicada ao PostHog, sobrescrevendo o cookie local;
   - se o usuário ainda não tem registro no banco e existe decisão no cookie
     (típico de quem veio da LP), essa decisão é gravada como registro inicial
     (`source = 'carryover'`);
   - se não há registro no banco nem cookie, nada acontece: continua sem
     rastrear.
6. Ao mudar o toggle em Configurações → Privacidade, a mudança é gravada no
   banco (`source = 'settings'`) e aplicada imediatamente ao PostHog (init ou
   opt-out + reset), além de atualizar o cookie.
7. `/cadastro` **não** ganha checkbox de cookies. O aceite de Termos continua
   sendo o único campo obrigatório do formulário; consentimento de cookie não
   pode ser condicionado ao contrato (Guia Orientativo de Cookies da ANPD, item
   sobre consentimento livre e específico). O que a conta nova herda é a decisão
   que a pessoa já tomou na LP, via requisito 5.
8. `signOut()` não apaga o cookie de consentimento: a decisão do navegador
   sobrevive ao logout, senão a próxima visita à LP pergunta de novo.

Requisitos não-funcionais:

- **Segurança / RLS:** `cookie_consents` é append-only, com `INSERT` e `SELECT`
  restritos a `user_id = auth.uid()`, sem policy de `UPDATE`/`DELETE` (mesmo
  padrão de `terms_acceptances`, SPEC 049).
- **Multi-tenant:** a preferência é do titular (pessoa), não da empresa. Sem
  `empresa_id` na tabela: um usuário que troca de empresa mantém a própria
  decisão sobre rastreamento.
- **Fail-closed:** nenhum caminho de erro (rede caindo na leitura do banco,
  cookie corrompido, `localStorage` indisponível) pode resultar em rastrear sem
  consentimento. Na dúvida, não rastreia.
- **Tamanho do cookie:** valor JSON curto (`{"analytics":true,"decidedAt":...}`),
  bem abaixo de qualquer limite de header.

## Critérios de aceite

- [ ] Dado um visitante que aceita cookies na LP, quando ele navega para
      `app.pilarsoft.com.br/entrar`, então nenhum banner aparece e o PostHog
      está ativo no app.
- [ ] Dado um visitante que recusa na LP, quando ele entra no app, então o
      PostHog não é inicializado em nenhum dos dois domínios.
- [ ] Dado um usuário com `pilar_cookie_consent` antigo em `localStorage` do
      app, quando ele abre o app depois do deploy, então a decisão é preservada,
      migrada para cookie, e a chave de `localStorage` some.
- [ ] Dado um usuário logado que desliga o toggle em Configurações →
      Privacidade, quando a página é recarregada, então o toggle continua
      desligado e o PostHog não é inicializado.
- [ ] Dado um usuário que aceitou cookies no navegador A, quando ele loga no
      navegador B (sem cookie nenhum), então a preferência da conta é aplicada
      sem perguntar nada.
- [ ] Dado um usuário sem registro no banco e com cookie "aceito" vindo da LP,
      quando ele loga, então um registro `carryover` é criado com
      `analytics = true`.
- [ ] Dado um usuário que faz logout, quando ele volta para a LP, então o banner
      não reaparece.
- [ ] Caso de borda: cookie com JSON inválido é tratado como "sem decisão"
      (não rastreia, e a LP pergunta de novo).
- [ ] Caso de borda: falha na leitura de `cookie_consents` (rede/RLS) não
      liga o PostHog nem quebra o login.

## Dados e contratos

Tabela nova:

```sql
public.cookie_consents (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  analytics  boolean not null,
  source     text not null check (source in ('carryover', 'settings')),
  created_at timestamptz not null default now()
)
```

Índice `(user_id, created_at desc)` para a leitura "preferência mais recente".
Append-only: cada mudança de opinião é uma linha nova, e a última vence. Isso dá
o histórico exigido para demonstrar consentimento e revogação sem precisar de
tabela de auditoria à parte.

Cookie de primeira parte:

```
pilar_cookie_consent = {"analytics":boolean,"decidedAt":ISO8601}
path=/; max-age=31536000; samesite=lax; [domain=.pilarsoft.com.br]; [secure]
```

Sem RPC nem edge function nova: leitura e escrita via `supabase.from()` com RLS.

## Plano de implementação

1. Migration `cookie_consents` + RLS append-only; `npm run gen:types:local` e
   commit do `types.ts`.
2. `src/lib/cookieConsent.ts` e `apps/marketing/src/cookieConsent.ts`: trocar
   `localStorage` por cookie de domínio pai, com migração da chave antiga.
3. `src/lib/cookieConsent.ts`: funções de banco (`fetchStoredConsent`,
   `persistConsent`) e `syncConsentForUser(userId)` chamada pelo `AuthContext`.
4. `AuthContext`: hidratar consentimento depois de `fetchProfile`, dentro do
   mesmo `setTimeout` que já escapa o lock do `onAuthStateChange`.
5. `App.tsx`: remover `<CookieConsentBanner />`; apagar
   `src/components/CookieConsentBanner.tsx` e o evento de "review" no app (fica
   só na LP, que ainda usa o link do rodapé).
6. `PrivacidadePanel`: trocar o botão por um `Switch` ligado ao estado real.
7. Testes: atualizar `analytics.consent.test.ts` para cookie e cobrir migração
   do `localStorage`, JSON inválido e carryover.
8. ADR 0032 registrando a mudança de decisão sobre o ADR 0022.

## Decisões e riscos

- [ADR 0032](../architecture/adr/0032-consentimento-de-cookies-por-conta-e-por-dominio.md):
  consentimento compartilhado por domínio pai e persistido por conta, corrigindo
  a parte do [ADR 0022](../architecture/adr/0022-consentimento-cookies-client-side.md)
  que fixava a decisão por origem.
- **Risco:** se um dia a LP ou o app for servido de outro domínio registrável
  (ex.: domínio de campanha), o cookie compartilhado deixa de funcionar e a
  duplicação volta para o tráfego anônimo. Aceitável: o usuário logado continua
  coberto pelo banco.
- **Risco:** cookie de 1 ano em navegador com limpeza agressiva (ITP do Safari
  corta cookie de script em 7 dias) faz o visitante anônimo ser perguntado de
  novo na LP. Não afeta usuário logado, que resolve pelo banco.
- **Suposição:** LP e app permanecem no mesmo domínio registrável
  (`pilarsoft.com.br`), como hoje (`MARKETING_URL` e `APP_URL`).
