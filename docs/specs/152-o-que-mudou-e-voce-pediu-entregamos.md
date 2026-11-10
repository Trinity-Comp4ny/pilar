# SPEC: "O que mudou" no aviso de nova versão e "Você pediu, entregamos"

**Data:** 2026-11-10
**Status:** Em implementação
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
   `Impacto: fluxo | melhoria | correcao`. Opcional: `Modulo: <chave da feature>` (as chaves de
   `src/lib/features.ts`, ex. `financeiro`, `leads`). Commit sem `Novidade:` é interno.
2. No push em `main` (release), o workflow `release-notas.yml` junta os commits de staging que
   entraram no release (mesma lógica de árvore do SPEC 145) e manda os que têm `Novidade:` para
   a edge `release-rascunho`, que grava o **rascunho** com os itens e os `Feedback: <id>` de cada
   commit. Sem `Impacto:` o item entra como `melhoria`; impacto fora da lista é ignorado; os
   dois casos voltam como aviso.
3. O Ultra admin tem a seção "Releases": revisar, editar o texto, impacto e módulo, adicionar ou
   remover item, criar release à mão e publicar. Rascunho não aparece para ninguém.
4. Publicar uma release grava `publicada_em`. O merge do PR de release em `main` não publica
   sozinho; o ultra admin publica depois de confirmar o deploy (ordem: deploy → publicar).
5. O toast de nova versão passa a dizer quantos itens a release tem ("Nova versão com 3
   novidades") quando a release correspondente ao SHA do servidor já foi publicada; se não,
   mantém o texto atual.
6. Depois do reload, se a release publicada mais recente tem item `fluxo` que o usuário ainda
   não viu, o modal "O que mudou" abre uma vez. Sem item `fluxo`, só o ponto em "Novidades".
7. "Novidades" no menu do usuário (e no MoreSheet no mobile) abre a página `/novidades`, com as
   releases publicadas da mais recente à mais antiga e o selo de cada item (Mudou o caminho /
   Novo / Correção). Abrir a página conta como visto.
8. Item com `Modulo` só gera modal ou ponto para quem tem acesso àquele módulo
   (`usePermissions`); na lista completa aparece para todos.
9. "Visto" é gravado no banco por usuário (`visto_ate`), valendo em qualquer dispositivo.
   Conta criada depois da release não recebe o histórico como novidade.
10. **Você pediu, entregamos:** quando a release é publicada, cada autor de feedback ligado a um
    item recebe uma notificação no sino (categoria `sistema`, tipo `feedback_entregue`) com o
    texto do item e link para `/novidades`; o e-mail segue a preferência da categoria (mesmo
    canal das outras notificações). No modal e na lista, o item leva o selo "Você pediu" para o
    autor.
11. (Fase 2) Gerar a seção do `CHANGELOG.md` a partir da release publicada. Na fase 1 o
    arquivo segue como histórico técnico escrito à mão.

Requisitos não-funcionais:

- **Segurança / RLS:** as três tabelas abrem só para `ultra_admin` (vistas: nenhum acesso
  direto). O usuário lê pela RPC `novidades_publicadas` (só publicada, sem os ids de feedback)
  e marca visto por `marcar_novidades_vistas`. Publicar só pela RPC `publicar_release`: um
  trigger recusa gravar `publicada_em` direto, até para o ultra admin, porque publicaria sem
  avisar ninguém. A edge escreve com service_role e token próprio (padrão do `feedback-sync`).
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

Migration `20261211000000_novidades_do_produto.sql`, teste `supabase/tests/novidades_do_produto.sql`.

- `product_releases`: `id`, `sha` (commit de main, único; nulo se criada à mão), `titulo`,
  `versao` (amigável, ex. `2.4`), `criada_em`, `publicada_em`, `publicada_por`.
- `product_release_itens`: `id`, `release_id`, `texto` (até 300), `impacto`
  (`fluxo|melhoria|correcao`), `modulo` (nullable), `feedback_ids uuid[]`, `commit_sha`, `ordem`.
- `product_release_vistas`: `user_id` (pk), `visto_ate`.
- Edge `release-rascunho` (POST, `RELEASE_NOTAS_TOKEN`): `{ sha, commits: [{ sha, mensagem }] }`
  → `{ release_id, itens, avisos }`. Mesmo sha refaz o rascunho; release publicada não muda.
- RPC `novidades_publicadas() → jsonb` `{ visto_ate, releases: [{ id, sha, titulo, versao,
  publicada_em, nova, itens: [{ id, texto, impacto, modulo, voce_pediu }] }] }` (30 últimas).
- RPC `marcar_novidades_vistas() → void`.
- RPC `publicar_release(p_release_id) → integer` (só ultra_admin): quantos avisos saíram; 0 se
  já estava publicada.
- Segredos: `RELEASE_NOTAS_TOKEN` (edge + GitHub) e `RELEASE_NOTAS_URL` (GitHub).

## Plano de implementação

1. [x] Migration das três tabelas + RLS + RPCs + pgTAP.
2. [x] `scripts/release-notas.sh` + `.github/workflows/release-notas.yml` (push em main) +
   `FORMATO` em `scripts/feedback-release-commits.sh`.
3. [x] Edge `release-rascunho` (leitura dos trailers em `notas.ts`, com teste Deno).
4. [x] Ultra admin: seção "Releases" (`/ultra-admin/releases`).
5. [x] App: `useNovidades`, página `/novidades`, modal `OQueMudou` no Layout, "Novidades" com
   ponto no menu do usuário e no MoreSheet, contagem no toast do `useNovaVersao`.
6. [x] Regra editorial e trailers no `CHANGELOG.md` e no template de PR.
7. [ ] Configurar `RELEASE_NOTAS_TOKEN` na edge de produção e `RELEASE_NOTAS_URL`/
   `RELEASE_NOTAS_TOKEN` nos segredos do GitHub (sem eles o workflow só avisa).

Mudança visual: o PR traz antes e depois da sidebar, do toast, do modal e da aba do Ultra admin.

## Decisões e riscos

- **Banco em vez de arquivo (diferente da 038):** a release precisa ser editada e publicada
  sem deploy, ter visto por usuário em qualquer dispositivo e ligar feedback a autor. A 038
  já previa migrar para tabela com mais de um cliente pagante.
- **Publicação manual:** evita anunciar algo antes de o deploy estar no ar, e dá o controle
  editorial ao CEO. Custo: um passo a mais no release.
- **Rascunho no push em main, não na branch de release:** o release já é um commit com a árvore
  de staging; reaproveitar a mesma busca de intervalo do SPEC 145 evita um passo manual a mais
  e grava a release com o sha que o `/version.json` serve (é por ele que o toast acha a release).
- **Risco: ninguém escreve o trailer.** Mitigação: o template de PR pergunta "Isto muda o que
  o usuário vê ou faz?" e o ultra admin pode criar release e item à mão.
- **Risco: modal vira ruído.** Só `fluxo` abre modal, e no máximo uma vez por release.
