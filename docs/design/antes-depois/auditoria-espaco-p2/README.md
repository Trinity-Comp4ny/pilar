# Auditoria de espaço: P1 (resto) e P2

Antes = `origin/staging` (dabb532). Depois = branch do PR. Seed `dev@local.test` mais 12 projetos
fictícios só no banco local. Viewport 1440×800; Cronograma e detalhe do projeto também em 1320×750
(a janela do notebook 13" do Matheus). "Recolhido" = faixa de indicadores fechada.

O que muda:

- **Cronograma:** linha do projeto de 56 para 44 px. Em 1320×750: **13 linhas** (eram 10 depois do
  P1 e 5 antes do P0). A coluna de nomes também deixou de desalinhar 1 px por projeto.
- **Detalhe do projeto:** o nome não se repete mais abaixo do cabeçalho. Status, prioridade e prazo
  ficam na linha dos indicadores; os indicadores e o progresso recolhem com resumo; o seletor
  Tabela/Gantt/Fluxo vai para a linha das abas. A 1ª disciplina sai de y≈540 para y≈430 (aberto)
  ou y≈283 (recolhido).
- **Lançamentos:** um seletor de tipo só (o da barra, agora "Tudo · A receber · A pagar"); o
  recorte, o "Atualizado" e o Importar numa linha à direita dos indicadores, que recolhem com
  resumo. A 1ª linha da tabela sai de y≈520 para y≈450 (aberto) ou y≈358 (recolhido).
- **Leads, Disciplinas e Obras:** indicadores recolhíveis com resumo numa linha.

| Tela                          | Antes                                         | Depois                                          |
| ----------------------------- | --------------------------------------------- | ----------------------------------------------- |
| Cronograma 1320×750           | ![antes](antes-cronograma-1320.jpg)           | ![depois](depois-cronograma-1320.jpg)           |
| Cronograma 1440×800           | ![antes](antes-cronograma.jpg)                | ![depois](depois-cronograma.jpg)                |
| Detalhe do projeto 1320×750   | ![antes](antes-projeto-detalhe-1320.jpg)      | ![depois](depois-projeto-detalhe-1320.jpg)      |
| Detalhe do projeto            | ![antes](antes-projeto-detalhe.jpg)           | ![depois](depois-projeto-detalhe.jpg)           |
| Detalhe do projeto, recolhido | ![antes](antes-projeto-detalhe-recolhido.jpg) | ![depois](depois-projeto-detalhe-recolhido.jpg) |
| Lançamentos                   | ![antes](antes-lancamentos.jpg)               | ![depois](depois-lancamentos.jpg)               |
| Lançamentos, recolhido        | ![antes](antes-lancamentos-recolhido.jpg)     | ![depois](depois-lancamentos-recolhido.jpg)     |
| Leads, recolhido              | ![antes](antes-leads-recolhido.jpg)           | ![depois](depois-leads-recolhido.jpg)           |
| Disciplinas                   | ![antes](antes-disciplinas.jpg)               | ![depois](depois-disciplinas.jpg)               |
| Disciplinas, recolhido        | ![antes](antes-disciplinas-recolhido.jpg)     | ![depois](depois-disciplinas-recolhido.jpg)     |
| Obras                         | ![antes](antes-obras.jpg)                     | ![depois](depois-obras.jpg)                     |
| Obras, recolhido              | ![antes](antes-obras-recolhido.jpg)           | ![depois](depois-obras-recolhido.jpg)           |

No "antes", Disciplinas e Obras não recolhem: as imagens "recolhido" mostram a mesma tela.
