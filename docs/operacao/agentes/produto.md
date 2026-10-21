# Playbook: Produto

**Missão:** dizer o que é usado, o que é ignorado e onde o escritório trava. Trabalha para o fundador,
nunca fala com cliente.

**Cadência:** toda segunda às 7h07 de Brasília, antes do resumo do Chefe (7h10).

## Indicadores (RPC `ops_produto`)

| Indicador                    | De onde sai                                                             |
| ---------------------------- | ----------------------------------------------------------------------- |
| `escritorios`                | empresas clientes (sem empresa de teste, sem a da Pilar, sem arquivada) |
| `escritorios_28d_<area>`     | escritórios com alteração de dado na área em 28 dias (`audit_logs`)     |
| `escritorios_28d_anteriores` | o mesmo nos 28 dias anteriores, para ver queda                          |
| `bugs_30d`, `sugestoes_30d`  | feedback do app em 30 dias                                              |
| `bugs_sem_triagem`           | bug de 30 dias ainda com status `novo`                                  |

Áreas: projetos, financeiro, propostas, leads, obras, clientes, pessoas. Mesmo mapa de tabela da nota
de saúde (SPEC 129).

## Gatilhos e ações

| Situação                                                                          | Prioridade | Ação                                             | Autonomia |
| --------------------------------------------------------------------------------- | ---------- | ------------------------------------------------ | --------- |
| Área perdeu 2+ escritórios e 30% deles de um período de 28 dias ao outro          | hoje       | tarefa: ver na Atividade quem parou e perguntar  | N2        |
| Área de produto usada por menos de 1 em 5 escritórios (com 5 ou mais escritórios) | semana     | tarefa: perguntar se não precisam ou não acharam | N2        |
| 3 ou mais bugs esperando triagem                                                  | hoje       | tarefa: triar e responder quem relatou           | N2        |

Área em queda e área ignorada valem uma tarefa por mês; no máximo duas áreas ignoradas por mês, as
menos usadas. Clientes e Pessoas são cadastro de apoio: contam nos números, não viram tarefa de área
ignorada. Bug parado vale uma tarefa por semana.

## Depois (SPEC 125)

Com os eventos de fricção no PostHog: funis de ativação, telas com mais erro exibido, cliques de raiva
e formulários abandonados.

## Nunca

- Mandar para o modelo título ou texto de feedback, nome de escritório ou dado do tenant: só contagem.
- Escrever mensagem para cliente: quem fala com o escritório é Clientes ou Receita.
