# Auditoria de espaço: P5 (segunda varredura)

Antes = `origin/staging` (b194e1f). Depois = branch do PR. Seed `dev@local.test` (mais lançamentos e
projetos fictícios só no banco local). Viewport 1320×750 (a janela do notebook 13" do Matheus) e
1905×953 (a dos prints dele, com o painel da sidebar aberto).

Uma varredura medida de 30 rotas achou a causa comum dos vãos: o conteúdo das telas tinha 32 a 48 px
de recuo, enquanto o título usa 24 px. Isso criava o vão acima dos Indicadores e deixava o conteúdo
desalinhado do título. O que muda:

- **Todas as telas que não são de dados** (Financeiro, Início, Ajuda, Novidades, Clima, Fornecedores,
  detalhe da obra, Ultra e outras): recuo de 24 px, alinhado ao título. Ganham 16 a 24 px no topo e
  de cada lado.
- **Lançamentos:** sai o card em volta da tabela (eram duas bordas). Em 1320 px, Valor e Status
  ficavam fora da tela. Agora a tabela cabe inteira: categoria, projeto e cliente cortam com
  reticências (o nome inteiro aparece ao passar o mouse) e "atrasado" fica embaixo da data. Em
  telas largas os limites são maiores.
- **Clientes, Equipe e Fornecedores:** a tabela encosta no card (eram 16 px a mais de cada lado).
- **Fornecedores:** sai a linha da barra que só mostrava "3 de 3". A contagem aparece no
  cabeçalho quando a busca recorta a lista.
- **Clima:** largura toda, no lugar da coluna central de 1024 px.
- **Obra › Visão:** Marcos de faturamento ao lado do Avanço, sem as metades vazias.

| Tela                           | Antes                                     | Depois                                      |
| ------------------------------ | ----------------------------------------- | ------------------------------------------- |
| Financeiro › Visão geral, 1905 | ![antes](antes-financeiro-visao-1905.jpg) | ![depois](depois-financeiro-visao-1905.jpg) |
| Financeiro › Visão geral, 1320 | ![antes](antes-financeiro-visao-1320.jpg) | ![depois](depois-financeiro-visao-1320.jpg) |
| Lançamentos, 1905              | ![antes](antes-lancamentos-1905.jpg)      | ![depois](depois-lancamentos-1905.jpg)      |
| Lançamentos, 1320              | ![antes](antes-lancamentos-1320.jpg)      | ![depois](depois-lancamentos-1320.jpg)      |
| Folha de pagamento, 1320       | ![antes](antes-folha-1320.jpg)            | ![depois](depois-folha-1320.jpg)            |
| Clima, 1905                    | ![antes](antes-clima-1905.jpg)            | ![depois](depois-clima-1905.jpg)            |
| Clima, 1320                    | ![antes](antes-clima-1320.jpg)            | ![depois](depois-clima-1320.jpg)            |
| Clientes, 1320                 | ![antes](antes-clientes-1320.jpg)         | ![depois](depois-clientes-1320.jpg)         |
| Fornecedores, 1320             | ![antes](antes-fornecedores-1320.jpg)     | ![depois](depois-fornecedores-1320.jpg)     |
| Obra › Visão, 1320             | ![antes](antes-obra-detalhe-1320.jpg)     | ![depois](depois-obra-detalhe-1320.jpg)     |
| Central de ajuda, 1320         | ![antes](antes-ajuda-1320.jpg)            | ![depois](depois-ajuda-1320.jpg)            |
