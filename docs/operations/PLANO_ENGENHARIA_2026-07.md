# Plano de engenharia: trazer o padrão Labrynth para o Pilar

Data: 2026-07-25
Método: varredura de `plg-api` e `labrynth-platform` (AWS/Python/Terraform) mais a skill
`labrynth-engineering-standards`, comparada com auditoria do estado real deste repo.
Restrição: seguimos no Supabase. Nada aqui depende de migrar para AWS.

## Resumo em uma linha

O que falta aqui não é ferramenta, é **gate**. Lá quase toda regra escrita tem um job
que a reprova; aqui a maioria das regras vive em `CONTRIBUTING.md` e depende de
lembrança. Três gates existiam e foram removidos (pgTAP, types-sync, e2e), e a
documentação continua descrevendo eles como ativos.

---

## 1. Risco ativo agora (antes de qualquer melhoria)

| # | Fato verificado | Consequência |
|---|---|---|
| R1 | `supabase/config.toml:1` aponta `project_id` de **produção** | qualquer `supabase db push` ou `functions deploy` sem `--db-url`/`--project-ref` aplica no banco dos clientes. `npm run gen:types` (`package.json:17`) também gera do banco de prod |
| R2 | `npm audit --audit-level=high` retorna 13 high **hoje** | o job `audit` é `needs` do `deploy-staging`: o próximo push em staging derruba o CI e congela o CD de backend |
| R3 | `itau-sync` e `bradesco-sync` falham há 30 dias consecutivos (`SSLError ... PEM lib`, cert mTLS inválido) sem nenhum alerta | extrato do cliente que usa o produto de verdade está um mês defasado; a descoberta vem do cliente |
| R4 | `main` está 177 commits atrás; o `ci.yml` de `main` não tem os jobs de deploy | promover para prod hoje = rodar `db push` na mão, do laptop, contra o ref que o `config.toml` já aponta |
| R5 | Os 9 arquivos pgTAP de RLS (~80 asserts) não rodam desde `f5a86ea` | policy quebrada entra em staging com CI verde; é a camada que separa empresa A de empresa B |
| R6 | `types.ts` fora de sincronia (`jobs_queue`, `pessoas_safe`, `clientes_listar_paginado` ausentes); `types-sync-check` removido em `83d62e4` | código chama tabela/RPC que o tipo não conhece, passa no typecheck via cast, quebra em runtime (mesmo padrão do incidente `_feature_catalog`) |

R1, R2 e R3 são de hoje, não de roadmap.

---

## 2. O que lá existe e aqui não

Comparação só dos itens replicáveis sem AWS.

| Prática | plg-api / platform | Pilar | Ganho aqui |
|---|---|---|---|
| Um required check agregado (`ci-ok`) | sim (`platform/ci.yml:155`) | não, 3 checks nominais | job novo não exige mexer em branch protection |
| Piso de cobertura por branch de destino | sim, 50% feature / 80% main (`plg/ci.yml:48-66`) | nenhum gate, 26 testes para 469 arquivos | rampa em vez de "80% ou nada" |
| Migration aplicada em banco efêmero no CI | sim (`platform/ci.yml:73-87`, Postgres service) | não | migration quebrada aparece no PR, não no deploy |
| Guard de plano destrutivo com allowlist por recurso | sim (`check-terraform-plan-safety.sh:14`) | não; 8 migrations com `DROP TABLE`/`DROP COLUMN`, zero reversível | deploy não apaga tabela sem alguém autorizar por nome |
| Teste unitário sobre o próprio pipeline | sim (`test_deploy_safety_contract.py:33`, garante guard antes do apply) | não | remover um guard quebra o CI |
| PR de promoção automática e idempotente com checklist | sim (`promote-to-staging.yml:24-36`) | não | promoção deixa de ser ato de memória |
| Resultado do deploy comentado no PR de promoção | sim (`platform/cd.yml:437-454`) | não | a evidência chega onde a decisão é tomada |
| Validação de env na fronteira | sim, pydantic-settings + `config.ts` único ponto de leitura | 23 acessos diretos a `import.meta.env` em 12 arquivos; 3 vars usadas fora do `.env.example` | deploy sem `VITE_TURNSTILE_SITE_KEY` para de subir login sem captcha silenciosamente |
| Default de env que falha seguro | sim (`settings.py:26-33`, `data_classification="controlled"`) | não | flag ausente vira o comportamento restritivo, não o permissivo |
| Comportamento por ambiente em arquivo declarativo | sim (`envs/staging.tfvars`, ambiente legível em 100 linhas) | não; app não distingue staging de prod por nenhum sinal próprio | mata a classe de bug "staging apontando pro Supabase de prod" |
| Gate de compatibilidade de runtime | sim, compila no Python do runtime real (`platform/ci.yml:89-108`) | não; 47 Edge Functions Deno sem gate de compilação | erro de sintaxe Deno para de aparecer só no cold start |
| Smoke test pós-deploy no pipeline | sim em plg (`cd.yml:171-196`, `/health` estático) | não; `health/index.ts` existe e nunca é chamado pelo CD | deploy verde deixa de significar "aplicou", passa a significar "responde" |
| Health check estático por decisão | sim (`http_api.py:5-7`, nunca toca o banco) | health do Pilar agrega db/asaas/resend | soluço do banco não derruba o gate de deploy |
| Suites caras isoladas por marker com o comando na descrição | sim (`pyproject.toml:148-156`, eval offline por default, `EVAL_LIVE=1` para live) | não; Playwright nunca rodou em CI | testar IA sem queimar crédito em cada push |
| Secrets do CI: distinção secret vs variable proposital | sim; allowlists e opt-ins de destruição são **variables** auditáveis | tudo secret | opt-in de destruição fica visível no histórico |
| Sourcemap e release no build | plg injeta `PLG_RELEASE_SHA` em toda Lambda | `build.sourcemap` não setado (default false); `health` reporta `version: "unknown"` | stack trace de prod no Sentry deixa de ser minificado |
| Dependabot/Renovate | ausente lá também | ausente | (não é ganho, é dívida comum aos três) |

Padrão cultural que vale mais que qualquer job: **todo guard, exceção e flag carrega no
arquivo o motivo, a data e a condição de saída**. É por isso que aqueles repos convivem
com dívida grande sem confundir dívida com regime. Aqui, `CONTRIBUTING.md` descreve
três jobs que não existem mais, e `STAGING_SETUP.md:86` cita um workflow deletado.

---

## 3. Plano por fase

Ordenado por risco evitado por hora gasta. Cada fase é mergeável sozinha.

### Fase 0: parar o sangramento — CONCLUÍDA em 2026-07-25

Entregue na branch `chore/phase-0-engineering-hardening`:

- `config.toml` aponta para staging; todo comando destrutivo passa por
  `scripts/supabase-target.sh` com ambiente obrigatório e opt-in para prod
  ([ADR 0007](../architecture/adr/0007-ambiente-explicito-em-comando-destrutivo.md)).
  `gen:types` deixou de ter o ref de prod hardcoded.
- `audit` destravado: `eslint@10` + `eslint-plugin-react-hooks@7` zeraram os 13 high.
  As 4 regras novas de compiler do react-hooks ficaram como warning (71 ocorrências
  medidas, motivo e condição de saída no `eslint.config.js`). Restam 2 moderate do
  `react-router-dom`, abaixo do nível do gate, com fix major pendente.
- Falha de cron abre ou atualiza issue via `.github/actions/notify-cron-failure`,
  ligada aos dois workflows de sync. **O cert mTLS do Itaú e do Bradesco continua
  inválido: o alerta agora avisa, o conserto é o próximo passo.**
- `CONTRIBUTING.md`, `STAGING_SETUP.md` e `CLAUDE.md` corrigidos: os gates removidos
  aparecem como removidos, e a referência ao workflow deletado saiu.

Itens originais da fase, para registro:

1. **`config.toml` deixa de apontar para prod.** Trocar `project_id` para o ref de
   staging e mover todo comando destrutivo para script com ref explícito
   (`scripts/db-push.sh <staging|prod>` que exige a flag). ADR curto registrando
   a decisão.
2. **Destravar o `audit`.** Resolver ou aceitar formalmente as 13 high (a maioria vem
   de `eslint`/`typescript-eslint`, parte exige `eslint@10`). Deixar o gate vermelho
   parado não é opção: ele congela o CD.
3. **Alertar falha de cron.** Step `if: failure()` nos dois workflows de sync abrindo
   issue ou postando no canal. Depois, corrigir o cert mTLS do Itaú e do Bradesco.
4. **Sincronizar a doc com a realidade.** Remover de `CONTRIBUTING.md` e
   `STAGING_SETUP.md` a menção aos gates removidos, ou reativar os gates. Manter os
   dois divergentes é pior que qualquer um dos dois estados.

Critério de aceite: CI verde em staging, `db push` impossível de rodar sem escolher
ambiente, falha de cron notifica alguém.

### Fase 1: gates que impedem o erro caro (1 a 2 dias)

5. **`ci-ok` agregado** como único required check, com
   `needs: [lint, typecheck, test, migrations, rls, secrets-scan, audit]`.
6. **Job `migrations`**: Postgres efêmero (service container), aplica as 183 migrations
   do zero, roda `gen:types` e falha se `git diff --exit-code src/integrations/supabase/types.ts`
   sujar. Fecha R6 e a regra manual do `CLAUDE.md` de uma vez.
7. **Job `rls`**: religar os 9 arquivos pgTAP contra esse mesmo Postgres. Fecha R5.
8. **Guard de migration destrutiva**: script que varre o diff de `supabase/migrations/*.sql`
   procurando `DROP TABLE|DROP COLUMN|DROP POLICY|TRUNCATE|DISABLE ROW LEVEL SECURITY`,
   falha por padrão, e só passa com a repo variable `ALLOW_DESTRUCTIVE_MIGRATION=true`.
   Mais um teste que garante que o guard roda antes do `db push` (padrão
   `test_deploy_safety_contract.py`).
9. **`deno check` em `supabase/functions/**`** como gate. 47 funções sem nenhuma
   verificação de compilação hoje.
10. **`timeout-minutes` e `permissions` explícitos** em todos os jobs. Nenhum workflow
    do repo tem os dois (nem lá, mas o custo de corrigir é uma linha por job).

Critério de aceite: PR que quebra RLS, dessincroniza `types.ts`, ou dropa coluna sem
opt-in não consegue mergear.

### Fase 2: promoção e deploy previsíveis (1 a 2 dias)

11. **Trazer o `ci.yml` de staging para `main`** e desenhar o CD de prod com aprovação
    (o environment `Production` já tem required reviewer configurado).
12. **PR de promoção automática** `staging → main`, idempotente (cria ou comenta), com
    checklist de risco do domínio: migrations revisadas, RLS auditada, `gen:types`
    rodado, sem vuln high, portal cliente exercitado, valores conferidos no Financeiro.
13. **Smoke pós-deploy**: `curl -sf .../functions/v1/health` como job final do mesmo
    workflow, e comentário do resultado no PR de promoção. Simplificar `health` para
    liveness estático e mover o agregado db/asaas/resend para um endpoint separado
    (liveness e correção são coisas diferentes).
14. **Concurrency por ambiente** nos jobs de deploy, com `cancel-in-progress: false`
    (cancelar `db push` no meio é pior que esperar).
15. **Consertar o `e2e-staging.yml`**: hoje o `workflow_run` aponta para "Deploy Supabase",
    workflow deletado, e o `environment` está em minúscula. A suíte Playwright nunca rodou.
16. **`RELEASE_SHA` + sourcemap + release do Sentry** no build. Hoje todo stack trace de
    prod chega minificado e o health responde `version: "unknown"`.

Critério de aceite: promover para prod é aprovar um PR; o deploy prova que respondeu.

### Fase 3: fronteira de dados e config (2 a 3 dias)

17. **`src/lib/env.ts` com zod**, único lugar do app que lê `import.meta.env`, validado
    no boot, com todas as chaves no `.env.example` (faltam `VITE_TURNSTILE_SITE_KEY`,
    `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`) e um `VITE_APP_ENV` para o app finalmente
    distinguir staging de prod. Análogo em `supabase/functions/_shared/env.ts`.
    Eliminar os casts `as string` sem validação.
18. **Teste de paridade de ambiente**: staging e prod têm exatamente o mesmo conjunto de
    chaves, valores diferentes. Mata a classe de bug que já aconteceu aqui.
19. **Inventário versionado de secrets de Edge Function** (nomes, nunca valores) e um
    step de pré-deploy que checa existência no projeto alvo antes de deployar.
20. **Piso de cobertura por branch de destino**, começando por módulo em vez de global:
    `src/pages/financeiro/**` primeiro, que é onde vive o cálculo de dinheiro.
    Instalar `@vitest/coverage-v8` (hoje ausente, então nem se mede).
21. **`eslint .` com `--max-warnings=0`**: hoje `no-console` e `no-unused-vars` são warn
    e o CI não reprova.

Critério de aceite: falta de env var derruba o boot com o nome da chave, não gera
`undefined/functions/v1/...` em runtime.

### Fase 4: higiene contínua (meio dia, depois automático)

22. Dependabot ou Renovate agrupado por semana. Sem isso o gate de `audit` fica vermelho
    por acumulação até alguém desligá-lo (é exatamente o que está acontecendo).
23. Deletar `bun.lockb` (morto desde 2025-12-01, o CI usa npm). Dev que rode `bun install`
    instala um grafo diferente do que o CI valida.
24. `CODEOWNERS`, `PULL_REQUEST_TEMPLATE.md`, `SECURITY.md`. Nenhum existe.
25. Resolver a colisão de ADR 0006 (`docs/adr/` vs `docs/architecture/adr/`) e consolidar
    numa pasta só. Adotar o cabeçalho com grafo de decisão (`Status` / `Supersedes` /
    `Amended by`) e citar ADR por número dentro do código, como lá se faz no Terraform.
26. `required_approving_review_count` em staging é 0 hoje. Decidir se é intencional para
    time de um.

---

## 4. Traduções dos padrões AWS para o nosso stack

| Padrão lá | Equivalente aqui |
|---|---|
| `workflow_run` + filtro de branch + `if conclusion == success && event == push` | igual, trocando `terraform apply` por `supabase db push` + `functions deploy` |
| Guard de plano destrutivo sobre `terraform show -json` | grep no diff das migrations novas, com opt-in por repo variable |
| pydantic-settings com `Literal` | zod com `z.enum` em `env.ts`, parse no boot |
| Secret shell no Terraform, valor por CLI | `supabase secrets set`, valor nunca em `config.toml`, inventário de nomes versionado |
| Data source SSM falhando o plan (ordem de deploy) | step de pré-deploy que checa a existência dos secrets/migrations esperadas e sai não-zero |
| Span processor detectando regressão de custo em runtime | wrapper nas Edge Functions `ai-*` gravando em `ai_usage_logs` e emitindo warn quando tokens por chamada saem de faixa |
| CloudWatch como dead-man switch do Logfire | Checkly (já configurado em `checkly.config.ts`, deploy manual hoje) como camada independente do Sentry |
| Marker `eval` com snapshot offline e `EVAL_LIVE=1` | `describe.skipIf(!process.env.EVAL_LIVE)` para as features de IA, projeto Vitest separado |
| Compilar no runtime de destino | `deno check` nas Edge Functions com a versão que o Supabase roda; Node pinado em `engines` |

## 5. O que não copiar

- **Ausência de `timeout-minutes`**: nenhum dos 12 jobs do plg tem. Um job travado
  consome as 6h default.
- **Frontend fora do CI**: no `labrynth-platform` nenhum job toca `frontend/`. Aqui o
  front já é coberto, não regredir.
- **Deploy sem gate humano**: os dois repos abriram mão do required reviewer por causa da
  trust policy OIDC pinada em branch. Nós não temos essa restrição, o environment
  `Production` já tem reviewer. Manter.
- **Segurança report-only**: `detect-secrets`, ASH e Trivy rodam com
  `continue-on-error: true` no platform. Aqui o gitleaks já bloqueia. Manter bloqueante.
- **Documentação obrigatoriamente em inglês** (regra D17 da skill): aqui a decisão é
  PT-BR em UI e docs, inglês em commits/branches/PRs. Divergência consciente.

## 6. Achado colateral

`.gitleaksignore` tem duas fingerprints de `.env` (`b1236fbc...`, `d3accb7d...`) e
`git log --all -- .env` mostra 3 commits. O segredo foi **suprimido do scanner, não
removido do histórico**: segue recuperável por qualquer clone, e o scanner nunca mais
vai avisar. Decidir entre rotacionar a chave (mais simples) ou reescrever o histórico.
