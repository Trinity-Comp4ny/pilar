# 038 — Central de novidades in-app

Status: implementado (MVP)
Data: 2026-08-13

## Contexto

Deploy não é release (regra do `CHANGELOG.md`): vários deploys por dia, e o
usuário não sabe o que mudou. O changelog existe, mas vive na raiz do repo, longe
de quem usa o produto. Faltava um lugar dentro do app onde o usuário vê "o que há
de novo" e um sinal discreto de que existe algo novo para ler.

Isto unifica dois itens do backlog de product experience: **#15 What's New** e
**#16 changelog do usuário**. São a mesma coisa vista de dois ângulos (novidade em
destaque vs. histórico), então viram uma central só.

## Decisão

Central de novidades voltada ao usuário, alimentada por dados versionados no
código. **Sem banco, sem migration.**

- **Fonte**: `src/lib/novidades.ts` exporta um array tipado `NOVIDADES` (mais
  recente primeiro), cada release `{ versao, titulo, data, itens: {tipo, texto}[] }`,
  com `tipo ∈ {novo, melhoria, correcao}`. Preenchido a partir do `CHANGELOG.md`:
  a seção `[Não lançado]` vira o release do topo com rótulo amigável
  ("Agosto de 2026"); `[1.0.0]` vira o release base. **Não parseamos o .md em
  runtime** — o array dá tipo forte, zero I/O e controle editorial (a linguagem
  aqui é do usuário, não do time).
- **Marca de "visto"**: `localStorage` por usuário
  (`pilar:novidades-vista:<profileId>` = id da última versão vista). `temNovidade()`
  compara com `ULTIMA_VERSAO`; `marcarVista()` grava. Sem `profileId` (deslogado),
  não persiste e não sinaliza.
- **Gatilho**: botão discreto no rodapé da barra lateral, ao lado do sino de
  notificações (ícone `Sparkles`), com um dot da cor da marca quando há novidade.
  Abre o dialog, que ao abrir chama `marcarVista()` e some o dot.
- **UI**: `Dialog` + `ScrollArea`, releases do mais recente ao mais antigo, cada
  item com um `Badge` de status (Novo/Melhoria/Correção) reusando as variantes
  `success`/`info`/`warning` do Badge do projeto (ADR 0008 D3).

### Por que não tabela agora

Com um cliente (design partner) e um autor de release (o time), uma tabela
`product_releases` + fetch + cache seria cerimônia sem retorno. O conteúdo muda no
mesmo PR que entrega a feature, então versioná-lo no código mantém código e
novidade em sincronia por construção. **Migrar para tabela quando houver >1 cliente
pagante** e a edição de release precisar sair do deploy (ex.: marketing publicando
sem deploy). O contrato de dados (`Release`) já foi desenhado para espelhar uma
linha de tabela, então a migração é rasa.

## Arquivos

- `src/lib/novidades.ts` — tipo `Release`, array `NOVIDADES`, `ULTIMA_VERSAO`,
  `ROTULO_TIPO`, `VARIANTE_TIPO`.
- `src/hooks/useNovidades.ts` — `temNovidade()` / `marcarVista()`, leitura inicial
  síncrona do localStorage, namespacing por `profile.id`.
- `src/components/NovidadesDialog.tsx` — dialog da central; marca visto ao abrir.
- `src/components/AppSidebar.tsx` — botão + dot no rodapé; dialog lazy (Suspense).
- `src/hooks/useNovidades.test.ts` — cobre temNovidade/marcarVista e o caso sem
  profileId.

## Lazy / bundle

`AppSidebar` está no bundle de entrada. `NovidadesDialog` é `lazy()` + `Suspense`,
montado só após o primeiro clique em "Novidades", então não pesa no first load. O
entry segue abaixo do cap (264 kB gzipped).

## Manutenção

Ao promover `staging → main`, quando a seção `[Não lançado]` do `CHANGELOG.md`
vira uma versão datada, espelhar em `novidades.ts`: novo release no topo e
atualizar `ULTIMA_VERSAO`. É o único passo manual; um teste de sincronização
CHANGELOG↔novidades fica para quando a cadência de release justificar.

## Riscos e limites

- **Sincronização manual** entre `CHANGELOG.md` e `novidades.ts`: esquecer deixa a
  central desatualizada. Mitigado por ser um passo no runbook de promoção.
- **localStorage por dispositivo**: a marca de "visto" não sincroniza entre
  máquinas; o usuário pode reencontrar o dot em outro browser. Aceito no MVP.
- **`versao` como string comparada por igualdade**: `temNovidade` só verifica
  "diferente da última vista", não ordena versões. Suficiente enquanto só importa
  "viu a mais recente ou não".
- Sem categorização por pilar/módulo nem deep-link para a feature citada. Fora do
  MVP.
