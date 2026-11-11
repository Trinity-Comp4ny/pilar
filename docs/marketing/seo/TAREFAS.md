# Tarefas de SEO fora do código

O que está no código já foi feito (ver [NOTA_SEO.md](./NOTA_SEO.md)). Daqui para cima, a nota depende destas
tarefas. Cada uma diz quantos pontos vale, quanto tempo leva e como fazer. Ao concluir, marque em
[`checklist-externo.json`](./checklist-externo.json) (`"feito": true` e a data em `"em"`, ou a `"quantidade"`) e
rode `npm run seo:nota` para ver a nota nova.

> Pré-requisito de tudo: o PR desta branch mergeado em `staging` e promovido para `main` (release), para o
> blog, as ferramentas e o sitemap novo estarem no ar em www.pilarsoft.com.br.

## Depois de cada release

Abra `https://www.pilarsoft.com.br/engenharia` e um artigo do blog no navegador. Se der 404, o prerender não
rodou no build da Vercel (ver o histórico de 11/11 em [NOTA_SEO.md](./NOTA_SEO.md)). O aviso ao IndexNow é
automático: o workflow `IndexNow` do GitHub roda 5 minutos depois de cada release que muda a landing.

## Semana 1: medição (leva a nota de 85 para 93)

### 1. Google Search Console: +3 pontos, 15 minutos

É a tarefa mais importante: é onde você vê, por busca, quantas vezes o Pilar apareceu no Google, em que posição e
quantos cliques teve.

1. Acesse search.google.com/search-console e entre com a conta Google da empresa.
2. **Adicionar propriedade › Domínio** › digite `pilarsoft.com.br` (sem www, cobre tudo).
3. O Google mostra um registro **TXT** (`google-site-verification=...`). Copie.
4. No painel onde está o DNS do domínio (Vercel › Domains, ou Registro.br, conforme onde o domínio aponta), crie um
   registro **TXT** no nome `@` com esse valor.
5. Volte ao Search Console e clique em **Verificar**. Pode levar de minutos a algumas horas.
6. Marque `searchConsole` no checklist.

### 2. Enviar o sitemap: +1 ponto, 2 minutos

1. No Search Console › **Sitemaps** › digite `sitemap.xml` › **Enviar**.
2. Em **Inspeção de URL**, cole a home e as páginas principais (`/engenharia`, `/arquitetura`, `/blog`,
   `/ferramentas/calculadora-de-honorarios`) e clique em **Solicitar indexação** em cada uma.
3. Marque `sitemapEnviado`.

### 3. Bing Webmaster Tools: +1 ponto, 5 minutos

O Bing alimenta a busca do ChatGPT e do Copilot.

1. Acesse bing.com/webmasters › **Importar do Google Search Console** (depois da tarefa 1).
2. O IndexNow (avisa o Bing de todas as páginas de uma vez) roda sozinho no GitHub depois de cada release
   da landing. Para rodar à mão: GitHub › Actions › IndexNow › Run workflow.
3. Marque `bing`.

### 4. Página da empresa no LinkedIn: +1 ponto, 20 minutos

1. Crie a página da empresa no LinkedIn (nome "Pilar", setor Software, site `https://www.pilarsoft.com.br`).
2. Confira se o Instagram @pilarsoft.app tem o link do site na bio.
3. Me passe a URL da página do LinkedIn: ela entra no `sameAs` do `apps/marketing/index.html`, ao lado do Instagram.
4. Marque `perfisOficiais`.

### 5. Painel de conversão por canal: +1 ponto, 15 minutos

O evento `landing_cta_clicked` agora leva `canal` (google, chatgpt, linkedin, direto...), `pagina` e
`utm_campaign`. No PostHog:

1. **Insights › Trends** › evento `landing_cta_clicked`, filtro `cta = agende_demo`, quebrado por `canal`.
2. Um segundo insight igual, quebrado por `pagina` (mostra quais artigos geram demonstração).
3. Salve os dois num painel "Landing: demonstração por origem".
4. Marque `conversaoMedida`.

### 6. Core Web Vitals: +1 ponto, 10 minutos

O PostHog agora só carrega depois do consentimento de cookies. O JavaScript inicial da landing caiu de 247 KB para
136 KB comprimidos.

1. Rode pagespeed.web.dev em `https://www.pilarsoft.com.br/` e em um artigo do blog, no modo **celular**.
2. Se as duas ficarem com 90 ou mais (ou o relatório Core Web Vitals do Search Console estiver sem URL ruim, o que
   leva semanas de dado), marque `coreWebVitals`.
3. Se ficar abaixo, me mande o relatório: eu ataco o que ele apontar.

## Mês 1–3: autoridade (15 pontos no total, aos poucos)

### 7. Diretórios de software: +2 pontos (meta 3)

Cadastre o Pilar com descrição, preço e prints em:

- Capterra (capterra.com.br) e GetApp: o cadastro de um costuma valer para os dois e para o Software Advice
- B2B Stack (b2bstack.com.br)
- G2

Atualize `diretorios.quantidade` e a `lista` no checklist.

### 8. Sites que linkam o Pilar: +3 pontos (meta 20 domínios)

Link de site relevante é o sinal mais forte para o Google. As ferramentas abertas são o melhor motivo para pedir.

- **Design partners e clientes:** link "sistema de gestão: Pilar" no rodapé do site do escritório.
- **Associações e entidades:** AsBEA, ABECE, sindicatos e núcleos regionais de CREA e CAU, com artigo convidado
  ou indicação da calculadora de honorários como material de apoio.
- **Professores e cursos** de gestão de escritório para arquitetos e engenheiros: a calculadora e o modelo de
  proposta são material de aula.
- **Podcasts e canais** do setor: entrevista sobre gestão de escritório.
- **Artigo convidado** em blogs de arquitetura e engenharia, com link para um artigo do blog do Pilar.

Conte os domínios em Search Console › **Links › Sites com mais links** e atualize `dominiosComLink.quantidade`.

### 9. Avaliações reais: +2 pontos (meta 10)

1. Peça a cada escritório ativo uma avaliação no Capterra ou na B2B Stack (mande o link direto).
2. Bom momento: logo depois de uma entrega que deu certo ou de um elogio espontâneo.
3. Nunca escreva, compre ou incentive avaliação com desconto. O Google e os diretórios punem.
4. Atualize `avaliacoes.quantidade`.

## Toda semana: conteúdo (mantém a nota e a posição)

- **2 artigos por semana**, pela pauta do [GUIA_BLOG.md](./GUIA_BLOG.md). Os 40 da meta já estão publicados;
  daqui em diante o artigo novo mantém o ponto de frescor (artigo nos últimos 30 dias) e abre palavras-chave novas.
- **A cada 15 dias, no Search Console › Desempenho:** busca com muita impressão e posição entre 8 e 20 é a próxima
  a ganhar reforço (atualizar o artigo, criar artigo vizinho e linkar).
- **Todo mês:** um post no LinkedIn e no Instagram por artigo novo, com link e `utm_source`.
- Depois de publicar: nada a fazer, o workflow `IndexNow` avisa o Bing no release.

## Resumo

| #   | Tarefa                                         | Pontos | Tempo    | Quem                        |
| --- | ---------------------------------------------- | ------ | -------- | --------------------------- |
| 1   | Search Console verificado                      | +3     | 15 min   | Matheus                     |
| 2   | Sitemap enviado e páginas principais indexadas | +1     | 2 min    | Matheus                     |
| 3   | Bing Webmaster + IndexNow                      | +1     | 5 min    | Matheus                     |
| 4   | Página do LinkedIn e URL no `sameAs`           | +1     | 20 min   | Matheus (URL para o código) |
| 5   | Painel de demonstração por canal no PostHog    | +1     | 15 min   | Matheus                     |
| 6   | PageSpeed ≥ 90 no celular                      | +1     | 10 min   | Matheus                     |
| 7   | 3 diretórios de software                       | +2     | 1–2 h    | Matheus                     |
| 8   | 20 domínios linkando                           | +3     | contínuo | Matheus + parceiros         |
| 9   | 10 avaliações reais                            | +2     | contínuo | Sucesso do cliente          |
