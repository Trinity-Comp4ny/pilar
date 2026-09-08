# SPEC: Navegação mobile — bottom bar + chip-nav por módulo

**Data:** 2026-09-08
**Status:** Draft
**Autor:** Matheus (decisão) + Claude (redação)
**Módulo:** shell (transversal — afeta `AppSidebar`, `PageLayout`, `PageHeader`)

## Problema

Em mobile, a navegação hoje é a sidebar desktop reaproveitada como `Sheet` lateral: qualquer troca de tela exige abrir o menu (1 toque) e escolher o destino (2º toque), e a estrutura de 3 pilares (Gestão/Projetos/Obras) fica escondida atrás desse drawer. A auditoria de 08/09 ("Pilar no bolso") comparou isso contra 12 apps de referência mundial e achou que nenhum usa esse padrão; todos usam uma barra inferior fixa com os destinos de maior frequência.

## Objetivo

Trocar a sidebar mobile por uma barra inferior fixa de 6 itens, com uma faixa de chips horizontal que muda de conteúdo conforme o módulo ativo — reaproveitando a mesma função (`routeToModule` + `MODULES[activeModule].items`, `src/lib/modules.ts`) que já decide a sidebar desktop hoje. Depois desta feature, qualquer tela do app é alcançável em no máximo 2 toques a partir de qualquer ponto, e a estrutura de módulos fica sempre visível.

**Fora de escopo:**

- Sidebar desktop (`≥ md`) continua exatamente como está.
- Portal do Cliente (`ClienteShell`) e Pilar Campo (`/campo/*`) já têm navegação própria, não usam `AppSidebar` — não são tocados aqui.
- Conteúdo interno de cada tela (KPIs, tabelas, modais) — isso é o restante do roadmap da auditoria (P2/P3 do artifact), tratado em specs separadas.
- Rotas administrativas sem módulo (`/admin`, `/ultra-admin`) continuam existindo, mas não ganham slot fixo na barra (ficam alcançáveis via Menu, ver requisito 6).

## Requisitos

1. Abaixo do breakpoint mobile (`useIsMobile`, `< 768px`), o app renderiza uma barra fixa no rodapé com 6 itens, nesta ordem: **Início, Agentes, Gestão, Projetos, Obra, Menu**. A sidebar/`Sheet` atual deixa de aparecer nesse breakpoint.
2. O item ativo é o módulo da rota atual, pela mesma lógica que a sidebar desktop já usa (`routeToModule(pathname)` ?? `readUltimoModulo()`). `/inicio` e `/agentes` marcam Início/Agentes independentemente do último módulo usado.
3. Tocar em um item de módulo (Gestão, Projetos ou Obra) que não é o módulo ativo navega para `MODULES[id].homeRoute` (mesmo comportamento do `selectModule` já existente em `AppSidebar.tsx`).
4. Quando um módulo está ativo, uma faixa de chips horizontal (scroll-x) aparece logo abaixo do header da página, com os itens de `MODULES[activeModule].items`, filtrados pela mesma regra de permissão que a sidebar já aplica (`withNav`/`getNavItemProps`, incluindo `hiddenWhenLockedForUser`). Grupos (`group`, ex. "Empresa"/"Comercial" dentro de Gestão) mantêm um separador visual entre eles, na mesma ordem em que aparecem hoje na sidebar.
5. Início e Agentes **não têm** chip-nav (não são módulos).
6. "Menu" abre um painel (bottom sheet) com o que hoje vive no dropdown do avatar (`AppSidebar.tsx:404-448`): bloco de conta (abre Configurações), Notificações (com badge de não lidas), Feedback, toggle "Ocultar/mostrar valores financeiros", Portal Admin (só se `isAdmin`), Portal Ultra (só se `isUltraAdmin`), seletor de impersonation (só se `isUltraAdmin`), Sair.
7. "Agentes" navega direto para `/agentes`; o ícone leva um badge com `usePendenciasAgentes().length`, igual ao que a sidebar já mostra hoje.
8. A barra fica fixa (`position: fixed`/`sticky`) na base da viewport; o container de conteúdo ganha padding inferior suficiente para nada ficar escondido atrás dela.
9. Rotas fora dos 3 módulos e fora de Início/Agentes/Menu (hoje só `/admin` e `/ultra-admin`) continuam navegáveis a partir do Menu, sem precisar de slot próprio na barra.

Requisitos não-funcionais:

- **Não regride desktop:** nenhuma mudança visual ou de comportamento acima de `md`.
- **Acessibilidade:** cada item da barra com `aria-label`, área de toque mínima de 44×44px (o protótipo já mediu 59–68px em 375–430px de largura real).
- **Performance:** zero chamadas de rede novas — reaproveita `usePermissions`, `usePendenciasAgentes` e o próprio `MODULES` já carregados.
- **Sem regressão de feature gating:** um chip de módulo bloqueado por plano/role se comporta exatamente como o item equivalente na sidebar hoje (oculto ou desabilitado, conforme a regra vigente).

## Critérios de aceite

- [ ] Dado um usuário em mobile, quando abre o app, então vê a barra de 6 itens e nenhuma sidebar/drawer lateral.
- [ ] Dado um usuário em mobile em `/gestao/tarefas`, quando olha a tela, então "Gestão" aparece com destaque ativo na barra, e a faixa de chips mostra Tarefas (ativo) · Financeiro · Equipe · Metas │ Leads · Clientes · Propostas, com o separador entre os dois grupos.
- [ ] Dado um usuário em mobile em qualquer tela, quando toca em "Projetos" (não ativo), então navega para `/projetos` e o destaque da barra atualiza para Projetos.
- [ ] Dado um usuário sem a feature Financeiro liberada, quando olha o chip-nav de Gestão, então o chip "Financeiro" se comporta como hoje na sidebar (oculto ou cinza, conforme `hiddenWhenLockedForUser` e o role do usuário).
- [ ] Dado um usuário em mobile, quando toca em "Menu", então abre um painel com conta, notificações (com badge), feedback, toggle de ocultar valores e sair — e Portal Admin/Ultra/Impersonation aparecem só quando aplicável ao role do usuário.
- [ ] Dado um usuário em mobile em `/admin`, quando olha a barra, então nenhum item de módulo fica marcado como ativo indevidamente (mantém o último módulo usado, mesma regra de `readUltimoModulo` de hoje).
- [ ] Caso de borda: usuário sem nenhuma feature de um módulo inteiro liberada (ex. Obra desligada para a empresa) — decidir e testar se o módulo mantém o slot fixo na barra (ver "Decisões e riscos").

## Dados e contratos

Nenhuma mudança de schema, RPC ou edge function — feature 100% de front, reaproveitando dados já carregados hoje pela sidebar (`useAuth`, `usePermissions`, `usePendenciasAgentes`, `useValoresOcultos`).

## Plano de implementação

A aprovar com o Matheus antes de gerar código (rascunho inicial):

1. Extrair de `AppSidebar.tsx` a lógica de filtro de permissão dos itens de módulo (`withNav`, `moduleGroups`) para um hook reutilizável, ex. `useModuleMenuItems(moduleId)` — hoje está presa dentro do componente da sidebar.
2. Criar `src/components/BottomNav.tsx`: os 6 itens fixos, ativo via `routeToModule`/`readUltimoModulo`, navega via `useNavigate`; badge de pendências no ícone Agentes.
3. Criar `src/components/ModuleChipNav.tsx`: recebe o módulo ativo, usa o hook do passo 1, renderiza chips horizontais com scroll e separador de grupo.
4. Extrair o conteúdo do dropdown de usuário (conta/feedback/ocultar valores/admin/ultra/impersonation/sair) para um componente compartilhado entre o dropdown desktop e o novo `MoreSheet.tsx` mobile, evitando duplicar as 7 ações em dois lugares.
5. Em `AppSidebar.tsx`: quando `isMobile`, para de renderizar o `Sheet` da sidebar; renderiza `<BottomNav />` fixo no lugar.
6. Decidir onde `<ModuleChipNav />` entra sem precisar tocar em cada uma das ~14 páginas — candidato natural é dentro do `PageLayout`/`PageHeader`, atrás de uma prop nova (ex. `showModuleNav?: boolean`) ativada quando `isMobile` e há módulo ativo.
7. Ajustar padding inferior do conteúdo para não ficar atrás da barra fixa.
8. Testar em viewport 390px real (iframe + `innerWidth` medido) cada módulo, Início, Agentes e Menu, mais os 2 casos de borda dos critérios de aceite.

## Decisões e riscos

- **Pendente de decisão com o Matheus:** um módulo sem nenhuma feature liberada para a empresa mantém o slot fixo na barra (mostrando um estado vazio/bloqueado ao tocar) ou o slot desaparece, como a sidebar já faz hoje (`visibleModules`)? Manter o slot fixo evita a barra "pular" de posição entre empresas com planos diferentes, mas pode expor um módulo que a empresa nem contratou.
- **Risco de duplicação:** o conteúdo do Menu (passo 4) precisa ficar compartilhado com o dropdown desktop, ou a manutenção diverge com o tempo (um ganha uma opção nova, o outro não).
- **Decisão de arquitetura relevante?** Esta troca de padrão de navegação é transversal a todo o app mobile; se o Matheus quiser, isso também justifica um ADR curto (contexto/decisão/consequências) além desta spec — a spec já registra o "quê" e o "porquê" com detalhe suficiente pra codar, o ADR seria só pra deixar a decisão arquitetural achável fora do histórico de specs.
- Base do design e do racional completo: artifact "Pilar no bolso" (link na memória do projeto), seção 4 (Navegação) e seção 3 (benchmark dos 12 apps).
