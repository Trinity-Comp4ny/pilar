# SPEC: Faixa de incidente e manutenção dentro do app

**Data:** 2026-11-10
**Status:** Em implementação
**Autor:** Matheus Rezende
**Módulo:** plataforma (status, ultra-admin)
**Relacionada:** [SPEC 055](055-status-page-publica.md) (status page), [SPEC 105](105-golden-signals-slos-e-status-page.md) (status page externa), [SPEC 152](152-o-que-mudou-e-voce-pediu-entregamos.md) (novidades), pesquisa [profissionalizacao-saas-referencias](../../research/themes/profissionalizacao-saas-referencias.md)

## Problema

Quando algo quebra, o incidente é declarado em `/ultra-admin/incidentes` e aparece na status
page, mas quem está usando o Pilar não vê nada: descobre a falha pelo erro, acha que é com ele
e manda WhatsApp. Manutenção programada também não tem aviso; hoje ela simplesmente acontece.

## Objetivo

Todo usuário logado fica sabendo, dentro do app e em até um minuto, que há instabilidade
declarada ou manutenção prevista, com o que é afetado e onde acompanhar.

**Fora de escopo:**

- Comunicados livres para clientes (card próprio; reusa esta faixa depois).
- Detecção automática de incidente (a SPEC 105 cobre sinais e alertas; aqui só o que o ultra
  admin declara).
- Portal do Cliente e app de campo (fase 2).
- E-mail de manutenção programada.

## Requisitos

1. Com incidente aberto (status diferente de `resolvido`), o app mostra uma faixa no topo do
   conteúdo com o título, os componentes afetados, a última atualização e o link
   "Acompanhar" para a status page.
2. A cor da faixa segue a severidade: `outage` = perigo, `parcial` = atenção,
   `degradado` = aviso.
3. A faixa atualiza sozinha (consulta a cada 60 s com a aba visível): incidente novo aparece,
   atualização nova troca o texto, incidente resolvido vira "Normalizado" por 30 minutos e
   depois some.
4. A pessoa pode dispensar a faixa; ela volta se o incidente tiver atualização nova. A
   dispensa vale só para aquela aba (sessionStorage), porque incidente aberto é coisa que se
   quer ver de novo.
5. Manutenção programada: o ultra admin cadastra título, mensagem, início e fim em
   `/ultra-admin/incidentes`. A faixa aparece 24 h antes ("Manutenção programada em 12/11, das
   22:00 às 23:00") e durante ("Manutenção em andamento até 23:00"). Cancelar tira a faixa.
6. Mais de um aviso ao mesmo tempo: aparecem empilhados, incidente antes de manutenção, mais
   grave primeiro.

Requisitos não-funcionais:

- **Segurança / RLS:** `status_manutencoes` segue a status page: leitura para `anon` e
  `authenticated` (é público por natureza), escrita só `is_ultra_admin()`.
- **Performance:** uma consulta leve por minuto por aba visível; nada quando a aba está em
  segundo plano.
- **Falha:** se a consulta falhar, a faixa não aparece e nada quebra.

## Critérios de aceite

- [ ] Dado um incidente `parcial` aberto no componente "Aplicação Pilar", então a faixa de
      atenção mostra o título, "Afeta: Aplicação Pilar", a última atualização e o link.
- [ ] Dado um incidente resolvido há 10 minutos, então a faixa mostra "Normalizado"; há 40
      minutos, não mostra nada.
- [ ] Dado que a pessoa dispensou a faixa, quando o incidente recebe atualização nova, então a
      faixa volta.
- [ ] Dada uma manutenção que começa daqui a 30 horas, então não há faixa; daqui a 5 horas,
      faixa "Manutenção programada"; em andamento, "Manutenção em andamento até ...";
      cancelada, nada.
- [ ] Dado um usuário comum, então ele não consegue criar nem cancelar manutenção (pgTAP).

## Dados e contratos

- `status_manutencoes`: `id`, `titulo`, `mensagem` (opcional), `inicio`, `fim`
  (`fim > inicio`), `cancelada_em`, `created_at`, `created_by`.
- Leitura pelo app: `status_incidents` (abertos + resolvidos nos últimos 30 min) com
  componentes e atualizações, e `status_manutencoes` com `fim > now()` e não cancelada.

## Plano de implementação

1. Migration `status_manutencoes` + RLS + pgTAP; `types.ts`.
2. `src/lib/avisosPlataforma.ts` (regra pura: o que vira faixa, tom, texto, ordem) com teste.
3. Hook `useAvisosPlataforma` + `FaixaAvisos` no `Layout`, acima do conteúdo.
4. Ultra admin: bloco "Manutenções programadas" na página de Incidentes (cadastrar, cancelar).

## Decisões e riscos

- **Faixa no conteúdo, não fixa no topo da janela:** não cobre o header da página nem briga
  com o `ReadOnlyBanner`/`ImpersonationBanner`, que já são fixos.
- **Polling em vez de Realtime:** um minuto basta para o critério, e não abre canal novo por
  usuário. Se a carga incomodar, troca por Realtime nas três tabelas.
- **Risco: faixa esquecida aberta.** Mitigação: o próprio Ultra admin mostra o incidente
  aberto no topo; resolver tira a faixa de todos.
