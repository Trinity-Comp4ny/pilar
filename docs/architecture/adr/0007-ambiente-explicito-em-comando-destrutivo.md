# ADR 0007: Exigir ambiente explícito em todo comando que muta banco ou funções

**Data:** 2026-07-25
**Status:** Accepted

## Contexto

`supabase/config.toml` declarava `project_id = "vepnsonbnsimqcsfcagm"`, o ref de
**produção**. Consequências reais:

- `supabase db push` e `supabase functions deploy` sem `--db-url`/`--project-ref`
  aplicavam no banco dos clientes. É o comando mais curto e mais natural de digitar.
- `npm run gen:types` (o comando que `CLAUDE.md` e `CONTRIBUTING.md` mandam rodar
  depois de qualquer migration) tinha o ref de prod hardcoded no `package.json`.
  Depois de uma migration aplicada só em staging, o comando padrão gerava tipos do
  banco errado.
- A armadilha era conhecida e documentada em prosa (`STAGING_SETUP.md:32-34`,
  "Nunca rode `db push` sem alvo explícito"), mas nada no repo a impedia.

Não há rollback barato: uma migration errada em prod só volta por PITR, com perda de
tudo desde o snapshot. Aviso em documento não é controle.

Opções consideradas:

- **A. Manter prod no `config.toml` e reforçar a documentação.** Custo zero, eficácia
  zero: era exatamente o estado anterior, e a documentação já avisava.
- **B. Remover `project_id` do `config.toml`.** Faz o comando "pelado" falhar, mas
  quebra `supabase start` e outros fluxos locais que leem o arquivo.
- **C. Apontar `config.toml` para staging e canalizar todo comando destrutivo por um
  wrapper com ambiente obrigatório.** O erro por reflexo passa a cair em ambiente
  descartável, e o caminho para prod exige nomear a intenção.

## Decisão

Adotar a opção C.

1. `supabase/config.toml` aponta para o ref de **staging** (`rizaklgstyfrwgmdsldf`),
   com o motivo e a data no próprio arquivo.
2. Todo comando que muta banco ou funções passa por `scripts/supabase-target.sh`, que
   exige a ação e o ambiente como argumentos posicionais e recusa qualquer valor fora
   de `staging|prod`.
3. Produção exige opt-in nomeado `ALLOW_PROD_DB_PUSH=true`. Gerar tipos é leitura e
   está isento do opt-in.
4. Os scripts do `package.json` deixam de ter ref hardcoded. `gen:types` passa a
   apontar para staging (default seguro); prod é `gen:types:prod`.

```bash
npm run db:push:staging                          # aplica migrations em staging
ALLOW_PROD_DB_PUSH=true npm run db:push:prod     # produção, intenção nomeada
npm run gen:types                                # tipos de staging
```

O CI não muda de mecanismo: `deploy-staging` e `deploy-production` (`.github/workflows/ci.yml`)
já passavam `--db-url` e `--project-ref` explícitos vindos dos GitHub Environments, e
continuam sendo o único caminho automatizado.

## Consequências

**Positivas:**

- O erro mais caro possível no repo (migration não testada em prod por comando digitado
  por reflexo) deixa de ser alcançável sem nomear a intenção.
- `gen:types` volta a ser correto por default depois de migration em staging, o que
  ataca a causa do `types.ts` dessincronizado.
- Ambiente errado falha antes de tocar em qualquer coisa, com mensagem que diz o que fazer.
- A escrita de `types.ts` passa a ser atômica: falha de rede não trunca mais o arquivo.

**Negativas:**

- Quem tinha `npm run gen:types` na memória muscular agora gera de staging. Se estava
  querendo prod, o arquivo muda de conteúdo sem erro. Mitigação: os dois ambientes têm
  o mesmo schema quando o pipeline está saudável, e divergência é justamente o que a
  Fase 1 do plano vai detectar no CI.
- Uma indireção a mais entre a pessoa e a CLI. O script é 70 linhas sem dependência.
- `ALLOW_PROD_DB_PUSH=true` é fácil de virar hábito colado no histórico do shell. Não
  substitui aprovação: o gate real de prod é o required reviewer do GitHub Environment
  `Production`.

## Decisões relacionadas

- [ADR 0001](./0001-arquitetura-multi-tenant.md): o dado que a migration errada atinge
  é multi-tenant, então o raio de alcance de um push errado é toda a base de clientes.
- `docs/operations/PLANO_ENGENHARIA_2026-07.md`: esta é a Fase 0, item 1. A Fase 1
  adiciona os gates de CI (migrations em banco efêmero, pgTAP de RLS, guard de
  migration destrutiva) que cobrem o que um wrapper local não cobre.
- `docs/operations/STAGING_SETUP.md`: o aviso em prosa que este ADR converte em controle.
