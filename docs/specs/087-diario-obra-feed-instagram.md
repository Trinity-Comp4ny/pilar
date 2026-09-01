# SPEC: Diário da obra em feed (interno) + resumo curado no portal do cliente

**Data:** 2026-09-01
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** obras · portal
**Estende:** [015 — Obras MVP](015-obras-mvp.md), [030 — Obra no portal do cliente](030-obra-no-portal-do-cliente.md), [080 — RDO por voz](080-rdo-por-voz.md)

<!-- Origem: decisão registrada em docs/strategy/DECISOES.md, 01/09 ("Diário da
obra vira feed visual"). Benchmark competitivo do Obra Guru (feed tipo
Instagram, inclusive expondo ocorrência ao cliente) considerado e
parcialmente descartado: o formato visual (card por dia, foto, resumo) é bom
e vale copiar; expor impedimento/ocorrência ao cliente foi explicitamente
rejeitado — mantém a fronteira da spec 030. -->

## Problema

O dono da obra liga ou manda mensagem pro gestor perguntando "como foi hoje?"
porque não tem lugar nenhum pra ver isso sozinho — o portal hoje só mostra
cronograma (frentes) e prestação de contas (spec 030), sem o dia a dia. Por
dentro, o Diário (`ObraDiarioTab`) já lista os RDOs, mas como uma lista
densa de cards de dados (efetivo, impedimento, visita, tarefas) — não é um
formato pensado pra "folhear o que aconteceu", é pensado pra "auditar um
registro". RDO por voz (spec 080) já captura o material que falta pra virar
um feed sem esforço extra: resumo de atividades, fotos, clima.

## Objetivo

O Diário passa a ter uma visualização em feed (um card visual por dia: data,
clima, resumo curto, fotos, quem lançou) além da lista densa já existente
(troca de visualização, não substitui — a densa continua servindo quem quer
o dado operacional completo). O portal do cliente ganha uma nova seção
"Diário", com o MESMO formato de card, mas mostrando só o resumo curado do
dia — sem impedimento, efetivo por fornecedor ou fornecedor específico.

**Fora de escopo:**

- **Status de aprovação por card** ("Aguardando cliente"/"Aprovado", como o
  Obra Guru tem). Não existe esse conceito no modelo hoje (RDO não tem
  workflow de aprovação, spec 062 decidiu isso deliberadamente); não inventa
  aqui. Cada card é só informativo.
- **Ocorrência/impedimento como card próprio no feed do cliente** (o Obra
  Guru faz isso). Decisão registrada: cliente vê o resumo do dia, não o
  operacional interno. Internamente (feed do Diário no sistema), impedimento
  continua visível — só não vira card separado no MVP, fica dentro do card
  do dia (mesmo dado que a lista densa já mostra).
- **Reações/comentários no feed** (curtida, comentário do cliente num dia).
  Fica pra depois se a demanda aparecer; aqui é só leitura.
- **Notificação push quando um novo dia é lançado.** Central de notificações
  (spec 029) é extensão futura, não parte desta spec.
- **Vídeo no feed.** Só foto (mesmo limite de hoje, spec 080).

## Requisitos

Funcionais:

1. No Diário (interno), um toggle "Lista / Feed" alterna entre a
   visualização densa atual e a nova visualização em feed. Preferência não
   precisa persistir entre sessões no MVP (reseta pra um padrão a cada
   entrada na aba).
2. Cada card do feed (interno) mostra: data, ícone de clima, um resumo de
   1-2 linhas (usa `atividades`; se vazio, usa as primeiras palavras de
   `ocorrencias`; se os dois vazios, "Sem observações"), grid de fotos (se
   houver), e "por: {nome de quem lançou}" (via `created_by` → `profiles`).
   Clicar no card abre o mesmo dialog de edição que a lista densa já usa
   (`RdoFormDialog`, `rdoInicial`) — reaproveita, não duplica.
3. O portal do cliente (`/obras/:id` no portal, mesmo componente de
   `ClienteObraDetail.tsx`) ganha uma terceira seção "Diário", só quando a
   obra atende o mesmo gate da spec 030 (`cliente_id` do cliente logado +
   `modelo_cobranca = 'administracao'` — já resolvido pela RPC existente,
   não é gate novo).
4. Cada card do feed do cliente mostra: data, clima, o resumo (`atividades`),
   fotos. **Nunca** mostra `ocorrencias`, `pendencias`, efetivo por
   fornecedor, impedimentos ou visitas — só os 3 campos citados + fotos.
5. Fotos no feed do cliente carregam via URL assinada de curta duração (5min,
   mesmo padrão de `portal-entrega-download`) — o portal não tem sessão
   Supabase autenticada, não pode chamar `storage.createSignedUrls`
   diretamente como o front interno faz.
6. Feed (interno e cliente) ordena mais recente primeiro, com paginação ou
   "carregar mais" quando passar de ~20 dias (evita carregar o histórico
   inteiro de uma obra longa de uma vez).

Não-funcionais:

- **Segurança / RLS:** nenhuma tabela nova. A leitura do feed do cliente usa
  a RPC `get_cliente_obra_detail` já existente (estendida com um array
  `diario`) — mesmo gate de segurança que já protege cronograma/conta, não
  duplica lógica de autorização.
- **Privacidade:** o filtro de campos do feed do cliente (requisito 4)
  acontece no SQL da RPC, não no front — o front nunca recebe
  `ocorrencias`/`pendencias`/impedimentos pra depois esconder na UI; esses
  campos simplesmente não fazem parte do JSON devolvido pro portal.
- **Performance:** RPC do cliente já busca a obra inteira numa chamada
  (padrão atual); adicionar o array de diário não pode virar N+1 de fotos —
  resolver as URLs assinadas em lote (mesmo IDs, uma chamada de
  `createSignedUrls` na edge, não uma por foto).

## Critérios de aceite

- [ ] Dado um RDO com atividades e 2 fotos, quando abro o Diário (interno)
      em modo Feed, então vejo um card com o resumo e as 2 fotos, e clicar
      nele abre o formulário de edição do dia.
- [ ] Dado um RDO com impedimento e visita lançados, quando abro o mesmo
      card no feed interno, então o resumo não esconde essa informação (ela
      aparece dentro do card, igual à lista densa já mostra hoje).
- [ ] Dado o mesmo RDO, quando o dono da obra abre a seção Diário no portal,
      então vê data/clima/atividades/fotos, mas **não** vê o impedimento nem
      a visita em lugar nenhum da resposta (nem escondido no HTML).
- [ ] Dado uma obra em `preco_fechado` ou sem `cliente_id`, quando o cliente
      tenta acessar, então a seção Diário nem aparece (mesmo gate da spec
      030, já testado lá).
- [ ] Dado um RDO sem nenhuma foto, quando o card do feed renderiza (interno
      ou cliente), então não sobra espaço vazio de grid de foto — o bloco de
      fotos simplesmente não aparece.
- [ ] Caso de borda: obra com mais de 20 RDOs — o feed carrega os mais
      recentes primeiro e não trava buscando o histórico inteiro de uma vez.
- [ ] `npm run test:run` e `npm run typecheck` verdes.

## Dados e contratos

Sem tabela nova. Muda:

- **`get_cliente_obra_detail`** (RPC existente, SQL): adiciona `diario`, um
  array de `{ data, clima, atividades, fotos: [{id, path}] }` — só os 3
  campos texto/enum permitidos pro cliente (requisito 4), `ocorrencias`/
  `pendencias`/efetivo/impedimento/visita **não entram na query** dessa RPC
  (não é filtro no front, é ausência no SQL).
- **Edge function nova** `portal-obra-fotos` (ou extensão de
  `portal-entrega-download` para aceitar um segundo tipo de recurso — decidir
  no plano, olhando o quanto os dois fluxos divergem): recebe
  `session_token` + lista de `foto_id`, revalida que cada foto pertence a um
  RDO de uma obra do cliente da sessão (mesmo padrão de
  `portal-entrega-download`, incluindo a checagem ACH-PORT-02 de não vazar
  entre clientes da mesma empresa), devolve `signed_url` por foto (lote, não
  uma chamada por foto).
- Front interno: `ObraDiarioTab.tsx` ganha o toggle Lista/Feed e o novo
  componente de card (reusa `useObraFotos`/`useObraRdos` que já existem,
  sem hook novo de dados — só view nova).
- Front portal: `useClienteObraData.ts` ganha o campo `diario` no tipo
  `ClienteObraData`; `ClienteObraDetail.tsx` ganha a seção nova, reusando o
  mesmo componente de card visual do lado interno (compartilhado, com uma
  prop pra esconder o "por: fulano" e qualquer ação de clique/edição no
  modo cliente).

## Plano de implementação

A confirmar em plan mode, esqueleto:

1. Ler `get_cliente_obra_detail` atual (SQL da migration correspondente) pra
   estender com o array `diario` sem quebrar o contrato existente.
2. Migration: só altera a função SQL (`CREATE OR REPLACE FUNCTION`), sem
   tabela nova.
3. Edge function de signed URL em lote pro portal (novo arquivo ou extensão,
   decidir olhando `portal-entrega-download` de perto).
4. Componente de card visual compartilhado (`RdoFeedCard` ou nome
   equivalente), com prop de modo (`interno` | `cliente`) controlando o que
   aparece (por-quem, clique-pra-editar).
5. `ObraDiarioTab.tsx`: toggle Lista/Feed, grid de cards no modo Feed.
6. `useClienteObraData.ts` + `ClienteObraDetail.tsx`: consome `diario`,
   renderiza a seção nova com o mesmo card em modo `cliente`.
7. Paginação/"carregar mais" quando > 20 dias (requisito 6) — decidir no
   plano se é paginação real (nova chamada) ou só limitar e crescer no
   client-side por ora (obra real ainda não tem histórico longo pra isso
   importar hoje; validar se vale o esforço agora ou é over-engineering).
8. Testes: função pura de "resumo do card" (fallback atividades→ocorrencias
   igual ao requisito 2) testável sem mock; `npm run typecheck`/`test:run`.
9. Verificação manual: obra de teste com RDO por voz gerando fotos +
   atividades, conferir os dois feeds (interno completo, portal curado) e
   confirmar via inspeção de rede que o payload do portal genuinamente não
   contém os campos proibidos.

## Decisões e riscos

- **Decisão:** filtro de campo do feed do cliente é feito no SQL da RPC, não
  escondido no front — decisão de segurança por padrão (nunca confiar em UI
  pra esconder dado sensível, princípio já seguido em toda RLS do projeto).
- **Decisão:** card visual é componente COMPARTILHADO entre interno e
  cliente (com prop de modo), não duas implementações — reduz deriva visual
  entre as duas superfícies e é menos código pra manter.
- **Risco:** URL assinada de foto no portal exige uma chamada de rede extra
  (edge function) que o front interno não precisa (lá é direto no client
  Supabase autenticado). Se isso pesar na performance do portal com muitas
  fotos, resolver em lote (já no requisito 5) deve segurar — validar no
  teste manual com uma obra com fotos de verdade.
- **Risco:** "resumo do dia" hoje é só o texto livre de `atividades`
  (spec 080 já resume razoavelmente bem quando vem de voz, mas texto digitado
  à mão pode ficar vazio ou ruim). Sem fallback de IA nesta spec — se um
  RDO não tem `atividades` preenchida, o card mostra "Sem observações", não
  gera resumo automático. Extensão futura, não aqui.
- Nenhuma decisão de arquitetura transversal (extensão de padrão de RPC de
  portal + Storage signed URL já existentes); não abre ADR novo.
