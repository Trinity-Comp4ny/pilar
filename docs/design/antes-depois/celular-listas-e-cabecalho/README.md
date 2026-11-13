# Celular: listas em cards e cabeçalho que recolhe

Antes = `origin/staging` (8a6937c). Depois = branch do PR. Celular 390×844, seed `dev@local.test`.

- **Clientes, Equipe, Fornecedores e Propostas:** no celular, a tabela de desktop espremida (colunas
  cortadas, rolagem para o lado) vira uma lista de cards, com nome, dado de apoio, selo e valor:
  - **Clientes:** CPF/CNPJ e portal. Editar e excluir ficam no detalhe, que abre ao tocar.
  - **Equipe:** cargo, tipo e status.
  - **Fornecedores:** CNPJ, com editar e excluir no card, porque o detalhe não tem essas ações.
  - **Propostas:** código, cliente, status e valor.

  O card em volta da lista some no celular, para não ficar card dentro de card.

- **Cabeçalho:** a linha de atalhos do módulo (Tarefas, Financeiro, Equipe…) recolhe ao rolar para
  baixo e volta ao rolar para cima ou ao chegar no topo. São cerca de 44 px a mais de conteúdo; no
  Financeiro o cabeçalho tinha 197 px de 844. Vale para toda tela com atalhos do módulo, inclusive
  quando a rolagem é numa lista interna. Rolagem só para o lado (quadro, abas) não recolhe.

| Tela                | Antes                                  | Depois                                   |
| ------------------- | -------------------------------------- | ---------------------------------------- |
| Clientes            | ![antes](antes-clientes.jpg)           | ![depois](depois-clientes.jpg)           |
| Equipe              | ![antes](antes-equipe.jpg)             | ![depois](depois-equipe.jpg)             |
| Fornecedores        | ![antes](antes-fornecedores.jpg)       | ![depois](depois-fornecedores.jpg)       |
| Propostas           | ![antes](antes-propostas.jpg)          | ![depois](depois-propostas.jpg)          |
| Financeiro, rolado  | ![antes](antes-financeiro-rolado.jpg)  | ![depois](depois-financeiro-rolado.jpg)  |
| Lançamentos, rolado | ![antes](antes-lancamentos-rolado.jpg) | ![depois](depois-lancamentos-rolado.jpg) |
| Projetos, rolado    | ![antes](antes-projetos-rolado.jpg)    | ![depois](depois-projetos-rolado.jpg)    |
