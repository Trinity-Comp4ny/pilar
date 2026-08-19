# ADR 0023: Adotar Framer Motion para animações do site de marketing

**Data:** 2026-08-18
**Status:** Accepted

## Contexto

`apps/marketing` (landing page, separada do app desde o [ADR 0021](./0021-marketing-site-separado-do-app.md)) hoje anima só via CSS (`@keyframes` em `index.css`) e uma classe `reveal-up` acionada por um `IntersectionObserver` manual escrito em `App.tsx`. Isso cobre fade-in simples, mas não escala para o nível de polish que a LP precisa agora: título com stagger palavra a palavra, crossfade cíclico entre screenshots do produto, e reveals coordenados por seção sem reescrever a lógica de observer a cada novo componente.

Opções consideradas:

- **Opção A, Continuar só com CSS + `IntersectionObserver` manual.** Prós: zero dependência nova, bundle mínimo. Contras: orquestração (stagger, exit animation, crossfade) fica verbosa e frágil em CSS puro; cada efeito novo é `@keyframes` + classe + estado manual.
- **Opção B, Framer Motion (`motion/react`).** Prós: padrão de mercado em React para este tipo de animação; `whileInView` substitui o observer manual; `AnimatePresence` resolve o crossfade do showcase de produto; `useReducedMotion` já integra com `prefers-reduced-motion` sem código extra. Contras: dependência nova (~40-50kb gzip), só usada em `apps/marketing`.
- **Opção C, GSAP.** Prós: mais poder para timelines complexas. Contras: overkill para o escopo (LP, não um site com storytelling scroll-driven pesado), API imperativa que não combina bem com componentes React declarativos, pacote maior.

## Decisão

Adotar **Framer Motion** (`framer-motion`, import via `motion/react`) como dependência de `apps/marketing/package.json`. Não adicionar ao app autenticado (`package.json` raiz), o isolamento de bundle entre marketing e app, já estabelecido no ADR 0021, se mantém.

Uso concreto:

```tsx
import { LazyMotion, domAnimation, m, AnimatePresence, useReducedMotion } from "framer-motion";

// apps/marketing/src/App.tsx: uma vez, na raiz
<LazyMotion features={domAnimation} strict>
  {/* ... */}
</LazyMotion>;
```

Import via `m` (não `motion`) dentro de um `<LazyMotion features={domAnimation} strict>` envolvendo o app: o modo `strict` obriga todo componente animado a usar `m.div`/`m.span`/etc em vez de `motion.*`, o que carrega só o subconjunto de features (`domAnimation`) em vez do pacote completo. Medido nesta rodada: `motion.*` puro gerava 561KB (183KB gzip) de bundle; trocar para `m` + `LazyMotion` reduziu para 514KB (169KB gzip). Ainda bem acima do baseline de 52KB gzip pré-Framer Motion (ver Negativas).

- Reveal de seção no scroll: `whileInView` + `viewport={{ once: true }}` substitui o par `reveal-up` (CSS) + `IntersectionObserver` manual de `App.tsx` (ver `Reveal.tsx`).
- Stagger do título do Hero: `variants` com `staggerChildren`.
- Crossfade do showcase de produto (`ProductShowcase`): `AnimatePresence mode="wait"`.
- Todo componente com animação de entrada consulta `useReducedMotion()` e reduz/pula a animação quando `true`.

Hover states simples (ex. botão) continuam em CSS/Tailwind, Framer Motion é só para o que CSS não orquestra bem (stagger, crossfade, whileInView).

## Consequências

**Positivas:**

- Menos código bespoke para orquestrar animação (sem observer manual em `App.tsx`).
- `prefers-reduced-motion` respeitado de forma consistente, sem reimplementar a checagem em cada componente.
- Abre caminho para os próximos polimentos da LP (parallax leve, micro-interação) sem nova decisão de lib.

**Negativas:**

- +1 dependência e ~117KB gzip a mais no bundle do site de marketing (169KB final vs. 52KB baseline pós-auditoria, ver memória `project_auditoria_landing_posicionamento_performance`), mesmo já usando `LazyMotion`+`m` para reduzir o pacote. É uma regressão real frente ao objetivo original do ADR 0021 (Lighthouse mobile ≥90, LCP ≤2.5s); validar com Lighthouse depois do merge e considerar follow-up (code-splitting por rota, adiar animação do showcase até após o LCP) se a régua não for atingida.
- Duas formas de animar convivendo no mesmo app (CSS para hover simples, Framer Motion para o resto), aceito conscientemente para não trocar o que já funciona.

## Decisões relacionadas

- [ADR 0021](./0021-marketing-site-separado-do-app.md): site de marketing separado, é o que permite isolar esta dependência.
- [SPEC 047](../../specs/047-redesign-landing-page.md): consome esta decisão para o showcase de produto e os reveals de seção.
