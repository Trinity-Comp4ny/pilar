# SPEC 126: Time de agentes no Ultra

**Data:** 2026-10-15
**Status:** Em implementação (fase 0 na #641; fase 1 em PR próprio; ingestão do post-automation e fases 2 e 3 pendentes)
**Autor:** Matheus Rezende
**Módulo:** ultra-admin + edge functions (operação da Pilar)
**Relacionada:** [SPEC 117](117-portal-ultra-admin-na-sidebar.md) (portal Ultra), [SPEC 125](125-telemetria-de-produto-e-erros.md) (telemetria que alimenta os agentes), [SPEC 113](113-avisos-do-ultra-admin-por-email.md) (aviso por e-mail), [ADR 0060](../architecture/adr/0060-agentes-de-operacao-medem-no-pilar-publicam-fora.md), [ADR 0050](../architecture/adr/0050-agente-que-grava-rascunho-cita-evidencia.md), [ADR 0051](../architecture/adr/0051-modelo-de-ia-por-configuracao-com-gateway.md), [AGENTS_TEAM.md](../AGENTS_TEAM.md)

## Problema

A Pilar é tocada por uma pessoa e vai a público em janeiro de 2027 (data guia, ver
DECISOES.md 2026-10-15). Os dados para operar a empresa existem, mas estão espalhados:
cadastro e origem UTM no banco, assinatura no Asaas, uso no PostHog, erro no Sentry,
alcance das redes no banco do `post-automation`. Ninguém junta, ninguém avisa, e os
agentes de `.claude/agents/` só respondem quando chamados, sem ler dado real. O fundador
descobre tarde que um teste promissor venceu sem contato, que um cliente parou de entrar
ou que um post trouxe cadastros.

## Objetivo

O ultra admin abre "Time" no portal e, em um minuto, sabe como está cada área da empresa
(receita, clientes, marketing, produto, qualidade) e o que precisa decidir hoje. Cada área
tem um agente que roda sozinho, mede com número vindo do SQL, escreve o briefing e deixa
ações em rascunho numa fila única. Nada sai para cliente ou rede social sem aprovação.

**Fora de escopo:**

- Gerar, renderizar ou publicar post, carrossel ou vídeo. Isso vive no repo
  `post-automation` e no banco dele (ADR 0060). O Pilar só recebe o resumo.
- Envio por API do WhatsApp. A ação de WhatsApp abre `wa.me` com o texto pronto;
  quem envia é o fundador.
- Agente com autonomia N3 (envio sem aprovação). Fica para depois de medir a taxa de
  aprovação sem edição.
- CRM de prospecção outbound. Se vier, usa o próprio módulo Leads do Pilar numa empresa
  interna, em spec própria.

## O time

| Agente              | Missão em uma linha                                                 | Cadência                                                    | Fontes                                                                                           | Fase |
| ------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---- |
| Chefe de gabinete   | Junta as áreas, ordena a fila e manda o resumo do dia               | 07h10 diário, revisão segunda 08h                           | saída dos outros agentes                                                                         | 2    |
| Receita             | Fazer cada teste promissor virar pagante e nenhum pagamento escapar | 07h e 19h, e por evento (cadastro, checkout, atraso)        | `empresas`, `pilar_subscriptions`, `trial_niveis`, origem UTM do cadastro, eventos de ativação   | 1    |
| Clientes            | Manter cada escritório ativo, ouvido e com o problema resolvido     | 07h diário, e por evento (erro, feedback)                   | nota de saúde, `feature_suggestions`, Sentry por `empresa_id`, `email_envios`                    | 1    |
| Marketing           | Mostrar o que traz cadastro ativado, não curtida                    | resumo diário, revisão segunda                              | ingestão do `post-automation` (redes, anúncios, SEO), PostHog da landing, origem UTM até pagante | 2    |
| Produto e analytics | Dizer o que é usado, o que é ignorado e onde o usuário trava        | segunda 07h, e 7/14/30 dias após cada lançamento de feature | PostHog (SPEC 125), feedback, módulos por empresa                                                | 2    |
| Qualidade           | Ordenar erro por cliente afetado e não deixar regressão passar      | 07h diário, e por alerta do Sentry                          | Sentry (issues, regressões, `empresa_id`), `status_incidents`                                    | 2    |
| Finanças da Pilar   | MRR, custo de IA e infra, margem e fôlego de caixa                  | segunda                                                     | `pilar_subscriptions`, `ai_token_ledger`, custos informados                                      | 3    |

Regra de cada agente: a missão, as fontes, os indicadores e os tipos de ação ficam num
playbook em `docs/operacao/agentes/<agente>.md`. O prompt da edge é derivado dele, e o
agente de Claude Code da mesma área lê o mesmo arquivo.

## Requisitos

### Painel

1. O portal Ultra ganha o grupo "Time" no topo do painel lateral, acima de Plataforma,
   com os itens Central, Receita, Clientes, Marketing, Produto, Qualidade (e Finanças na
   fase 3). Cada item mostra um ponto de status (ok, atenção, falhou, pausado) e o número
   de ações pendentes.
2. `/ultra-admin/time` (Central) mostra: frase de abertura com o total de decisões e
   quantas vencem hoje; um cartão por agente (status, última e próxima execução, ações
   pendentes, indicador principal com variação); e a fila de decisões de todos os agentes,
   ordenada por prazo e prioridade.
3. `/ultra-admin/time/<agente>` segue um layout único (a ficha do agente):
   - cabeçalho: nome, missão, status, última e próxima execução, nível de autonomia,
     custo de IA em 30 dias, ações "Rodar agora" e "Pausar";
   - indicadores da área (sempre do SQL, com variação contra o período anterior);
   - briefing da última execução, em que cada afirmação abre a evidência;
   - abas Ações, Execuções e Configuração (horário, nível de autonomia por tipo de ação,
     modelo).
4. Indicadores por área (mínimo da fase em que o agente entra):
   - Receita: funil 30 dias (visitas da landing, cadastros, ativados, pagantes), novos
     pagantes no mês, MRR e variação, testes vencendo em 48 h, checkout iniciado sem
     pagamento, pagamentos em atraso, conversão por `utm_campaign`.
   - Clientes: empresas por faixa de saúde, empresas em risco (lista), sem acesso há 7+
     dias, feedback sem resposta há 24+ h, erros que afetaram cliente nas últimas 24 h.
   - Marketing: alcance e engajamento por rede (7 e 30 dias), visitas ao perfil e
     cliques no link, gasto, CPM, CPC e custo por cadastro ativado nos anúncios, sessões
     da landing por origem, conversão landing → cadastro, consultas do Google com
     impressões, CTR e posição, Core Web Vitals da landing.
   - Produto: adoção por módulo e por feature nova, funis de ativação, telas com mais
     erro exibido, cliques de raiva e abandono de formulário.
   - Qualidade: issues abertas por empresas afetadas, novas e regressões em 24 h, taxa
     de sessão sem erro, incidentes abertos.
5. Ação na fila: Aprovar, Editar e aprovar, Descartar (com motivo curto), e o executor
   conforme o tipo:
   - `email`: envia pelo módulo único de e-mail (ADR 0039) e registra em `email_envios`;
   - `whatsapp`: abre `https://wa.me/<telefone>?text=<texto>` e marca como enviada
     quando o ultra admin confirma;
   - `tarefa`: cria item interno na própria fila (N2 permitido);
   - `issue`: abre issue no GitHub com a evidência (fase 2);
   - `conteudo`: devolve a decisão ao `post-automation` (aprovar pauta, repetir ângulo).
6. Resumo diário por e-mail às 07h10 para o ultra admin (reusa `aviso-ultra-admin-email`):
   três prioridades do dia, números que mudaram e link para a Central.

### Agentes (runtime)

7. Um executor único (`ops-agente-run`) recebe o id do agente, calcula os sinais em SQL,
   chama o modelo pelo gateway (ADR 0051) só com sinais agregados e grava briefing e
   ações. Cron por `pg_cron` com `cronAutorizado` (ADR 0056), heartbeat em
   `agent_cron_heartbeats`.
8. Toda ação gravada cita a evidência recebida (ADR 0050). Ação sem evidência válida é
   descartada pelo executor antes de gravar.
9. Gatilhos por evento entram como job na fila existente (`jobs` / `claim_next_job`):
   novo cadastro, checkout iniciado sem pagamento em 2 h, pagamento em atraso,
   feedback novo, issue do Sentry nova afetando 2+ empresas.
10. Níveis de autonomia por tipo de ação: N0 observa, N1 rascunha e espera aprovação,
    N2 executa reversível e avisa, N3 autônomo. Na fase 1 todo envio externo é N1. O
    painel mostra, por tipo de ação, a taxa de aprovação sem edição; com 20 seguidas
    sem edição, sugere subir para N2 (a mudança é manual).

### Integração com o `post-automation`

11. `ops-ingest` recebe do `post-automation` um snapshot diário assinado (HMAC SHA-256
    no header `x-ops-signature`, segredo `OPS_INGEST_SECRET`), valida o shape na entrada
    e grava em `ops_metricas_diarias`. Payload repetido para a mesma data e fonte
    substitui o anterior (idempotente).
12. `ops-export-funil` devolve ao `post-automation`, com token próprio
    (`OPS_EXPORT_TOKEN`), cadastros, ativados e pagantes por `utm_source`,
    `utm_campaign` e `utm_content` por dia, sem nenhum dado pessoal. É o que permite ao
    bandit de conteúdo otimizar por cadastro ativado em vez de curtida.

### Não-funcionais

- **Segurança / RLS:** tabelas `ops_*` com RLS ligada; `SELECT` só para
  `has_role(auth.uid(), 'ultra_admin')`; escrita só pelo service role nas edges. Rotas
  atrás de `UltraAdminRoute` (papel + MFA aal2). As duas edges de integração não aceitam
  JWT de usuário.
- **LGPD:** o agente lê metadado de uso (acessos, contagens, erros, status de cobrança),
  nunca valor financeiro, cliente ou projeto do tenant. Para o modelo vai o agregado com
  nome do escritório e primeiro nome do contato. ROPA atualizado com a finalidade
  "relacionamento e suporte ao cliente".
- **Custo:** número sempre do SQL; modelo só sintetiza e escreve. Custo registrado no
  `ai_token_ledger` como plataforma, visível em Custos de IA e na ficha do agente. Teto
  mensal por agente em `ops_agentes.teto_mensal_brl`; acima dele o agente pausa e avisa.
- **Repo público:** prompt e playbook podem estar no repo; dado de cliente nunca.

## Critérios de aceite

- [x] Dado um ultra admin, quando abre `/ultra-admin/time`, então vê um cartão por agente
      ativo com status, última execução e ações pendentes.
- [x] Dado um usuário sem `ultra_admin`, quando consulta `ops_acoes` pela API, então
      recebe zero linhas (pgTAP com `SET ROLE authenticated`, não superuser).
- [x] Dado um cadastro novo com `utm_campaign=lancamento-2027-01`, quando o agente
      Receita roda, então a conversão daquela campanha conta 1 cadastro.
- [ ] Dada uma empresa em teste com 3+ projetos e vencimento em menos de 48 h, quando o
      agente Receita roda, então existe uma ação `whatsapp` pendente para ela com a
      evidência (projetos, vencimento).
- [ ] Dada uma ação gerada sem evidência, então o executor não grava e registra o
      descarte na execução.
- [ ] Dada uma ação `whatsapp` aprovada, quando o ultra admin clica, então abre `wa.me`
      com o texto aprovado e o telefone do contato.
- [ ] Dado um POST em `ops-ingest` com assinatura inválida, então responde 401 e não
      grava.
- [ ] Dado o mesmo snapshot enviado duas vezes, então `ops_metricas_diarias` tem uma
      linha por (data, fonte, chave, dimensão).
- [ ] Dado um agente que estourou o teto mensal, quando o cron dispara, então não chama
      o modelo, marca a execução como `pausada_teto` e avisa no resumo.
- [ ] Dado o resumo diário, então lista no máximo três prioridades e todas têm link
      para a ação correspondente.

## Dados e contratos

```sql
ops_agentes (
  id text primary key,              -- 'receita', 'clientes', 'marketing', ...
  nome text, missao text,
  ativo boolean, cron text, modelo text,
  autonomia jsonb,                  -- {"email":"N1","whatsapp":"N1","tarefa":"N2"}
  teto_mensal_brl numeric
)
ops_execucoes (
  id uuid, agente_id text, gatilho text,          -- 'cron' | 'evento' | 'manual'
  inicio timestamptz, fim timestamptz,
  status text,                                     -- 'ok' | 'falhou' | 'pausada_teto'
  sinais jsonb, briefing jsonb, descartes jsonb,
  tokens_in int, tokens_out int, custo_usd numeric, erro text   -- custo_brl na fase 0; USD como o ledger desde a fase 1
)
ops_acoes (
  id uuid, agente_id text, execucao_id uuid,
  tipo text,                                       -- 'email'|'whatsapp'|'tarefa'|'issue'|'conteudo'|'alerta'
  empresa_id uuid null, titulo text, rascunho jsonb, evidencia jsonb,
  prioridade smallint, prazo timestamptz,
  status text,                                     -- 'pendente'|'aprovada'|'editada'|'descartada'|'executada'|'falhou'
  editada boolean, motivo_descarte text,
  decidida_em timestamptz, executada_em timestamptz, resultado jsonb
)
ops_metricas_diarias (
  data date, fonte text,                           -- 'pilar'|'posthog'|'sentry'|'instagram'|'linkedin'|'x'|'meta_ads'|'gsc'|'psi'
  chave text, dimensao text default '',            -- ex. chave 'alcance', dimensao 'instagram:reels'
  valor numeric, recebido_em timestamptz,
  primary key (data, fonte, chave, dimensao)
)
```

- RPC `ops_saude_empresas()` (SECURITY DEFINER, prefixo de função interna só para o
  service role): nota 0 a 100 por empresa a partir de último acesso, semanas ativas nas
  últimas 4, módulos usados, projetos ativos, erros recentes, feedback sem resposta e
  atraso de pagamento. Pesos no playbook do agente Clientes, com teste.
- RPC `ops_receita(p_dias integer)` (entregue na fase 0, no lugar do `ops_funil`): cadastros,
  ativados, novos pagantes e o período anterior, MRR, testes vencendo, atrasos e conversão
  por UTM. As visitas da landing entram na fase 2, pelo snapshot do PostHog. Plano original:
  `ops_funil(p_desde date)`: visitas (do PostHog via snapshot), cadastros,
  ativados, pagantes, por origem UTM.
- Edge `ops-agente-run` `POST { agente_id, gatilho, contexto? }`.
- RPC `ops_decidir_acao(p_acao_id, p_decisao, p_texto?, p_motivo?)` (fase 1, no lugar da edge
  `ops-acao`): `enviada` grava o texto final e se foi editado; `descartada` guarda o motivo.
  Envio de WhatsApp é o próprio `wa.me`, então não precisa de edge.
- RPC `ops_definir_agente_ativo(p_agente_id, p_ativo)`: Pausar e Retomar da ficha.
- Edge `ops-ingest` `POST { fonte, data, metricas: [{ chave, dimensao, valor }] }`.
- Edge `ops-export-funil` `GET ?desde=YYYY-MM-DD`.

## Plano de implementação

Fase 0, antes de qualquer LLM (semanas de 20/10 e 27/10):

1. [x] Tabelas `ops_*` + RLS + pgTAP; `ops_saude_empresas` e `ops_receita` com teste
       (`supabase/tests/time_de_agentes.sql`).
2. [x] Grupo "Time" no `ultraAdminNav.ts`; Central e fichas Receita e Clientes só com
       indicadores do SQL; fila de decisões por regra (teste vencendo, atraso, sem acesso há
       7+ dias, feedback parado) com link `wa.me` e texto pronto; fichas dos outros agentes
       mostram o que vão medir. Playbooks em `docs/operacao/agentes/`.
3. [ ] Resumo diário por regra (sem modelo) no e-mail do ultra admin. Passa para a fase 1,
       junto com o executor, porque precisa de cron e da mesma regra da fila.

Fase 1 (novembro):

4. [x] Edge `ops-agente-run` (cron por segredo ou "Rodar agora" do ultra admin): Receita
       (7h e 19h) e Clientes (7h05) calculam os fatos pelas mesmas RPCs da tela, escolhem os
       candidatos por regra (`regras.ts`), pedem ao modelo só briefing e rascunho, aterram a
       resposta em código (referência inexistente e texto com preço, desconto, porcentagem ou
       link são descartados) e gravam ações pendentes com chave natural (sem duplicar entre
       execuções). Sem modelo, ou acima do teto mensal (R$ 30 por agente), roda só com regra.
5. [x] Chefe de gabinete (7h10, sem modelo): resumo do dia por e-mail aos ultra admins, com
       as três prioridades da fila e os números de Receita e Clientes.
6. [x] Tela: briefing da última execução, "Rodar agora", "Pausar"/"Retomar", histórico e
       custo em 30 dias; fila com Editar mensagem, Abrir no WhatsApp, Marcar como enviada e
       Descartar. Agente ligado traz as próprias ações; agente desligado segue com a regra
       da fase 0.
7. [ ] `ops-ingest` e `ops-export-funil` e o lado do `post-automation` (ver o plano de
       presença social naquele repo).
8. [ ] Custo dos agentes também no `ai_token_ledger`, para entrar em Custos de IA (hoje fica
       em `ops_execucoes.custo_usd` e na ficha do agente).
9. [ ] Eval do prompt dos agentes (ADR 0048) antes de trocar modelo ou prompt.

Fase 2 (dezembro): Marketing, Produto e Qualidade; briefing do Chefe com modelo; executor
`issue`.

Fase 3 (depois do lançamento): Finanças da Pilar; revisão de autonomia por tipo de ação.

## Decisões e riscos

- Fronteira entre repos e níveis de autonomia: [ADR 0060](../architecture/adr/0060-agentes-de-operacao-medem-no-pilar-publicam-fora.md).
- Risco: virar gerente de agente em vez de vender. Mitigação: a fase 0 não tem LLM e já
  entrega a maior parte do valor; revisão mensal desliga agente com aprovação baixa.
- Risco: nota de saúde errada gera mensagem constrangedora. Mitigação: N1 em todo envio
  e evidência visível antes de aprovar.
- Risco: métrica social por API depende de aprovação das redes (LinkedIn Community
  Management, X pago). Mitigação: o snapshot aceita fonte faltando, e o painel mostra
  "sem dado desde" em vez de zero.
