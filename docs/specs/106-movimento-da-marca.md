# SPEC: Movimento da marca (anel de leitura, ritmo e véu)

**Data:** 2026-10-09  
**Status:** Em implementação  
**Autor:** Matheus Rezende  
**Módulo:** transversal (app e landing)

Depende de: [ADR 0049](../architecture/adr/0049-movimento-fala-com-a-marca.md).
Referência visual: laboratório `kit-final.html` (estudo fora do repo, 4 rodadas, 9 out 2026).

## Problema

Toda espera do Pilar tem a mesma cara genérica: `Loader2` girando em 82 arquivos,
"Carregando..." em texto puro na entrada do app e tela em branco enquanto a landing
baixa. Nada disso parece o Pilar, e a entrada depois do login pisca entre estados.

## Objetivo

Toda espera, entrada e troca de tela usa o vocabulário da marca (a coluna e a poeira
em anel). Nenhum `Loader2` com `animate-spin` sobra no código.

**Fora de escopo:** reescrever gráficos para a animação P02 de montanha, o medidor em
cápsula (P04), a expansão de botão em marcos (T04) e a coluna de progresso do onboarding
(U02). Ficam para a SPEC seguinte, tela a tela.

## Requisitos

1. **Ritmo (L02):** a marca com as quatro caneluras subindo e descendo fora de fase
   substitui todo spinner pequeno: dentro de botão, em campo de busca, em linha de status.
2. **Botão ocupado (U01):** `Button loading` mostra o ritmo no lugar do spinner, mantém
   a cor e desabilita o clique.
3. **Anel de leitura (R1):** poeira cinza em anel com uma varredura verde que dá a volta,
   pulso de leitura a cada 3,4s e a marca no ritmo no centro. Substitui todo carregamento
   de página, seção e card.
4. **Espera curta não anima:** o anel só aparece depois de 300ms. Abaixo disso, nada.
5. **Boot:** ao abrir a landing ou o app, o anel aparece sobre a cor da página enquanto
   o JavaScript baixa e some com fade quando a primeira tela pinta.
6. **Véu de entrada (T02):** entre o login e a primeira tela do app (sessão, perfil e
   assinatura), a tela mostra o véu com o anel e "Abrindo {empresa}". Ao terminar, o véu
   sai com fade de 360ms sobre o app já montado.
7. **Navegação comum (T05):** trocar de módulo pela sidebar faz o conteúdo entrar com
   fade e 8px de subida em 180ms. A sidebar não se mexe. Trocar de aba dentro do mesmo
   módulo não anima.
8. **Rota preguiçosa:** enquanto o chunk de uma página baixa, a sidebar fica e o anel
   ocupa só a área de conteúdo.
9. **Marca:** o logo desenha o traço técnico (A01) ao entrar no login e no cadastro; no
   hover, as caneluras ficam verdes uma a uma (só cor, sem girar).

Não-funcionais:

- **Acessibilidade:** quem pede movimento reduzido vê o quadro final parado (anel
  desenhado, caneluras inteiras). Carregamento anunciado com `role="status"` e texto
  para leitor de tela.
- **Performance:** sem dependência nova. Ritmo e véu em CSS; anel em canvas 2D que
  pausa com a aba escondida ou fora da tela. O script do boot tem uns 4KB sem minificar.
- **Segurança:** o boot roda como arquivo estático (`/boot-ring.js`), porque o CSP não
  permite script inline.

## Critérios de aceite

- [ ] Nenhum `Loader2` nem `animate-spin` em `src/` e `apps/marketing/src/` (teste de
      varredura no Vitest).
- [ ] `Button loading` renderiza o ritmo, fica desabilitado e não usa `Loader2`.
- [ ] O anel não aparece antes de 300ms e aparece depois (teste com timers falsos).
- [ ] Com `prefers-reduced-motion: reduce`, o anel pinta um quadro só e não agenda frame.
- [ ] Rotas privadas em carregamento mostram o véu com o nome da empresa quando o perfil
      já chegou, e "Abrindo o Pilar" antes disso; nenhum "Carregando..." solto.
- [ ] Abrir `/` da landing e `/login` do app com rede lenta mostra o anel do boot, que
      some quando a página pinta.
- [ ] Trocar de Projetos para Financeiro anima o conteúdo; trocar de aba em Financeiro não.

## Dados e contratos

Nenhuma tabela, RPC ou edge function. Componentes novos em `src/components/motion/`:

- `PilarMark` (svg da marca; `variant`: `rhythm`, `draw` ou parada)
- `BusyMark` (ritmo inline, herda a cor do texto)
- `ReadingRing` (anel R1 em canvas; `size`, `delay`)
- `PageLoader` (anel centralizado com legenda opcional, para página e seção)
- `EntryVeil` e `VeilExit` (véu T02)
- `useRouteEnter` (T05 no `<main>`)

## Plano de implementação

1. Componentes de movimento + CSS de keyframes em `src/index.css`.
2. Codemod: `Loader2` com `animate-spin` vira `BusyMark` (inline) ou `PageLoader` (bloco
   centralizado de página/seção), revisado arquivo a arquivo.
3. `Button` e `Spinner` passam a usar o ritmo.
4. Boot da landing e do app (`index.html` + `/boot-ring.js`).
5. `PrivateRoute` com o véu; `Layout` com Suspense local, T05 e saída do véu.
6. Logo: A01 no login e cadastro, hover A07; landing com o mesmo hover.
7. Teste de varredura, testes dos componentes, typecheck, lint, build.
