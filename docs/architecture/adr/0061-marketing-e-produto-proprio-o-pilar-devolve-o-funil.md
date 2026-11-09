# ADR 0061: Marketing é produto próprio; o Pilar abre a plataforma e devolve o funil

**Data:** 2026-10-16
**Status:** Accepted. Substitui em parte a [ADR 0060](./0060-agentes-de-operacao-medem-no-pilar-publicam-fora.md) (ficha de Marketing com métricas no Ultra e `ops-ingest`).

## Contexto

A ADR 0060 já tirava do Pilar a geração e a publicação de conteúdo, mas previa que o Pilar
recebesse um snapshot diário das redes (`ops-ingest`) e mostrasse o agente de Marketing com esses
números no Ultra › Time. Em 15 e 16/10 o fundador decidiu que a plataforma web do repo
`post-automation` é um produto próprio, vendável a outros escritórios (ADR 0002 daquele repo), e
que tudo de marketing fica lá: campanhas, posts, vídeos, agendamento, analytics e o agente.

- **Opção A, manter o espelho no Ultra:** dois lugares para o mesmo número, contrato de ingestão
  para manter, e a plataforma deixa de ser autossuficiente para outro cliente.
- **Opção B, a plataforma é a fonte:** o Pilar só abre a plataforma e entrega o único dado que
  só ele tem, o que aconteceu depois do clique (cadastro, ativação, pagamento).

## Decisão

Opção B.

- O Ultra › Time › Marketing vira o atalho "Abrir plataforma de marketing" (`VITE_MARKETING_APP_URL`,
  padrão `https://post-automation.vercel.app`), também no topo da Central. O agente `marketing` fica
  inativo no Pilar, com status "Na plataforma de marketing".
- O `ops-ingest` sai do plano: o Pilar não recebe métrica de rede social.
- O Pilar expõe `ops-export-funil` (GET, `Authorization: Bearer <OPS_EXPORT_TOKEN>`, `?desde=&ate=`,
  janela máxima de 120 dias). Resposta: por dia de cadastro (Brasília) e por `utm_source`,
  `utm_medium`, `utm_campaign` e `utm_content`, as contagens de cadastros, ativados (projeto real) e
  pagantes (assinatura paga hoje). Nenhum dado pessoal. `utm_content` é o id da distribuição da
  plataforma (ADR 0001 de lá), já gravado pelo `/cadastro`.
- Os agentes que leem o banco do Pilar (Receita, Clientes, Produto, Qualidade, Finanças) continuam
  no Ultra.

## Consequências

**Positivas:**

- Um lugar só para marketing; a plataforma serve outro cliente sem depender do Pilar.
- O bandit e os relatórios da plataforma passam a premiar o post que trouxe cliente, com o dado
  que só o Pilar tem.
- Menos código no Pilar: sai a ingestão e a ficha com números de rede.

**Negativas:**

- Um segredo compartilhado novo (`OPS_EXPORT_TOKEN`) nos dois deploys.
- O resumo do Chefe de gabinete não traz número de redes; quem quiser vê na plataforma.
- Login continua separado entre os dois produtos até a plataforma ter login por cliente (ADR 0002
  de lá).

## Decisões relacionadas

- [ADR 0060](./0060-agentes-de-operacao-medem-no-pilar-publicam-fora.md): fronteira original e níveis de autonomia, que seguem valendo.
- [SPEC 128](../../specs/128-plataforma-de-marketing-externa-e-funil-por-utm.md): o que foi implementado.
- `post-automation`: ADR 0001 (campanha, brief, ativo, distribuição; `utm_content`) e ADR 0002 (plataforma como produto próprio).
