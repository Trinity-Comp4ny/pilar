# ADR 0031: MFA é opcional; aal2 obrigatório só no acesso cross-tenant

**Data:** 2026-08-20
**Status:** Accepted

## Contexto

A migration `020_mfa_enforcement` (e o guard em `PrivateRoute`) tornou o MFA
obrigatório: todo usuário sem fator verificado é redirecionado para
`/mfa/setup`, e admin sem aal2 é barrado em `create_convite` e nas policies de
`asaas_config`.

O custo real apareceu com o primeiro design partner que se cadastrou sozinho: a
primeira tela do produto, antes de qualquer valor entregue, foi um TOTP
obrigatório. E o botão de códigos de backup dessa tela retorna `PGRST202`,
porque `mfa_generate_backup_codes` não existe nem em produção nem em staging,
apesar de a migration `026` estar registrada como aplicada nos dois bancos. Ou
seja: pedágio obrigatório, na porta de entrada, com o botão de saída quebrado.

O produto hoje tem 8 empresas e nenhum requisito de compliance que exija MFA
obrigatório para o usuário final. O que de fato justifica segundo fator é o
acesso cross-tenant do `ultra_admin`, que lê e escreve em todas as empresas.

## Decisão

**1. MFA vira opcional para todo usuário.** `PrivateRoute` não redireciona mais
para `/mfa/setup`; a ativação vive em Configurações > Segurança, por escolha do
usuário. O desafio no login continua existindo para quem tem fator ativo.

**2. aal2 obrigatório só onde há acesso cross-tenant.** `UltraAdminRoute`
continua exigindo; `AdminRoute` não. `admin_mfa_required()` deixa de bloquear
`create_convite` e as policies de `asaas_config`, e passa a exigir aal2 apenas
de `ultra_admin`.

**3. As RPCs de código de backup são recriadas** (`mfa_generate_backup_codes`,
`mfa_consume_backup_code`), porque MFA opcional só é honesto se ativar funcionar
de ponta a ponta, incluindo a saída de emergência.

## Consequências

**Positivas:**

- O primeiro contato com o produto deixa de ser uma exigência de segurança
  antes de qualquer valor entregue.
- Fecha um erro em produção (`PGRST202`) que só existia por causa do fluxo
  obrigatório.
- A proteção fica onde o risco é maior de verdade: a conta que atravessa
  tenants.

**Negativas:**

- Conta de admin de cliente passa a depender só de senha, e a maioria não vai
  ativar MFA por conta própria. Aceito para o estágio atual (8 empresas, sem
  exigência contratual); volta a ser obrigatório se um contrato ou incidente
  pedir, e o mecanismo continua todo no lugar para isso.
- Um requisito de compliance futuro (SOC 2, cliente enterprise) reabre a
  decisão. O caminho de volta é o mesmo guard, com política por empresa em vez
  de global.

## Decisões relacionadas

- Revisa a política da migration `020_mfa_enforcement`.
- Ver [SPEC 058](../../specs/058-acesso-por-role-observabilidade-total-mfa-opcional.md).
