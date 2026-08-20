<!--
Template curto de propósito. Marque só o que se aplica e apague as seções que
não se aplicam: fix de copy não precisa da seção de banco. Seção que fica com
caixa vazia sem explicação é sinal de que falta trabalho, não de burocracia.
-->

## O que muda e por quê

<!-- Uma ou duas frases. Se existe spec ou ADR, linke: docs/specs/NNN, ADR NNNN. -->

## Como verifiquei

<!--
Obrigatório em qualquer mudança de comportamento. Uma das duas, ou as duas:
teste automatizado (qual) ou exercício do fluxo real (qual tela, qual caminho).
"Passou o typecheck" não é verificação de comportamento.
-->

---

## Gates

- [ ] Escopo: é fix/refactor/copy (vai direto), ou é feature real e tem spec aprovada
- [ ] Decisão que passa de uma feature está registrada como ADR, não enterrada aqui
- [ ] Sem `console.log` sobrando, early returns, nada de `alert()`

### Se tocou banco (migration, policy, RPC, view)

- [ ] Tabela nova nasceu com `empresa_id` e RLS na **mesma** migration (ADR 0001)
- [ ] Função `SECURITY DEFINER` valida `empresa_id = get_user_empresa_id()` na primeira linha
- [ ] Função nova declara `search_path` fixo
- [ ] Policy nova usa `(select auth.uid())`, não `auth.uid()` direto, e **não** usa `has_role()` (legada, ignora impersonation)
- [ ] View nova usa `security_invoker=true`; se roda como dona, filtra tenant explícito e o motivo está no cabeçalho da migration
- [ ] `npm run gen:types` rodado e `types.ts` commitado
- [ ] `npm run check:migrations` passou (guard de migration destrutiva)
- [ ] Teste pgTAP cobrindo a policy nova em `supabase/tests/`

### Se tocou autenticação, sessão ou endpoint sensível

- [ ] Rate limit definido, com fail-open vs fail-closed escolhido de propósito
- [ ] Fronteira validada por schema (Zod na entrada, não confiar no payload)
- [ ] Erro não vaza mensagem técnica pro usuário nem mascara o erro real no Sentry
- [ ] Segredo novo entrou em `docs/security/secrets-rotation.md`, e **nada** sensível ganhou prefixo `VITE_`

### Se tocou UI

- [ ] Página usa `PilarPage`, modal de formulário usa `FormDialog` (largura `sm`/`md`/`lg`)
- [ ] Cor só por token semântico, botão primário via `variant="brand"`
- [ ] Status via `StatusBadge`, dinheiro e data via `@/lib/format`, exclusão via `ConfirmDialog`
- [ ] Tabela plana via `DataTable` (com os 3 estados: dado, carregando, erro)
- [ ] Empty state orienta a próxima ação; erro diz o que houve e o próximo passo

### Se mudou comportamento que vale medir

- [ ] Evento de negócio instrumentado via `analytics.track` (hoje o funil está quase sem instrumentação, cada feature nova é chance de fechar isso)
- [ ] Falha de rede em `invoke`/`rpc` chega no Sentry, não morre só num toast

### Antes de mergear

- [ ] Todos os checks verdes, nenhum contornado com `--no-verify`
- [ ] Branch saiu de `origin/staging` e o PR aponta pra `staging`, nunca pra `main`
- [ ] Commits curados (sem "wip"/"typo"), porque o merge é rebase e reaplica tudo no log
