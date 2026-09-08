# ADR 0040: Navegação mobile via bottom bar fixa, não sidebar em drawer

**Data:** 2026-09-08
**Status:** Accepted

## Contexto

A navegação mobile do Pilar hoje é a sidebar desktop reaproveitada dentro de um `Sheet` lateral (`AppSidebar.tsx`, quando `isMobile`): qualquer troca de tela exige 2 toques (abrir o drawer, escolher o destino), e a estrutura de 3 pilares (Gestão/Projetos/Obras, `src/lib/modules.ts`) fica escondida atrás dele até o usuário abrir.

A auditoria de responsividade mobile de 08/09/2026 (artifact "Pilar no bolso") comparou esse padrão contra 12 apps de referência mundial (Notion, Linear, Asana, ClickUp, Monday, Trello, Stripe, HubSpot, Xero, Nubank, Procore, Fieldwire, Vobi) e não achou nenhum que use sidebar-em-drawer como navegação primária de mobile. Todos usam uma barra inferior fixa.

Opções consideradas:

- **A — módulos na barra** (Início, Gestão, Projetos, Agentes, Mais): nenhuma das 12 referências faz isso; "Gestão" é um contêiner abstrato, não um destino.
- **B — contextos na barra** (Início, Busca, +, Pendências, Perfil), módulos como árvore dentro do Início: é o padrão dominante nas referências (Linear, ClickUp, Trello, Notion), mas custa 1 toque a mais pra chegar num módulo que o usuário do Pilar abre todo dia.
- **C — 2 destinos diários + Menu** (ex. Projetos, Financeiro, Início, Pendências, Menu): o que HubSpot e Xero fazem, ambos com mais módulos que o Pilar. Depende de medir qual módulo é mais acessado (dado de analytics que hoje não existe em volume: o Pilar tem opt-in de consentimento de analytics, e a maioria das sessões reais do app autenticado não gera evento).
- **D — os 3 pilares fixos na barra** (Início, Agentes, Gestão, Projetos, Obra, Menu): nenhuma referência usa 6 itens (o teto observado foi 5), mas testado em viewport real (iframe, `innerWidth` confirmado) a 375/390/430px, cada item mede 59–68px, dentro do mínimo de área de toque recomendado.

## Decisão

Usar a **opção D**: barra fixa de 6 itens, nesta ordem: **Início, Agentes, Gestão, Projetos, Obra, Menu**.

- O módulo ativo na barra decide sozinho os chips de uma faixa horizontal logo abaixo do header, reaproveitando o mecanismo que já monta a sidebar desktop hoje: `routeToModule(pathname)` para achar o módulo da rota atual, e `MODULES[activeModule].items` (`src/lib/modules.ts`) para a lista de telas daquele módulo — só troca lista vertical por chips horizontais.
- **Um módulo sem nenhuma feature liberada para a empresa mantém o slot fixo na barra** (mostrando um estado vazio/bloqueado ao tocar), em vez de sumir como a sidebar já faz hoje (`visibleModules`). A barra nunca muda de posição entre empresas com planos diferentes — previsibilidade para quem já usa o app todo dia pesa mais que esconder um módulo não contratado.
- "Menu" concentra o que hoje é o dropdown do avatar na sidebar desktop (conta, notificações, feedback, ocultar valores, admin/ultra-admin, sair) — nunca uma tela de módulo.
- Sidebar desktop (`≥ md`) não muda.

Detalhamento funcional completo, critérios de aceite e plano de implementação: [SPEC 097](../../specs/097-navegacao-mobile-bottom-bar-e-chip-nav.md).

## Consequências

**Positivas:**

- Qualquer tela do app fica alcançável em no máximo 2 toques a partir de qualquer ponto (hoje, com o drawer, também são 2 toques, mas sem visibilidade prévia dos 3 pilares).
- Reaproveita a arquitetura de módulos já existente (`modules.ts`) sem duplicar a lógica de permissão/gating — o chip-nav e a sidebar desktop leem do mesmo lugar.
- A barra nunca muda de forma entre empresas com planos diferentes (módulo bloqueado mostra estado vazio, não desaparece), o que é mais previsível para quem abre o app todo dia.

**Negativas:**

- Diverge do padrão observado nas 12 referências (nenhuma mistura destino + contexto + taxonomia de módulo na mesma barra, e nenhuma passa de 5 itens). Aceito conscientemente: o Pilar tem só 3 pilares fixos (não módulos ilimitados como ClickUp), e medido em viewport real a área de toque continua confortável.
- Expõe módulos que a empresa não contratou (ex. Obra desligada) como um item sempre visível na barra, ainda que vazio/bloqueado — decisão deliberada, não descuido.
- "Menu" duplica, por ora, o conteúdo do dropdown de usuário desktop em vez de compartilhar um componente único (risco registrado na spec 097, seção "Decisões e riscos" — resolver na implementação se o esforço permitir).

## Decisões relacionadas

- [SPEC 097](../../specs/097-navegacao-mobile-bottom-bar-e-chip-nav.md): requisitos, critérios de aceite e plano de implementação desta decisão.
- [ADR 0016](./0016-rotas-aninhadas-por-modulo.md) (se existir): rotas aninhadas por módulo — a base sobre a qual `routeToModule`/`MODULES` já foi construída.
- Base do racional: artifact "Pilar no bolso" (auditoria mobile + benchmark de 12 apps, 08/09/2026), seções 3 e 4.
