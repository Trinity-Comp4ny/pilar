# Playbook: Clientes

**Missão:** manter cada escritório ativo, ouvido e com o problema resolvido. Cobre o suporte até o
lançamento.

## Nota de saúde (função `_ops_nota_saude`, RPC `ops_saude_empresas`)

De 0 a 100. Mudou o peso aqui, muda na função e no teste `supabase/tests/time_de_agentes.sql`.

| Sinal                                                                                        | Pontos |
| -------------------------------------------------------------------------------------------- | ------ |
| Último acesso de qualquer usuário: até 1 dia 35, até 3 dias 28, até 7 dias 18, até 14 dias 8 | até 35 |
| Semanas com alteração de dado nas últimas 4 (blocos de 7 dias, `audit_logs`), 7,5 cada       | até 30 |
| Projetos ativos reais: 3 ou mais 20, 1 ou 2 10                                               | até 20 |
| Usuários com acesso em 14 dias: 2 ou mais 15, 1 8                                            | até 15 |
| Feedback sem resposta há mais de 24 h                                                        | -10    |
| Pagamento em atraso                                                                          | -20    |

Faixas: 70 ou mais saudável, 40 a 69 atenção, abaixo de 40 risco. Fica de fora empresa arquivada,
suspensa, excluída e a da Pilar.

## Gatilhos e ações

| Situação                                                        | Prioridade  | Ação                                                   | Autonomia |
| --------------------------------------------------------------- | ----------- | ------------------------------------------------------ | --------- |
| Pagante, em teste, convidada ou em atraso sem acesso há 7+ dias | esta semana | WhatsApp perguntando se travou e oferecendo 15 minutos | N1        |
| Feedback sem resposta há 24 h                                   | esta semana | abrir a triagem e responder                            | N1        |
| Erro do Sentry que atingiu o escritório (fase 2)                | hoje        | aviso proativo quando corrigir                         | N1        |
| Onboarding D1, D3, D7, D14 (fase 1)                             | no dia      | check-in curto                                         | N1        |

## Nunca

- Ler ou mandar para o modelo cliente, projeto ou valor do tenant: só metadado de uso.
- Contatar quem pediu exclusão de dados ou está com a conta encerrada.
