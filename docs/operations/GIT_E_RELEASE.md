# Git, branches e release (regra inquebrável)

Detalhe completo do fluxo. O resumo inegociável fica no `CLAUDE.md`.

Fluxo e higiene não negociáveis. Aplicar sempre, sem perguntar, em toda mudança:

O repo permite squash e rebase, mas BLOQUEIA merge commit.

**Branches**

- Feature/fix nasce de `origin/staging` e o PR vai SEMPRE para `staging`, nunca direto para `main`.
- Merge do PR de feature com `gh pr merge <n> --rebase --delete-branch`: preserva os commits em linha e mantém `staging` linear. Curar a branch antes (sem commits "wip/typo"), porque o rebase reaplica todos no log.
- Zero commit direto em `staging` ou `main`.
- Entre trabalhos só sobrevivem `main` e `staging`. Nenhuma branch órfã.

**Promoção staging→main (release)**

- NUNCA PR direto de `staging` para `main`: o histórico divergiu (releases antigos foram squash) e qualquer método por replay (rebase ou merge) dá conflito falso.
- Método correto: branch `release/staging-AAAA-MM-DD[-slug]` a partir de `origin/main`, depois `git read-tree --reset -u origin/staging`, `git commit --no-verify`, e PR para `main`. Isso vira UM commit cuja árvore = `staging`, sem replay de histórico.
- Merge do PR de release com `gh pr merge <n> --admin --squash --delete-branch` (`enforce_admins=false` deixa o admin passar o review requerido). Como a branch release já é 1 commit, squash e rebase são equivalentes aqui.
- Só mergear com TODOS os checks verdes, incluindo Security audit e "types.ts em sync".

**Feedback de cliente (SPEC 145)**

- Commit que corrige um feedback do Ultra leva a linha `Feedback: <id>` (botão "Copiar linha do commit" no detalhe). O merge em `staging` move o feedback para `planejado` e o release para `resolvido`.

**Limpeza obrigatória após CADA merge**

- Deletar a branch merged, local e remota (`--delete-branch`, ou `git branch -D` + `git push origin --delete`).
- Issues resolvidas: escrever `Closes #N` (ou `Fixes`/`Resolves`) na mensagem do commit. O `Closes` nativo não dispara em `staging`, então o workflow `fechar-issues-staging.yml` fecha a issue quando o commit chega lá, com link para ele. Sem a linha no commit, fechar à mão.
- Trocar para `staging`, `git pull --ff-only`, e apagar as branches locais já merged.

**Verificação de fecho**

- Após o release, confirmar `git diff --stat origin/main origin/staging` vazio (árvore idêntica = promoção completa).
