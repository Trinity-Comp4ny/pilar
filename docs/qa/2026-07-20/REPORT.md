# QA Pilar — Relatório consolidado

Data: 2026-07-17 · Ambiente: banco **local** (Supabase 127.0.0.1) · App: http://localhost:8080
Método: híbrido. Camada A (7 agentes de análise de código, paralela) → 311 casos de teste + 95 achados estáticos. Camada B (browser sequencial) → verificação em runtime, evidência abaixo.

Catálogos detalhados por módulo em `qa-report/catalogs/`.

---

## Placar

| Domínio | Casos (Parte A) | Achados | 🔴 | 🟠 | 🟡 | ⚪ |
|---|---|---|---|---|---|---|
| Auth / Onboarding / RBAC | 58 | 15 | 0 | 4 | 7 | 4 |
| Clientes / Fornecedores / Leads | 63 | 10 | 0 | 3 | 6 | 2 |
| Propostas / Projetos | 61 | 19 | 1 | 6 | 7 | 5 |
| Financeiro | 40 | 20 | 1 | 4 | 8 | 7 |
| Portal Cliente | 28 | 10 | 1 | 2 | 6 | 2 |
| Dashboard / Relatórios / Mapa | 33 | 9 | 0 | 3 | 3 | 3 |
| Dormentes / Admin / IA | 28 | 12 | 0 | 1 | 6 | 5 |
| **Total** | **311** | **95** | **3** | **23** | **43** | **28** |

---

## 🔴 Críticos (4 confirmados em runtime + 1 rebaixado)

- **ACH-RLS-01** (CRÍTICO, segurança) · Colaborador faz `PATCH /rest/v1/profiles` no próprio perfil setando `features.financeiro=editor` → 200 → destrava todo o financeiro (leu e inseriu receita via API). Trigger anti-tampering não protege `features`. **Todo o controle de acesso por feature é burlável.** Confirmado por API.
- **ACH-RLS-03** (CRÍTICO, segurança) · `folha_pagamento` sem gate de feature: qualquer autenticado lê e **altera salários** (colab mudou salário p/ 999999, HTTP 200). Confirmado por API.
- **ACH-FIN-02** (CRÍTICO, dinheiro) · `TransferenciaFormDialog.tsx:97` — transferência de `1.000,50` vira **R$ 1,00** (`parseFloat` para no ponto de milhar). Confirmado em runtime + banco.
- **ACH-PORT-01** (CRÍTICO, feature quebrada) · aba Entregas do cliente falha ao carregar (RLS não tem caminho pro token do portal); cliente vê "1 entrega para aprovar" mas nunca abre. Confirmado em runtime + RLS.
- ~~ACH-PROJ-01~~ **REBAIXADO** · "Gerar Parcelas" (`BillingMilestonesTab`) é código morto, não ligado a rota — não explorável pelo usuário.

## 🟠 Altos (23) — resumo

**Financeiro:** ACH-FIN-03 pagar fatura aceita valor > total sem teto (overpay); ACH-FIN-08 dedup de folha ignora `deleted_at` (folha paga sem lançamento); ACH-FIN-01 `parseCurrencyString` interpreta formato US e dígitos crus errado; ACH-FIN-07 full-scan sem paginação em Despesas/Receitas.

**Propostas/Projetos:** ACH-PROJ-14 excluir projeto orfana receitas (dialog promete remoção total); ACH-PROJ-02 aprovar aditivo com item sem disciplina falha em silêncio; ACH-PROJ-03/05 trigger BEFORE cria receita automática e orçamento (custo×1,3) diverge do contrato; +2.

**Auth:** ACH-AUTH-01 login trava todo mundo se RPC de rate-limit falhar; ACH-AUTH-02 onboarding marca completo antes de definir senha; ACH-AUTH-03 AuthContext engole erro de fetch do profile (autenticado com profile=null); ACH-AUTH-04 token de novo owner em plaintext.

**Clientes/Forn./Leads:** ACH-LEAD-01 conversão lead→cliente não-atômica (lead "convertido pela metade"); ACH-FOR-01 hard-delete de fornecedor orfana despesas; ACH-FOR-02 Fornecedores mascara erro como lista vazia.

**Portal:** ACH-PORT-03 aprovar via anon dá toast de sucesso mas não persiste; ACH-PORT-02 IDOR no download por session_token (só valida empresa_id).

**Dashboard/Mapa:** ACH-MAP-01 Mapa engole erro (mostra "nenhum projeto"); ACH-DASH-01 filtro custom sem guard from<=to zera KPIs; ACH-REL-01 relatório Financeiro full-scan sem teto.

**Dormentes:** ACH-ADM-10 edge functions `ai-*` legadas via service_role sem RLS (A2 residual).

## Corrigidos confirmados (histórico)

- Dashboard mascara falha de query → CORRIGIDO (`useDashboardData.ts:42-45` faz throw + card de erro).
- Portal login sha256/plaintext → CORRIGIDO (bcrypt + token hasheado + CORS allowlist).
- Quitar antecipado ignora desconto → CORRIGIDO (migration `20260713000002`).
- Cartão contado em dobro → CORRIGIDO (`is_fatura_payment`/`cartao_id=NULL` filtrado).
- A Receber sem filtro de data → CORRIGIDO (escopado por `data_vencimento`).
- Conversão proposta→projeto disciplinas vazias → CORRIGIDO (RPC `rpc_converter_proposta_projeto`).
- A1 RPC `aprovar_orcamento_agente` sem gate → CORRIGIDO (gate `user_has_feature`).

---

## Camada B — Verificação em runtime

> Preenchido durante a varredura no browser. PASS = comportamento correto observado; FAIL = bug reproduzido; ⚠️ = parcial/observação.

### Fundação
- **PASS** · Login `admin@pilar.local` (MFA bypassado no local, toast de sucesso, sessão OK).
- **PASS** · Logout → volta a `/login`.
- **PASS** · Dashboard com banco vazio: KPIs em R$ 0,00 e "Sem dados no período", sem crash.

### Clientes
- **PASS** · Empty state orienta primeira ação ("Crie o primeiro cliente para começar").
- **PASS** · Obrigatório: "Próximo" com Nome vazio → toast "Preencha o nome para continuar", bloqueia.
- **PASS** · CPF inválido (`111.111.111-11`) → "CPF inválido", bloqueia avanço.
- **PASS** · Email inválido (`naoehemail`) → "E-mail inválido", bloqueia.
- **PASS** · XSS (`<script>alert('xss')</script>`) no nome → renderizado como texto literal, não executa.
- **PASS** · Criar cliente PJ válido (CNPJ `11.222.333/0001-81`) → toast "Cliente cadastrado", aparece na lista.
- **⚠️** · Telefone digitado no cadastro não apareceu na coluna Contato da lista (a reconfirmar; pode ter sido timing de clique no teste).

### Financeiro — Contas e Transferência
- **PASS** · Criar conta bancária com saldo inicial `10.000,00` → máscara "R$ 10.000,00" correta; lista mostra "R$ 10 mil". Idem 2ª conta.
- **PASS** · Detalhe da conta (saldo, entradas, saídas) renderiza certo.
- **PASS** · Transferência bloqueia mesma conta origem=destino (Conta Principal fica desabilitada no destino).
- **🔴 FAIL — ACH-FIN-02 CONFIRMADO e caracterizado** · Transferência: campo Valor **sem máscara de moeda** (create E edit). Gatilho isolado em runtime: com o **separador de milhar** (`1.000,50`) grava **R$ 1,00** (parseFloat para no ponto); **sem** o separador (`1000,50`) grava certo (R$ 1.000,50). Confirmado no banco nos dois sentidos. Como o brasileiro digita "1.000,50" naturalmente, o bug atinge o uso real e corrompe o valor 1000x. `TransferenciaFormDialog.tsx:97`. Fix: usar a mesma máscara/parse dos outros campos de dinheiro (form de Conta/Despesa mascaram certo).

### Projetos
- **PASS** · Empty state ("Cadastre seu primeiro projeto...").
- **PASS** · Criar projeto (wizard 3 passos): código, cliente (dropdown mostra o cliente criado), valor `100.000,00` formatado certo, salvar sem disciplina permitido. Kanban e KPIs (1 ativo, pipeline R$ 100.000,00) corretos.
- **PASS** · Datas invertidas bloqueadas na origem: o date picker de Previsão **desabilita todas as datas anteriores ao Início** (dias 1-19 em cinza). Não dá pra criar prazo invertido pela UI.
- **PASS** · Preview e página de detalhe do projeto renderizam dados corretos.
- **⚠️ ACH-PROJ-01 reclassificado** · O botão "Gerar Parcelas" (`BillingMilestonesTab.tsx:177`) **não foi encontrado na UI**. Confirmei no código: `BillingMilestonesTab` **não é importado em nenhuma tela** (código morto/desconectado). Logo o bug de duplicação de receitas via esse botão **não é explorável pelo usuário hoje**. A RPC `rpc_gerar_parcelas_projeto` (sem idempotência) continua existindo, mas a tela que a chama está desligada. O gerador de parcelas **vivo** é o campo "Dia fixo de pagamento" no wizard → `rpc_gerar_parcelas_dia_fixo` (`useProjetoForm.ts:673`); recomendo reteste focado de duplicação nesse caminho.

### Guards / RBAC
- **PASS** · `/financeiro` acessível pelo admin (role legado passa pelo RequireRole de transição, como projetado).
- **PASS · colaborador** (colab@pilar.local): menu sem Comercial e sem Financeiro; itens sem acesso aparecem esmaecidos. Dashboard sem KPIs financeiros. Menu do usuário só Perfil+Sair (sem Portal Admin/Ver como).
  - `/financeiro` por URL → `/sem-acesso?recurso=financeiro` ("Requer Viewer ou Editor em Financeiro"). Página de acesso restrito clara, não 403 cru.
  - `/admin` por URL → `/sem-acesso?recurso=admin_portal` ("Requer perfil Admin ou Ultra Admin").
  - **⚠️ ACH-ADM-01 CONFIRMADO** · `/revisao-ia` **abre pro colaborador** (cockpit "Revisão da IA / trabalho gerado por agentes aguardando aprovação"). Sem gate de role na UI; exposto a qualquer perfil. (A RPC barra a ação, mas a tela não deveria aparecer.)
- **PASS · coordenador** (coord@pilar.local): menu mostra Comercial (Leads/Documentos/Clientes); Fornecedores esmaecido; sem seção Financeiro. Dashboard com KPI de Leads, sem financeiro. `/financeiro` por URL → `/sem-acesso`.
- **PASS · owner** (owner@pilar.local): menu completo com Financeiro; dashboard com KPIs financeiros; `/financeiro` acessível e mostra Despesas Totais R$ 500,00 corretamente.
- **⚠️ observação (cache entre sessões)** · Ao trocar de coord para owner na mesma aba, o KPI "Despesa do período" do dashboard mostrou R$ 0,00 (valor da sessão coord, sem acesso a financeiro) antes de refetch, enquanto o módulo Financeiro já mostrava R$ 500,00. Bleed de cache do react-query entre logins; baixo risco, mas dado de uma role aparece brevemente pra outra. Vale invalidar o cache no logout.
  - Nit de UI: na página `/sem-acesso`, a linha "Seu perfil" fica sem valor preenchido.

### Leads → Cliente
- **PASS** · Criar lead (kanban, KPIs de pipeline corretos).
- **PASS** · Lookup de CNPJ no dialog "Lead Ganho!" funciona (retorna razão social/endereço da Receita) mesmo no local.
- **✅ ACH-LEAD-01 REFUTADO neste caminho** · Converti lead com CNPJ colidente com cliente existente → toast "Erro na conversão / Já existe um registro com esses dados" e **rollback atômico**: no banco o lead segue `status=Novo`, `convertido_em` e `cliente_id` nulos, e **nenhum cliente parcial/duplicado** foi criado. O estado "convertido pela metade" previsto pela análise estática **não ocorreu** (a colisão é pega no CREATE, antes de marcar Ganho). Risco residual mais estreito que o catálogo sugeriu.
- **⚠️ novo achado** · O botão **"Criar sem CNPJ" não omite o CNPJ**: a conversão usa o `cnpj` que o lead guardou do formulário, então um lead que compartilha CNPJ com cliente existente **não consegue ser convertido por nenhuma via** (o escape hatch "sem CNPJ" também colide). Escape enganoso.
- **⚠️ inconsistência de dados** · `leads.cnpj` é gravado **formatado** (`11.222.333/0001-81`), mas `clientes.cpf_cnpj` é **sem formatação** (`11222333000181`). Normalização divergente entre tabelas.
- **⚠️ layout** · O dialog "Lead Ganho!" transborda horizontalmente (scrollbar) e o botão primário "Criar Cliente" fica cortado na borda.

### Propostas → Projeto
- **⚠️ novo achado (descoberta)** · A página `/documentos` (Propostas) **não tem botão de criar proposta**: só "Gerenciar Templates", busca, filtros e toggles de visualização. O empty state diz "Crie sua primeira proposta para começar" mas **não oferece CTA nem botão "Nova proposta"** (diverge de Clientes/Projetos/Leads, que têm CTA no empty state). A criação provavelmente exige criar um template antes (não sinalizado). Fluxo de entrada não descoberto pelo usuário.
- **N/A runtime** · A conversão proposta→projeto não foi exercitada em runtime porque a criação de proposta não é alcançável sem a cadeia de templates. A correção da conversão (`rpc_converter_proposta_projeto` popula `projeto_disciplinas`/`projeto_orcamento_fases` e promove lead→cliente) foi **verificada no código** pela Camada A (refuta o bug histórico de "disciplinas vazias").

### Financeiro — Cartão e Fatura
- **PASS** · Criar cartão de crédito (fechamento/vencimento eram placeholder, exigem preenchimento explícito — validação "Campos obrigatórios" pegou).
- **PASS** · Lançar despesa de R$ 500 no cartão → fatura "Agosto 2026" gerada automaticamente (ciclo 11/07–10/08, venc. 20/08, total R$ 500,00, status Aberta). Card mostra "Usado R$ 500,00 / R$ 10.000,00".
- **⚠️ ACH-FIN-03 não reproduzido neste passe** · O modal de detalhe da fatura **não tem ação de pagar** enquanto está "Aberta" (só o botão fechar). O overpay só é alcançável com a fatura fechada (ciclo fecha 10/08, futuro). Não consegui disparar o pagamento pela UI sem manipular datas/DB. Bug segue plausível no código (`Faturas.tsx:116` sem teto), mas não confirmado em runtime.

### Portal do Cliente
- **PASS** · Login do portal (`portal_login`, bcrypt) com conta de teste → "Login realizado", dashboard mostra o projeto do cliente.
- **PASS** · Visão Geral do projeto no portal: card "Você tem pendências — 1 entrega para aprovar" conta certo.
- **🔴 FAIL — ACH-PORT-01 CONFIRMADO (com nuance)** · Aba **Entregas** do cliente falha ao carregar ("Não foi possível carregar as entregas agora") mesmo com a entrega existindo no banco e a Visão Geral acusando "1 entrega para aprovar". **Causa raiz (DB):** a única policy de `portal_entregas` (`portal_entregas_manage`) exige `get_user_empresa_id()` + `user_has_feature('portal_cliente','editor')`, ambos de usuário staff autenticado no Supabase. O cliente do portal usa auth por token próprio (não é usuário Supabase) → SELECT barrado. Não há caminho de RLS para o cliente ler entregas. Feature inutilizável. Nuance vs catálogo: manifesta como estado de erro, não lista vazia silenciosa.
- **⚠️ copy** · Tagline do login do portal usa travessão ("entregas — tudo em um só lugar"), contra a regra de não usar travessão em copy de UI.
- **⚠️ menor** · Saudação "Olá, Contato" trunca o nome "Contato Alfa" no primeiro token.

### Dashboard / Relatórios — filtros
- **🟠 FAIL — ACH-DASH-01 CONFIRMADO** · Range de datas invertido (`from=2026-07-31&to=2026-07-01`) é **aceito sem guard**: cabeçalho mostra "31/07/2026 → 01/07/2026" e todos os KPIs financeiros zeram silenciosamente (Receita/Despesa/Saldo/A Receber = R$ 0,00), mesmo existindo despesa de R$ 500 no período real. Inconsistência: o gráfico "Fluxo Financeiro" ainda plota o ponto em R$ 500 (query do gráfico não respeita o mesmo filtro). Usuário que inverte datas por engano vê tudo zerado e conclui erroneamente que não há dados. Falta guard `from <= to` + aviso.

### Email / Convite / Nova empresa (agente de backend)
> CORREÇÃO de premissa: ao contrário do que o CONTEXT.md assumiu, **nenhum email chega ao Mailpit** neste setup — o Auth Hook `send_email` está habilitado e (a) quebrado localmente e (b) apontando pro Resend real.
- **🟠 ACH-EMAIL-03 (custo/privacidade)** · Dev **local faz chamadas AO VIVO ao Resend de PRODUÇÃO** (chave real em `functions/.env`), enviando do domínio de produção para `@pilar.local`. Risco de gastar cota e entregar email de teste de verdade. Deveria usar Mailpit/Inbucket local.
- **🟠 ACH-EMAIL-01 (blocker local)** · O edge runtime aplica `verify_jwt` no `auth-email-hook` apesar do `config.toml` ter `verify_jwt=false` (config em execução defasada). Retorna `500: Hook requires authorization token` e quebra **todos** os emails de auth locais (convite, reset). Fix: reiniciar o stack. (Não reiniciado para não derrubar QAs em paralelo.)
- **🟡 ACH-EMAIL-06 (segurança)** · `/recover` vaza existência de conta localmente (500 p/ conta real vs 200 p/ inexistente) — consequência do hook quebrado; revalidar em staging.
- **FAIL · Convite de equipe** · Row em `convites` gravada certa (só `token_hash` sha256, `token` NULL — bom), mas email nunca sai (hook 500 + invite-user 400).
- **PARTIAL · Convite de portal** · Conta criada com senha bcrypt (`$2a$06$`) + `must_change_password=true`, mas email vai pro Resend real, não Mailpit.
- **⚠️ ACH-EMAIL-04 · Nova empresa** · `create-company-owner` bloqueado (SUPER_ADMIN_KEY ausente) e dessincronizado do `handle_new_user` (não cria signup pago). **Admin não tem caminho funcional para criar empresa.** O mecanismo do trigger em si FUNCIONA quando se semeia um `pilar_pending_signups` pago (empresa criada, owner role=admin).
- **PASS · Adversariais** · RBAC, coerção de escalada owner→user, CSRF de origin, duplicata de portal (409), validação de email: todos corretos.

### Projeto interno: Disciplinas / Escopos / Aditivos / Marcos (3ª rodada)
- **PASS** · Adicionar disciplina (via Editar Projeto, passo 3): dropdown de disciplinas coerente com ICP (Estrutural, Elétrico, Hidráulico...); datas da disciplina **limitadas à janela do projeto** (não deixa sair do prazo) — bom guard. Guard de "Descartar alterações?" ao sair com mudanças não salvas — bom.
- **🔴 ACH-DISC-01 (novo, blocker de onboarding)** · Salvar a disciplina dispara `TypeError: Cannot read properties of undefined (reading 'rest')` (`useProjetoDisciplinas.ts:9` e `:289`, `syncResponsaveis` → `callUntypedRpc` → supabase rpc). A disciplina foi adicionada **sem responsável** porque a empresa nova não tem ninguém em Equipe. Resultado: toast "Erro ao salvar" — **MAS a disciplina É persistida** (o crash é no `syncResponsaveis`, que roda DEPOIS do insert da disciplina). Confirmado: a disciplina "Estrutural" apareceu no Calendário no dia 24. Ou seja, **sucesso parcial mascarado como falha**: o usuário vê "erro", acha que não salvou, e retenta → cria disciplinas duplicadas. Pior em UX do que uma falha limpa. (Correção do que eu havia registrado antes: a disciplina não deixa de persistir; só os responsáveis não sincronizam.) Ver causa-raiz ACH-RPC-BIND-01. Stack trace no console.
- **🟠 ACH-RBAC-OWNER-01 (novo)** · O **owner é bloqueado de `/equipe`** ("Requer perfil Admin ou Ultra Admin" → /sem-acesso). O dono da empresa (role de contrato `owner`) **não consegue gerenciar a própria equipe**; só o role legado `admin`. Combinado com ACH-DISC-01, uma empresa criada só com owner fica presa: sem equipe e sem poder criá-la, e disciplina não salva sem responsável. Inconsistência do modelo de roles de contrato (owner deveria ser o topo).
- **BLOQUEADO em runtime** · Escopos, aditivos, orçamento por fases e marcos de faturamento dependem de disciplina; como a criação de disciplina quebra (ACH-DISC-01) numa empresa sem equipe, não foi possível exercitá-los pela UI neste estado. Cobertura desses fica no nível de código (Camada A, catálogo 03) até o blocker ser corrigido ou uma pessoa ser cadastrada.

### Causa-raiz e código morto (achados fortes desta rodada)
- **🔴 ACH-RPC-BIND-01 (sistêmico, causa-raiz do ACH-DISC-01)** · `callUntypedRpc` (`src/lib/supabaseRpc.ts:16-20`) faz `const client = supabase.rpc; return client(fnName, args)` — **extrair o método desliga o `this`**, então dentro do supabase-js `this.rest` fica undefined → `TypeError: Cannot read properties of undefined (reading 'rest')`. Vale em prod também (mesmo código). **Raio de impacto: as 4 features que usam `callUntypedRpc` quebram:** (1) salvar responsáveis de disciplina (`useProjetoDisciplinas.ts:12`), (2) **logout do portal do cliente** (`useClienteAuth.ts:38`), (3) **admin mudar acesso de usuário** (`admin/tabs/Usuarios.tsx:129`, `update_user_access`), (4) **admin alternar features da empresa** (`admin/tabs/Features.tsx:54`, `update_company_features`). A RPC existe no banco; o defeito é 100% client-side. **Fix de 1 linha:** `supabase.rpc(fnName, args)` direto (ou `.bind(supabase)`). Confirmado em runtime na disciplina (stack trace); os outros 3 quebram pelo mesmo caminho (inspeção de código).
- **⚠️ Escopos / Aditivos = código morto** · `EscopoTab.tsx` (escopo_itens, aditivos, aprovar aditivo) **não é importado/montado em nenhuma tela** — igual ao `BillingMilestonesTab` (marcos). O detalhe do projeto só expõe "Disciplinas" e "Pagamentos". Logo **escopos, aditivos e marcos de faturamento não são acessíveis pelo usuário** no produto atual. Os achados do catálogo sobre aprovação de aditivo (ACH-PROJ-02/03/05) referem-se a código não exposto. Disciplina é a única interna "viva" e está quebrada pelo ACH-RPC-BIND-01; Pagamentos (lista de recebimentos) funciona.

### Folha / Receita / Quitação (4ª rodada, dinheiro)
- **Folha de Pagamento** · Renderiza certo (Total R$ 0,00, Equipe 0, empty state), mas **depende de colaboradores** e a empresa não tem equipe (owner não pode criar — ACH-RBAC-OWNER-01). Não exercitável neste estado. (RLS já provou colab edita salário — ACH-RLS-03.)
- **✅ PASS · Receita parcelada** · Criar receita R$ 10.000 em 3x → 3 registros (3.333,33 / 3.333,33 / **3.333,34**), soma no banco = **R$ 10.000,00 exato**. Arredondamento correto, sem perda de centavo. Refuta qualquer suspeita de rounding em parcelamento.
- **✅ PASS · Quitação** · Marcar parcela como "Recebida" exige Conta (campo vira obrigatório) — bom guard. Após salvar, status=Recebido + conta vinculada no banco.
- **⚠️ ACH-CACHE-01 (número stale)** · Após marcar a parcela recebida, os KPIs do topo (RECEBIDO/A RECEBER) **não atualizam** até recarregar a página (RECEBIDO ficou R$ 0,00, correto R$ 3.333,33 só após reload). Mutação não invalida a query de resumo. Relevante para o "número confiável" (usuário vê valor defasado). Mesmo padrão do bleed de cache observado no RBAC.

### Passe amplo dos módulos (5ª rodada)
- **PASS render** · **Fluxo de Caixa** (Receitas/Despesas/Lucro/Margem 85%, gráficos, coerente com os dados).
- **PASS render** · **Mapa** (empty state claro "precisam ter endereço com coordenadas"; sem projeto com coords, vazio legítimo).
- **PASS render** · **Calendário** (mostra prazo do projeto + a disciplina Estrutural no dia 24 — o que provou que a disciplina persistiu, ver correção ACH-DISC-01).
- **PASS render** · **Timesheet** (tabs Meus/Equipe, filtros de data, empty state, Lançar horas).
- **PASS render** · **Capacidade** (KPIs Equipe/Sobrecarregados/Ociosos, empty state; sem equipe não dá pra confirmar o "Ociosos=todos" do catálogo).
- **⚠️ Templates** · Renderiza, mas **sem botão de criar** para o owner (bate com ACH-ADM-04: gestão de template gated a papéis legados admin/operacional).
- **PASS render** · **AI Hub** (11 funções, contador 0/100, loading state "Analisando..." funciona).
- **⚠️ ACH-AI-01 (falha silenciosa)** · Rodar "Fechamento Mensal" → a edge function retorna **non-2xx** (`FunctionsHttpError`, logado no monitoring), mas a **UI não mostra erro** (dialog só volta a "Gerar Análise", sem toast, contador segue 0/100). Falha silenciosa para o usuário. Contradiz parcialmente a suposição do catálogo de que a IA sempre trata erro com toast.
- **⚪ ACH-UI-BADGE-01** · Warning React repetido: `Badge` recebe `ref` sem `forwardRef` (`src/components/ui/badge.tsx:37` via `StatusBadge` em `LancamentosItemRow.tsx:33`). Ruído de console / possível ref quebrada.

### Admin / Company / Billing / Impersonation (6ª rodada, como admin)
- **PASS render** · Admin Portal (Usuários 6, menu Usuários/Features/Empresa/Parâmetros/Automações/Integrações/Auditoria/Plano). Reflete os acessos configurados por role.
- **🔴 ACH-RPC-BIND-01 CONFIRMADO em runtime (Features)** · Alternar a feature "Agentes" na aba Features → UI mostra "Agentes ON / 16 de 16 features", **mas o banco não muda** (`empresas.features.agentes`/`ai_chat` seguem nulos). Toggle otimista + `update_company_features` (via `callUntypedRpc`) quebra → **falha silenciosa, sem erro**. O admin acha que ativou um módulo; nada persiste. Confirma o raio do bug no painel admin.
- **⚠️ copy** · Descrição de "Agentes" usa travessão ("linguagem natural — os agentes respondem"), contra a regra de marca.
- **Observação** · A feature "Agentes"/`ai_chat` está OFF no plano Starter → `/agentes` (Chat) é gated por feature; por isso o Chat não abre para esta empresa (e não dá pra ligar pela UI por causa do bug acima).
- **PASS** · **Company** (RequireAal2 liberado pelo bypass MFA local; Dados/Usuários/Personalização, Editar, Equipe 4).
- **PASS** · **Billing/Assinatura** (empty state "Sem assinatura ativa / Ver planos"). ⚠️ Inconsistência: Features do admin diz "Plano: Starter" mas Billing diz "sem assinatura".
- **PASS** · **Relatórios** · Gerou Financeiro (Receitas R$10.000, Despesas R$500, Saldo R$9.500, gráfico Evolução mensal, filtros), com **export CSV e PDF** + seletor de Colunas. (CSV injection ACH-REL-02 fica como risco de código; não baixei arquivo.)
- **PASS** · **Impersonation** ("Ver como > Usuário") · Banner "Visualizando como Usuário — apenas UI; RLS mantém permissões reais". Copy honesta. Sair limpa o estado. ⚠️ copy com travessão.
- **PASS render** · **Profile** (dados, Segurança/Configurar MFA, trocar email, trocar senha).
- **Chat/Agentes** · Gated OFF pela feature (plano Starter); não abre e não dá pra ligar via UI (ACH-RPC-BIND-01).
- **Não cobertos** (ferramenta/estado): MFA enrollment real (bypassado local), forgot/reset na tela (email quebrado local), viewport mobile, acessibilidade a fundo, performance sob carga.

### Financeiro — aprofundamento (7ª rodada)
- **PASS · Validação de valor** · Nova Despesa: valor **zero** é bloqueado ("Valor deve ser maior que zero"); **negativo** é descartado pela máscara ("-100,00" → R$100,00). ACH-FIN-11 mitigado na UI (lacuna do `CHECK` no banco permanece como defesa-em-profundidade).
- **🔴 ACH-FIN-02 totalmente caracterizado** · Confirmado create E edit; gatilho = separador de milhar. Os forms de Despesa/Receita/Conta mascaram o valor corretamente; **só o de Transferência não tem máscara** (raiz do bug).
- **PASS · Despesa avulsa paga debita conta** · Criei despesa "Aluguel" R$ 2.000 (PIX, status Pago, Conta Principal). KPI PAGO subiu pra R$ 2.000 (sem reload). Saldo da Conta Principal = 10.000 inicial + 3.333,33 recebido − 2.000 pago − 1,00 transferência = **R$ 11.332,33** ("R$ 11,3 mil" exibido); Conta Secundária = 2.000 + 1,00 = "R$ 2 mil". **Saldo agrega receita/despesa/transferência corretamente.**
- **⚠️ Categoria** · O dropdown de Categoria na despesa abre **vazio** (nenhuma criada) e não há criar-inline; a gestão de categorias/centros de custo deve viver em outra tela de config (não localizada no menu Financeiro). Cliente novo não classifica lançamento sem esse caminho.
- **Aprofundamento ainda pendente no Financeiro**: pagar fatura (precisa a fatura fechar no ciclo), editar/excluir transferência observando reversão de saldo, e as abas dormentes (Projeção/Aging/DRE/Rentabilidade/WIP, não roteadas no menu).

### Leads + Propostas (8ª rodada, admin)
- **✅ Proposta nasce via Lead** · No detalhe do lead há "Criar Proposta" → cria a proposta (Rascunho) e o editor completo (código, título, vincular a lead/cliente, valor, área, prazo, disciplinas, validade, localização, observações). **Resolve o gap "Propostas sem botão de criar"**: o botão "Nova Proposta" só aparece depois que a lista tem ≥1 proposta; a primeira nasce via lead. Empty-state da página Propostas segue sem CTA (chicken-and-egg).
- **⚠️ ACH-PROP-REDIRECT** · Após "Criar Proposta", toast diz "Redirecionando para edição..." e a URL vira `?edit=<id>`, mas **o editor não abre** (permanece na lista). Pelo caminho manual (clicar na proposta > Editar) o editor abre normal. Deep-link/redirect quebrado.
- **✅ Editor de proposta** · Valor Proposto mascara certo (R$ 80.000,00), salvar persiste (toast "Proposta atualizada", valor na lista). O editor menciona "ao converter em projeto, o lead vira cliente" (conversão não exercitada nesta rodada; RPC verificada no código pela Camada A).
- **Lead detalhe** · Editar dados / Excluir lead / Criar Proposta presentes. Kanban drag **não testável via automação** (dnd exige eventos intermediários; caminho funcional "Ações > Mover para" já validado).
- **Pendente**: converter proposta→projeto em runtime, editar/excluir lead na tela, filtros de leads/propostas, PF em Clientes, busca/filtros de Clientes, aprovar entrega no portal (bloqueada por ACH-PORT-01).

**Críticos verificados:**
- 🔴 **ACH-FIN-02** CONFIRMADO — transferência R$1,00 (prova de banco).
- 🔴 **ACH-PORT-01** CONFIRMADO — portal Entregas quebrada (causa raiz RLS).
- ⚠️ **ACH-PROJ-01** reclassificado — código morto, não explorável.

**Altos/médios verificados em runtime:**
- 🟠 **ACH-DASH-01** CONFIRMADO — datas invertidas zeram KPIs sem guard.
- ⚠️ **ACH-ADM-01** CONFIRMADO — /revisao-ia exposto ao colaborador.
- ✅ **ACH-LEAD-01** REFUTADO — conversão é atômica; sem estado meio-convertido.

**Não reproduzidos (bloqueio de setup, não refutados):**
- ⚠️ ACH-FIN-03 (overpay) — fatura não pagável no estado "Aberta"; precisa ciclo fechado.
- Propostas→projeto — criação de proposta não descoberta (sem CTA); conversão verificada só no código.

**Achados novos da Camada B (não estavam nos catálogos):**
- Campo de valor da transferência sem máscara de moeda (raiz do ACH-FIN-02 na UI).
- "Criar sem CNPJ" na conversão de lead não omite o CNPJ → lead com CNPJ duplicado é inconvertível.
- `leads.cnpj` formatado vs `clientes.cpf_cnpj` sem formatação (normalização divergente).
- Página de Propostas sem botão/CTA de criar.
- Dialog "Lead Ganho!" transborda e corta o botão primário.
- Bleed de cache do react-query entre logins de roles diferentes.
- Copy com travessão na tagline do portal (fere regra de marca).
- Telefone do cliente não persistiu na coluna Contato; "Olá, Contato" trunca nome; linha "Seu perfil" vazia em /sem-acesso.

**~30 fluxos PASS** (auth 4 roles, logout/login, clientes CRUD+validações+XSS, contas+cartão+fatura, projetos+datas, portal login, RBAC guards, lead criar+conversão atômica, empty states).

**RBAC: sólido só na UI, FURADO no backend** (ver seção RLS abaixo — CORREÇÃO da conclusão anterior). Os guards de rota e /sem-acesso funcionam, mas a barreira real (RLS/API) é contornável por um colaborador.

### RLS / Segurança backend (agente de matriz RLS) — a parte mais importante
> CORREÇÃO: minha conclusão anterior de "RBAC sólido" valia só para a UI. Testando a API direta com JWT de cada role, o backend NÃO segura.
- **✅ Isolamento entre empresas: OK** · Nenhum usuário da Pilar Local enxergou dado da empresa QARLS em nenhuma tabela. `empresa_id = get_user_empresa_id()` segura; `role`/`empresa_id` do profile imutáveis. Anon totalmente barrado. Auditoria/MFA/impersonation/convites invisíveis ao colaborador. RPC `aprovar_orcamento_agente` com gate (A1) + tenancy.
- **🔴 ACH-RLS-01 (CRÍTICO — escalada de privilégio)** · O trigger anti-tampering de `profiles` bloqueia mudar `role`/`empresa_id` mas **NÃO bloqueia `features`**. Colaborador faz `PATCH /rest/v1/profiles?id=eq.<self>` com `{"features":{"financeiro":"editor"}}` → 200, e destrava TODO o financeiro. Confirmado por API: após o PATCH o colab leu receitas/despesas/contas/cartoes e **inseriu receita (201)**. **Todo o controle por feature é burlável com 1 request.** Enquanto isso existir, os gates das outras tabelas são teatro. Fix: incluir `features` no trigger anti-tampering (só admin+ muda features).
- **🔴 ACH-RLS-03 (CRÍTICO — folha)** · `folha_pagamento` tem policies só por `empresa_id`, **sem gate de feature**, em todas as operações. Colab e coord leem a folha; colab deu **UPDATE alterando salário para 999999 (200)**. Qualquer autenticado lê e adultera salários. Fix: gate de feature/role nas policies de folha.
- **🟠 ACH-RLS-02** · `faturas` SELECT sem gate de feature: coord/colab leem faturas de cartão (escrita é gated).
- **🟠 ACH-RLS-04** · `transferencias`, `centros_custo`, `lancamento_rateios` só por `empresa_id`: colab lê E escreve (inseriu em `centros_custo`, 201).
- **🟠 ACH-RLS-05** · `cliente_portal_accounts` expõe `senha_hash` e `token_sessao` (token de sessão ativo) num `select=*` para staff, sem RLS por coluna — combinável com ACH-RLS-01 para roubo de sessão de portal.

### Edits e Deletes na UI (2ª rodada Camada B)
- **PASS · Editar cliente** · Form pré-preenchido correto; editei telefone → toast "Cliente atualizado", persiste na coluna Contato. (O sumiço do telefone na criação foi timing do meu 1º teste, não bug.)
- **PASS · Excluir cliente** · Tem **dialog de confirmação** ("Excluir Cliente", nome em destaque, "o histórico é preservado, você pode desfazer") = soft delete (`deleted_at`). **Refuta** o bug histórico "deletes sem confirmação/undo".
- **PASS · Undo** · No teste em batch único, "Desfazer" **restaura** o cliente (confirmado no banco: `deleted_at` volta a NULL). Funciona.
- **⚠️ UX menor** · A janela do toast de undo é curta; se o usuário hesitar alguns segundos, o "Desfazer" some. Considerar janela maior ou um lugar persistente pra reverter (lixeira/arquivados).
- **PASS · Criar/editar fornecedor** · Form simples; criação OK (toast "Fornecedor adicionado").
- **⚠️ CORRIGIDO (era ACH-FOR-01)** · O delete de fornecedor tem confirmação e diz "Esta ação não pode ser desfeita" — **mas isso é falso**: o agente de banco provou que um trigger `soft_delete_generic()` converte o delete em soft delete (recuperável). Logo o fornecedor NÃO é hard-deletado e NÃO orfana despesas (ACH-FOR-01 refutado). O problema real é (a) a cópia mente na direção assustadora e (b) não há botão de undo, embora seja recuperável — divergente de Clientes.

### Delete / Edit — integridade (agente de banco)
- **🟠 ACH-DEL-01** · Trigger `soft_delete_generic()` BEFORE DELETE em clientes/projetos/receitas/despesas/fornecedores/leads/escopos faz `UPDATE deleted_at + RETURN NULL`. Efeito: **todo DELETE vira soft delete** e **nenhuma FK ON DELETE (CASCADE/SET NULL/RESTRICT) dispara** — são letra morta no schema. Consequência positiva: sem orfanamento (refuta ACH-FOR-01 e ACH-PROJ-14). Consequência de risco: ver ACH-DEL-02.
- **🟠 ACH-DEL-02 (novo, risco de número errado)** · Soft delete de pai (projeto/cliente) deixa filhos (escopos, receitas, despesas) **vivos apontando pra um pai oculto**. Se as queries filhas filtram só o próprio `deleted_at` e não o do pai, listagens e **somatórios financeiros incluem registros de entidade "excluída"**. Precisa verificar cada query de roll-up.
- **⚠️ ACH-DEL-03 (cópia enganosa)** · Dialog de excluir projeto/fornecedor diz "não pode ser desfeita / dados serão removidos", mas é **reversível e nada é removido**. Cliente/lead têm Undo; fornecedor/projeto/receita/despesa **não têm Undo** apesar de recuperáveis. Copy contradiz o comportamento real.
- **✅ ACH-FIN-11 confirmado** · Sem `CHECK (valor > 0)` em receitas/despesas — aceita zero e negativo no banco.
- **⚠️ ACH-DEL-04** · `grupo_parcela` é uuid solto, sem FK para `grupos_parcela`. Excluir 1 parcela remove só ela (soft).
- **PASS · Edit/audit** · Trigger `handle_record_audit` grava `updated_at`/`updated_by=auth.uid()` corretamente. Editar valor de projeto não recalcula derivados (roll-up é em query, valor cru armazenado).
