# Matriz de acesso

Quem vê e quem decide o quê, por papel. A regra vale no banco (RLS, privilégio de coluna,
checagem nas funções); a tela só acompanha. Decisão: [ADR 0034](../architecture/adr/0034-financeiro-delegado-eixo-separado-do-role.md)
e [ADR 0046](../architecture/adr/0046-matriz-de-acesso-a-dinheiro-travada-por-teste.md).
← [voltar](./README.md)

## Papéis

| Papel                   | Quem é                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| **admin**               | Sócio ou dono do escritório. Tudo dentro da empresa.                                           |
| **financeiro delegado** | Qualquer membro com `profiles.financeiro_delegado = true`. Vê e decide dinheiro; não vê folha. |
| **coordenador**         | Toca projeto e equipe. Sem delegação, não vê dinheiro.                                         |
| **user**                | Membro operacional. Não vê dinheiro.                                                           |
| **ultra_admin**         | Plataforma Pilar (suporte). Bypass auditado.                                                   |
| **portal** / **campo**  | Cliente e equipe de obra. Sessão própria por token, só o que a função do portal/campo devolve. |

Helpers no banco: `can_view_financeiro()` = admin, owner, ultra_admin ou `financeiro_delegado`.
`can_view_folha()` = admin, owner ou ultra_admin.

O front (`src/lib/permissions.ts`) é mais restrito que o banco: a tela de Financeiro só abre
para admin ou coordenador com delegação. Um `user` com `financeiro_delegado` passa no banco,
mas não ganha a rota. Nunca o contrário.

## Dinheiro

| Dado                                                                      | admin | delegado | coordenador |   user    | Como                                                                |
| ------------------------------------------------------------------------- | :---: | :------: | :---------: | :-------: | ------------------------------------------------------------------- |
| Receitas, despesas, lançamentos, faturas, contas, cartões, parcelamentos  |   ✓   |    ✓     |             |           | RLS com `can_view_financeiro()`                                     |
| Gráfico financeiro, custo real do projeto, despesas recorrentes, parcelas |   ✓   |    ✓     |             |           | Função checa o papel no início                                      |
| Valor de contrato do projeto                                              |   ✓   |    ✓     |  mascarado  | mascarado | `projetos_safe`                                                     |
| Orçamento por fase (custo, venda, margem)                                 |   ✓   |    ✓     |             |           | RLS; quem lança horas usa `fases_do_projeto()` (só id e disciplina) |
| Valor do aditivo e custo do escopo                                        |   ✓   |    ✓     |  mascarado  | mascarado | `escopos_safe`; coluna fechada na tabela                            |
| Aprovar ou rejeitar aditivo                                               |   ✓   |    ✓     |             |           | Trigger em `escopos`; adiar continua aberto                         |
| Valor estimado do lead                                                    |   ✓   |    ✓     |  mascarado  | mascarado | `leads_safe`; coluna fechada na tabela                              |
| Conta da obra (lançamentos com valor)                                     |   ✓   |    ✓     |             |           | RLS                                                                 |
| Alertas financeiros e notificações com valor                              |   ✓   |    ✓     |             |           | `alertas` com RLS; notificação só vai para quem vê financeiro       |

## Folha e dado pessoal

| Dado                              | admin | delegado | coordenador | user | Como                                  |
| --------------------------------- | :---: | :------: | :---------: | :--: | ------------------------------------- |
| Salário, CPF, PIX, conta bancária |   ✓   |          |             |      | `pessoas_safe` com `can_view_folha()` |
| Folha de pagamento                |   ✓   |          |             |      | RLS com `can_view_folha()`            |

## Notificações

- Cada pessoa lê e marca só as próprias (`destinatario_id = auth.uid()`).
- Ninguém grava notificação direto: só funções do banco, que escolhem o destinatário pelo
  papel (financeiro só para quem vê financeiro, pedido de token só para gestão).
- Os helpers de notificação não são executáveis por usuário; os pontos de entrada são
  menção em comentário, pedido de tokens e aviso de capacidade, e todos checam a empresa.

## Entre empresas

Toda tabela de empresa tem RLS com `empresa_id = get_user_empresa_id()`. View `*_safe`
roda como dona e por isso filtra a empresa no próprio `WHERE`. Função SECURITY DEFINER
nunca confia no `p_empresa_id` recebido: compara com a empresa de quem chama.

## Exceções conhecidas (decisão de produto)

Ficam legíveis a todo membro da empresa, com motivo na allowlist de
`supabase/tests/acesso_dinheiro.sql`:

- **Consumo de IA e plano Pilar** (saldo e custo de tokens, compra de pacote): é a conta
  do escritório com o Pilar, mostrada em Configurações > Uso.
- **Compra da obra** (cotações, itens, material, valor previsto por etapa, taxa de
  administração): quem toca a obra compara cotação.
- **Comercial**: preço da proposta e valor de venda por disciplina.

Decisões abertas, ainda visíveis a quem tem o módulo:

- `propostas.custo_estimado` e `propostas.margem_estimada_pct`.
- `proposta_disciplinas.custo_hora` e `projeto_disciplinas.custo_hora`.

Fechar qualquer uma delas segue o mesmo padrão: coluna fechada na tabela, view `_safe`,
e sai da allowlist do teste.

## Como isso é verificado

| Teste                                             | O que prova                                                                                                                                                            |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/tests/acesso_dinheiro.sql`              | Varre o schema (coluna de dinheiro sem gate, função DEFINER sem checagem de papel) e exercita a matriz com admin, delegado, coordenador, user e admin de outra empresa |
| `supabase/tests/funcoes_internas_grants.sql`      | Helper interno (prefixo `_` e lista nomeada) não é executável por usuário                                                                                              |
| `supabase/tests/anon_function_grants.sql`         | Função DEFINER executável por anon só na allowlist                                                                                                                     |
| `supabase/tests/hardening_grants_search_path.sql` | View que roda como dona está na lista revisada                                                                                                                         |
| `e2e/acesso-papel-authenticated.spec.ts`          | Pela tela e pela API pública, o user comum não abre o financeiro nem lê valor                                                                                          |
| `e2e/aditivo-authenticated.spec.ts`               | User vê o aditivo sem valor e sem botões; admin aprova e o contrato soma                                                                                               |
