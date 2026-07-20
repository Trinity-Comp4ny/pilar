# QA — achados remanescentes (o que NÃO foi corrigido, e por quê)

Estado em 2026-07-20 após duas rodadas de correção (PR #125 mergeado em staging +
branch `fix/qa-auth-and-tail`). Os achados abaixo foram triados e conscientemente
deixados de fora, cada um com o motivo. Não é esquecimento; é escopo.

## Resolvido nesta rodada (antes em "decisão de produto")
- **ACH-CLI-03** — RESOLVIDO: removida a unicidade por empresa de email e telefone
  (migration `20260720000009`), mantendo só CPF/CNPJ. Cadastros que compartilham email/
  telefone deixam de ser bloqueados.
- **ACH-FOR-01** — RESOLVIDO: delete de fornecedor virou soft delete explícito com "Desfazer".
- **ACH-AUTH-09** — RESOLVIDO: remoção de usuário passou a usar a edge `delete-user`.
- **ACH-FIN-07 / ACH-REL-01** — RESOLVIDO (mitigado): teto de 2000 linhas na listagem e 50k
  no relatório, com aviso ao monitoring. Paginação server-side completa fica como refactor
  futuro se o volume crescer (os filtros da tela são client-side).

## Módulos DORMENTES (CLAUDE.md manda avisar antes de mexer)
- **ACH-FIN-09/10/14** (Folha), **ACH-ADM-05/06** (Timesheet), **ACH-ADM-08** (Capacidade),
  **ACH-ADM-02** (AI Hub stub), **ACH-ADM-04/12** (Templates), **ACH-ADM-10** (edge `ai-*`
  via service_role). Reais, mas em código dormente que o produto ainda não usa. Corrigir
  aqui é ativar/tocar módulo dormente — precisa de sinal verde antes.

## Refactor maior (não cabe num fix pontual)
- **ACH-LEAD-01** — conversão lead→cliente não é 100% atômica: a causa mais comum (CNPJ
  colidente) já foi neutralizada com `p_omit_cnpj`, mas o enrichment ainda é um UPDATE
  separado após a RPC. Atomicidade total = mover o enrichment para dentro da RPC.
- **ACH-PROJ-07/13** — validação de datas do projeto no submit e rollback do valor da
  proposta quando disciplinas falham.

## Latentes / baixo risco (armadilhas, não bugs ativos)
- **ACH-FIN-01** (`parseCurrencyString` com formato US colado), **ACH-FIN-12/13** (regra de
  ciclo de fatura diverge no dia exato do fechamento), **ACH-FIN-16/17** (guard de exclusão
  de cartão lê coluna crua em vez da view), **ACH-FIN-18** (`view_cartao_resumo.usado` só
  conta Pendente → "disponível" inflado), **ACH-FIN-20** (overload 4-arg de `pagar_fatura`),
  **ACH-AUTH-04** (token de owner em plaintext — fluxo `create-company-owner` hoje bloqueado),
  **ACH-AUTH-06** (timeout fixo no PasswordReset), **ACH-AUTH-08** (sem Luhn no cartão),
  **ACH-AUTH-12** (preview ultra-admin via localStorage, dev-only), **ACH-AUTH-14** (otimismo
  de role na lista de usuários), **ACH-CLI-02** (contato sem `formatPhone`), **ACH-CLI-05**
  (`key={index}`), **ACH-FOR-02/03** (Fornecedores já mostra toast de erro; placeholder),
  **ACH-ADM-11** (catch genérico no admin).

## Regressão paralela (fora do QA, descoberta durante o trabalho)
- `fechar_folha_agente` perdeu o `linhas_ids` numa migration de merge (`20260715000033`),
  quebrando o undo preciso da folha. Fluxo de agente, dormente.
