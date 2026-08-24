# ADR 0032: Consentimento de cookies compartilhado por domínio e persistido por conta

**Data:** 2026-08-20
**Status:** Accepted (revisa a decisão de armazenamento do [ADR 0022](./0022-consentimento-cookies-client-side.md))

## Contexto

O [ADR 0022](./0022-consentimento-cookies-client-side.md) resolveu o gate de
consentimento (banner próprio, sem CMP de terceiro, `analytics` como única
categoria, fail-closed no `analytics.ts`). Essa parte segue valendo.

O que não sobreviveu ao uso real foi a escolha de **onde** guardar a decisão:
`localStorage`, por origem, com a nota de que "produto e landing não compartilham
a decisão". O fluxo principal do produto é exatamente atravessar essa fronteira:
`pilarsoft.com.br` → CTA → `app.pilarsoft.com.br/cadastro`. Quem aceita na
landing leva o mesmo banner na cara segundos depois, no app. Pedir duas vezes a
mesma coisa não é só ruído de UX: é sinal de que o consentimento está sendo
tratado como estado de navegador, não como manifestação do titular.

Dois efeitos colaterais do mesmo desenho:

- A decisão morre com o navegador. O mesmo usuário logando de casa responde de
  novo, e ninguém sabe qual das respostas é "a dele".
- Não há prova de consentimento. A LGPD (Art. 8º, §1º) põe no controlador o ônus
  de demonstrar que o consentimento foi obtido. Uma chave de `localStorage` no
  dispositivo do titular não demonstra nada para o controlador.

Houve também a hipótese de resolver isso movendo o consentimento de cookies para
dentro do checkbox de aceite dos Termos em `/cadastro` (SPEC 049). Ela foi
descartada: aquele checkbox é obrigatório para criar a conta, e amarrar cookie
de análise a ele transforma um consentimento que precisa ser livre e específico
em condição de acesso ao serviço, contra o Guia Orientativo de Cookies da ANPD.
Também não cobriria visitante anônimo, conta antiga, nem login em navegador novo.

## Decisão

Manter tudo do ADR 0022 (banner próprio, categoria única, gate fail-closed no
`analytics.ts`) e trocar o armazenamento por dois níveis:

1. **Cookie de primeira parte no domínio pai.** `pilar_cookie_consent` gravado
   em `.pilarsoft.com.br` (sem `domain` em `localhost`), lido pela landing e
   pelo app. Mesmo mecanismo já usado pelo `pilar_logged_hint`, que a landing lê
   para trocar o CTA. Decisão tomada em qualquer um dos dois vale nos dois. A
   chave antiga de `localStorage` é migrada na primeira leitura e removida, para
   ninguém ser perguntado de novo por causa do deploy.
2. **Tabela `cookie_consents`, append-only, como fonte de verdade do usuário
   autenticado.** Uma linha por decisão (`analytics`, `source`, `created_at`), a
   mais recente vence; sem `UPDATE`/`DELETE`, mesmo padrão de
   `terms_acceptances`. Ao abrir sessão, a preferência da conta é aplicada e
   sobrescreve o cookie; se a conta ainda não tem registro e existe cookie (veio
   da landing), esse cookie vira o registro inicial (`carryover`).

Como consequência direta, **o app deixa de ter banner**. Visitante anônimo é
perguntado na landing, que é o único lugar onde ele existe como anônimo; usuário
autenticado controla em Configurações → Privacidade, com um toggle de estado
real. Sem decisão em lugar nenhum, o padrão continua sendo não rastrear.

## Consequências

**Positivas:**

- Pergunta uma vez, vale nos dois domínios e em qualquer dispositivo onde a
  pessoa logue.
- Existe prova de consentimento e de revogação, com data, do lado do
  controlador, e não só no navegador do titular.
- Banner some do produto: dentro do app, privacidade vira configuração, que é
  onde o usuário procura, em vez de interrupção.
- Reaproveita o padrão de cookie de domínio pai que já existe no repo.

**Negativas:**

- Duas fontes (cookie e banco) precisam ser reconciliadas no login. A regra é
  simples (banco vence, cookie é cache), mas é um passo a mais no `AuthContext`,
  que já é a parte mais delicada do app.
- O consentimento agora depende do domínio registrável comum. Landing ou app em
  outro domínio quebra o compartilhamento para o tráfego anônimo (o autenticado
  segue coberto pelo banco).
- Navegadores que limitam cookie escrito por script (ITP do Safari, 7 dias)
  fazem o visitante anônimo ser perguntado de novo na landing. Sem solução
  client-side; só um cookie `Set-Cookie` de servidor resolveria, e nenhum dos
  dois apps tem backend próprio de borda hoje.
- Uma linha por mudança de opinião cresce sem teto. Volume desprezível na
  escala atual, e o histórico é justamente o que dá o valor probatório.

## Decisões relacionadas

- [ADR 0022](./0022-consentimento-cookies-client-side.md): decisão original de
  consentimento client-side. Continua válida no gate e no banner da landing;
  a parte "decisão por origem, em `localStorage`" é substituída por este ADR.
- [ADR 0021](./0021-marketing-site-separado-do-app.md): app e landing são builds
  separados. A duplicação de `cookieConsent.ts` entre os dois segue sendo
  aceita; o que passa a ser compartilhado é o dado, não o código.
- [SPEC 049](../../specs/049-aceite-termos-de-uso-onboarding.md): aceite de
  Termos, obrigatório e imutável. Deliberadamente separado deste consentimento,
  que é opcional e revogável.
- [SPEC 059](../../specs/059-consentimento-cookies-unificado.md): requisitos e
  critérios de aceite da implementação.
