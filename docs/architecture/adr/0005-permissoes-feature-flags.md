# ADR 0005: Modelo de permissões em dois níveis (role + features)

**Data:** 2026-05-04  
**Status:** Accepted

## Contexto

O sistema precisava de controle de acesso granular para um produto multi-tenant SaaS onde:

1. Diferentes planos (básico / pro / enterprise) habilitam módulos diferentes
2. Dentro de uma empresa, usuários têm roles distintos (user / admin / ultra_admin)
3. Administradores de uma empresa precisam poder ativar/desativar módulos por usuário
4. A autorização deve ser enforçada no banco (RLS), não apenas na UI

Opções consideradas:

- **Apenas role**: simples, mas não cobre "admin com acesso ao módulo financeiro vs sem acesso"
- **Apenas feature flags**: flexível, mas perde semântica de quem pode gerenciar o quê
- **RBAC completo** (tabela `roles × permissions × users`): poderoso mas overengineering para o volume atual
- **Dois níveis: role + features por usuário**: cobre os casos de uso sem a complexidade do RBAC

## Decisão

Implementar dois níveis de autorização complementares:

**Nível 1 — Role** (`profiles.role: enum('user','admin','ultra_admin')`)

- Controla capacidades sistêmicas: gerenciar usuários, acessar área admin, fazer impersonation
- Enforçado via `has_role(role)` em RLS policies para operações admin

**Nível 2 — Features** (`profiles.features: text[]`)

- Controla acesso a módulos de negócio: financeiro, propostas, leads, relatórios, etc.
- Por usuário (não por empresa): permite granularidade fina dentro do time
- Enforçado via `user_has_feature(feature, level)` em RLS policies para dados de módulos
- `ultra_admin` tem acesso implícito a tudo (sem checagem de features)
- Apenas `admin` e `ultra_admin` podem modificar features de outros usuários

**Funções centrais:**

```sql
has_role(required_role text) → boolean          -- role >= required_role
user_has_feature(feature text, level text) → boolean  -- feature em profiles.features
current_effective_role() → text                  -- respeita impersonation ativa
```

## Consequências

**Positivas:**

- RLS enforça autorização no banco — UI bugs não vazam dados
- Feature flags por usuário: flexibilidade sem RBAC completo
- `current_effective_role()` permite impersonation transparente para todas as policies
- Fácil de auditar: `profiles.features` é um array de strings visível no dashboard

**Negativas:**

- Features duplicadas se empresa muda de plano (precisar de script de sync)
- Sem herança de grupo — atribuição deve ser feita user a user
- `text[]` não tem foreign key — typos em feature names não são detectados no banco

## Decisões relacionadas

- ADR 0001: Arquitetura multi-tenant (isolamento por empresa via RLS)
- ADR 0002: MFA TOTP (autenticação antes de autorização)
- Impersonation sessions (admin temporariamente assume role de user para debug/suporte)
