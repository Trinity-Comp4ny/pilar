# Antes e depois no PR (regra do dono)

Detalhe completo da regra. O resumo inegociável fica no `CLAUDE.md`.

Todo PR (ou fase de uma sprint) que muda a aparência de uma tela mostra **o antes e o depois**
no corpo, para o Matheus acompanhar a evolução. Sem exceção para mudança visual.

**Regra rígida: o PR só é aberto depois que a imagem antes/depois existe e vai embutida no corpo**
(uma imagem lado a lado, fixada por SHA). "Sem Docker/Supabase local" não dispensa: capture com
mock do cliente Supabase, Playwright com rotas interceptadas ou harness do componente real. Se
nada servir, pergunte ao dono antes de abrir. Nunca abrir PR visual "sem print" para completar depois.

- **Antes** = como a tela era na base do PR (`origin/staging` no momento de abrir). Suba a base
  numa worktree separada (`git worktree add --detach /tmp/pilar-antes <base>`, `node_modules`
  por symlink, `vite --port 8081`) e capture ali. Nunca "reconstrua de memória".
- **Depois** = a branch do PR, mesma rota, mesmo viewport (1440px; mobile 390px quando o
  layout mobile muda), mesmo dado seed (`dev@local.test`).
- Guarde as imagens em `docs/design/antes-depois/<spec-ou-pr>/` (uma imagem por tela, **antes e
  depois lado a lado na mesma imagem**, com os rótulos "ANTES" e "DEPOIS") com um `README.md` na
  mesma pasta. **As imagens aparecem dentro do corpo do PR**, não só num link: commite as imagens,
  pegue o SHA do commit e use `![antes e depois](https://github.com/Trinity-Comp4ny/pilar/blob/<SHA>/docs/design/antes-depois/<pasta>/<tela>.jpg?raw=true)`.
  O SHA fixa a imagem: link por nome de branch quebra quando a branch é apagada no merge (foi o que
  aconteceu no PR #842). Edite o corpo com `gh pr edit <n> --body-file` (o CLI preserva a imagem; a
  ferramenta do GitHub da sessão troca `![](url)` por texto em crases e a imagem aparece quebrada,
  11/11, PR #812). Confira com `gh pr view <n> --json body` que o `![` está no corpo. Cada nova fase
  do mesmo PR acrescenta as suas telas.
- **PR visual sem as imagens no corpo está incompleto**: não dar como pronto nem pedir aprovação.
  Se o teste visual regrava as referências (label `atualizar-visual`), as imagens novas só existem
  depois que o workflow termina: espere-o e monte os prints antes de avisar o Matheus.
- Dado seed apenas (repo público): nada de dado real de cliente nos prints.
- Fase sem mudança visual (só código/teste) diz isso em uma linha em vez de tabela.
