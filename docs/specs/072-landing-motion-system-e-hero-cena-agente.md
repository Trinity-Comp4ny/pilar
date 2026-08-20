# SPEC: Sistema de movimento da landing e hero em cena de agente

**Data:** 2026-08-20
**Status:** Em implementação
**Autor:** Matheus Rezende
**Módulo:** marketing (apps/marketing)

## Problema

A landing não convence e não retém. Três causas concretas, levantadas na auditoria
visual de 20/08 (LP rodando em `localhost:8082`, viewport 1440):

1. **A hero não mostra o produto.** O `ProductTour` divide a atenção em 3 abas com
   autoplay de 7s, e o conteúdo de cada aba é um mock vetorial em cinza claríssimo.
   Em 5 segundos o visitante não entende o que o Pilar faz.
2. **A página não tem vida.** Existe uma única animação de entrada em toda a LP
   (`Reveal`: opacity 0→1, y 32→0, 700ms, easeOut), aplicada identicamente a tudo.
   Nada acoplado ao scroll, nenhum stagger real, nenhum contador, nenhuma revelação
   de texto.
3. **O ritmo é monótono.** Cinco seções seguidas com a mesma forma (badge uppercase
   → h2 metade em itálico → parágrafo → conteúdo), todas sobre dois cinzas
   praticamente idênticos (`paper` 97% vs `paper-alt`), com blocos grandes de espaço
   morto.

Bug encontrado no caminho: o `ChatDemo` do `AgentsSection` renderiza um retângulo
branco vazio de 250px por até 2,5s (e permanentemente se o `IntersectionObserver`
não bater `threshold: 0.35`), porque cada balão nasce em `opacity: 0` esperando um
`setTimeout` que só arma depois do observer.

## Objetivo

Um visitante que chega na LP entende o que o Pilar faz nos primeiros 5 segundos,
sem clicar em nada, e percorre a página inteira com sensação de continuidade.

**Fora de escopo:** vídeo gravado do produto real (decisão de 20/08: a hero é
animação em código, com o componente preparado para receber um `<video>` depois);
páginas `/gestao`, `/projetos`, `/obra`, `/planos` e `/faq` (ficam para a rodada
seguinte); mudança de paleta ou de tipografia da marca (Paper + Ink permanece).

## Requisitos

1. A hero mostra **uma cena única e contínua** em loop, sem abas e sem escolha do
   visitante: um mock do Pilar operado por um agente de IA invisível, representado
   por um cursor com rastro e um rótulo do que ele está fazendo.
2. A cena conta a história da tagline de ponta a ponta, na ordem: pedido em
   português ao copiloto → rascunho montado campo por campo → aprovação → lead
   atravessa o funil → receita entra no dashboard → margem do projeto recalculada.
3. A cena reinicia sozinha em loop, **pausa** quando sai da viewport ou quando a
   aba perde o foco, e serve um **frame final estático** com
   `prefers-reduced-motion: reduce`.
4. Existe um módulo de movimento reutilizável (`src/lib/motion.ts` + primitivas em
   `src/components/motion/`) com pelo menos: reveal com variantes, stagger de
   container/item, revelação de texto por palavra, contador numérico, parallax
   acoplado ao scroll, marquee e barra de progresso de leitura.
5. Cada seção da home usa uma coreografia **diferente** das demais. Nenhuma seção
   pode ser apenas `Reveal` com os valores padrão.
6. O ritmo de fundo alterna claro e escuro. A seção de agentes é o clímax escuro
   (fundo `ink`), e o CTA final fecha em escuro.
7. A home ganha uma faixa de prova entre a hero e os módulos (números do produto,
   não depoimento inventado).
8. O `ChatDemo` nunca renderiza vazio: sem animação disponível, nasce completo.

Não-funcionais:

- **Performance:** o custo desta feature no bundle inicial fica em até +15KB gzip
  sobre a base. Medido em 20/08: `origin/staging` entrega 178,8KB gzip e a versão
  com a cena entrega 190,7KB, ou seja +11,9KB. (O número de 52KB citado na
  auditoria de 17/08 está velho: a LP cresceu desde então. Reduzir a base é
  trabalho à parte, não desta spec.) A cena anima só `transform` e `opacity`;
  nada de animar `width`, `top` ou `box-shadow` em loop, e o loop para fora da
  viewport.
- **Acessibilidade:** a cena é decorativa (`aria-hidden`), com um resumo textual
  equivalente para leitor de tela. Todo movimento respeita
  `prefers-reduced-motion`.
- **Design system:** cor só por token semântico (ADR 0008). Nada de paleta crua.
- **Dependências:** nenhuma biblioteca de animação nova. As primitivas são
  adaptadas à mão a partir dos padrões públicos de MagicUI / React Bits / 21st.dev
  sobre o `framer-motion` que já está instalado, mesmo caminho já usado no
  `ModuleConnector` ("Animated Beam, adaptado").

## Critérios de aceite

- [ ] Dado um visitante em desktop, quando a home carrega, então a hero exibe uma
      cena única em movimento (sem abas) e o primeiro ato começa em menos de 1s.
- [ ] Dado que a cena chegou ao último ato, quando o loop termina, então ela
      reinicia do primeiro ato sem salto visual.
- [ ] Dado `prefers-reduced-motion: reduce`, quando a home carrega, então a cena
      mostra o estado final estático e nenhum loop infinito roda na página.
- [ ] Dado que a hero saiu da viewport, quando o visitante está lendo outra seção,
      então a cena está pausada (nenhum timer da cena disparando).
- [ ] Dado um scroll rápido do topo ao rodapé, quando qualquer seção passa, então
      nenhum bloco fica em branco ou preso em `opacity: 0`.
- [ ] Dado o `ChatDemo`, quando ele é montado fora da viewport, então seu conteúdo
      já está presente no DOM e visível ao entrar em vista.
- [ ] Dado `npm run build` em `apps/marketing`, então o chunk inicial da home não
      cresce mais de 15KB gzip sobre `origin/staging`.
- [ ] Caso de borda: aba em segundo plano por 2 minutos, quando o visitante volta,
      então a cena retoma sem acumular atraso nem pular atos.

## Dados e contratos

Nenhum. É front puro em `apps/marketing`, sem tabela, RPC ou edge function.

## Plano de implementação

1. `src/lib/motion.ts`: durações, easings e variantes compartilhadas.
2. `src/components/motion/`: `Reveal` (com variantes), `TextReveal`, `NumberTicker`,
   `Parallax`, `Marquee`, `ScrollProgress`, `GridBackdrop`.
3. `src/components/hero/`: motor de timeline (`useScene`) + `HeroScene` + os
   painéis do mock do produto, mais `HeroSceneMobile`: o palco de desktop tem
   1120px fixos e escala para ~0,30 num celular de 390px, o que transformaria um
   rótulo de 10,5px em 3,2px. Abaixo de `md` a mesma história roda em retrato,
   sem a moldura do app, com o mesmo relógio e o mesmo roteiro.
4. `HeroSection` passa a usar `HeroScene`; `ProductTour` e `ProductShowcase` saem
   da home.
5. `ProofStrip` nova, entre hero e módulos.
6. Retrabalho de `ModulesSection`, `AgentsSection` (fundo escuro + fix do chat),
   `CampoSection`, `PortalSection` e `CTASection`, cada uma com coreografia própria.
7. Verificação ao vivo no Chrome (desktop e mobile) + `typecheck` + `build`.

## Decisões e riscos

- **Decisão:** a hero é animação em código, não vídeo. Motivos: nitidez em retina,
  peso (KB contra MB, e a LP inteira hoje tem 52KB gzip depois da auditoria de
  17/08), e a cena continua editável linha a linha quando o produto mudar. O
  `HeroScene` fica isolado atrás de um componente único, então trocar por `<video>`
  depois é substituir um arquivo.
- **Decisão:** o agente é um cursor com rastro e rótulo, não um mascote. Um
  personagem ilustrado conflita com "calma, técnica, premium" do
  `brand/visual.md` e com o ICP (sócio de escritório de engenharia).
- **Risco:** cena longa demais cansa. Mitigação: loop de ~20s, cada ato com leitura
  própria, e nada que exija esperar para entender.
- **Risco:** o mock da hero envelhece em relação ao produto real. Mitigação: o mock
  reproduz layout e linguagem, não pixels; e o critério é a história, não a
  fidelidade de cada campo.
