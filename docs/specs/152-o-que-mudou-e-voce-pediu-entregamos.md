# SPEC: "O que mudou" no aviso de nova versão e "Você pediu, entregamos"

**Data:** 2026-11-10
**Status:** Draft
**Autor:** Matheus Rezende
**Módulo:** plataforma (release, notificações, ultra-admin)
**Relacionada:** [SPEC 038](038-central-de-novidades.md) (central de novidades, MVP que saiu do código), [SPEC 145](145-feedback-fecha-pela-pr.md) (feedback fecha pela PR), [SPEC 113](113-avisos-do-ultra-admin-por-email.md) (e-mail do ultra admin), pesquisa [profissionalizacao-saas-referencias](../../research/themes/profissionalizacao-saas-referencias.md)

## Problema

Quando sai versão nova, o `useNovaVersao` mostra "Nova versão disponível · Recarregar", mas o
escritório não sabe o que mudou. Mudança que altera o caminho de uma tarefa pega o usuário de
surpresa, e o aviso hoje sai à mão, por WhatsApp. Quem mandou um feedback que virou entrega
também não fica sabendo: o status vai para `resolvido` (SPEC 145) só dentro do Ultra admin.

A central da SPEC 038 (`novidades.ts`, `NovidadesDialog`) não existe mais no código, e o
`CHANGELOG.md` está parado na seção `[Não lançado]` desde agosto.

## Objetivo

Toda promoção para produção que muda algo que o usuário vê ou faz chega a ele dentro do app,
com o texto certo e só para quem é afetado; e quem pediu a mudança é avisado de que ela saiu.

**Fora de escopo:**

- Changelog público na landing (vem depois, reusa os mesmos dados).
- Roadmap público e votação de ideias.
- Prévia de recursos / beta opcional (card próprio).
- Tradução: só pt-BR.

## Regra editorial: o que vai para o usuário

A decisão acontece no commit, por quem fez a mudança, com uma pergunta: **isto muda o que o
usuário vê ou faz?**

| Impacto | Quando usar | Como aparece |
|---|---|---|
| `fluxo` | Muda o caminho de uma tarefa que ele já fazia | Modal "O que mudou" depois do reload |
| `melhoria` | Coisa nova ou melhor que ele pode usar | Ponto em "Novidades" na sidebar |
| `correcao` | Correção de algo que ele percebia | Linha em "Novidades", sem ponto |
| (sem trailer) | Infra, refatoração, teste, CI, migration, performance invisível | Não aparece |

Infra só vira novidade quando o usuário sente o efeito ("o Financeiro abre 3x mais rápido").
O texto segue `brand/voice-tone.md`: o que ele ganha, não o que o time fez.

## Requisitos

1. Commit que muda algo visível leva os trailers `Novidade: <frase para o cliente>` e
   `Impacto: fluxo | melhoria | correcao`. Opcional: `Modulo: <chave do módulo>`. Commit sem
   `Novidade:` é interno.
2. Na criação da branch `release/staging-AAAA-MM-DD`, um script lê os commits de
   `origin/main..origin/staging`, extrai os trailers e grava um **rascunho de release** com os
   itens, os `Feedback: <id>` ligados a cada item e a lista de SHAs.
3. O Ultra admin tem a aba "Releases": revisar, editar o texto, remover ou juntar itens,
   escolher título e publicar. Rascunho não aparece para ninguém.
4. Publicar uma release grava `publicada_em`. O merge do PR de release em `main` não publica
   sozinho; o ultra admin publica depois de confirmar o deploy (ordem: deploy → publicar).
5. O toast de nova versão passa a dizer quantos itens a release tem ("Nova versão · 3
   melhorias") quando a release correspondente ao SHA do servidor já foi publicada; se não,
   mantém o texto atual.
6. Depois do reload, se a release publicada mais recente tem item `fluxo` que o usuário ainda
   não viu, o modal "O que mudou" abre uma vez. Sem item `fluxo`, só o ponto em "Novidades".
7. "Novidades" na sidebar (e no MoreSheet no mobile) lista as releases publicadas, da mais
   recente à mais antiga, com selo Novo / Melhoria / Correção.
8. Item com `Modulo` só gera modal ou ponto para quem tem acesso àquele módulo
   (`usePermissions`); na lista completa aparece para todos.
9. "Visto" é gravado no banco por usuário (última release vista), valendo em qualquer
   dispositivo.
10. **Você pediu, entregamos:** quando a release é publicada, cada autor de feedback ligado a um
    item recebe uma notificação no sino (categoria `sistema`) e e-mail, respeitando a
    preferência de e-mail, com o texto do item e link para a tela. No modal e na lista, o item
    leva o selo "Você pediu" para o autor.
11. Publicar a release atualiza o `CHANGELOG.md` no próximo release (o script gera a seção a
    partir da release publicada), para o arquivo voltar a ser verdade.

Requisitos não-funcionais:

- **Segurança / RLS:** `product_releases` e `product_release_itens`: `select` para
  `authenticated` só onde `publicada_em is not null`; escrita só `ultra_admin`. Estado de
  visto por usuário com policy `user_id = auth.uid()`. O script de rascunho escreve por edge
  function com token próprio (mesmo padrão do `feedback-sync`).
- **Multi-tenant:** release é da plataforma (sem `empresa_id`); notificação de "você pediu"
  respeita a empresa do autor.
- **Performance:** a leitura das novidades é uma query pequena, com cache longo
  (`staleTime` de horas), invalidada quando o `useNovaVersao` detecta versão nova.
- **Sem duplicar:** a notificação de "você pediu" é idempotente por (release, feedback).

## Critérios de aceite

- [ ] Dado um intervalo de commits sem `Novidade:`, quando o script roda, então o rascunho sai
      vazio e nada aparece para o usuário.
- [ ] Dado um commit com `Novidade:` e `Impacto: fluxo`, quando a release é publicada e o
      usuário recarrega, então o modal "O que mudou" abre uma vez e não abre de novo em outro
      navegador.
- [ ] Dado uma release só com `melhoria`/`correcao`, então não abre modal; aparece o ponto em
      "Novidades" (só se houver `melhoria`).
- [ ] Dado um item com `Modulo: financeiro`, quando o usuário não tem acesso ao Financeiro,
      então o item não gera modal nem ponto para ele.
- [ ] Dado um rascunho não publicado, então nenhum usuário autenticado consegue lê-lo (pgTAP).
- [ ] Dado um item ligado a `Feedback: <id>`, quando a release é publicada, então o autor
      recebe uma notificação e um e-mail, e publicar de novo não duplica.
- [ ] Dado o SHA do servidor sem release publicada, então o toast mantém "Nova versão
      disponível".
- [ ] Trailer malformado (`Impacto: outro`) é rejeitado pelo script com mensagem clara.

## Dados e contratos

- `product_releases`: `id`, `titulo`, `versao` (amigável, ex. `2.4`), `sha_inicio`, `sha_fim`,
  `criada_em`, `publicada_em`, `publicada_por`.
- `product_release_itens`: `id`, `release_id`, `texto`, `impacto` (`fluxo|melhoria|correcao`),
  `modulo` (nullable), `feedback_ids uuid[]`, `ordem`, `commit_sha`.
- `product_release_vistas`: `user_id` (pk), `ultima_release_id`, `visto_em`.
- Edge `release-rascunho` (POST, token próprio): recebe os itens extraídos e cria/atualiza o
  rascunho daquela branch de release.
- RPC `publicar_release(release_id)` (só ultra_admin): grava `publicada_em` e enfileira as
  notificações de "você pediu".
- Rodar `npm run gen:types:local` e commitar o `types.ts`.

## Plano de implementação

1. Migration das três tabelas + RLS + pgTAP.
2. `scripts/release-notas.sh` (extração de trailers, com teste no padrão do
   `feedback-sync.test.ts`) + passo no fluxo de criação da branch de release.
3. Edge `release-rascunho` + RPC `publicar_release` + notificação/e-mail de "você pediu".
4. Ultra admin: aba "Releases" (revisar, editar, publicar).
5. App: hook `useNovidades` (lê releases publicadas + visto), entrada "Novidades" na sidebar e
   MoreSheet, `NovidadesDialog` e modal "O que mudou", ajuste do toast em `useNovaVersao`.
6. Documentar a regra editorial e os trailers no `CHANGELOG.md` e no runbook de promoção.

Mudança visual: o PR traz antes e depois da sidebar, do toast, do modal e da aba do Ultra admin.

## Decisões e riscos

- **Banco em vez de arquivo (diferente da 038):** a release precisa ser editada e publicada
  sem deploy, ter visto por usuário em qualquer dispositivo e ligar feedback a autor. A 038
  já previa migrar para tabela com mais de um cliente pagante.
- **Publicação manual:** evita anunciar algo antes de o deploy estar no ar, e dá o controle
  editorial ao CEO. Custo: um passo a mais no release.
- **Risco: ninguém escreve o trailer.** Mitigação: o template de PR pergunta "Isto muda o que
  o usuário vê ou faz? Se sim, escreva a linha `Novidade:`"; o rascunho mostra os commits
  `feat`/`fix` sem trailer para o ultra admin decidir.
- **Risco: modal vira ruído.** Só `fluxo` abre modal, e no máximo uma vez por release.
