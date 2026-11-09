# Playbook: Qualidade

**Missão:** ordenar erro por cliente atingido e não deixar regressão passar. Fecha o ciclo com o
escritório: quando o erro que ele viu é corrigido, ele fica sabendo.

**Cadência:** todo dia às 7h03 de Brasília, depois da Receita e antes do Clientes.

## Indicadores (Sentry, ambiente do deploy)

| Indicador                   | De onde sai                                                       |
| --------------------------- | ----------------------------------------------------------------- |
| `erros_24h`                 | erros abertos com atividade nas últimas 24 h                      |
| `novos_24h`                 | vistos pela primeira vez nas últimas 24 h                         |
| `regressoes_24h`            | resolvidos que voltaram (`substatus = regressed`)                 |
| `pessoas_atingidas_24h`     | soma de usuários por erro                                         |
| `escritorios_atingidos_24h` | escritórios clientes na tag `empresa_id` dos 10 erros mais amplos |
| `incidentes_abertos`        | incidentes da status page ainda não resolvidos                    |

Secret obrigatório: `SENTRY_READ_TOKEN` (Internal Integration do Sentry com Project, Issue & Event e
Organization em Read). Passo a passo na [SPEC 131](../../specs/131-agente-qualidade.md).

## Gatilhos e ações

| Situação                                          | Prioridade  | Ação                                           | Autonomia |
| ------------------------------------------------- | ----------- | ---------------------------------------------- | --------- |
| Regressão                                         | hoje        | tarefa com link para o Sentry (uma por semana) | N2        |
| Erro que atingiu escritório pagante               | hoje        | tarefa com link para o Sentry                  | N2        |
| Erro novo ou que atingiu outro escritório cliente | esta semana | tarefa com link para o Sentry                  | N2        |
| Erro resolvido no Sentry com tarefa pendente      | -           | baixa automática na tarefa                     | N2        |
| Erro resolvido que tinha atingido escritório      | esta semana | WhatsApp avisando que já foi corrigido         | N1        |

Erro antigo que não atinge cliente não vira tarefa: já é conhecido.

## Nunca

- Mandar ao cliente detalhe técnico, código do erro, prazo ou culpa.
- Mandar para o modelo id ou nome de escritório da lista de atingidos: só contagem.
- Guardar o token fora dos secrets da Edge Function.
