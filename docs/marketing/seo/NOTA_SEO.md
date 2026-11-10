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

> Nota alta não garante posição: ela mede o que está sob nosso controle. A posição real vem do
> Search Console (impressões, cliques, posição média por busca), que deve ser lido a cada 15 dias.

## Histórico

| Data       | Nota   | Técnico /20 | On-page /25 | Conteúdo /30 | Dados estruturados e IA /10 | Autoridade e medição /15 | O que mudou                                                                                                                                                                                                                                                                                      |
| ---------- | ------ | ----------- | ----------- | ------------ | --------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-10 | **30** | 18          | 8,8         | 1,2          | 1,8                         | 0                        | Ponto de partida: 12 páginas, sem blog, títulos sem palavra-chave ("Gestão \| Pilar"), H1 de marca, `llms.txt` dizendo que o Pilar "não é ferramenta de arquitetura".                                                                                                                            |
| 2026-11-10 | **72** | 20          | 25          | 16,6         | 10                          | 0                        | Blog com 8 artigos, páginas `/engenharia` e `/arquitetura`, título/descrição/H1 com palavra-chave em todas as páginas, `lastmod` no sitemap, `offers` e `sameAs` no JSON-LD, BlogPosting/Breadcrumb/FAQ nos artigos, `llms.txt` corrigido.                                                       |
| 2026-11-10 | **79** | 20          | 25          | 24           | 10                          | 0                        | Blog com 20 artigos, ferramentas abertas (`/ferramentas/calculadora-de-honorarios` e `/ferramentas/modelo-de-proposta`) e comparativos `/vs/whatsapp`, `/vs/notion` e `/vs/erp-construtora`. No site, só faltam os 20 artigos para a meta de 40 (6 pontos); o resto da nota está fora do código. |

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

## Roteiro de 79 até 100

| Pontos | O quê                            | Quem                | Como                                                                                                                                                      |
| ------ | -------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| +3     | Google Search Console verificado | Matheus             | Propriedade de domínio `pilarsoft.com.br`, registro TXT no DNS                                                                                            |
| +1     | Sitemap enviado                  | Matheus             | Search Console › Sitemaps › `https://www.pilarsoft.com.br/sitemap.xml`                                                                                    |
| +1     | Bing Webmaster Tools             | Matheus             | Importar do Search Console (1 clique). O Bing alimenta o ChatGPT Search                                                                                   |
| +1     | Perfis oficiais                  | Matheus             | Página da empresa no LinkedIn com link para o site; depois pôr a URL no `sameAs` do `index.html` ao lado do Instagram                                     |
| +1     | Conversão por canal              | Matheus             | Painel no PostHog: `landing_cta_clicked` com `cta=agende_demo`, quebrado por origem                                                                       |
| +1     | Core Web Vitals                  | Matheus             | Relatório do Search Console sem URL ruim (ou PageSpeed mobile ≥ 90)                                                                                       |
| +6     | 20 artigos novos (meta 40)       | Conteúdo            | Dois por semana, pela pauta do [GUIA_BLOG.md](./GUIA_BLOG.md) (~10 semanas)                                                                               |
| +2     | 3 diretórios                     | Matheus             | Capterra, GetApp, B2B Stack                                                                                                                               |
| +3     | 20 domínios linkando             | Matheus + parceiros | Design partners, associações (AsBEA, ABECE, CAU/CREA regionais), artigo convidado, podcasts. As ferramentas abertas são o melhor material para pedir link |
| +2     | 10 avaliações reais              | Sucesso do cliente  | Pedir aos escritórios ativos, nos diretórios e no Google                                                                                                  |

Só com os itens da primeira semana (Search Console, sitemap, Bing, LinkedIn, conversão, Web Vitals)
a nota vai a **87**. O resto é ritmo: conteúdo toda semana e autoridade conquistada aos poucos.

## Atualizar a checklist externa

Em [`checklist-externo.json`](./checklist-externo.json), marque `"feito": true` (com a data em `"em"`)
ou atualize `"quantidade"`. O número de domínios que linkam vem do Search Console › Links › Sites com mais links.
Avaliação inventada é proibida e derruba a confiança do Google; só conta avaliação real.
