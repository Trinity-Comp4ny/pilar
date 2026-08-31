# SPEC 073: Financeiro delegado por pessoa + papel Coordenador

**Data:** 2026-08-31
**Status:** Em implementação (RLS/RPCs/adoção de projetos_safe prontos e testados; aguardando PR/review)
**Autor:** Matheus
**Módulo:** financeiro / administração (transversal)

## Problema

Um cliente (design partner) reportou que qualquer usuário da empresa, qualquer
papel, vê o módulo Financeiro inteiro, incluindo folha de pagamento (salário)
e dados sensíveis de funcionário. Ele quer restringir por padrão a
admin/sócio, e liberar pontualmente só quem realmente mexe com financeiro.

Levantamento no código confirmou que o modelo atual não tem onde pendurar
essa restrição: desde o ADR 0029, o gate das tabelas financeiras decide por
módulo da empresa, não por papel, e a distinção de nível (viewer/editor) que
a spec 031 usava para separar folha do resto deixou de existir quando
`user_has_feature` passou a ignorar `p_min_level`. Valores embutidos em telas
não-financeiras (`projetos.valor_contrato`, `custo_indireto_pct`) tampouco
têm recorte próprio: seguem a visibilidade do módulo Projetos. O detalhe do
levantamento fica na memória do projeto, não aqui (repo público, ver regra de
não documentar lacuna de acesso em doc aberta).

## Objetivo

Depois desta spec: só `admin`/`ultra_admin` veem folha e PII, sem exceção.
Financeiro geral (contas, faturas, lançamentos, valor de contrato e margem de
projeto) só admin/ultra_admin, ou quem o admin marcou individualmente como
"acesso financeiro". Papel `coordenador` passa a existir
de fato (hoje é enum morto) para diferenciar quem gerencia projeto/obra de
quem só executa tarefa, mas não concede financeiro por si só. Ver
[ADR 0034](../architecture/adr/0034-financeiro-delegado-eixo-separado-do-role.md)
para a decisão de desenho (dois eixos: papel × concessão financeira).

**Fora de escopo:**

- Redesenhar o que `coordenador` pode fazer operacionalmente além de
  financeiro (aprovar aditivo, gerenciar equipe do projeto etc.). Aqui ele só
  passa a existir como terceiro valor vivo de `role`; comportamento adicional
  é spec futura.
- Reabrir `/gestao/equipe` (RH) para além de admin. Continua `AdminOnlyRoute`.
- Granularidade por sub-área dentro de Financeiro (ex.: "vê faturas mas não
  fluxo de caixa"). O grant é um único nível: acesso financeiro geral, sim ou
  não.
- Mascarar `propostas.valor_proposto` e `marcos_faturamento.valor`. Quem
  trabalha proposta ou faturamento precisa do valor para operar; mascarar
  quebraria o fluxo comercial. Se o cliente pedir, entra numa fase 2 com
  decisão própria (o padrão `_safe` fica pronto para estender).
- Convite carregar o flag financeiro. Convite nasce sempre com
  `financeiro_delegado = false`; o admin liga depois, na tela de usuários.
  Mantém um caminho único de concessão (a RPC), que foi a lição do ADR 0029.
- Mudar o papel `ultra_admin` ou seu bypass de plataforma.

## Requisitos

Funcionais:

1. Admin pode marcar/desmarcar "acesso financeiro" para qualquer pessoa da
   própria empresa, num toggle na tela de administração de usuários
   (`UsersAccessManager`). Fica registrado quem concedeu e quando.
2. Usuário sem "acesso financeiro" e sem papel admin não vê o item
   Financeiro na sidebar, não acessa `/gestao/financeiro` (redireciona, igual
   `FeatureRoute` hoje), e uma query direta às tabelas financeiras (RLS)
   retorna vazio.
3. Usuário com "acesso financeiro" mas sem papel admin vê Financeiro, exceto
   a aba/dado de Folha de Pagamento, que continua bloqueada.
4. Folha de pagamento (tabela `folha_pagamento`, RPC `get_folha_pessoas_pii`,
   colunas sensíveis de `pessoas_safe`) só é visível para `admin`/
   `ultra_admin`, independente do toggle de acesso financeiro.
5. `projetos.valor_contrato` e `custo_indireto_pct` ficam ocultos (`NULL`) na
   leitura de quem não tem admin nem acesso financeiro, sem esconder o resto
   do projeto (nome, status, prazo, responsável continuam visíveis a quem já
   acessa o projeto hoje).
6. Ações do agente de IA que escrevem em financeiro (`agent-write-financeiro`,
   `agent-write-folha`, `agent-write-parcelado`, `agent-write-despesa-cartao`)
   respeitam a mesma regra: financeiro geral exige `can_view_financeiro()`,
   folha exige `can_view_folha()` (hoje ambos checam só
   `user_has_feature('financeiro','editor')`, que não diferencia mais
   ninguém).
7. Papel `coordenador` pode ser atribuído a um usuário pelo admin, junto com
   `user` e `admin` (não altera o toggle de acesso financeiro: coordenador
   também precisa do grant explícito, igual `user`).
8. Ninguém altera `financeiro_delegado` por UPDATE direto na tabela, nem o
   próprio: a coluna só muda pela RPC `set_financeiro_delegado`. Dupla
   barreira: privilégio de UPDATE da coluna revogado de `authenticated` e
   `tg_prevent_profile_tampering` estendido para bloquear a mudança (sem isso,
   qualquer usuário se autoconcederia o flag num UPDATE do próprio profile).
9. `update_user_access` e `set_access_profile` passam a aceitar somente
   `user`, `coordenador` e `admin`. Hoje as duas ainda deixam cunhar `owner`
   e `colaborador`, papéis que não passam em `has_role('admin')` e ficariam
   fora do novo gate. Backfill idempotente na mesma migration: `owner` →
   `admin`, `colaborador` → `user` (re-executa o de 18/08 por segurança).

Não-funcionais:

- **Segurança / RLS:** toda policy financeira passa a checar
  `can_view_financeiro()` ou `can_view_folha()`, nunca `user_has_feature`
  diretamente (evita o mesmo desalinhamento que já aconteceu duas vezes:
  `folha_pagamento`/`get_folha_pessoas_pii` hoje usam o helper genérico direto,
  sem passar pelo helper de sigilo). `admin`/`ultra_admin` nunca dependem do
  flag (`has_role('admin') OR ...`, nesta ordem). Rodar `rls-auditor` no diff.
- **Migration:** coluna nova é `boolean not null default false`, sem
  validação de subconjunto, sem trigger de cascata, sem coluna JSONB (ver ADR
  0034, "Opções consideradas"). Nenhum backfill de dado precisa apagar nada
  (contraste com a migration do ADR 0029, que teve `DROP COLUMN`).
- **Multi-tenant:** `set_financeiro_delegado` (RPC nova) só opera dentro da
  empresa do caller, mesmo padrão de escopo de `update_user_access`.
- **Auditoria:** mudança do toggle grava em `audit_log`, mesmo padrão de
  `tg_audit_profile_changes` (que já audita troca de `role`).
- **Performance:** `projetos_safe` segue o padrão `security_barrier` de
  `pessoas_safe`; sem full-scan novo (mesmo índice de `empresa_id` da tabela
  base).

## Critérios de aceite

- [ ] Dado um `user` sem acesso financeiro, quando abre `/gestao/financeiro`,
      então é redirecionado e o item some da sidebar.
- [ ] Dado um `user` sem acesso financeiro, quando faz `select * from
      folha_pagamento` ou chama `get_folha_pessoas_pii` diretamente via API
      (bypassando o front), então recebe vazio/negado.
- [ ] Dado um `coordenador` sem acesso financeiro, quando abre o projeto dele,
      então vê nome/status/prazo normalmente e `valor_contrato`/margem vêm
      vazios, com placeholder de valor oculto (não erro, não linha oculta).
- [ ] Dado o admin marcando "acesso financeiro" para um `coordenador`, quando
      esse usuário loga de novo, então vê Financeiro (contas, faturas,
      lançamentos, valor de projeto) mas a aba Folha de Pagamento continua
      bloqueada/oculta para ele.
- [ ] Dado um `admin`, quando abre Financeiro e Folha, então acessa tudo sem
      precisar do toggle (comportamento inalterado vs hoje).
- [ ] Dado um agente de IA (`agent_run`) disparado por um usuário sem acesso
      financeiro, quando tenta lançar receita/despesa/fechar folha, então a
      RPC recusa com a mesma mensagem de erro que a policy de RLS daria.
- [ ] Caso de borda: dado um delegado com a tela aberta, quando o admin
      desmarca o flag dele, então a próxima requisição já volta vazia (os
      helpers leem `profiles` a cada query; sem acesso residual de sessão).
- [ ] Caso de borda: dado um `user` autenticado, quando tenta `UPDATE
      profiles SET financeiro_delegado = true` no próprio registro via API,
      então recebe erro (privilégio de coluna revogado + trigger de
      tampering).
- [ ] Regressão: suíte de RLS/pgTAP existente para `folha_pagamento` e
      `pessoas_safe` continua verde, mais um teste novo que replica o bug do
      ADR 0029 (usuário comum não pode ver folha mesmo com `financeiro`
      habilitado na empresa).

## Dados e contratos

- **Migration:**
  - `ALTER TABLE public.profiles ADD COLUMN financeiro_delegado boolean NOT
    NULL DEFAULT false;` seguido de `REVOKE UPDATE (financeiro_delegado) ON
    public.profiles FROM authenticated, anon;` (escrita só pela RPC).
  - `CREATE OR REPLACE FUNCTION public.can_view_financeiro()` e
    `public.can_view_folha()` (assinatura mantida, corpo reescrito, ver ADR
    0034 para o SQL).
  - Reescrever todas as policies que hoje chamam
    `user_has_feature('financeiro', ...)` diretamente (inventário por grep na
    implementação; a contagem de ocorrências passa de 20 entre USING e WITH
    CHECK): folha e PII → `can_view_folha()`; o resto →
    `can_view_financeiro()`. O mesmo grep cobre as RPCs server-side de
    leitura (lançamentos, ADR 0017; dashboard financeiro, spec 044).
  - `get_folha_pessoas_pii`: trocar o gate para `can_view_folha()`.
  - `agent-write-financeiro`, `agent-write-folha`, `agent-write-parcelado`,
    `agent-write-despesa-cartao`: trocar `user_has_feature('financeiro',
    'editor')` para `can_view_financeiro()` (ou `can_view_folha()` no caso de
    folha).
  - `CREATE VIEW public.projetos_safe` (mesmo padrão `security_barrier` de
    `pessoas_safe`): todas as colunas de `projetos`, exceto `valor_contrato`
    e `custo_indireto_pct`, que viram `CASE WHEN can_view_financeiro() THEN
    ... END`. ATENÇÃO ao revoke por coluna na tabela base: ele é o ÚLTIMO
    passo da PR, não o primeiro. 31 arquivos do front leem `projetos` hoje, e
    privilégio de coluna não olha papel da aplicação: qualquer `select('*')`
    (ou `RETURNING *` em RPC) quebra no momento do revoke, inclusive para
    admin. Ordem obrigatória: criar a view → migrar as leituras → grep de
    `from("projetos")` com select amplo zerado → só então revogar.
  - `CREATE FUNCTION public.set_financeiro_delegado(p_user_id uuid, p_delegado
    boolean)`: `SECURITY DEFINER`, exige `has_role('admin')`, escopo por
    `empresa_id` igual `update_user_access`, grava em `audit_log`.
  - `update_user_access` e `set_access_profile`: whitelist `user`/
    `coordenador`/`admin` (hoje `owner` e `colaborador` passam) + backfill
    idempotente `owner` → `admin`, `colaborador` → `user`.
  - Estender `tg_audit_profile_changes` para também logar mudança de
    `financeiro_delegado` (o trigger é `AFTER UPDATE OF role`; vira `OF role,
    financeiro_delegado`) e `tg_prevent_profile_tampering` para bloquear
    alteração da coluna fora da RPC.
- **RPC nova:** `set_financeiro_delegado(p_user_id uuid, p_delegado boolean)
  RETURNS void`.
- **Front:**
  - `src/lib/permissions.ts`: `canDo()` ganha a mesma regra do banco:
    `financeiro` deixa de cair no branch genérico de feature e passa a
    checar `role === 'admin' || financeiroDelegado`; `folha` (se tratado como
    sub-recurso) exige só `role === 'admin'`.
  - `useUserRole`/hook novo precisa expor `financeiro_delegado` junto do
    `role` (mesma query em `profiles`, um `select` a mais).
  - `src/lib/modules.ts`: item Financeiro na sidebar usa `canDo`, não só
    `feature`.
  - Telas de projeto que hoje leem `projetos` trocam para `projetos_safe`
    onde exibem valor/margem (leitura); escrita continua em `projetos`.
  - `UsersAccessManager.tsx`: novo toggle "Acesso financeiro" por usuário,
    chamando `set_financeiro_delegado`; select de papel ganha `Coordenador`
    como opção ao lado de `Usuário`/`Admin`.
- Após a migration: `npm run gen:types:local` (dev local) e `npm run
  gen:types` (staging) antes do PR; o gate `types-sync` do CI bloqueia
  divergência.

## Plano de implementação

Preenchido em plan mode antes de codar, revisar com o Matheus antes de gerar
o primeiro código.

1. Migration local: coluna `financeiro_delegado` + revoke de UPDATE da
   coluna, `can_view_financeiro`/`can_view_folha` reescritas,
   `set_financeiro_delegado`, whitelist em `update_user_access`/
   `set_access_profile`, backfill de roles residuais, auditoria e
   anti-tampering estendidos.
2. Migration local: reescrever as policies que gateiam por
   `user_has_feature('financeiro', ...)` para os dois helpers (inventário por
   grep).
3. Migration local: `projetos_safe` (masking de `valor_contrato`/
   `custo_indireto_pct`), SEM o revoke por coluna ainda.
4. Migration local: agent RPCs (`agent-write-*`) e RPCs server-side de
   leitura trocam o gate.
5. `rls-auditor` no diff completo das migrations 1 a 4; teste pgTAP
   específico replicando o cenário do ADR 0029 (usuário comum × folha) e o
   de auto-concessão do flag.
6. Front: `canDo`, hook de role+delegado, sidebar, rotas.
7. Front: toggle de acesso financeiro + seletor de papel Coordenador em
   `UsersAccessManager`.
8. Front: migrar TODAS as leituras de `projetos` que tocam valor/margem (ou
   usam select amplo) para `projetos_safe`; grep de verificação zerado.
9. Migration local final: revoke por coluna em `projetos` (só depois do
   passo 8).
10. `typecheck`, `test:run`, `lint`; `gen:types:local` → verificar em browser
    (login como user, coordenador sem/com delegado, admin) → `gen:types`
    (staging) → `db:push:staging`.
11. PR para `staging` linkando este spec e o ADR 0034.

## Decisões e riscos

- **Decisão de arquitetura:** [ADR 0034](../architecture/adr/0034-financeiro-delegado-eixo-separado-do-role.md).
- **Risco:** algum consumidor de `user_has_feature('financeiro', ...)` que a
  auditoria de código não pegue continua com o gate fraco. Mitigação: grep
  fechado de `user_has_feature\('financeiro'` no diff final, tem que dar zero
  fora de `can_view_financeiro`/`can_view_folha` em si.
- **Achado na revisão manual, corrigido:** a policy de SELECT de `alertas`
  nunca tinha gate de financeiro (só DELETE/INSERT tinham, desde antes desta
  spec), mesmo a tabela carregando tipos de alerta claramente financeiros.
  Ficou de fora tanto do grep de fechamento (o grep pega chamada ao helper,
  não policy ausente) quanto da auditoria do rls-auditor. Corrigida pro mesmo
  gate de `can_view_financeiro()` já aplicado a DELETE/INSERT, INSERT/UPDATE
  incluídos por consistência.
- **Achado no teste ponta a ponta, corrigido (migration 20260872000000):**
  `pessoas_safe` (20260715000050) fechou a LEITURA de salário/CPF/PIX/conta
  bancária, mas nunca a ESCRITA — a policy `pessoas_write` seguia exigindo só
  `user_has_feature('pessoas','editor')` (qualquer membro desde o ADR 0029).
  Confirmado ao vivo: um usuário que vê salário mascarado ainda conseguia
  `UPDATE` esse valor direto na tabela base, às cegas. Fix: trigger
  `BEFORE INSERT/UPDATE` que bloqueia só as 5 colunas sensíveis sem
  `can_view_folha()` — resto de `pessoas_write` (nome, cargo, telefone)
  segue igual. Testado: nem coordenador com `financeiro_delegado` (que já vê
  financeiro geral) passa; só admin.
- **Mesmo achado, mesmo padrão, em `projetos` (migration 20260873000000):**
  a policy `projetos_write` (20260507300000) também exige só
  `user_has_feature('projetos','editor')`, sem checar financeiro. O gate
  cirúrgico que a migration 20260871000000 pôs em `update_projeto_completo`
  era decorativo: `UPDATE projetos SET valor_contrato = ...` direto na
  tabela ignorava a RPC inteira. Confirmado ao vivo (user comum reescreveu
  `valor_contrato` de 200000 pra 1 sem passar pela RPC). Mesmo trigger
  cirúrgico: bloqueia só `valor_contrato`/`custo_indireto_pct` sem
  `can_view_financeiro()` (financeiro geral, não folha — coordenador
  delegado passa). Resto de `projetos_write` (nome, status, datas,
  disciplinas) segue igual.
- **O mais grave dos achados no teste ponta a ponta (migration 20260874000000):**
  `rpc_dashboard_rentabilidade`, `rpc_projeto_rentabilidade` e
  `get_projeto_rentabilidade_detalhe` são `SECURITY DEFINER`, bypassam RLS
  por completo, e devolviam `valor_contrato`, margem, receitas, despesas e
  faturamento de TODOS os projetos da empresa num JSON só, checando apenas
  `empresa_id` — nenhum gate de financeiro nunca, desde a definição mais
  antiga (`000_base_schema.sql`). Não é regressão desta spec, mas é
  estruturalmente o mesmo furo do cliente, só que devolvendo o relatório
  inteiro de uma vez em vez de tabela por tabela. Também tinham `GRANT ALL`
  pra `anon` (inofensivo na prática, `get_user_empresa_id()` é `NULL` sem
  sessão, mas fora do padrão do resto do financeiro). Gate cheio
  (`can_view_financeiro()`) nas três, `REVOKE` de `anon` junto. Testado:
  bloqueado pra `user`/`anon`, retorna dado real pra `admin`.
- **Varredura final, 9 funções corrigidas (migration 20260875000000):**
  partindo das ~55 RPCs que o app chama de verdade (fora do portal do
  cliente), achei mais 9 `SECURITY DEFINER` do mesmo padrão: `get_folha_preview`
  (prévia de folha completa, sem gate → `can_view_folha()`);
  `rpc_criar_transferencia`/`rpc_editar_transferencia`/`rpc_excluir_transferencia`,
  `rpc_faturar_marco`, `gerar_fatura`, `rpc_lancamento_set_rateio`,
  `rpc_gerar_parcelas_projeto` (todas escrevem financeiro geral sem gate →
  `can_view_financeiro()`); e `_soft_delete_guard` (usado por
  `rpc_soft_delete`/`rpc_soft_delete_grupo`/`rpc_restaurar`), que mapeava
  tabela financeira pra `user_has_feature('financeiro','editor')` — o mesmo
  gate fraco de sempre, permitindo `rpc_soft_delete('receitas', id)` sem
  financeiro. Todas testadas: bloqueiam `user`, funcionam pra `admin`.
  Deliberadamente fora: `rpc_calcular_wip` (referencia tabela `timesheets`
  já dropada, quebra antes de expor dado — não é vazamento vivo);
  `rpc_excluir_projeto`/`rpc_restaurar_projeto` (feature `projetos`, não
  financeiro, fora do escopo do pedido do cliente).
- **Adoção de `projetos_safe` concluída (migration 20260876000000):** dos 31
  arquivos que liam `from("projetos")`, só 6 de fato expunham
  `valor_contrato`/`custo_indireto_pct` ou faziam `select("*")`:
  `usePagamentosProjeto.ts`, `useClienteDetalhe.ts`, `dashboard/queries.ts`,
  `MapaTab.tsx`, `useProjetosData.ts`, `useProjetoDetail.ts` — todos
  migrados pra `projetos_safe`. Achado técnico no caminho: view não embeda
  relação via PostgREST (sem FK visível), então `clientes(nome)` e
  `projeto_disciplinas(...)` que vinham embutidos na mesma query viraram
  queries separadas, mescladas em memória no mesmo formato de antes (mesmo
  padrão que `pessoas_safe` já usa: sempre select flat, nunca embed). Com o
  fechamento confirmado (grep zerado no resto do repo), o revoke de coluna
  entrou: `REVOKE SELECT ON projetos` + `GRANT SELECT` coluna a coluna,
  exceto as duas mascaradas — mesmo padrão de `pessoas_safe`. Testado ao
  vivo: `select valor_contrato from projetos` (que antes vazava o valor
  real) agora dá `permission denied`; `select *` idem; leitura via
  `projetos_safe` mascara certo; escrita de campo não-financeiro
  (`UPDATE projetos SET nome = ...`) continua livre, porque o revoke é só
  de SELECT — RLS e o trigger `tg_projetos_protege_valor` seguem sendo a
  autoridade de escrita.
- **Achado da auditoria, corrigido (migration 20260871000000):** `pagar_fatura`,
  as 4 RPCs `rpc_grupo_parcela_*` (criar, editar_em_aberto, renegociar,
  quitar_antecipado) e `update_projeto_completo` são `SECURITY DEFINER` com
  `GRANT EXECUTE` direto pra `authenticated` e checavam só `empresa_id`,
  nunca chamaram `user_has_feature('financeiro', ...)`. O grep de fechamento
  acima não pega essa classe: elas bypassam RLS por serem definer, não por
  policy. `pagar_fatura` e as 4 de parcela ganharam gate cheio
  (`can_view_financeiro()` logo no topo, mesmo padrão das RPCs do agente).
  `update_projeto_completo` ganhou gate cirúrgico: só exige
  `can_view_financeiro()` quando `p_valor_contrato` REALMENTE muda em relação
  ao valor salvo, porque a função edita o projeto inteiro (nome, status,
  datas, disciplinas) e um gate cheio bloquearia coordenador/user editando
  campo não-financeiro do próprio projeto. Validado com teste funcional: o
  mesmo coordenador renomeia/muda status normalmente e é barrado só ao
  tentar mudar o valor de contrato.
- **Risco:** tela esquecida lendo `projetos` com select amplo segue exibindo
  valor até o revoke final; e o revoke, se rodar antes de o front migrar,
  quebra 31 arquivos (inclusive para admin: privilégio de coluna não olha
  papel da aplicação). Mitigação: a ordem do plano (view → migração das
  leituras → grep zerado → revoke) e o revoke numa migration separada, que só
  entra na PR quando o passo 8 fechar.
- **Risco:** `RETURNING *` em RPC de escrita de projeto (ex.:
  `update_projeto_completo`) também respeita privilégio de coluna e quebraria
  com o revoke. Auditar os `RETURNING` na implementação antes do passo 9.
- **Gate 0 (antes da migration):** rodar `SELECT role, count(*) FROM profiles
  GROUP BY role` em staging e produção. Se existir alguém em `owner`/
  `colaborador`, o backfill vira migração de dados consciente. E combinar com
  o cliente quem sai do primeiro deploy com o toggle ligado: a coluna nasce
  `false` para todo mundo, então quem hoje opera o financeiro sem ser admin
  perde acesso no deploy até o admin marcar (isso é a intenção, mas avisar
  antes, não descobrir por ticket).
