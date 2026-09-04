# SPEC 094: Limite de tokens por usuário e controle da equipe pelo admin

**Data:** 2026-09-04
**Status:** Proposta
**Autor:** Matheus (CEO) + Claude
**Módulo:** ia / billing (transversal), Configurações

> Estende [ADR 0035](../architecture/adr/0035-ledger-de-tokens-fonte-unica-de-uso-de-ia.md)
> e o motor de tokens já em produção ([SPEC 074](074-motor-de-tokens-ledger-saldo-e-debito.md),
> Fase 2 de enforcement, [SPEC 076](076-motor-de-tokens-superficies-de-cliente.md) de
> superfícies de cliente, [SPEC 085](085-token-anomalia-gasto-diario.md) de anomalia).
> Decisão de produto de 2026-09-04 (conversa registrada, não em DECISOES.md por ser
> detalhe de implementação, não direção de CEO): cap por usuário é teto opcional
> sobre o pool único da empresa, nunca um saldo separado.

## Problema

O gate de tokens hoje só enxerga a empresa: `gate_tokens(p_empresa_id)` lê e debita
`ai_token_saldo`, um pool único por empresa. O ledger (`ai_token_ledger`) já atribui
cada evento a um `user_id`, e a view `v_uso_tokens_por_usuario` já existe, mas nada
usa esse dado para **agir**. Resultado: um usuário sozinho pode consumir a cota
inteira do mês e travar a IA para o resto do time até a renovação (ou até a empresa
comprar pacote avulso), sem que o admin tenha visibilidade prévia nem qualquer
ferramenta para intervir.

Não existe hoje, para o admin da empresa:

- visão de quanto cada usuário consumiu no ciclo corrente;
- forma de travar o consumo de uma pessoa específica;
- canal para essa pessoa pedir mais, quando trava.

## Objetivo

O admin da empresa (ou coordenador com acesso de equipe concedido, ADR 0034) ganha
controle de segundo nível sobre o consumo de IA:

1. Vê o consumo de tokens de cada membro no ciclo corrente.
2. Pode, opcionalmente, definir um teto mensal de tokens por usuário.
3. Recebe e resolve pedidos de "mais tokens" de quem bateu o próprio teto.

O usuário comum vê o próprio consumo e o próprio teto (se houver), e quando o
bloqueia, tem um caminho de um clique para pedir mais ao admin, sem sair do produto.

**Fora de escopo:**

- Dividir a cota da empresa em fatias fixas por usuário. Rejeitado por design (ver
  "Decisões e riscos"): o cap é um teto de governança, não uma reserva.
- Cap para consumo sem usuário (`user_id NULL`: cron, guardião de margem, alertas
  ambient). Isso já não conta contra ninguém hoje; esta spec só confirma que
  continua assim.
- Qualquer mudança em `PRICING.md` ou em preço. Cap por usuário é ferramenta interna
  de gestão de equipe, não SKU, não aparece em copy de venda.
- Reativar agentes do IA Hub ou qualquer feature nova de IA. Esta spec só governa
  consumo do que já existe (chat, cotação, importação financeira, guardião de
  margem, etc.), qualquer `agent_key` novo cai automaticamente no mesmo modelo.

## Requisitos

### Funcionais

1. Existe `ai_token_limite_usuario` (`empresa_id`, `user_id`, `limite_mensal bigint`
   com `CHECK (limite_mensal > 0)`, `criado_por`, `updated_at`). PK composta
   `(empresa_id, user_id)`. **Ausência de linha = sem teto** (comportamento atual:
   consome livre do pool da empresa). Nenhum usuário nasce com uma linha; o admin
   cria uma só quando quer travar alguém.
2. `gate_tokens_usuario(p_empresa_id, p_user_id)`: roda em `ai-client.ts` logo após
   `verificarTokens` (gate de empresa), **só quando existe linha de limite para
   aquele usuário** (sem linha, retorna ok sem nenhuma query extra: zero custo no
   hot path para quem nunca configurou nada). Quando existe, soma o consumo do
   ciclo corrente (mesmo recorte `date_trunc('month', now())` do `gate_tokens`) via
   `ai_token_ledger` filtrado por `empresa_id + user_id + source='usage'` e compara
   contra `limite_mensal`.
3. Bloqueio distingue motivo, e o front usa o campo para escolher a mensagem certa:
   - saldo de empresa zerado (mensagem já existente: renovação ou compra de
     pacote);
   - teto pessoal batido (mensagem nova): "Você atingiu seu limite de tokens deste
     mês (usou {limite} de {limite}). Peça mais tokens ao administrador da sua
     empresa." com botão de ação "Pedir mais tokens".
     Saldo de empresa zerado tem prioridade de mensagem sobre teto pessoal batido (se
     os dois estourarem juntos, o problema real é da empresa, não da pessoa).
4. Falha de infraestrutura no gate por usuário segue a mesma postura do gate de
   empresa (fail-open, nunca quebra a resposta de IA; reporta ao Sentry com
   `empresa_id` e `user_id`).
5. `ai_token_solicitacao` registra pedido de mais tokens: `empresa_id`, `user_id`,
   `mensagem` (opcional, texto livre do usuário), `limite_sugerido` (opcional),
   `status` (`pendente` / `aprovado` / `negado`), `resolvido_por`, `resolvido_em`,
   `novo_limite` (o valor efetivamente aplicado, `NULL` quando a resolução remove o
   teto). Único pedido `pendente` por vez por usuário (`UNIQUE (empresa_id,
user_id) WHERE status = 'pendente'`), para o botão não virar canal de spam.
6. RPC `solicitar_mais_tokens(p_mensagem text DEFAULT NULL, p_limite_sugerido
bigint DEFAULT NULL)`: `authenticated`, insere o pedido em nome de
   `auth.uid()` e dispara `notificar()` para os destinatários de
   `_notif_gestao(empresa_id)` (categoria `financeiro`, mesmo canal já usado pelo
   alerta de saldo baixo da spec 076), com `link` apontando para a aba nova de
   Configurações. Chamada com pedido já pendente falha com mensagem clara (não
   cria um segundo).
7. RPC `resolver_solicitacao_tokens(p_solicitacao_id uuid, p_aprovar boolean,
p_novo_limite bigint DEFAULT NULL)`: só quem `can_manage_equipe()` (helper
   novo, ver requisito 8). Aprovar com `p_novo_limite` definido faz upsert em
   `ai_token_limite_usuario`; aprovar com `p_novo_limite = NULL` remove a linha
   (usuário fica sem teto); negar só fecha o pedido. Sempre grava
   `resolvido_por`/`resolvido_em`/`novo_limite` na solicitação.
8. `can_manage_equipe()`: função SQL nova, mesmo esqueleto de `can_view_financeiro()`
   (`20260904000000_equipe_metas_delegado_e_leads_safe.sql`): `true` para
   `current_effective_role() IN ('admin', 'ultra_admin', 'owner')` ou para
   `profiles.equipe_delegado` do usuário autenticado. RLS de
   `ai_token_limite_usuario` e `ai_token_solicitacao` usa esse helper (write); é a
   mesma régua que já governa a feature "pessoas" no front
   (`src/lib/permissions.ts`), agora também no banco.
9. RLS de `ai_token_limite_usuario`: SELECT = o próprio usuário vê **só o seu**
   registro; quem `can_manage_equipe()` vê o de toda a empresa.
   INSERT/UPDATE/DELETE só quem `can_manage_equipe()`. Nunca há policy de escrita
   para o próprio usuário (ele não define o próprio teto).
10. View `v_uso_tokens_usuario_ciclo` (`security_invoker = true`): `empresa_id`,
    `user_id`, `user_nome`, `tokens_ciclo` (soma de todos os agentes no mês
    corrente), `limite_mensal` (`LEFT JOIN` com `ai_token_limite_usuario`, `NULL` =
    sem teto). Fonte única tanto da tabela do admin quanto do "seu consumo" do
    usuário comum — herda a RLS do ledger mais a policy do requisito 9, sem
    duplicar regra.
11. UI, Configurações > Uso:
    - Aba nova "Equipe", visível só a quem `canDo(ctx, 'pessoas')` no front (mesma
      feature delegável já usada pelo módulo Pessoas): tabela (`DataTable`) com
      cada membro ativo, consumo do ciclo, teto (editável inline; "sem limite" por
      padrão, com opção de remover), e seção "Pedidos pendentes" com
      aprovar/negar. Aprovar abre o campo de novo limite pré-preenchido com
      `limite_sugerido` quando o usuário sugeriu um.
    - Quem não tem `pessoas` não vê a aba, mas vê o próprio consumo e teto (se
      houver) na aba "Uso" já existente, com o botão "Pedir mais tokens" quando
      estiver perto ou tiver batido o teto.
12. Consumo de sistema (`user_id NULL`) nunca entra no `SUM` do gate por usuário
    nem na tabela do admin como linha de "alguém" — a query do requisito 2 e a
    view do requisito 10 filtram `user_id IS NOT NULL` explicitamente. Continua
    contando normalmente contra o saldo da empresa.

### Não funcionais

- **Segurança / RLS:** nenhuma escrita em `ai_token_limite_usuario` ou
  `ai_token_solicitacao` fora de `can_manage_equipe()` (para a tabela de limite) ou
  do próprio `auth.uid()` (para criar a própria solicitação); usuário comum nunca
  lê teto de colega, mesmo via `curl` direto no Supabase — testar com `auth.uid()`
  real de dois usuários da mesma empresa, um admin e um comum.
- **Performance:** gate por usuário só executa quando existe linha de limite
  (a tabela tende a ficar pequena: só quem o admin travou). Índice
  `(empresa_id, user_id, source, created_at)` em `ai_token_ledger` cobre o `SUM`
  do ciclo tanto do gate quanto da view nova.
- **Multi-tenant:** mesmo padrão do ADR 0035: `empresa_id NOT NULL`, FK
  `ON DELETE CASCADE` em `empresas` e `profiles`.
- **Consistência de mensagem de erro:** segue o padrão da casa (CLAUDE.md): o que
  houve + próximo passo, sem culpar o usuário. "Você atingiu seu limite..." nunca
  "Você excedeu seu uso" ou qualquer tom de repreensão.

## Critérios de aceite

- [ ] Dado um usuário sem linha em `ai_token_limite_usuario`, quando ele consome
      tokens, então `gate_tokens_usuario` não executa nenhuma query e o consumo só
      é limitado pelo saldo da empresa (comportamento idêntico ao atual).
- [ ] Dado um usuário com `limite_mensal = 100000` e consumo do ciclo em 95000,
      quando ele faz uma chamada que soma 10000 tokens, então a chamada corrente é
      aceita (overdraft, mesma filosofia do gate de empresa) e a **próxima** chamada
      é bloqueada com o motivo `limite_usuario`.
- [ ] Dado saldo de empresa zerado **e** teto pessoal também batido, quando o
      usuário tenta uma chamada, então o motivo de bloqueio retornado é
      `saldo_empresa`, não `limite_usuario`.
- [ ] Dado um usuário sem pedido pendente, quando chama `solicitar_mais_tokens`,
      então uma linha `pendente` é criada e uma notificação chega para admin/owner
      da empresa (categoria `financeiro`, dedupe padrão de `notificar()`).
- [ ] Dado um usuário com pedido já `pendente`, quando chama `solicitar_mais_tokens`
      de novo, então a chamada falha com mensagem clara e nenhuma segunda linha é
      criada.
- [ ] Dado um admin resolvendo um pedido com `p_aprovar=true, p_novo_limite=500000`,
      quando a RPC roda, então `ai_token_limite_usuario` reflete o novo valor e a
      solicitação vira `aprovado` com `novo_limite=500000`.
- [ ] Dado um admin resolvendo com `p_aprovar=true, p_novo_limite=NULL`, quando a
      RPC roda, então a linha de limite do usuário é removida (ele fica sem teto).
- [ ] Dado um usuário comum (sem `can_manage_equipe()`), quando tenta
      `INSERT`/`UPDATE`/`DELETE` direto em `ai_token_limite_usuario` ou chama
      `resolver_solicitacao_tokens`, então a operação falha por RLS/permissão.
- [ ] Dado um usuário comum consultando `v_uso_tokens_usuario_ciclo`, quando o
      filtro é aplicado, então só vê a própria linha; um admin vê todas as linhas
      da empresa.
- [ ] Dado um evento do ledger com `user_id NULL` (ex.: guardião de margem via
      cron), quando o gate por usuário ou a view agregam dados, então esse evento
      nunca aparece atribuído a nenhuma pessoa.

## Dados e contratos

- Migrations: `ai_token_limite_usuario`, `ai_token_solicitacao`,
  `can_manage_equipe()`, `gate_tokens_usuario()`, `solicitar_mais_tokens()`,
  `resolver_solicitacao_tokens()`, view `v_uso_tokens_usuario_ciclo`, índice
  `(empresa_id, user_id, source, created_at)` em `ai_token_ledger`. Depois:
  `npm run gen:types` (staging) e commit do `types.ts` (gate `types-sync`).
- `verificarTokens` em `_shared/ai-client.ts` ganha uma segunda etapa
  (`verificarLimiteUsuario`) chamada com o `userId` já disponível na função (mesmo
  dado que hoje só alimenta `debitarTokens`); resposta 402 ganha campo `motivo:
'saldo_empresa' | 'limite_usuario'` para o front escolher a mensagem certa.
- Front: `UsoPanel.tsx` ganha aba "Equipe" (novo componente, ex.
  `EquipePanel.tsx`) usando `canDo(ctx, 'pessoas')` de `src/lib/permissions.ts`
  para decidir o que renderizar; hook novo `useUsoEquipe` lendo
  `v_uso_tokens_usuario_ciclo` e `ai_token_solicitacao` (pendentes).

## Plano de implementação

Proposto; aprovar antes de codar (plan mode).

1. Migration com as tabelas, helper `can_manage_equipe()`, RPCs e view, RLS
   endurecida (mesmo padrão de REVOKE/GRANT do restante do motor de tokens);
   testes pgTAP dos cenários de aceite (atenção ao achado já registrado: pgTAP
   como superuser não aplica RLS, testar via role `authenticated` real).
2. `gen:types:local`; `_shared/ai-client.ts` ganha `verificarLimiteUsuario` e o
   campo `motivo` na resposta 402; ajuste dos `ai-*` que já chamam
   `verificarTokens` para propagar o motivo ao front.
3. Antes de codar o gate: confirmar no código de impersonation
   (`_shared/audit.ts` e o fluxo de `current_effective_role`) se uma chamada de IA
   feita por suporte Pilar em modo impersonação grava `user_id` do agente de
   suporte (JWT real) ou do cliente impersonado. Se for o do cliente, este gate
   precisa excluir esses eventos do `SUM` por usuário (mesma classe do vazamento
   de dado financeiro sob impersonação já corrigido nesta branch).
4. Front: `EquipePanel.tsx`, `useUsoEquipe`, botão "Pedir mais tokens" no bloqueio
   402 com `motivo='limite_usuario'` (chat e demais telas que hoje tratam o 402 de
   saldo).
5. Deploy em staging (migration via CD); validar critérios com dado real: um
   usuário de teste com teto baixo, consumir até bloquear, pedir mais, aprovar
   pelo admin, confirmar que os outros usuários da empresa nunca foram afetados.

## Decisões e riscos

- **Rejeitado: dividir a cota da empresa em fatias fixas por usuário.** Motivo:
  o uso de IA é desigual por natureza entre papéis (financeiro/comercial usa
  IA o tempo todo, campo quase nada); dividir por N desperdiça token de quem usa
  pouco e exige realocação toda vez que a empresa contrata ou desliga alguém.
  O teto opcional sobre pool único evita os dois problemas.
- **Suposições assumidas nesta spec, a confirmar antes de codar** (o CEO não
  fechou explicitamente estes pontos na conversa que originou a spec):
  - Cap nasce **desligado** para todo mundo; o admin liga pontualmente. Nenhum
    onboarding cria linhas em massa.
  - Owner/admin da empresa nunca recebe teto (evita travar quem administra sem
    saída).
  - A aba "Equipe" só aparece quando a empresa tem 3 ou mais membros ativos
    (abaixo disso, é ruído de UI numa conta pequena ou em trial).
    Se qualquer uma estiver errada, ajustar aqui antes da implementação, não
    durante.
- **Impersonação de suporte:** ver passo 3 do plano de implementação. Risco real
  dado que o vazamento de dado financeiro sob impersonação corrigido nesta mesma
  branch é da mesma classe (JWT real vs papel simulado); só fecha depois de
  verificado no código.
- **Pedido de tokens como canal de spam:** mitigado pelo único pendente por vez;
  se ainda incomodar o admin na prática, o ajuste é ele subir/remover o teto, não
  reabrir esta spec.
- **Anomalia diária (SPEC 085) continua só por empresa** nesta spec; estender
  `v_uso_tokens_anomalia_diaria` para detectar pico por usuário mesmo sem cap
  configurado fica registrado aqui como próximo passo natural, não incluído no
  escopo desta implementação (evita inflar esta spec com um objetivo distinto:
  detecção de anomalia vs. controle deliberado do admin).

## Estado da implementação (2026-09-04)

Implementado (migration `20260910000000`, 36 casos pgTAP + regressão da fundação
36+31+8 verde, `_shared/ai-client.ts`, 4 edge functions, front). Dois ajustes de
design feitos durante a implementação, registrados aqui porque divergem do texto
original desta spec:

- **`tokens_ciclo` (consumo) é visível a qualquer membro da empresa, não só a
  quem `can_manage_equipe()`.** O requisito 9 original pedia "usuário nunca vê
  consumo de colega"; na prática o extrato geral (`v_extrato_tokens`, spec 076)
  já expõe "quem gastou o quê" para toda a empresa, alinhado ao princípio 2 do
  motor de tokens (transparência total do consumo). Manter esse campo fechado
  na view nova teria sido inconsistente com o que o produto já faz. **O que
  continua privado**: `limite_mensal` (o teto configurado) e o conteúdo de
  `ai_token_solicitacao` (mensagem do pedido) — só o próprio usuário e quem
  administra equipe veem essas duas colunas.
- **Impersonação verificada, risco não se aplica**: o mecanismo de impersonation
  deste projeto (`impersonation_sessions` + `current_effective_role()`) troca só
  o papel simulado dentro da MESMA empresa e do MESMO `auth.uid()` — não é
  suporte Pilar acessando conta de cliente sob outro usuário. `debitar_tokens`
  sempre grava o `user_id` real de quem está logado, então não existe o cenário
  de consumo atribuído à pessoa errada. O passo 3 do plano de implementação foi
  cumprido só com essa verificação, sem mudança de código.
- **Achado crítico só visível testando o app de verdade, não em pgTAP:** a
  primeira versão de `ai_token_limite_usuario`/`ai_token_solicitacao` tinha
  `user_id` referenciando `public.profiles(id)`. Uma tabela com FK simultânea
  para `profiles` E `empresas` faz o PostgREST detectar uma falsa relação
  many-to-many entre as duas (heurística de "tabela de junção"), o que quebrou
  com `PGRST201` (embedding ambíguo) **qualquer** `profiles?select=*,empresas(*)`
  no app inteiro — inclusive o carregamento de perfil no login. `ai_token_ledger`
  já evitava isso referenciando `auth.users(id)` em vez de `profiles(id)`; as
  duas tabelas novas foram corrigidas para o mesmo padrão. pgTAP não detecta
  isso (não faz embed via PostgREST); só apareceu ao exercitar o fluxo real no
  browser. Lição: qualquer tabela nova com FK para `profiles` **e** `empresas`
  ao mesmo tempo deve apontar para `auth.users` em vez de `profiles`, ou o app
  quebra de forma não óbvia e distante do PR que introduziu a mudança.

Suposições da seção anterior mantidas: cap desligado por padrão (nenhuma linha
nasce sozinha), owner/admin sem teto (RLS/RPC não impedem tecnicamente, mas
nenhum fluxo da UI oferece setar teto em si mesmo — reforçar isso é dívida
pequena se vira problema real). **Uma suposição foi simplificada**: o threshold
de "aba só aparece com 3+ membros" não foi implementado nesta entrega — a
seção "Equipe" aparece para qualquer empresa em que o usuário tenha
`can('pessoas')`, independente do tamanho. Ajuste de front trivial (checar a
contagem de membros antes de renderizar) se o ruído em conta pequena incomodar
na prática.
