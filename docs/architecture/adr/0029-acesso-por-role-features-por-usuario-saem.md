# ADR 0029: Acesso é role + módulo da empresa; features por usuário saem

**Data:** 2026-08-20
**Status:** Accepted

## Contexto

O [ADR 0005](./0005-permissoes-feature-flags.md) criou dois eixos de permissão:
role (admin/user) e nível por feature no usuário (`profiles.features`, viewer ou
editor). O [ADR 0026](./0026-feature-madura-universal-toggle-vira-capacidade.md)
(18/08) tirou o eixo da empresa do caminho para toda feature madura, mas manteve
o eixo do usuário explicitamente: "o nível usuário (viewer/editor) não muda".

Dois dias depois esse eixo produziu, em produção, o mesmo bug que o ADR 0026
tinha acabado de eliminar no nível da empresa: um design partner recém-convidado
como admin ficou sem acesso a nada, porque os três caminhos de convite gravam
`features = '{}'` quando o cargo é admin, e `user_has_feature` exige nível
explícito no profile para admin (só `ultra_admin` tem bypass). São 76 policies em
34 tabelas atrás dessa função. O usuário não via nem o projeto que ele mesmo
tinha criado minutos antes, e o front mostrava botões que a RLS negava, porque
`canDo` dá bypass para admin e a RLS não.

A causa não é um bug pontual, é um desalinhamento estrutural: o provisionamento
foi escrito no mundo "admin tem tudo implícito", a RLS vive no mundo "todo mundo
precisa de grant explícito", e nada garante que os dois concordem. Enquanto
existirem dois lugares onde acesso é decidido, eles voltam a divergir.

Opções consideradas:

- **Consertar os três caminhos de convite.** Resolve os casos de hoje e deixa a
  armadilha montada: o quarto caminho (ou o próximo `UPDATE` manual) reintroduz o
  problema. Foi essa a aposta de 18/08 (PRs #273/#277/#278, sobre o signup) e o
  bug voltou por outra porta em 24 horas.
- **Dar bypass de admin também no banco.** Alinha os dois mundos por baixo, mas
  mantém o eixo por usuário vivo para `user`, ou seja, mantém metade da
  armadilha, e ainda deixa o front e a RLS com regras diferentes.
- **Remover o eixo por usuário (escolhida).** Acesso passa a ser: tem profile na
  empresa e a empresa tem o módulo. Uma verdade só, a mesma no banco e no front.

## Decisão

**1. `user_has_feature(p_feature, p_min_level)` mantém a assinatura e muda a
semântica.** Responde `true` quando: a chave está no catálogo, quem chama tem
profile, e a feature está habilitada para a empresa (universal e core sempre;
`dormant` exige o toggle do ADR 0026). `ultra_admin` continua com bypass total.
`p_min_level` é aceito e ignorado: membro da empresa lê e escreve.

A assinatura fica por decisão consciente: reescrever 76 policies para tirar um
parâmetro é risco desproporcional ao ganho estético, e mantê-la deixa a porta
aberta para um nível por role no futuro (ver "Consequências").

**2. `profiles.features` e `convites.features` são dropadas**, junto de tudo que
existia só para validá-las: `tg_validate_features_subset`,
`validate_profile_features`, `tg_validate_convite_features`,
`tg_validate_convite_features_subset`, `tg_cascade_feature_revocation` e
`_validate_features_payload`. `create_convite`, `admin_create_convite` e
`update_user_access` perdem o parâmetro `p_features`.

**3. `empresas.features` fica, restrita às features `dormant`.** É o early access
que o ADR 0026 definiu, operado pelo ultra-admin. Rollout de plataforma continua
em `feature_flags` (percentual, lista de empresas), que é o mecanismo desenhado
para isso. Nenhum dos dois é paywall.

**4. O front usa a mesma regra.** `canDo` = role + `isFeatureEnabledForCompany`.
`parseUserFeatures`, `UserFeatures`, `meetsLevel`, `FeatureAccessGrid` e
`AccessBadges` saem do código. A tela de acesso passa a editar role.

**5. Restrição por role continua existindo** e é o único eixo de RBAC: admin
portal, convites, configuração da empresa e billing seguem por role;
`ultra_admin` segue como plataforma.

## Consequências

**Positivas:**

- Elimina a classe de bug "usuário provisionado sem grant", que já custou dois
  incidentes em três dias, sem depender de ninguém lembrar de preencher JSONB.
- Front e RLS passam a decidir com a mesma regra, então a UI para de oferecer
  ação que o banco nega (o `403` silencioso que ninguém via).
- Nenhum backfill: a função ignora o JSONB, então as contas travadas voltam a
  funcionar no deploy, sem `UPDATE` em produção.
- Menos superfície: 6 triggers/funções e 2 colunas a menos, 3 edge functions e 4
  componentes de front mais simples.

**Negativas:**

- **Escrita mais aberta.** Todo membro escreve em todo módulo liberado, inclusive
  Financeiro (53 policies). Antes isso era teoricamente restringível, na prática
  ninguém tinha grant nenhum, então o efeito prático é ganho de acesso legítimo,
  mas o raio de uma conta comprometida dentro da empresa aumenta. Auditoria de
  escrita continua registrando autor.
- Perde-se a capacidade de dizer "esse usuário só vê Projetos". Se voltar a ser
  pedido, entra como RBAC por role (papéis com escopo de módulo), nunca como
  JSONB por usuário: o parâmetro `p_min_level` já está lá para receber isso.
- `DROP COLUMN` é irreversível por rollback (só por PITR). O dado descartado é o
  JSONB que este ADR declara sem valor, mas exige autorização explícita no CI.

## Decisões relacionadas

- Supersede a parte "nível usuário" do [ADR 0005](./0005-permissoes-feature-flags.md)
  e revisa o [ADR 0026](./0026-feature-madura-universal-toggle-vira-capacidade.md),
  que havia mantido esse eixo de propósito.
- Ver [SPEC 058](../../specs/058-acesso-por-role-observabilidade-total-mfa-opcional.md).
