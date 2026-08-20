# SPEC 058: Acesso por role, observabilidade em toda fronteira, MFA opcional

**Data:** 2026-08-20
**Status:** Em implementação
**Autor:** Matheus
**Módulo:** plataforma / acesso / observabilidade / auth

## Contexto

Um design partner (Mawe Arquitetos, convidado em 19/08) ficou 23 minutos tentando
cadastrar uma disciplina e levou `403` em 11 tentativas. O Sentry não registrou
nada: `ManageDisciplinasDialog` faz `toast.error` e descarta o erro.

O diagnóstico expôs três problemas de classes diferentes.

**1. Acesso: dois modelos de role convivendo.** `user_has_feature` exige nível
explícito em `profiles.features` para admin e user (só `ultra_admin` tem bypass),
mas os três caminhos de convite gravam `features = '{}'` justamente quando o cargo
é admin, porque foram escritos quando admin tinha bypass:

| Caminho | Linha | O que grava |
| --- | --- | --- |
| `ultra-admin-empresas` (criar empresa) | `index.ts:187` | `p_features: {}` |
| `ultra-admin-usuarios` (convidar) | `index.ts:200` | `safeRole === "admin" ? {} : ...` |
| `invite-user` (convite do cliente) | `index.ts:168` | `safeRole === "admin" ? {} : ...` |

`handle_new_user` copia `coalesce(convite.features, '{}')` para o profile, e o
resultado é um admin sem acesso a nada: **76 policies em 34 tabelas** chamam
`user_has_feature`. Medido no banco de produção, na sessão do usuário afetado:

```
user_has_feature('projetos','viewer') = false
projetos visíveis = 0 | disciplinas visíveis = 0 | clientes visíveis = 0
```

Ele não via nem o projeto que ele mesmo havia criado 5 minutos antes (a criação
passa por RPC `SECURITY DEFINER`, que não checa feature). O front piora o
diagnóstico: `canDo` dá bypass para admin, então a UI mostra os botões que a RLS
nega. Afetados em produção: Mawe, LTS Engenharia e MF Construção, ou seja, todas
as contas provisionadas pelo ultra-admin.

O [ADR 0026](../architecture/adr/0026-feature-madura-universal-toggle-vira-capacidade.md)
já tornou toda feature madura universal por empresa; manter um segundo eixo de
permissão por usuário só reproduz esse bug com outro nome.

**2. Observabilidade: o erro morre no toast.** 429 `toast.error` no app contra 33
`captureException`; 112 arquivos têm toast e nenhuma captura. Todo erro de dado
nasce numa fronteira só (o `fetch` do cliente Supabase), então dá para capturar
100% deles em um ponto em vez de editar 112 arquivos.

**3. MFA obrigatório para todos, com a tela quebrada.** `PrivateRoute.tsx:124`
redireciona todo usuário sem fator verificado para `/mfa/setup`, o que fez o
design partner cair numa tela obrigatória antes de qualquer uso do produto. E lá
o botão de códigos de backup chama `mfa_generate_backup_codes`, que **não existe
nem em produção nem em staging** (`PGRST202`), apesar de a migration `026` estar
registrada como aplicada nos dois. Único erro do usuário que o Sentry pegou
(PILAR-A): um MFA obrigatório com botão quebrado, imposto antes do primeiro uso.

## Objetivo

Uma verdade só para acesso (role + módulo da empresa), nenhum erro de fronteira
invisível, e MFA como escolha do usuário, não pedágio de entrada.

## Requisitos

### A. Acesso por role (features de usuário saem)

1. `user_has_feature(p_feature, p_min_level)` mantém a assinatura (76 policies
   dependem dela) e passa a responder apenas: a feature existe no catálogo **e**
   está habilitada para a empresa (universal/core sempre; `dormant` exige o
   toggle) **e** quem chama tem profile. `ultra_admin` continua com bypass.
   `p_min_level` fica sem efeito: membro da empresa lê e escreve.
2. `profiles.features` e `convites.features` são dropadas, junto dos triggers e
   funções que só existiam para validá-las: `tg_validate_features_subset`,
   `validate_profile_features`, `tg_validate_convite_features`,
   `tg_validate_convite_features_subset`, `tg_cascade_feature_revocation`,
   `_validate_features_payload`.
3. `create_convite` e `admin_create_convite` perdem `p_features` (DROP + CREATE,
   nunca `CREATE OR REPLACE`, por causa dos overloads). `update_user_access`
   perde `p_features` e passa a alterar só role. `handle_new_user` para de
   escrever features de usuário nos três ramos (self-serve, convite, owner pago).
4. `tg_audit_profile_changes` e `tg_prevent_profile_tampering` deixam de olhar
   `features`; role e `empresa_id` continuam auditados e protegidos.
5. Front: `canDo` passa a ser role + `isFeatureEnabledForCompany`, sem
   `userFeatures`. `parseUserFeatures`, `UserFeatures`, `meetsLevel` e
   `FeatureAccessGrid`/`AccessBadges` saem. A tela de usuários (admin e
   ultra-admin) edita role, não mais grid de features.
6. `empresas.features` **fica**, restrita às 4 features `dormant` (early access
   do ultra-admin), como o ADR 0026 já decidiu. Rollout de plataforma continua
   em `feature_flags` (`useFeatureFlag`), que é o mecanismo certo para isso. O
   toggle sai do admin do cliente (aba "Features") e passa a existir só no
   ultra-admin: quem decide acesso antecipado é a plataforma, não a empresa.
   `handle_new_user` para de gravar o catálogo hardcoded em `empresas.features`
   (ligava `timesheet` e a chave morta `planejamento` em toda empresa nova):
   empresa nasce com `{}`, e o universal não depende desse JSONB.
7. Backfill não é necessário: a nova `user_has_feature` ignora o JSONB. As três
   contas hoje travadas voltam a funcionar no deploy da migration, sem UPDATE.
8. Duas tabelas guardam credencial, não dado de negócio, e o gate de módulo
   deixou de proteger: `asaas_config` (api_key do gateway) volta a exigir role
   admin/owner, e `cliente_portal_accounts` (senha_hash e token de sessão do
   portal) exige admin/owner/coordenador além do módulo. Achado pelos testes
   pgTAP de RLS ao rodar a semântica nova, não em revisão de código.

### B. Observabilidade em toda fronteira

8. O cliente Supabase recebe um `fetch` instrumentado: toda resposta `>= 400`
   (REST, RPC, Storage, Auth) e toda falha de rede vira evento no Sentry com
   tabela/rota, método, status, código PostgREST e `request_id`, sem corpo de
   requisição (PII).
9. `4xx` esperado não polui: `401`/`403` entram como `warning` com fingerprint
   por rota+status (agrupa em vez de espalhar), `5xx` e falha de rede como
   `error`. `406` de `.maybeSingle()` sem linha é ignorado.
10. Verificado, já existia: `QueryClient` tem `onError` global em mutation e um
    `subscribe` no query cache que capturam no Sentry (`src/App.tsx`). Nada a
    fazer aqui, fica registrado para não parecer lacuna.
11. `reportError(err, ctx)` em `src/lib/reportError.ts`: captura no Sentry e
    devolve a mensagem para o toast, com o event id como código de referência.
    Os catches que hoje só dão `toast.error` nos caminhos de escrita passam a
    usá-lo, começando pelos de disciplina (o caso relatado).
12. Verificado, já existia: as 44 edge functions usam `withSentry(...)`, que
    reporta erro não tratado com o nome da função. Nada a fazer.

### C. MFA opcional

13. `PrivateRoute` para de redirecionar para `/mfa/setup`. A ativação vive em
    Configurações > Segurança, por escolha do usuário.
14. `AdminRoute` não exige mais aal2. `UltraAdminRoute` continua exigindo: acesso
    cross-tenant é o único que justifica segundo fator obrigatório.
15. `admin_mfa_required()` deixa de bloquear `create_convite` e as policies de
    `asaas_config`; passa a exigir aal2 apenas de `ultra_admin`.
16. `mfa_generate_backup_codes` e `mfa_consume_backup_code` são recriadas (o
    corpo da `026` nunca chegou aos dois bancos), para que a ativação opcional
    funcione de ponta a ponta.

## Não incluído

- Granularidade de permissão por role dentro da empresa (ex.: só admin lança no
  financeiro). Hoje 53 policies usam `financeiro`; a decisão desta spec é que
  todo membro escreve. Se voltar a fazer sentido, é uma spec de RBAC própria,
  baseada em role, nunca em JSONB por usuário.
- Enforcement de `max_projetos` (requisito 9 da spec 052), ainda pendente.
- Reescrever os 429 `toast.error` um por um: o interceptor cobre a origem; os
  catches migram para `reportError` conforme as telas forem tocadas.
- **Follow-up de tenancy (achado, não corrigido aqui):** `disciplinas` não tem
  `empresa_id`. É um catálogo global compartilhado por todas as empresas (13
  linhas em produção hoje), então uma disciplina cadastrada por um cliente
  aparece para os outros. O teste pgTAP `policy_projetos_module` já registrava a
  dúvida "catálogo curado ou colaborativo?"; a resposta prática é colaborativo,
  mas o isolamento por empresa continua faltando. Precisa de spec própria
  (migration com `empresa_id` + backfill + decisão sobre um catálogo semente).

## Critérios de aceite

1. Um admin recém-convidado (sem nenhuma linha de features) cria disciplina,
   projeto e lançamento financeiro sem `403`.
2. `select` como esse usuário retorna as linhas da empresa dele em `projetos`,
   `clientes` e `disciplinas`.
3. `profiles.features` e `convites.features` não existem mais no schema, e
   `npm run typecheck` passa sem referência a elas.
4. Um `403` forçado numa escrita aparece no Sentry com tabela, método e status,
   sem precisar de `captureException` na tela.
5. Login novo cai em `/inicio`, não em `/mfa/setup`.
6. Ativar MFA em Configurações > Segurança gera os códigos de backup sem erro.
7. `/ultra-admin` continua pedindo aal2; `/admin` não.
8. `npm run test:run` e os testes pgTAP de RLS passam.
9. `asaas_config` continua invisível para membro sem role administrativo (o
   teste pgTAP de RLS cobre).

## Riscos

- **Escrita mais aberta que antes.** Todo membro passa a escrever em todo módulo
  liberado, inclusive Financeiro. É a decisão explícita desta spec (o modelo
  anterior nunca funcionou de fato: dava 403 silencioso), mas amplia o raio de
  uma conta comprometida dentro da empresa. Mitigação: auditoria já registra
  quem escreveu; role continua barrando admin portal, convites e billing.
- **Migration destrutiva.** `DROP COLUMN` reprova o guard do CI sem
  `ALLOW_DESTRUCTIVE_MIGRATION=true`. O dado perdido é o JSONB que esta spec
  declara sem valor; ainda assim exige autorização explícita no merge.
- **MFA opcional reduz a barreira** para conta de admin de cliente. Aceito: hoje
  o obrigatório empurrava o usuário para uma tela com botão quebrado antes do
  primeiro uso, o que é pior na prática. Ultra-admin segue obrigatório.

## Referências

- [ADR 0029](../architecture/adr/0029-acesso-por-role-features-por-usuario-saem.md)
- [ADR 0030](../architecture/adr/0030-erro-de-fronteira-sempre-reportado.md)
- [ADR 0031](../architecture/adr/0031-mfa-opcional-aal2-so-cross-tenant.md)
- [ADR 0026](../architecture/adr/0026-feature-madura-universal-toggle-vira-capacidade.md) (features universais por empresa)
- [SPEC 052](./052-features-universais-por-empresa-capacidade-de-plano.md)
