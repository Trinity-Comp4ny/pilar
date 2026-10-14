# ADR 0049: Toda espera e transição usa o vocabulário da marca

**Data:** 2026-10-09  
**Status:** Accepted

## Contexto

O app tinha 226 usos de `Loader2` com `animate-spin`, um `Spinner` genérico e
"Carregando..." em texto na entrada. A landing ficava em branco enquanto baixava. Um
estudo de movimento com 4 rodadas (31 variações, 13 favoritas, 3 decisões) fechou um
kit próprio, adaptado do ADR 0047 do Precursal ("motion speaks with the mark"):

- **Opção A: manter ícones de spinner da biblioteca.** Zero custo, zero identidade.
- **Opção B: biblioteca de animação (Lottie, framer em todo o app).** Peso extra no
  bundle do app e arquivos fora do código.
- **Opção C: kit próprio em CSS, Web Animations e canvas 2D.** Leve, versionado no repo,
  com a marca. Exige disciplina para não virar enfeite.

## Decisão

Opção C. O movimento fala com a marca:

- **Ritmo** (as quatro caneluras subindo e descendo) é a espera inline: botão, campo,
  linha de status. Nunca `Loader2`.
- **Anel de leitura** (poeira cinza em anel com varredura verde) é a espera de página,
  seção, card, boot e véu. Aparece só depois de 300ms.
- **Véu** cobre a entrada no app; navegação comum só faz fade de 180ms no conteúdo.
- **Marca** se desenha pelo traço técnico; no hover muda só a cor.
- Movimento só enquanto há trabalho real. Uma coisa se mexe por vez. Movimento reduzido
  mostra o quadro final.
- Componentes em `src/components/motion/`. Um teste de varredura impede `Loader2` e
  `animate-spin` de voltarem.

## Consequências

**Positivas:**

- Toda espera parece Pilar, e mudar o kit é mexer em um lugar só.
- Nada de dependência nova; o anel pausa fora da tela e com a aba escondida.

**Negativas:**

- Canvas exige cuidado com densidade de pixel e com teste (jsdom não pinta).
- O boot precisa de um script estático (`/boot-ring.js`) duplicando a lógica do anel,
  porque o CSP barra script inline e o React ainda não carregou nesse momento.

## Decisões relacionadas

- [SPEC 106](../../specs/106-movimento-da-marca.md): o que foi implementado e os critérios.
- ADR 0008 (design system): o `Spinner` de lá passa a usar o ritmo.
