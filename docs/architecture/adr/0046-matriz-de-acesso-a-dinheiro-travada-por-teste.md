# ADR 0046: Matriz de acesso a dinheiro vale para toda tabela, função e view, e é travada por teste

**Data:** 2026-10-09  
**Status:** Accepted

## Contexto

O [ADR 0034](./0034-financeiro-delegado-eixo-separado-do-role.md) separou dinheiro do papel
operacional: o financeiro geral é visível só para admin ou para quem tem
`profiles.financeiro_delegado`, via `can_view_financeiro()`; folha e dado pessoal, só admin,
via `can_view_folha()`. A regra foi aplicada às tabelas do módulo Financeiro e às views
`*_safe` que mascaram valor em telas de outros módulos.

Uma varredura do schema em 2026-10-09 mostrou que a regra dependia de cada autor lembrar
dela. Dinheiro aparece fora do módulo Financeiro (orçamento por fase, conta da obra,
aditivo, valor do lead, parcelamentos) e em funções SECURITY DEFINER que filtram por
empresa mas não por papel. Nada reprovava um PR que esquecesse o gate.

Opções consideradas:

- **Revisão manual a cada PR**: é o que já existia, e não segurou.
- **Gate só no front** (`usePermissions().can("financeiro")`): esconde da tela, mas a API
  pública (PostgREST) continua entregando o dado para quem consultar direto.
- **Gate no banco, com teste estrutural que varre o schema**: a regra vira propriedade do
  schema; tabela, coluna ou função nova que fuja dela reprova o CI.

## Decisão

1. **Dinheiro é decidido no banco.** Policy de tabela com valor exige
   `can_view_financeiro()` (ou `can_view_folha()` para folha). Função SECURITY DEFINER que
   lê ou grava dinheiro checa o papel logo no início, além da empresa.
2. **Quando a mesma linha serve a quem vê e a quem não vê valor**, a tabela fecha as
   colunas de dinheiro por privilégio de coluna (REVOKE SELECT da tabela, GRANT coluna a
   coluna, padrão de `projetos` em 20260879000000) e a tela lê por uma view
   `<tabela>_safe` com `security_barrier`, filtro explícito de empresa e o valor em
   `CASE WHEN can_view_financeiro()`. A view expõe `pode_ver_valor` para a tela decidir o
   que mostrar. Hoje: `projetos_safe`, `leads_safe`, `escopos_safe`, `pessoas_safe`.
3. **Decisão de dinheiro segue a leitura.** Aprovar ou rejeitar aditivo exige
   `can_view_financeiro()` (trigger em `escopos`); adiar continua aberto a quem vê o
   projeto.
4. **Quem só precisa do vínculo, não do valor, ganha função própria.** Exemplo:
   `fases_do_projeto()` devolve id e disciplina da fase para o lançamento de horas.
5. **Travado por teste.** `supabase/tests/acesso_dinheiro.sql` varre o schema: coluna de
   dinheiro legível sem gate, ou função DEFINER que toca tabela de dinheiro sem checar
   papel, só passa com motivo escrito na allowlist do próprio teste. O mesmo arquivo
   exercita a matriz por papel (admin, delegado, coordenador, user, admin de outra
   empresa). `e2e/acesso-papel-authenticated.spec.ts` prova pela tela e pela API.
6. **Helper interno não é executável por usuário.** No Supabase toda função nova em
   `public` nasce executável por `authenticated`. Função SECURITY DEFINER com prefixo `_`
   é interna e não pode ter esse EXECUTE (`supabase/tests/funcoes_internas_grants.sql`).

A matriz legível, papel por papel, fica em
[docs/security/MATRIZ_DE_ACESSO.md](../../security/MATRIZ_DE_ACESSO.md).

## Consequências

- Coluna nova numa tabela com privilégio por coluna (`escopos`, `escopo_itens`, `leads`,
  `projetos`) nasce ilegível pela API até entrar no GRANT. O teste aponta o esquecimento;
  o custo é uma linha na migration.
- Escrever em coluna fechada passa por função ou pela view, nunca por `update` direto do
  front com a coluna de valor.
- Exceção à regra é explícita e tem motivo (catálogo público, consumo de IA, operação de
  compra da obra, comercial). Mudar uma exceção é decisão de produto, registrada na
  matriz.
- Supersede nada; aplica e estende o ADR 0034.
