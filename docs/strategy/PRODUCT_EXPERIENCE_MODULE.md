# Product Experience — versionamento, "What's New" e polimento de SaaS

← [voltar ao índice](./README.md) · Status: **ideia registrada, NÃO implementar ainda** · 2026-07-16

Origem: conversa do Matheus com o GPT sobre in-app messaging, versionamento de
release e os "detalhes que sobem o nível de um SaaS". Este doc guarda a ideia e
adiciona a leitura crítica pro estágio real do Pilar (solo founder, pré-primeiro
pagante). A ideia bruta do GPT é boa; o risco é tratar a lista de 36 itens como
backlog. Não é. A maior parte é prematura.

---

## 1. A ideia central (vale guardar)

Três conceitos que valem para o Pilar:

**a) Separar deploy técnico de release de produto.** Vários deploys por dia
(fix de CSS, refactor, feature flag) não viram aviso pro usuário. Um "release"
é só quando há algo que o cliente precisa saber. Deploy é automático e contínuo;
release é curado e raro.

**b) In-app messaging orientado a dados, não a código.** Em vez de codar um modal
novo a cada novidade, ter uma estrutura (tabela/CMS) que descreve a campanha:
tipo (modal, banner, tooltip, toast), público, regra de exibição (show once,
após X dias, só quem não usou a feature), janela de datas. O frontend lê e
renderiza. Anunciar deixa de exigir deploy.

**c) Registro por usuário do que já foi visto.** Para autenticado, salvar no
banco (não só localStorage): `user_id + release_id + viewed_at/dismissed_at`.
localStorage some ao trocar de máquina ou limpar navegador e não deixa medir
adoção. localStorage serve como cache ou para não-autenticado.

### Esqueleto de dados proposto (referência, não schema final)

```
product_releases        -- id, version, title, summary, released_at, status, audience, feature_flag, show_modal, show_once
release_items           -- release_id, title, description, category, image_url, video_url
release_tour_steps      -- release_id, target_selector, title, description, position, sort_order
user_release_interactions -- user_id, release_id, viewed_at, dismissed_at, completed_at
```

Versionamento: SemVer (MAJOR.MINOR.PATCH) interno pra log/suporte; nome amigável
("Atualização de julho", "Nova visão de fluxo de caixa") pro usuário. Dois níveis
de changelog: técnico (commits/PRs) e voltado ao cliente (uma frase de valor).

Bibliotecas de tour citadas: Shepherd.js, React Joyride, Driver.js, Intro.js.
Ferramentas de mercado da categoria: Intercom, Appcues, Userpilot, Pendo,
Chameleon.

---

## 2. Leitura crítica — o que disso serve ao Pilar HOJE

O estágio manda. Pilar é solo founder, sem primeiro pagante fechado, com dívida
estrutural conhecida (páginas-deus, cobertura de teste zero no financeiro, bugs
de dinheiro já mapeados). Nesse contexto, a maioria dos 36 itens "enterprise"
que o GPT listou é polimento que ninguém está pedindo e que não move a agulha da
primeira venda. O valor real está em separar sinal de ruído.

### Vale de verdade (barato e melhora percepção real)

- **Empty states com ação** — hoje há telas que só mostram "sem dados". Trocar
  por "ainda não há projetos → [criar projeto]" é barato e some com a sensação
  de produto vazio. Ligado ao onboarding do design partner.
- **Estados de erro com próximo passo** — já é padrão de marca do Matheus
  (mensagem diz o que houve + próximo passo, sem "Oops!"). É consistência, não
  feature nova.
- **Skeletons / loading decente** — percepção de velocidade, custo baixo.
- **Undo em deletes** — já mapeado nos bugs de corretude (deletes sem
  confirmação/undo). É correção de bug, não polimento.
- **Feature flags** — já reconhecido como necessário (ligar plano→feature ainda
  não existe no código; ativar features dormentes com segurança).

### Vale, mas só perto/depois do primeiro pagante

- **"What's New" / release notes** — só faz sentido quando existe alguém do
  outro lado para quem anunciar. Com 1 design partner, um e-mail ou uma mensagem
  no WhatsApp entrega o mesmo valor sem construir CMS nenhum. Guardar o esqueleto
  de dados para quando houver >1 cliente ativo.
- **Central de novidades / changelog público** — mesmo raciocínio, escala.
- **Command palette (⌘K), busca global, favoritos, recentes** — ótimos, mas são
  conforto de usuário recorrente. Não convencem ninguém a comprar.

### Cuidado / provavelmente não (pro estágio atual)

- **Status page, roadmap público, SSO/SAML, custom roles, API pública, webhooks,
  sandbox, A/B testing, health score, analytics interno completo** — tudo isso é
  linguagem de produto com muitos clientes e time. Construir agora é teatro de
  maturidade: parece profissional, custa caro, não tem quem consuma. Vira dívida.
- **Audit trail completo (quem/quando/antes/depois/IP)** — atenção: parte disso
  pode ser exigência real do ICP (engenharia, dado de dinheiro), então NÃO
  descartar como vaidade. Avaliar caso a caso quando um cliente pedir compliance.

---

## 3. Se um dia construir o módulo "Product Experience"

A tese do GPT (um CMS interno que unifica onboarding, tours, "What's New",
banners, tooltips, checklists e pesquisas rápidas, com segmentação por
plano/empresa/feature-flag) é arquiteturalmente correta e é o caminho maduro.
Mas é um módulo inteiro. Regras de sequenciamento:

1. **Gatilho de início:** só depois de ≥3 clientes ativos e de a cadência de
   release justificar ("estou anunciando coisa toda semana e cansei de codar
   modal"). Antes disso, e-mail direto ganha.
2. **Fatiar, não construir tudo:** primeiro só `product_releases` +
   `user_release_interactions` + um modal simples lido do banco. Tour, tooltip,
   pesquisa, segmentação vêm depois, cada um puxado por dor concreta.
3. **Amarrar a feature-flag:** o mesmo mecanismo que libera a feature dispara o
   anúncio pra quem recebeu. Reaproveita infra que já vai existir.
4. **Comprar antes de construir:** avaliar Pendo/Appcues/Userpilot no free tier.
   Se resolver, não codar. Construir só se virar custo ou se precisar de
   integração profunda com o dado do Pilar.

---

## 4. Conexão com o que já existe no repo/estratégia

- Bugs de corretude 2026-07-13: deletes sem confirmação/undo → item "Undo" acima
  já é trabalho previsto, não novo.
- Padrão de marca (CLAUDE.md global): erro com próximo passo, empty state que
  orienta, microcopy em voz ativa → o "polimento" que vale já é regra escrita.
- Feature flags: pré-requisito para ligar plano→features (PRICING v1 ainda não
  liga isso no código).
- TODO config/admin 2026-07-14: profissionalismo de admin/super-admin é o vetor
  de "maturidade" mais urgente que este aqui — priorizar aquele primeiro.

---

## 5. Veredito de uma linha

Guardar a arquitetura (é o caminho certo pra depois), executar só os 4-5 itens
baratos que também são correção/consistência, e resistir à tentação de construir
"maturidade enterprise" antes de existir um cliente pagando para consumi-la.
