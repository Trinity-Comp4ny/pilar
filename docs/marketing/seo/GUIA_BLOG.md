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

Publicados em 2026-11-10 (20): software de gestão para escritório de engenharia, sistema para escritório de arquitetura,
proposta de projeto de engenharia, como precificar projeto, controle de prazo por disciplina, aditivo de projeto,
diário de obra (RDO), obra por administração, fluxo de caixa, contrato de projeto, cronograma de projeto de arquitetura,
compatibilização de projetos, relatório de obra para o cliente, CRM para escritório de arquitetura, retrabalho em
projeto, rentabilidade de projeto, cotação de material de obra, como organizar escritório de engenharia, como organizar
escritório de arquitetura e IA para escritório de engenharia.

Próximos, em ordem de prioridade:

| #   | Palavra-chave                                    | Ângulo                                                                  | Módulo   |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------- | -------- |
| 1   | ART e RRT: quando emitir em projeto e obra       | Conceito e rotina do escritório (sem número de resolução não conferido) | gestao   |
| 2   | como cobrar taxa de administração de obra        | Percentual, base de cálculo, nota e contrato                            | obra     |
| 3   | portal do cliente arquitetura                    | Mostrar andamento sem montar relatório                                  | portal   |
| 4   | gestão de equipe em escritório de engenharia     | Responsável por disciplina, carga, prioridade                           | projetos |
| 5   | planilha de controle de projetos                 | Quando a planilha deixa de servir                                       | projetos |
| 6   | inadimplência em escritório de arquitetura       | Parcelas por entrega, cobrança sem constrangimento                      | gestao   |
| 7   | gestão de obra para arquitetos                   | Acompanhamento × administração × gerenciamento                          | obra     |
| 8   | conciliação bancária para escritório             | Extrato lido por IA, revisado pela equipe                               | gestao   |
| 9   | modelo de proposta de projeto de arquitetura     | Estrutura comentada, linkando a ferramenta                              | gestao   |
| 10  | escopo de projeto de engenharia                  | Como escrever escopo que evita aditivo não pago                         | projetos |
| 11  | prazo de projeto estrutural                      | Dependências com arquitetura e o que atrasa                             | projetos |
| 12  | projeto de instalações prediais (MEP)            | Como coordenar elétrica, hidráulica e HVAC                              | projetos |
| 13  | efetivo de obra                                  | Como registrar e por que importa                                        | campo    |
| 14  | aporte de obra por administração                 | Como organizar o dinheiro do cliente                                    | obra     |
| 15  | medição de obra                                  | Avanço físico e o que mostrar ao cliente                                | campo    |
| 16  | quanto cobrar por projeto de engenharia elétrica | Método, sem tabela inventada, linkando a calculadora                    | gestao   |
| 17  | quanto cobrar por projeto estrutural             | Idem                                                                    | gestao   |
| 18  | software de arquitetura × software de gestão     | CAD/BIM × gestão do escritório                                          | projetos |
| 19  | pós-obra e entrega técnica                       | Documentação, garantia, relacionamento                                  | obra     |
| 20  | indicadores de escritório de engenharia          | Os poucos números que importam                                          | gestao   |

Ritmo sugerido: 2 artigos por semana. Com isso, os 40 artigos da meta chegam em cerca de 10 semanas.
