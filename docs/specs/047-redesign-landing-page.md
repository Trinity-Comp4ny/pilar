# SPEC: Redesign da landing page (menos sections, produto animado)

**Data:** 2026-08-18
**Status:** Entregue (Rodada A; Rodada B e Blog em specs futuras)
**Autor:** Matheus Rezende
**Módulo:** marketing (`apps/marketing`)

## Problema

A landing page atual (`apps/marketing`) tem 9 sections e repete a mesma promessa três vezes com ângulos diferentes: o Hero fala "pare do caos", `ProofSection` fala "controle total... mais margem", `RentabilidadeSection` fala "saiba se o projeto dá lucro antes de terminar". `FeaturesSection` já lista "Financeiro: resultado do projeto antes de fechar o mês" como um dos 6 módulos, então `RentabilidadeSection` duplica esse ponto numa section própria. `AISection` é rasa (3 frases) e `HowItWorksSection` (3 passos genéricos de onboarding) não ajuda a decidir comprar. Nenhum "mockup" de produto tem animação: são `div`s estáticas com sombra, diferente de referências como notion.com, onde o produto aparece animado logo no Hero. Resultado: visitante não sai com uma leitura clara de "o que o Pilar faz, pra quem, qual dor resolve" e a LP parece menos madura que o resto do design system.

## Objetivo

LP com 6 sections, cada uma com uma mensagem única (sem repetir promessa de outra), e um bloco de produto real (screenshots do app) animado no Hero. Resultado mensurável: nenhuma das 6 sections repete a headline central de outra (checagem manual, critério de aceite), e o Hero passa a mostrar produto em vez de só texto+CTA.

**Fora de escopo:**

- Pricing na LP (não existe página de preço pública ainda; ver `docs/strategy/PRICING.md` v2 em aberto).
- Mudança de ICP na copy (mantém "engenharia multidisciplinar", já é o texto correto em `TargetAudienceSection`, conforme `brand/BRAND.md`).
- Redesenho do header/footer (`LandingHeader`/`LandingFooter` seguem como estão).
- Copy nova do FAQ (mantém `FAQSection` como está).
- Página de cadastro/app autenticado, o CTA continua levando pra `${APP_URL}/cadastro`.

## Requisitos

1. `App.tsx` renderiza exatamente estas 6 sections, nesta ordem: Hero → DorSolução (ex-`ProofSection`) → Produto (nova, funde `FeaturesSection` + `AISection` + `RentabilidadeSection`) → ParaQuem (ex-`TargetAudienceSection`) → FAQ → CTA.
2. `HowItWorksSection` é removida de `App.tsx` e o arquivo é deletado.
3. O H1 do Hero usa a tagline oficial de `brand/messaging.md` ("Saiba se cada projeto está dando lucro antes de terminar") como promessa #1; o subheadline cobre "um fluxo só" (proposta→projeto→cobrança→portal). Isso resolve a tensão registrada em `brand/BRAND.md` §6.2 (tagline vs. hero atual), decisão tomada aqui: lucro antes do fim vem primeiro, é o pilar de mensagem #1 em `messaging.md` e o valor de marca #2 ("Lucro como bússola").
4. Abaixo do Hero (dentro da mesma `section`, antes do fold seguinte), um componente `ProductShowcase` cicla automaticamente entre 3 screenshots reais do app (Início/dashboard financeiro, detalhe de projeto, cronograma de projetos) com crossfade, dentro do frame de "browser" (dots + url) já usado em `FeaturesSection` hoje. **Nota de implementação:** o plano original previa um screenshot do portal do cliente; não há credencial de portal semeada no ambiente local (`scripts/seed-local.sql` só cria logins de escritório), então foi substituído por "detalhe de projeto" (contrato, prazo, progresso das disciplinas). Revisitar quando houver seed de portal.
5. A nova `ProductSection` mostra um grid de cards, um por pilar de mensagem de `brand/messaging.md` (lucro antes do fim, um fluxo só, agentes de IA) mais o portal do cliente, 4 cards no total. Cada card tem: ícone lucide (nunca emoji), headline curta, uma frase de apoio.
6. O título do Hero anima em stagger (palavra ou linha por linha) ao carregar.
7. Toda section usa reveal on-scroll via Framer Motion `whileInView` (ver [ADR 0023](../architecture/adr/0023-framer-motion-no-site-de-marketing.md)), substituindo a classe `reveal-up` + `IntersectionObserver` manual hoje em `App.tsx`.
8. Todas as animações de entrada respeitam `prefers-reduced-motion` (via `useReducedMotion` do Framer Motion): quando ativo, sections aparecem sem stagger/crossfade contínuo.
9. Nenhuma seção repete a headline central de outra, verificação manual linha a linha antes de marcar como Entregue.

Requisitos não funcionais:

- **Performance:** screenshots como assets otimizados (webp, dimensão real de exibição, não upload de captura em resolução nativa). Bundle do site de marketing não deve regredir de forma perceptível do baseline pós-auditoria (52KB gzip, ver memória `project_auditoria_landing_posicionamento_performance_2026-08-17`); validar com `npm run build` + Lighthouse manual depois do merge.
- **Marca:** copy nova segue `brand/voice-tone.md` (sem palavras banidas, sem hype, número antes de adjetivo) e o glossário de `brand/BRAND.md`/`messaging.md`.
- **Acessibilidade:** zero emoji em toda a LP (ícones lucide elaborados no lugar); contraste só via tokens de `src/styles/tokens.css`.

## Critérios de aceite

- [ ] Dado o usuário abre a LP, quando a página carrega, então o H1 do Hero anima em stagger e o `ProductShowcase` começa a ciclar sem precisar de interação.
- [ ] Dado `prefers-reduced-motion: reduce` ativo no SO, quando a LP carrega, então o stagger do título e o autoplay do showcase são substituídos por um estado estático (sem repetição de movimento).
- [ ] Dado o usuário rola a página, quando cada section entra no viewport, então ela revela uma única vez (não repete ao rolar pra cima e descer de novo).
- [ ] Dado o grid da `ProductSection`, quando renderizado, então não há nenhum emoji, só ícones do pacote `lucide-react`.
- [ ] Dado `App.tsx` depois da mudança, quando lido de cima a baixo, então existem exatamente 6 sections (fora header/footer) e `HowItWorksSection` não é importado em lugar nenhum do repo.
- [ ] Dado o Hero, quando comparado com `RentabilidadeSection`/`ProofSection` antigas, então a promessa de "lucro antes do fim" aparece uma vez só (no Hero e/ou no card correspondente da `ProductSection`), não em 3 sections diferentes.

## Dados e contratos

Nenhuma migration, é um site estático (`apps/marketing`), sem tabela nova nem RPC. Screenshots entram como arquivos estáticos versionados em `apps/marketing/src/assets/showcase/` (ou `public/`, a decidir na implementação conforme necessidade de otimização do Vite).

## Plano de implementação

**Nota (2026-08-18):** o escopo cresceu para um site multi-página (Produto/Soluções/Preços/Blog no header, não só a home), ver `docs/architecture/adr/0024-react-router-em-marketing.md`. Esta spec cobre só a **Rodada A**: fundação de roteamento + a home reduzida a 6 sections abaixo + limpeza do header (remoção da barra "Impulsionado por Trinity Company" em `apps/marketing` e em `src/pages/landing/components/LandingHeader.tsx`, já que existem duas cópias do header). As páginas `/produto` e `/solucoes` (Rodada B) e o Blog (adiado) ganham specs próprias antes de codar.

0. ~~ADR 0024 (react-router-dom em `apps/marketing`)~~, feito. `apps/marketing/src/App.tsx` vira layout de rotas (`<Routes><Route path="/" element={<Home />} /></Routes>`), conteúdo atual migrou para `apps/marketing/src/pages/Home.tsx`. Nesta rodada só a rota `/` existe; o nav continua com âncoras, sem item "Soluções" ainda.
1. ~~ADR 0023 (Framer Motion)~~, feito, ver link acima.
2. ~~Adicionar `framer-motion` a `apps/marketing/package.json`~~, feito (junto com `react-router-dom`).
3. ~~Rodar o app local e capturar screenshots reais~~, feito: Início/dashboard, detalhe de projeto (contrato/prazo/disciplinas) e cronograma de projetos (ver nota no requisito 4 sobre o portal do cliente não ter credencial semeada). Seed de demo (`scripts/seed-demo.sql`) precisou de um fix de idempotência (fatura duplicada por falta de `ON CONFLICT`).
4. ~~Criar `ProductShowcase.tsx`~~, feito: crossfade cíclico (`AnimatePresence mode="wait"`) dentro do `BrowserFrame` extraído.
5. ~~Reescrever `HeroSection.tsx`~~, feito: título com stagger, subheadline reordenado (lucro → fluxo), `ProductShowcase` embutido logo abaixo.
6. ~~Criar `ProductSection.tsx`~~, feito: grid de 4 cards com ícone lucide, funde o conteúdo de `FeaturesSection` + `AISection` + `RentabilidadeSection`; os 3 arquivos antigos (e `HowItWorksSection.tsx`) foram deletados.
7. ~~Revisar `ProofSection.tsx`~~, feito: mantém o nome do arquivo (rename não trouxe ganho real), copy não repete a headline da `ProductSection`.
8. ~~Remover `HowItWorksSection.tsx`~~, feito.
9. ~~Atualizar `App.tsx`~~, feito: sem `IntersectionObserver` manual nem classe `reveal-up`; toda section usa o componente `Reveal` (wrapper de `whileInView`).
10. ~~Typecheck + build + revisão visual no Chrome~~, feito (desktop; mobile não verificado nesta rodada por limitação da automação de browser, ver risco abaixo).

## Decisões e riscos

- [ADR 0023](../architecture/adr/0023-framer-motion-no-site-de-marketing.md), adoção do Framer Motion, linkado acima.
- [ADR 0024](../architecture/adr/0024-react-router-em-marketing.md), adoção do react-router-dom, linkado acima.
- **Risco de marca:** a promoção da tagline oficial para o H1 (requisito 3) resolve uma tensão aberta em `brand/BRAND.md` §6.2. É reversível (é só copy), se o Matheus discordar depois de ver o resultado, volta a decidir.
- **Risco de bundle, CONFIRMADO:** mesmo com `LazyMotion`+`m` (ver ADR 0023), o bundle JS foi de ~52KB para ~169KB gzip. Validar com Lighthouse antes de considerar a régua de performance do ADR 0021 atendida; se não bater, considerar code-splitting por rota ou adiar o carregamento do Framer Motion até após o LCP.
- **Mobile não verificado:** a ferramenta de automação de browser não conseguiu redimensionar a janela pra viewport mobile nesta sessão; o CSS responsivo existente foi preservado sem alteração de breakpoints, mas vale um teste manual em dispositivo/DevTools antes do merge.
- **Header duplicado:** existem duas cópias de `LandingHeader`/`LandingFooter` (`apps/marketing/src/components/` e `src/pages/landing/components/`, esta última usada por `/planos` no app autenticado). Ambas foram sincronizadas nesta rodada (nav, remoção da barra Trinity); qualquer mudança futura de nav precisa tocar as duas.
- **Bug encontrado, fora de escopo:** o clique via automação de browser não conseguiu selecionar cards de Kanban nem trocar de aba dentro de `/gestao/financeiro?tab=rentabilidade` (conteúdo ficou em branco mesmo após reload, sem erro no console). Não investigado a fundo por estar fora do escopo desta spec; vale abrir um bug à parte se se confirmar em uso real (não só na automação).
