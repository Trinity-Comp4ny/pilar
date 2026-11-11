# Guia do blog

Como publicar um artigo no blog da landing (`/blog`) e a pauta dos próximos. Objetivo de negócio:
aparecer no Google para quem está procurando como organizar um escritório de engenharia ou de arquitetura,
e levar essa pessoa a ver os planos ou agendar uma demonstração.

## Publicar um artigo

1. Criar `apps/marketing/src/content/blog/<slug>.md`. O slug é a palavra-chave em minúsculas, sem acento, com hífen.
2. Frontmatter, uma chave por linha:

   ```
   ---
   titulo: Título do artigo (H1 da página)
   tituloSeo: Versão curta para o Google, se "titulo + | Pilar" passar de 65 caracteres
   descricao: Meta description de 110 a 160 caracteres, com a palavra-chave
   palavraChave: palavra-chave principal
   categoria: Gestão | Projetos | Obra | Financeiro
   modulo: gestao | projetos | obra | portal | campo   (CTA do fim do artigo)
   publicadoEm: AAAA-MM-DD
   atualizadoEm: AAAA-MM-DD
   resumo: 1 a 2 frases para o card da listagem
   ---
   ```

3. Listar a rota `/blog/<slug>` em três lugares: `apps/marketing/public/sitemap.xml` (com `<lastmod>`),
   `apps/marketing/public/llms.txt` (seção Blog) e `ROTAS` em `apps/marketing/scripts/prerender.mjs`.
   O `rotas.test.ts` reprova se faltar algum.
4. Rodar `npx vitest run apps/marketing`. Os testes conferem frontmatter, tamanho do título e da descrição,
   seção de perguntas frequentes, links internos válidos e palavras proibidas.
5. Rodar a nota (`npm run seo:nota`, ver [NOTA_SEO.md](./NOTA_SEO.md)) e registrar a linha nova no histórico.

## Markdown aceito

`##` e `###` (nunca `#`: o título já é o H1), parágrafo, listas `-` e `1.`, `**negrito**`,
`[texto](/rota)`, `> destaque` e tabela com pipes. Nada de HTML, imagem ou lista aninhada.

## Como escrever

- **1.000 a 1.500 palavras.** Os 2–3 primeiros períodos respondem direto à busca: é o trecho que o Google
  mostra em destaque.
- **`##` como a pessoa pesquisa**, muitos em forma de pergunta ("Quem deve preencher o diário de obra?").
- **Pelo menos uma lista ou tabela prática.** Checklist, quadro de campos, comparação.
- **3 ou mais links internos:** módulo, `/planos`, `/engenharia` ou `/arquitetura` e outros artigos.
- **`## Como o Pilar ajuda`** perto do fim: curto, honesto, só com o que existe em `apps/marketing/src/lib/modules.ts`.
- **Termina em `## Perguntas frequentes`**, com 3 a 4 `###`. Vira o schema FAQ no Google.
- **Sem estatística inventada,** sem número de norma que não foi conferido e sem depoimento. Exemplo numérico só
  quando claramente hipotético.
- **Voz da marca** ([brand/voice-tone.md](../../../brand/voice-tone.md)): direta, técnica, sem hype. O teste
  `copy.test.ts` barra "grátis", "token", "solução completa" e as demais palavras banidas.
- **Atualizar artigo antigo também conta.** Revisar, trocar `atualizadoEm` e o `<lastmod>` do sitemap.

## Pauta

Publicados em 2026-11-10: 40 artigos (a meta da nota). A lista completa está em `apps/marketing/src/content/blog/`
e no feed `https://www.pilarsoft.com.br/blog/feed.xml`.

Daqui em diante, a pauta sai do Search Console (Desempenho › Consultas): busca com impressão e posição entre 8 e 20
vira atualização do artigo existente ou artigo vizinho. Ideias ainda não cobertas:

| #   | Palavra-chave                                      | Ângulo                                             | Módulo   |
| --- | -------------------------------------------------- | -------------------------------------------------- | -------- |
| 1   | onboarding de cliente em escritório de arquitetura | Do aceite da proposta à primeira entrega           | gestao   |
| 2   | como montar o fluxo padrão de projeto              | Colunas e etapas que servem para todos os projetos | projetos |
| 3   | folha de pagamento de escritório de engenharia     | Comprovante, rateio por projeto, rotina do mês     | gestao   |
| 4   | levantamento de campo para projeto                 | O que registrar antes de projetar                  | campo    |
| 5   | revisão de projeto: como controlar versões         | Rodadas, registro de decisão, cliente aprovando    | projetos |
| 6   | precificação de projeto de climatização (HVAC)     | Método, sem tabela inventada                       | gestao   |
| 7   | como apresentar proposta ao cliente                | Reunião, prazo de validade, objeções               | gestao   |
| 8   | gestão de fornecedores de obra                     | Cadastro, cotação, histórico                       | obra     |
| 9   | reforma por administração                          | Particularidades de obra pequena                   | obra     |
| 10  | estoque de obra                                    | Entrada, saída e saldo valorizado                  | obra     |

Ritmo sugerido: 1 a 2 artigos por semana, mais a revisão dos artigos que o Search Console mostrar perto da primeira página.
