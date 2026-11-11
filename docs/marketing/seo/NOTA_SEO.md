# Nota de SEO da landing

Nota de 0 a 100 para acompanhar o quanto o site está preparado para aparecer no Google em buscas como
"software de gestão para escritório de engenharia" e "sistema para escritório de arquitetura".

A nota é calculada por script, não por opinião: `apps/marketing/scripts/seo-nota.mjs` lê o HTML
pré-renderizado de cada URL do sitemap (o mesmo que o Google lê), o conteúdo do blog e a checklist
de itens fora do código em [`checklist-externo.json`](./checklist-externo.json).

```bash
npm run build:prerender --workspace=apps/marketing   # gera dist/ com o HTML de cada rota
npm run seo:nota --workspace=apps/marketing          # imprime a nota e onde estão os próximos pontos
```

> A nota mede o **build**, não o site no ar. Depois de cada release, abra uma página interna em
> produção (ex.: `https://www.pilarsoft.com.br/engenharia`) e confira no Search Console › Páginas se
> não surgiram erros 404: foi assim que o incidente de 11/11 apareceu, e a nota não o pegava.

> Nota alta não garante posição: ela mede o que está sob nosso controle. A posição real vem do
> Search Console (impressões, cliques, posição média por busca), que deve ser lido a cada 15 dias.

## Histórico

| Data       | Nota   | Técnico /20 | On-page /25 | Conteúdo /30 | Dados estruturados e IA /10 | Autoridade e medição /15 | O que mudou                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | ------ | ----------- | ----------- | ------------ | --------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-10 | **30** | 18          | 8,8         | 1,2          | 1,8                         | 0                        | Ponto de partida: 12 páginas, sem blog, títulos sem palavra-chave ("Gestão \| Pilar"), H1 de marca, `llms.txt` dizendo que o Pilar "não é ferramenta de arquitetura".                                                                                                                                                                                                   |
| 2026-11-10 | **72** | 20          | 25          | 16,6         | 10                          | 0                        | Blog com 8 artigos, páginas `/engenharia` e `/arquitetura`, título/descrição/H1 com palavra-chave em todas as páginas, `lastmod` no sitemap, `offers` e `sameAs` no JSON-LD, BlogPosting/Breadcrumb/FAQ nos artigos, `llms.txt` corrigido.                                                                                                                              |
| 2026-11-10 | **79** | 20          | 25          | 24           | 10                          | 0                        | Blog com 20 artigos, ferramentas abertas (`/ferramentas/calculadora-de-honorarios` e `/ferramentas/modelo-de-proposta`) e comparativos `/vs/whatsapp`, `/vs/notion` e `/vs/erp-construtora`. No site, só faltam os 20 artigos para a meta de 40 (6 pontos); o resto da nota está fora do código.                                                                        |
| 2026-11-10 | **85** | 20          | 25          | 30           | 10                          | 0                        | Blog com 40 artigos (meta batida), feed RSS, IndexNow, PostHog carregado só após consentimento (JS inicial de 247 KB para 136 KB comprimidos) e canal/página no evento de clique. Tudo o que está no código está no máximo; os 15 pontos restantes estão em [TAREFAS.md](./TAREFAS.md).                                                                                 |
| 2026-11-11 | **89** | 20          | 25          | 30           | 10                          | 4                        | Search Console e sitemap marcados (já existiam). **Incidente corrigido:** o build da Vercel não rodava o prerender, então não gerava o `spa.html` do rewrite, e toda rota abaixo da home dava 404 em produção (inclusive as antigas, como `/gestao`). O prerender passou a rodar com jsdom dentro do `npm run build`, sem navegador; `rotas.test.ts` trava a regressão. |

Toda mudança que mexer na nota ganha uma linha aqui (data, nota, categorias, o que mudou).

## A régua (100 pontos)

| Categoria               | Peso | O que mede                                                                                                                                                                                         |
| ----------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Técnico                 | 20   | HTML pré-renderizado em toda URL, robots, `lastmod`, canonical, lang/viewport, OG, sem noindex indevido, títulos e descrições únicos                                                               |
| On-page                 | 25   | Título 30–65 caracteres, descrição 110–160, um H1 por página, palavra-chave alvo no título e no H1, `alt` nas imagens                                                                              |
| Conteúdo                | 30   | Artigos publicados (meta 40), artigo novo nos últimos 30 dias, páginas por público, artigos com 900+ palavras e 3+ links internos, páginas comparativas (meta 5), ferramentas para baixar (meta 2) |
| Dados estruturados e IA | 10   | Organization com `sameAs`, SoftwareApplication com `offers`, BlogPosting e BreadcrumbList nos artigos, FAQPage, `llms.txt` coerente                                                                |
| Autoridade e medição    | 15   | Search Console, sitemap enviado, Bing, conversão por canal, Core Web Vitals, perfis oficiais, diretórios (meta 3), domínios que linkam (meta 20), avaliações reais (meta 10)                       |

A palavra-chave alvo de cada página fixa está no topo do script (`ALVOS`); a de cada artigo vem do
campo `palavraChave` do frontmatter. Mudar a régua ou as metas é decisão: registrar aqui com a data,
senão a comparação com as notas anteriores perde o sentido.

## Roteiro de 85 até 100

Os 85 pontos do código estão completos. Os 15 restantes estão fora do código, com o passo a passo em
[TAREFAS.md](./TAREFAS.md): Search Console (+3), sitemap enviado (+1), Bing (+1), LinkedIn (+1), painel de conversão
(+1), Core Web Vitals (+1), diretórios (+2), domínios linkando (+3) e avaliações reais (+2). As tarefas da primeira
semana levam a nota a **93**.

Para manter a nota: artigo novo ou atualizado a cada 30 dias (3 pontos de frescor) e as páginas novas sempre com
título, descrição e H1 na faixa (o teste do blog e a nota cobram).

## Atualizar a checklist externa

Em [`checklist-externo.json`](./checklist-externo.json), marque `"feito": true` (com a data em `"em"`)
ou atualize `"quantidade"`. O número de domínios que linkam vem do Search Console › Links › Sites com mais links.
Avaliação inventada é proibida e derruba a confiança do Google; só conta avaliação real.
