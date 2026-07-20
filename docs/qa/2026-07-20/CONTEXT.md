# QA Pilar — Contexto compartilhado

Ambiente: **banco LOCAL** (Supabase em 127.0.0.1). App em http://localhost:8080.
Data: 2026-07-17.

## Credenciais de teste (todas senha `Pilar@2026`)
| Email | Role | Uso |
|---|---|---|
| admin@pilar.local | admin | Workhorse: acesso total, criar/exercitar CRUD |
| owner@pilar.local | owner | RBAC contrato |
| coord@pilar.local | coordenador | RBAC contrato |
| colab@pilar.local | colaborador | RBAC contrato |

- empresa_id: `937f6812-e91c-4747-a345-b98f0bba0d41` ("Pilar Local", status active, onboarding_completed, todas features ligadas)
- MFA bypassado no dev local (commit 391cad9)
- Email local cai no **Mailpit**: http://127.0.0.1:54334 (convite, reset senha, nova empresa são testáveis lendo o Mailpit)
- Studio local: http://127.0.0.1:54333 · DB: postgresql://postgres:postgres@127.0.0.1:54332/postgres (container `supabase_db_rizaklgstyfrwgmdsldf`)

## Limitações do local
- Checkout/pagamento (Stripe/Asaas) não fecha; webhook não chega. Nova empresa via checkout precisa simular insert em `pilar_pending_signups`.
- IA Hub/Chat dependem de GEMINI_API_KEY (dormente, pode dar rate limit).
- Banco começa vazio (0 projetos/clientes/financeiro) → QA é "construir do zero", com dependência entre fluxos.

## Achados já registrados no setup
- ACH-000a: divergência de email do admin entre auth.users (.com) e identity/profile (.local). Normalizado p/ .local.
- Router protege /financeiro e /fornecedores com RequireRole roles=["owner"], mas admin é role legado → passa direto (não é bug, é o design do guard de transição).
