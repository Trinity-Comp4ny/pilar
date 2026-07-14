# ADR 0001: Arquitetura multi-tenant via RLS por empresa_id

**Data:** 2026-04-24
**Status:** Accepted
**Decisores:** Matheus Rezende

## Contexto

Pilar atende múltiplos escritórios de arquitetura/engenharia em isolamento de dados. Precisamos de:

- Isolamento forte (empresa A não vê dado de empresa B)
- Custo baixo (não manter DB por cliente)
- Deploy único da aplicação
- Auditoria centralizada

## Decisão

Usar **single database + Row Level Security** (RLS) do Postgres/Supabase, com coluna `empresa_id UUID` em todas tabelas sensíveis. Policies filtram por `empresa_id = public.get_user_empresa_id()`.

## Alternativas consideradas

1. **DB por tenant:** isolamento máximo mas custo operacional explodiria (1 DB per cliente).
2. **Schema por tenant:** middle-ground mas Supabase não suporta bem; migrations ficariam complexas.
3. **Filtro em app layer:** sem RLS. Qualquer bug de query = vazamento. Rejeitado.

## Consequências

### Positivas

- Single deploy, backup, migration
- Supabase RLS é testado em escala
- Edge case de vazamento = falha de policy (testável via pgTAP)
- Fácil cross-tenant queries admin (com service_role)

### Negativas

- Performance: cada query passa pela policy (overhead ~10-30%)
- Segurança depende de **nunca** usar service_role no frontend
- Desenvolvedor precisa lembrar de adicionar `empresa_id` em toda tabela nova
- Testes precisam rodar com role `authenticated` (não postgres)

## Mitigações

- pgTAP tests no CI validam isolamento por policy
- Convenção: toda tabela nova DEVE ter `empresa_id` + policy
- Review de PR checa `USING` e `WITH CHECK` em migrations
- RPC SECURITY DEFINER sempre valida `empresa_id = get_user_empresa_id()`
