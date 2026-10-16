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

| Situação                                                            | Prioridade  | Ação                                                                                            | Autonomia |
| ------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- | --------- |
| Pagante, em teste, convidada ou em atraso sem acesso há 7+ dias     | esta semana | WhatsApp perguntando se travou e oferecendo 15 minutos                                          | N1        |
| Feedback sem resposta há 24 h                                       | esta semana | abrir a triagem e responder                                                                     | N1        |
| Erro do Sentry que atingiu o escritório                             | hoje        | aviso de "já corrigimos" quando resolver: feito pela Qualidade ([qualidade.md](./qualidade.md)) | N1        |
| Pagante ou convidada em onboarding sem projeto, do dia 2 (SPEC 130) | esta semana | WhatsApp oferecendo montar o primeiro projeto junto                                             | N1        |
| Onboarding com uma pessoa só, do dia 5 (SPEC 130)                   | esta semana | WhatsApp oferecendo ajuda para chamar a equipe                                                  | N1        |
| Onboarding usando uma área só, do dia 9 (SPEC 130)                  | esta semana | WhatsApp mostrando projetos e Financeiro juntos                                                 | N1        |
| Nota caiu 20+ pontos em 7 dias, sem ter sumido (SPEC 129)           | esta semana | WhatsApp perguntando o que mudou                                                                | N1        |

Ativação: um marco por vez, na ordem (projeto, equipe, segunda área), e cada marco vira no máximo um
contato. Em teste fica com a Receita (o teste é curto). O contato conta como "funcionou" quando o marco
é atingido em 7 dias (projeto novo, segunda pessoa, lançamento no Financeiro). Nenhum escritório recebe
contato de duas áreas em 3 dias (SPEC 129).

## Nunca

- Ler ou mandar para o modelo cliente, projeto ou valor do tenant: só metadado de uso.
- Contatar quem pediu exclusão de dados ou está com a conta encerrada.
