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

## Uso real do app (PostHog)

Além do banco, o agente lê o PostHog (`posthog.ts`, consulta HogQL, só leitura). Secret das Edge
Functions: `POSTHOG_PERSONAL_API_KEY` (chave pessoal com escopo **Query: read**; `POSTHOG_PROJECT_ID`
padrão 679166, `POSTHOG_API_HOST` padrão `https://us.posthog.com`). Sem a chave o agente roda só com o
banco e avisa no resumo.

| Indicador                        | O que é                                                          |
| -------------------------------- | ---------------------------------------------------------------- |
| `logins_7d`                      | eventos `login_realizado` em 7 dias                              |
| `pessoas_logaram_7d`             | pessoas distintas que entraram em 7 dias                         |
| `escritorios_logaram_7d`         | escritórios distintos (`empresa_id`) que entraram em 7 dias      |
| `telas_vistas_28d_<modulo>`      | `$pageview` por módulo em 28 dias                                |
| `erros_exibidos_28d`             | `erro_exibido` em 28 dias (o resumo cita a ação que mais errou)  |

**Só vê quem aceitou a análise de uso** (cadastro, primeiro acesso ou cartão do app). Por isso o agente
nunca apresenta esses números como o total da base: o total vem do banco (`ops_produto`).

## Depois (SPEC 125)

Funis de ativação e retenção já estão no dashboard "Pilar: produto" do PostHog. Falta virar gatilho do
agente: tela com mais erro exibido, cliques de raiva e formulário abandonado.

## Nunca

- Mandar para o modelo título ou texto de feedback, nome de escritório ou dado do tenant: só contagem.
- Escrever mensagem para cliente: quem fala com o escritório é Clientes ou Receita.
