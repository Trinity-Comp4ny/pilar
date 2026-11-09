# SPEC 125: Telemetria de produto e erros para os agentes

**Data:** 2026-10-15
**Status:** Draft
**Autor:** Matheus Rezende
**Módulo:** cross-cutting (analytics, monitoring, landing)
**Relacionada:** [SPEC 098](098-instrumentacao-eventos-de-produto.md) (eventos de ativação), [SPEC 126](126-time-de-agentes-no-ultra.md) (time de agentes), [SPEC 105](105-golden-signals-slos-e-status-page.md) (sinais de saúde), [ADR 0027](../architecture/adr/0027-sentry-metrics-e-agent-replay-completo.md), [ADR 0053](../architecture/adr/0053-conteudo-de-prompt-no-sentry-so-em-dev.md)

## Problema

Os agentes de Produto, Qualidade e Marketing (SPEC 126) só são tão bons quanto o que
conseguem ver, e hoje veem pouco:

- PostHog tem 31 eventos nomeados e o `$pageview` com módulo, mas `autocapture` e
  replay estão desligados. Não dá para saber onde o usuário trava: clique sem efeito,
  clique repetido de raiva, formulário abandonado, erro exibido em toast, busca vazia.
- Feature nova entra sem plano de medição. Ninguém sabe, 14 dias depois, se foi usada.
- A landing só emite `landing_cta_clicked`. Não há início de cadastro, profundidade de
  rolagem, Core Web Vitals nem experimento A/B.
- Sentry agrupa erro do Supabase por rota + status. Quando a sessão de um usuário
  vence numa tela que carrega 19 endpoints, nascem 19 issues. Em 15/10/2026 as 20
  issues abertas em produção vinham de 1 usuário, numa janela de 2 h, todas 401 em
  `/projetos`. O ruído esconde o erro real.

## Objetivo

Toda pergunta de produto que o fundador faz ("a feature X pegou?", "onde o usuário
desiste do cadastro?", "qual erro está atingindo mais escritórios?") tem resposta num
insight do PostHog ou numa busca do Sentry, e os agentes leem a mesma resposta.

**Fora de escopo:** group analytics pago do PostHog (o `empresa_id` já vai registrado
em todo evento); data warehouse; tracking server-side com `posthog-node` nas edges
(o banco já registra cobrança e cadastro).

## Requisitos

### Produto (app)

1. Sinais de fricção no PostHog, só com consentimento de analytics:
   - `rageclick` e dead clicks ligados;
   - `autocapture` ligado só para cliques em `button`, `a` e `[data-ph]`, sem capturar
     texto do elemento (`mask_all_element_attributes`, `mask_all_text`);
   - replay de sessão com amostra de 10% (100% nas sessões com `erro_exibido`), com
     `maskAllInputs` e `maskTextSelector: "*"`. A tela vai sem conteúdo, só layout,
     clique e navegação, igual ao replay do Sentry (`OPCOES_REPLAY`).
2. Eventos de fricção novos:
   - `erro_exibido { tela, codigo, origem }` disparado pelo `useToast` quando a variante é
     de erro (um ponto só, não em cada tela);
   - `formulario_abandonado { formulario, campos_preenchidos }` no `FormDialog` fechado
     com campo sujo e sem salvar;
   - `busca_sem_resultado { tela }` no `DataTable` com filtro ativo e zero linhas;
   - `estado_vazio_visto { tela }` no componente de estado vazio padrão.
3. Feature nova é medida por contrato:
   - toda SPEC nova ganha a seção "Telemetria" (template atualizado) com o evento de uso,
     o funil e a meta de adoção em 14 dias;
   - feature que vai para todos passa por feature flag do PostHog durante o rollout, e a
     exposição (`$feature_flag_called`) vira a base do funil de adoção;
   - o agente Produto lê a seção "Telemetria" das SPECs entregues e cobra a medição em
     7, 14 e 30 dias.
4. Onboarding vira funil: `onboarding_passo { passo, ordem }` em cada etapa do
   `CompanySetup` e do checklist guiado.

### Landing (`apps/marketing`)

5. `cadastro_iniciado` no primeiro foco do formulário de cadastro, `cadastro_erro
{ campo }` em validação recusada, e `scroll_profundidade { pct: 25|50|75|100 }`.
6. Core Web Vitals reais (`capture_performance: { web_vitals: true }`) na landing e no
   app.
7. UTM persistida do primeiro toque ao cadastro (já existe em
   `raw_user_meta_data.origem`) e registrada como propriedade de pessoa no PostHog
   (`$set_once: { utm_source, utm_campaign, utm_content }`), para cruzar canal com
   retenção.
8. Experimento A/B do hero e do CTA por feature flag do PostHog, um por vez, com meta
   em `cadastro_iniciado`.

### Erros (Sentry)

9. Sessão vencida se recupera sozinha e, se não recuperar, vira 1 issue:
   - o retry do `supabaseFetch` após `refreshSession()` reenviava o `init` com o token
     vencido (o supabase-js põe o `Authorization` antes do fetch), então "JWT expired"
     nunca se recuperava. O retry passa a trocar o Bearer pelo token renovado;
   - 401 agrupa por código, sem a rota (`["supabase", "auth", "401", code]`), com a
     rota na tag. 403 continua por rota + status, porque cada tabela negada é um bug
     diferente;
   - as issues de 15/10 são resolvidas na mesma PR; o que restar fica aberto só se for
     bug real.
10. Toda issue leva as tags `empresa_id` (já existe), `plano`, `nivel_trial` e `modulo`,
    para o agente Qualidade ordenar por escritórios afetados.
11. Alertas do Sentry: issue nova afetando 2+ empresas em 1 h; regressão de issue
    resolvida; taxa de sessão sem crash abaixo de 99,5% em 24 h. Os três entram como
    job do agente Qualidade (SPEC 126, requisito 9).
12. O feedback do Sentry (`beforeSendFeedback`) já vai para `feature_suggestions`
    (SPEC 112); o agente Clientes liga o feedback à issue pelo `replay_id` quando houver.

### Leitura pelos agentes

13. Edge interna `ops-coleta-produto` (cron diário 06h30) consulta PostHog (HogQL com
    chave pessoal só de leitura, `POSTHOG_PERSONAL_API_KEY`) e Sentry (token só de
    leitura, `SENTRY_READ_TOKEN`) e grava agregados em `ops_metricas_diarias` com fonte
    `posthog` ou `sentry`. Nenhum dado pessoal sai do agregado.

Requisitos não-funcionais:

- **Privacidade:** nada novo dispara sem consentimento de analytics. Replay mascara todo
  texto e campo. Nenhuma propriedade carrega valor monetário, CPF ou CNPJ (o `scrub()`
  continua no caminho de todo evento).
- **Performance:** replay do PostHog carregado sob demanda, fora do bundle inicial, como
  o do Sentry.
- **Custo:** amostra de replay ajustável por env; o PostHog gratuito cobre o volume
  esperado até o lançamento. O agente Finanças acompanha o consumo depois.

## Critérios de aceite

- [ ] Dado um toast de erro exibido, então `erro_exibido` é capturado uma vez com a tela.
- [ ] Dado um `FormDialog` fechado com campo alterado e sem salvar, então
      `formulario_abandonado` é capturado.
- [ ] Dado um usuário sem consentimento de analytics, então nenhum evento, replay ou
      web vital é enviado.
- [x] Dada uma resposta 401 PGRST303 por token vencido, quando a sessão renova, então a
      chamada é repetida com o token novo e não gera evento (`supabaseFetch.test.ts`).
- [x] Dadas respostas 401 PGRST303 em rotas diferentes, então o fingerprint é o mesmo;
      403 em rotas diferentes continua separado.
- [ ] Dado o template de SPEC, então ele tem a seção "Telemetria".
- [ ] Dado o primeiro foco no formulário de cadastro da landing, então
      `cadastro_iniciado` dispara uma vez por sessão.
- [ ] Dada a execução de `ops-coleta-produto`, então `ops_metricas_diarias` tem linhas de
      fonte `posthog` e `sentry` para o dia, e reexecutar não duplica.

## Dados e contratos

- Sem tabela nova (usa `ops_metricas_diarias` da SPEC 126).
- Segredos novos nas edges: `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`,
  `SENTRY_READ_TOKEN`.
- Chaves gravadas (exemplos): `posthog: adocao_feature:<flag>`, `posthog: funil_cadastro:<passo>`,
  `posthog: rageclick:<tela>`, `posthog: erro_exibido:<tela>`, `posthog: lcp_p75:<pagina>`,
  `sentry: issues_abertas`, `sentry: empresas_afetadas_24h`, `sentry: sessoes_sem_crash`.

## Telemetria

Esta spec é a própria telemetria. Meta: em 30 dias após o merge, o agente Produto
responde "a feature X pegou?" para as três últimas features entregues.

## Plano de implementação

1. Retry com token renovado + fingerprint do 401 + limpeza das issues de 15/10 (PR pequena, primeiro). Entregue junto com esta spec.
2. Tags extras no Sentry e alertas.
3. Fricção no PostHog (`erro_exibido`, `formulario_abandonado`, `busca_sem_resultado`,
   `estado_vazio_visto`) + rageclick + replay mascarado.
4. Landing: `cadastro_iniciado`, `cadastro_erro`, rolagem, web vitals, UTM em pessoa.
5. Template de SPEC com "Telemetria"; flags de rollout.
6. `ops-coleta-produto` (depende da SPEC 126 fase 0).

## Decisões e riscos

- Replay no PostHog além do Sentry: o do Sentry só grava sessão com erro; o do PostHog
  mostra a sessão que travou sem erro (o usuário desistiu). Os dois mascaram tudo.
- Risco: `autocapture` amplo vira ruído e custo. Mitigação: restrito a `button`, `a` e
  `[data-ph]`, sem texto.
