# Política de Cookies: Pilar

**Status:** 🚧 RASCUNHO, NÃO PUBLICAR. Ver `docs/legal/README.md` para o porquê e a
condição de saída (CNPJ próprio da Pilar). O **mecanismo de consentimento descrito
aqui já está implementado e ativo** (ver [SPEC 048](../specs/048-consentimento-cookies.md)
e [ADR 0022](../architecture/adr/0022-consentimento-cookies-client-side.md)); só o
texto formal desta política ainda não foi publicado como página.

**Última atualização:** 2026-08-18
**Versão:** 1.0 (rascunho)

Esta política explica quais cookies e tecnologias similares o Pilar usa, no
produto (`app.pilarsoft.com.br`) e no site (`pilarsoft.com.br`), e como você
controla o consentimento.

## O que são cookies

Pequenos arquivos (ou registros equivalentes em `localStorage`) que um site
grava no seu navegador para lembrar informação entre visitas ou páginas.

## Categorias que usamos

### Essenciais (sempre ativos)

Necessários para o produto funcionar. Não podem ser desligados porque, sem eles,
login e navegação básica quebram.

| Nome/tipo                     | Finalidade                           | Duração                       |
| ----------------------------- | ------------------------------------ | ----------------------------- |
| Sessão do Supabase Auth       | Manter você logado                   | Sessão / renovação automática |
| Token CSRF (quando aplicável) | Proteger contra requisições forjadas | Sessão                        |
| Preferência de tema/UI        | Lembrar configurações de interface   | Persistente                   |

### Análise (opcional, requer seu consentimento)

Usados para entender como o produto e o site são usados (páginas visitadas,
cliques em botões-chave), de forma agregada.

| Nome/tipo                     | Finalidade                                    | Duração                |
| ----------------------------- | --------------------------------------------- | ---------------------- |
| PostHog (`ph_*`, distinct ID) | Métricas de uso e produto (pageview, cliques) | Até 1 ano ou revogação |

**Nenhum cookie desta categoria é gravado antes de você aceitar** no banner de
consentimento. PostHog roda com `autocapture` desligado e gravação de sessão
desligada: só eventos explícitos que o produto dispara (`$pageview`,
`landing_cta_clicked` etc.), sempre com dados sensíveis mascarados antes de sair
do seu navegador (CPF, CNPJ, senha, token nunca são enviados).

### Marketing/publicidade

**Não usamos.** Se isso mudar no futuro, esta política e o banner de
consentimento serão atualizados antes de qualquer cookie desse tipo ser ativado.

## Como o consentimento funciona

Na primeira visita, um banner pergunta se você aceita cookies de análise.
Enquanto você não decide, ou se recusa, nenhum cookie de análise é gravado, só
os essenciais, que não pedem consentimento por serem indispensáveis ao
funcionamento do serviço (LGPD Art. 7, IX: legítimo interesse/execução do
contrato).

Você pode mudar de ideia a qualquer momento:

- No produto: página **Privacidade**, botão "Alterar preferências de cookies".
- No site: rodapé, link "Preferências de cookies".

Ao recusar (ou revogar depois de ter aceitado), o PostHog é desativado
(`opt_out_capturing`) e o identificador local é apagado (`reset`); nenhum dado
novo é enviado depois disso.

## Cookies de terceiros

Hoje só o PostHog (categoria Análise) roda como serviço de terceiro. Ele está
hospedado nos EUA (`us.i.posthog.com`) sob contrato que exige proteção
equivalente à LGPD para os dados que efetivamente saem do Brasil.

## Alterações nesta política

Mudanças relevantes (nova categoria, novo terceiro) são comunicadas por
atualização desta página e, se aplicável, um novo pedido de consentimento no
banner. Mudanças menores (redação, formatação) podem ser aplicadas sem aviso.

## Contato

Dúvidas sobre cookies: **privacidade@pilarsoft.com.br**. Ver também a
[Política de Privacidade](./PRIVACY_POLICY.md).
