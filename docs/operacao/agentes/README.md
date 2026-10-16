# Playbooks dos agentes de operação

Um arquivo por agente do Time (Ultra › Time, [SPEC 126](../../specs/126-time-de-agentes-no-ultra.md),
[ADR 0060](../../architecture/adr/0060-agentes-de-operacao-medem-no-pilar-publicam-fora.md)).

O playbook é a fonte única das regras da área: o agente de operação (Edge Function, fase 1) deriva o
prompt daqui, e o agente de conselho do Claude Code da mesma área lê este mesmo arquivo. Mudou a regra,
muda aqui primeiro.

Cada playbook tem: missão, indicadores (e de onde saem), gatilhos, ações que o agente pode propor,
nível de autonomia de cada ação e o que ele nunca faz.

| Agente            | Playbook                       | Fase                                   |
| ----------------- | ------------------------------ | -------------------------------------- |
| Receita           | [receita.md](./receita.md)     | 0 (números) e 1 (briefing e rascunhos) |
| Clientes          | [clientes.md](./clientes.md)   | 0 (números) e 1 (briefing e rascunhos) |
| Produto           | [produto.md](./produto.md)     | 2 (tarefas da semana, SPEC 130)        |
| Qualidade         | [qualidade.md](./qualidade.md) | 2 (erros do Sentry, SPEC 131)          |
| Chefe de gabinete | a escrever na fase 2           | 2                                      |
| Finanças da Pilar | a escrever na fase 3           | 3                                      |
