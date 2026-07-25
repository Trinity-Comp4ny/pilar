# SPEC: Shell dos 3 Pilares — switcher de módulo + home Início

**Data:** 2026-07-25
**Status:** Aprovada (2026-07-25, com adendos: quadro Radar na home; header fino vira spec 002)
**Autor:** Matheus (com painel de agentes 2026-07-25)
**Módulo:** shell / navegação (transversal)

Contexto estratégico: `docs/strategy/DECISAO_PILARES_E_AGENTES_2026-07-25.md` (split =
taxonomia interna, sem anúncio comercial) e `docs/strategy/HOME_LAUNCHPAD_IDEA.md`
(home com agente como busca, agora promovida de "ideia" para escopo desta spec).

## Problema

O Pilar cresceu como uma lista plana de páginas. O usuário do escritório não tem uma
"casa" pra voltar (login cai num dashboard de métricas), e perfis diferentes (dono,
financeiro, projetista) veem tudo misturado. A visão de produto definiu 3 pilares
(Gestão / Projetos / Obras), mas a navegação atual não expressa isso.

## Objetivo

Depois desta feature: login leva a uma home de retomada de trabalho (busca-agente +
recentes + módulos), a sidebar expressa o módulo ativo via switcher, e o perfil
financeiro consegue trabalhar 100% dentro de Gestão sem ver Projetos.

**Fora de escopo:** anunciar/precificar os módulos publicamente (decisão 2026-07-25:
gatilho = produto 2 existir + 1 pagante); módulo Obras funcional (só página "Em breve");
"Meu trabalho" e tarefas (spec própria futura); busca full-text de entidades no hero
(fase 2); renomear rotas existentes; achados do Radar gerados por LLM (fase 1 é
determinística); **header fino padrão por página** (search + botões "+ Adicionar",
inspirado na sidebar/header do repo labrynth/labrynth-platform) — vira a spec
`002-header-padrao.md`, depois que o shell estiver entregue.

## Regra de arquitetura (a régua que resolve o compartilhamento)

**A entidade é da empresa; o módulo é dono da tela de administração; outros módulos
referenciam a entidade e exibem recortes contextuais.** O banco continua único por
`empresa_id`. Exemplos vigentes: aba Pagamentos dentro do projeto (recorte do
financeiro), picker de responsável na disciplina (referência a pessoas). Nenhum dado é
duplicado ou movido por esta spec.

### Composição dos módulos

| Módulo                              | Itens (rotas existentes)                                                                                                                           | Rota inicial  |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **Gestão**                          | Financeiro (`/financeiro`), Equipe (`/equipe`), Fornecedores (`/fornecedores`), Relatórios (`/relatorios`)                                         | `/financeiro` |
| **Projetos**                        | Dashboard (`/dashboard`), Leads (`/leads`), Documentos (`/documentos`), Clientes (`/clientes`), Projetos (`/projetos`), Calendário (`/calendario`) | `/dashboard`  |
| **Obras**                           | Página única "Em breve" (`/obras`)                                                                                                                 | `/obras`      |
| **Transversais (fora do switcher)** | Início (`/inicio`), Agentes (`/agentes`)                                                                                                           | —             |

Notas de classificação:

- Calendário hoje mostra prazos de disciplinas → Projetos. Quando existirem tarefas de
  Gestão, avaliar calendário unificado.
- Fornecedores sai do grupo "Comercial" e vai para Gestão (cadastro da empresa,
  insumo de despesa). O picker de fornecedor nas despesas não muda.
- Dashboard atual permanece em Projetos. Dashboards por módulo são evolução futura.
- Timesheet, Capacidade, Templates, AI Hub: continuam dormentes/ocultos (decisão
  2026-07-25), não entram em nenhum módulo agora.

## Requisitos

Funcionais:

1. Após login (e MFA quando aplicável), o usuário cai em `/inicio`.
2. `/inicio` contém: saudação por horário; input herói que envia a pergunta para
   `/agentes` (prompt pré-carregado); chips de ação rápida (novo lançamento, novo
   projeto, nova proposta, novo lead — respeitando feature/role de cada um); cards dos
   3 módulos com mini-stat (Gestão: contas a pagar próximos 7 dias; Projetos: projetos
   ativos + disciplinas atrasadas; Obras: "Em breve"); lista de Recentes (últimas 8
   páginas/entidades visitadas, persistidas em localStorage por usuário).
   2b. **Radar (quadro de achados dos agentes).** Seção da home com achados acionáveis,
   apresentados como descobertas dos agentes com link para a entidade. Fase 1 é 100%
   **determinística** (queries, zero LLM), na linha "dado certo antes de alerta"
   (decisão 2026-07-25): parcelas a vencer nos próximos 7 dias, parcelas vencidas,
   disciplinas com previsão estourada, propostas sem resposta há mais de 7 dias.
   Cada achado: título curto, valor/prazo, fonte clicável. Máximo 5 itens, ordenados
   por urgência; estado vazio: "nenhum alerta, tudo em dia". Investigação via LLM e
   Caixa de Decisões completa ficam para depois do gate de margem (fora de escopo
   aqui). Respeita feature/role: achado financeiro só aparece para quem tem
   `financeiro`.
3. A sidebar exibe: link fixo "Início"; switcher do módulo ativo (dropdown com
   Gestão / Projetos / Obras); itens apenas do módulo ativo; grupo fixo "Empresa"
   contendo Agentes; menu de usuário inalterado.
4. O módulo ativo é inferido da rota atual via mapa central (`src/lib/modules.ts`).
   Navegar por deep-link para `/clientes` seleciona Projetos no switcher sozinho.
5. Trocar de módulo no switcher navega para a rota inicial do módulo e persiste a
   escolha em localStorage (`pilar.ultimo-modulo`).
6. Visitar `/inicio` com sessão ativa não redireciona; o card/link do último módulo
   usado aparece destacado.
7. `/obras` renderiza página "Em breve": promessa do módulo ("antecipe faltas de
   material, bloqueios e atrasos antes que a obra pare"), 3 bullets do que virá
   (planejamento de frentes, prontidão de material, equipe de campo) e CTA "Me avise"
   (mailto ou registro simples em tabela existente de interesse; sem tabela nova).
8. Um módulo cujas features estão todas desligadas para a empresa/usuário não aparece
   no switcher (mesma lógica de `visibleGroups` atual). Obras aparece sempre, marcado
   "Em breve".
9. Usuário com apenas features de Gestão (ex.: `financeiro`, sem `projetos`) faz login,
   cai em `/inicio`, vê só o módulo Gestão no switcher e nenhum item de Projetos.
10. Rotas existentes não mudam de path; nenhum bookmark quebra.

Não-funcionais:

- **Segurança / RLS:** nenhuma mudança de banco. Gates existentes (`FeatureRoute`,
  `RequireRole`, `usePermissions`) permanecem a única autoridade; o switcher é
  apresentação, nunca autorização.
- **Performance:** mini-stats dos cards usam queries agregadas já existentes
  (dashboard) com `staleTime` generoso; `/inicio` não pode disparar full-scan novo.
- **Multi-tenant:** Recentes em localStorage com chave por `user.id` (não vazar entre
  contas no mesmo browser).
- **Mobile:** switcher funciona no Sheet mobile atual.

## Critérios de aceite

- [ ] Dado login válido, quando autentica, então navega para `/inicio` (substitui os
      dois `navigate("/dashboard")` de `src/pages/Login.tsx:36,95`).
- [ ] Dado usuário em `/clientes` via deep-link, então o switcher mostra "Projetos"
      ativo sem interação.
- [ ] Dado clique no switcher → Gestão, então navega para `/financeiro` e a sidebar
      lista só Financeiro, Equipe, Fornecedores, Relatórios (+ Início e Agentes fixos).
- [ ] Dado usuário owner, quando digita "quanto recebi esse mês?" no herói e envia,
      então chega em `/agentes` com a pergunta já enviada ao orquestrador.
- [ ] Dado usuário colaborador sem feature `financeiro`, então o chip "novo
      lançamento" não aparece e o módulo Gestão só aparece se alguma feature dele
      (ex. relatorios) estiver liberada.
- [ ] Dado segundo login no mesmo browser, então o card do último módulo usado vem
      destacado em `/inicio`.
- [ ] Dado navegação para `/obras`, então página "Em breve" renderiza sem erro e sem
      chamadas de rede além do shell.
- [ ] Caso de borda: usuário troca de conta no mesmo browser → Recentes da conta
      anterior não aparecem.
- [ ] Caso de borda: rota desconhecida (`/perfil` etc.) → switcher mantém último
      módulo, não quebra.
- [ ] `npm run test:run` e `npm run typecheck` verdes; teste unitário para
      `routeToModule()` e para o filtro de módulos visíveis por features.

## Dados e contratos

- **Sem migration.** Nenhuma tabela nova.
- Novo `src/lib/modules.ts`:
  `type ModuleId = "gestao" | "projetos" | "obras"` +
  `MODULES: Record<ModuleId, { label, icon, homeRoute, badge?, groups: MenuGroup[] }>` +
  `routeToModule(pathname: string): ModuleId | null` (prefix match, ex.: `/projetos/123`).
  O `menu` hardcoded de `src/components/AppSidebar.tsx:56-98` migra para cá.
- Recentes: `localStorage["pilar.recentes.<userId>"]` = array de
  `{ tipo, rota, label, ts }`, máx 8, gravado por um hook `useRecentes()` chamado nos
  detalhes de projeto/cliente e nas páginas principais.
- Herói → agentes: `navigate("/agentes", { state: { prompt } })`; `src/pages/chat/`
  lê `location.state.prompt` e dispara `enviar()` no mount (uma vez).

## Plano de implementação (proposta, aprovar antes de codar)

1. `src/lib/modules.ts` + testes de `routeToModule` (S).
2. Refatorar `AppSidebar` para: link Início + switcher (Dropdown existente) + grupos do
   módulo ativo + grupo Empresa fixo. Reusar `getNavItemProps`/`visibleGroups` (M).
3. Página `/inicio` (`src/pages/inicio/index.tsx`): saudação (reusar lógica do chat),
   herói (input + navigate com state), chips por feature, cards de módulo com
   mini-stats de hooks existentes, Recentes (M).
4. Hook `useRecentes` + instrumentar 4-5 páginas principais (S).
5. Página `/obras` "Em breve" (S).
6. Redirects: `Login.tsx` → `/inicio`; rota `/inicio` e `/obras` em `App.tsx` dentro de
   `PrivateRoute` (S).
7. QA: fluxos dos 3 perfis (owner, financeiro-only, colaborador), mobile, dark mode (S).

Estimativa: 3 a 5 dias de trabalho efetivo.

## Decisões e riscos

- **Decisão:** split é navegação interna; zero mudança de pricing/landing (ver doc de
  decisão 2026-07-25). Se um dia virar SKU, abre ADR.
- **Decisão:** Financeiro e Equipe pertencem a Gestão; Projetos consome recortes.
  Régua registrada na seção "Regra de arquitetura".
- **Risco:** home vazia em conta nova (sem recentes, stats zerados) → estado vazio
  orienta primeira ação ("crie seu primeiro projeto", chip destacado).
- **Risco:** usuários atuais (VRZ) têm hábito do login→dashboard → comunicar a mudança
  e manter `/dashboard` a 1 clique (card Projetos + switcher).
- **Suposição a validar com a VRZ:** o herói como agente-busca é usado; medir
  interações do herói vs navegação direta na primeira semana.
