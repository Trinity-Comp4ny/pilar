# Plano de engenharia 2026-10: de "ferramenta existe" para "gate que segura"

**Data:** 2026-10-07  
**Origem:** três análises externas (testes, arquitetura, check-up geral) conferidas
contra o código real de `staging`. Este documento registra o que procede, o que não
procede e a ordem de ataque. Sucede o [PLANO_ENGENHARIA_2026-07](./PLANO_ENGENHARIA_2026-07.md)
(fases 0 e 1 concluídas). Decisão de estratégia: [ADR 0045](../architecture/adr/0045-gate-de-qualidade-e-catraca-e2e-em-pr-contra-banco-local.md).

## Resumo em uma linha

O stack está certo e não precisa de migração; o problema é que vários controles
existiam sem reprovar nada. A onda 1 transforma esses controles em catraca e põe o
E2E antes do merge.

## 1. Medição real (07/10)

| Item                             | Medido                                                            |
| -------------------------------- | ----------------------------------------------------------------- |
| Edge Functions                   | 45 (+ `_shared` com 20 arquivos)                                  |
| Edge Functions com teste         | 7 de 45                                                           |
| `ai-chat/index.ts`               | 69 KB num arquivo                                                 |
| Testes Vitest                    | 90 arquivos, 893 testes, 17 s                                     |
| Cobertura `src/lib`              | 72% linhas                                                        |
| Cobertura `src/pages/financeiro` | 4% linhas (tela; coberta por E2E)                                 |
| pgTAP                            | 46 suítes                                                         |
| E2E Playwright                   | 48 testes do app passando contra banco local                      |
| ESLint, regras de design system  | 68 ocorrências legadas (eram `warn`)                              |
| Knip                             | 39 arquivos mortos, 21 dependências sobrando, 272 exports sem uso |
| Crons com monitor no Sentry      | todos os SQL; só 1 de 3 disparados por Edge Function              |

## 2. O que as análises acertaram

- E2E só depois do merge, cobertura sem piso, design system sem enforcement, nenhum
  controle de código morto, Edge Functions quase sem teste, `ai-chat` monolítico.
- DR: RPO de 24 h (backup noturno, sem PITR no plano free) e Storage sem backup.
- k6 existe em `tests/load/` mas não roda em lugar nenhum. Checkly está configurado
  (`checkly.config.ts`) sem workflow de deploy e com `alertChannels: []`.
- Não migrar para Next.js nem sair do Supabase: concordo, nada no repo pede isso.

## 3. O que não procede (ou está desatualizado)

| Afirmação                                                 | Realidade                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Status page não existe"                                  | Existe em `/status` (SPEC 055). O DR doc é que está velho.                                                                                                                                                                                                                                                     |
| "Você já tem Playwright protegendo os fluxos"             | Os specs logados eram **pulados em todo push** desde setembro: o spec de a11y da landing falhava antes. Dois apodreceram sem ninguém ver. Este foi o achado mais grave.                                                                                                                                        |
| "`_shared` virou depósito de dezenas de arquivos"         | São 20 arquivos com nome claro. Subpasta seria cosmético; não é prioridade.                                                                                                                                                                                                                                    |
| Layout `functions/jobs/...`, `functions/integrations/...` | O Supabase só reconhece função em pasta de primeiro nível. Organização por domínio aqui é convenção de prefixo (`pilar-*`, `portal-*`, `invite-*`, `ai-*`), que o repo já segue.                                                                                                                               |
| "Consolidar as 45 funções em 10 a 15 com Hono" como P1    | Renomear função muda URL: webhooks cadastrados no Asaas e no Resend, auth hook, `functions.invoke` no front, `verify_jwt` por função no `config.toml`, crons com URL fixa. O ganho (cold start) não aparece no volume atual. Fazer só ao mexer no domínio; o melhor candidato é billing (5 funções `pilar-*`). |
| Storybook como P1                                         | Custo de manutenção alto para time de uma pessoa. O problema real (regra só no documento) foi resolvido com lint em erro + catraca. Regressão visual entra via Playwright no job local (onda 2).                                                                                                               |
| Reconciliação de billing e AI evals como P0               | Zero pagante e Asaas de produção ainda desligado; idempotência de webhook já tem pgTAP (`webhook_idempotency.sql`). Vira P0 no dia em que a cobrança ligar.                                                                                                                                                    |
| "Falta painel de jobs"                                    | Sentry Crons já monitora os crons SQL (ADR 0036). Faltava nos disparados por Edge Function: corrigido na onda 1.                                                                                                                                                                                               |

## 4. Onda 1: feita (PR deste documento)

1. **E2E em todo PR** (job `e2e-local`, dentro do `CI OK`): Supabase local no runner,
   migrations do PR, seed, build, specs sem login + logados. Local: `npm run test:e2e:local`.
2. **Job E2E de staging conserta o pulo**: specs logados rodam mesmo se um sem login
   falhar (`!cancelled()`); a11y da landing virou projeto `marketing`, informativo.
3. **Dois specs logados consertados** (fluxo "Novo lançamento" → Receita; seed da
   Empresa Dev com `nivel_override = 'ouro'` para não bater no limite de trial).
4. **Piso de cobertura** por pasta no `vite.config.ts`; CI roda `test:coverage`.
5. **Design system e `no-console` em `error`** com supressão das ocorrências legadas.
6. **Knip** com config do repo e catraca (`npm run check:dead-code`).
7. **Catraca de teste de Edge Function** (`TEST_DEBT.txt`): função nova nasce com teste.
8. **`withCronMonitor`** no `_shared/sentry.ts`, aplicado em `trial-expiry-cron` e
   `retencao-pos-trial` (com teste Deno).
9. **CodeQL** (`codeql.yml`): SAST de JS/TS e dos workflows, informativo até a triagem.

Pendência operacional da onda 1: confirmar no Sentry (Insights > Crons) que os
monitores `trial-expiry-daily` e `retencao-pos-trial-daily` aparecem depois da
primeira execução em staging; se o Sentry não criar sozinho, criar com o schedule do
pg_cron (`0 7 * * *` e `30 7 * * *`, UTC).

## 5. Onda 2: próximas duas semanas

Cada item com critério de pronto. Ordem = ordem de ataque.

1. **Teste das Edge Functions de dinheiro e auth**: `pilar-checkout-webhook`,
   `asaas-webhook`, `pilar-token-pack-create`, `ativar-plano`, `delete-user`,
   `create-company-owner`. Padrão: extrair a regra do `index.ts` para módulo vizinho e
   testar com `deno test`. Pronto: `TEST_DEBT.txt` cai de 38 para 32.
   **Feito (PR #515).** De bônus: `delete-user` passou a checar o papel do alvo.
2. **Um spec E2E de criação por módulo ativo** no job local: cliente, lead → proposta,
   projeto → escopo/aditivo, convite de membro, portal do cliente logado (seed de
   usuário de portal). Pronto: cada módulo ativo do CLAUDE.md tem 1 fluxo de escrita.
   **Parcial (PR #517):** cliente, lead, proposta e portal logado; projeto e receita
   já existiam. Faltam aditivo e convite de membro (convite manda e-mail de verdade
   em staging, precisa de destino descartável antes). Achou bug de código de
   proposta duplicado.
3. **Regressão visual** com `toHaveScreenshot` em 5 telas (início, quadro de projetos,
   lançamentos, detalhe do projeto, portal), baseline gerada no runner Linux com dado
   fixo do seed. Pronto: mudança de CSS que desloca layout reprova o PR.
   **Feito (PR #518):** 6 telas (inclui Início no celular). Provado com sonda: sidebar
   24px mais larga reprova 4 telas. Limite absoluto de 100 pixels, não 1% da tela.
   Bugs visuais vistos ao montar e ainda abertos: valor do `KPICard` passa por baixo
   do ícone (Lançamentos), nome do cliente e prazo estouram os cards do detalhe do
   projeto a 1280px.
4. **Acessibilidade da landing**: corrigir contraste (decisão de marca, 84 nós) e
   tirar o `continue-on-error` do passo `marketing`.
   **Feito (2026-10-08), sem mudar a marca:** o contraste nunca foi o problema. O spec
   usava `reducedMotion` no `test.use`, opção ignorada pelo Playwright; a emulação não
   ligava e o Axe media as palavras da StatementSection ainda apagadas (opacidade
   0,16). Com `contextOptions`, a landing passa sem violação critical/serious, e o
   passo voltou a ser bloqueante.
5. **Triagem da primeira varredura do CodeQL**; decidir se entra no `CI OK`.
6. **Checkly**: ligar de verdade (canal de alerta + deploy) ou apagar a config. Config
   que não roda dá a impressão de monitoramento que não existe.
   **Feito (2026-10-08):** Checkly removido; os mesmos checks rodam a cada 30 min no
   workflow `monitor-producao.yml`, com alerta por issue (ver monitoring/synthetic-tests.md).
7. **Backup do Storage** (buckets de entregas, fotos de obra) no `backup-nightly.yml`.
   **Feito (PR #519):** `scripts/storage-backup.mjs` + passo no `backup-nightly.yml`,
   restore documentado em DISASTER_RECOVERY.md. Depende de copiar
   `SUPABASE_ACCESS_TOKEN` e `SUPABASE_PROJECT_REF` para o environment
   `production-automation`.

## 6. Onda 3: próximo mês

- **Quebrar o `ai-chat`** (já no BACKLOG, Fase 1): antes, testes do roteamento de
  intenção e dos schemas, para o split ser verificável.
- **Catálogo das Edge Functions**: tabela gerada (nome, gatilho, auth, segredos, teste)
  no lugar de reorganizar pastas. Consolidar billing num roteador quando mexer nele.
- **Front por domínio, sem big bang**: ao tocar num módulo, levar hooks/lib exclusivos
  dele para dentro de `src/pages/<modulo>/`. Rotas do `App.tsx` por módulo (ADR 0016).
- **Limpeza do Knip** (39 arquivos, 21 dependências) e baixar o baseline.
  **Feito (2026-10-08):** 39 arquivos e 22 dependências removidos; baseline de arquivos e
  dependências em zero (qualquer um novo reprova). Exports e tipos sem uso (169 e 103)
  ficam para limpar quando tocar no módulo.
- **Subir os pisos de cobertura** a cada módulo que ganhar teste.

## 7. Onda 4: quando houver cliente pagante

PITR (plano Pro), reconciliação Pilar × Asaas, k6 semanal em staging com histórico de
p95, SLOs com alerta, AI evals do `ai-chat`, DPIA (financeiro, portal, IA), FinOps
(custo por empresa), SBOM por release, React 19 e Vite 8 (com a suíte E2E já
protegendo a atualização).

## 8. O que já está bom e é para manter

CI com guard de migration destrutiva, migrations do zero + pgTAP em todo PR, `types.ts`
em sync, gitleaks, `npm audit`, actions pinadas por SHA, Dependabot com cooldown,
`deno check` com catraca, deploy por ambiente explícito (ADR 0007), smoke de health pós
deploy, Sentry em 44 de 45 funções, backup noturno criptografado com drill de restore,
ADRs e specs como prática.
