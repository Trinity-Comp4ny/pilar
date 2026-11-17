# Jornada comercial: antes e depois

**Estado desta evidência:** capturas concluídas, integridade verificada e inspeção estática dos 10 pares realizada, sem regressão visual aparente. As interações foram cobertas apenas pelos testes de marketing, não por estas capturas estáticas.

## Procedência

- [Execução de captura 43869838239](https://github.com/Trinity-Comp4ny/pilar/actions/runs/43869838239), concluída com sucesso em 16/11/2026.
- Artifact `14227801316`; SHA-256 do ZIP: `c435671d3701d70d930bc11fd2f94a84a4f87789a2c8ca388f82a49c1c9aa6c9`.
- **Antes, checkout executado:** `efc534fdf0e42a56eb65dd6739ed9a81a5c8df27`.
- **Depois, checkout executado:** `49513dbdb33854a01ec7218620fbf8e53820f4c1`.
- **Head comercial representado pelo depois:** `a46c53ae8476b8b1007455059ef528b9c81cdd9f`, da branch `fix/commercial-onboarding-journey`.

O depois foi capturado na branch temporária `fix/capture-commercial-20261116`. Entre o head comercial e o checkout capturado, mudam somente o workflow e os dois scripts auxiliares; nenhuma entrada visual da aplicação difere. Os auxiliares ficam fora da branch final.

## Metodologia

O runner fez checkout separado de cada SHA, instalou as dependências de cada lockfile e compilou o site real de marketing. A base de staging foi resolvida uma vez no começo do job, validada e usada como SHA imutável no checkout. O arquivo `capture-manifest.json` preserva os SHAs que foram efetivamente executados.

- Chromium com Playwright; Node 22 no runner.
- Desktop: viewport 1440 × 1000; mobile: 390 × 844; escala de dispositivo 1.
- Mesmas rotas, locale pt-BR, fuso America/Sao_Paulo, tema claro e movimento reduzido nos dois lados.
- Capturas de página completa, com fontes carregadas e conteúdo percorrido antes do print.
- Consentimento de analytics desativado em ambos. Apenas conteúdo público do site compilado localmente, sem login ou dados reais de clientes. Nenhuma origem externa foi necessária durante a captura.
- Cada par reúne os prints reais, lado a lado, com rótulos ANTES e DEPOIS. Não houve reconstrução ou modificação do conteúdo da interface.

Os dez JPEGs extraídos do artifact foram mantidos byte a byte. Seus hashes, dimensões e tamanhos estão em `sha256-manifest.json`.

## Base e entradas visuais verificadas

Na conferência de 16/11/2026 após o download, staging apontava para `efc534fdf0e42a56eb65dd6739ed9a81a5c8df27`, exatamente o SHA capturado no antes.

Também foi conferido que as entradas visuais abaixo não mudaram entre a base original da proposta (`2d70a53843f304882e035f61e4a7339f3d29698c`) e a base capturada. Entre o head comercial e o depois capturado, essas mesmas entradas são idênticas:

- `apps/marketing/`
- `src/styles/`
- `src/components/motion/`
- `tailwind.config.ts`
- `package.json` e `package-lock.json`
- `.npmrc`

Revalidar staging no momento de abrir o PR. Se qualquer entrada visual mudar, gerar a evidência correspondente de novo. O SHA de uma captura anterior não deve ser substituído no registro para aparentar que outro commit foi executado.

## Pares

| Tela | Rota | Desktop | Mobile |
| --- | --- | --- | --- |
| Home | `/` | [home-desktop.jpg](./home-desktop.jpg) | [home-mobile.jpg](./home-mobile.jpg) |
| Engenharia | `/engenharia` | [engenharia-desktop.jpg](./engenharia-desktop.jpg) | [engenharia-mobile.jpg](./engenharia-mobile.jpg) |
| Arquitetura | `/arquitetura` | [arquitetura-desktop.jpg](./arquitetura-desktop.jpg) | [arquitetura-mobile.jpg](./arquitetura-mobile.jpg) |
| Planos | `/planos` | [planos-desktop.jpg](./planos-desktop.jpg) | [planos-mobile.jpg](./planos-mobile.jpg) |
| FAQ | `/faq` | [faq-desktop.jpg](./faq-desktop.jpg) | [faq-mobile.jpg](./faq-mobile.jpg) |

A inspeção estática cobriu os cinco pares desktop e os cinco pares mobile, com revisores independentes. Ela não identificou defeito visual introduzido bloqueante. Os testes automatizados de marketing cobrem as interações verificadas; as imagens não validam cliques, navegação ou atendimento comercial. Incorporar as imagens no corpo do PR com URLs fixadas no SHA do commit que as contém, conforme `CLAUDE.md`.
