# Auditoria de espaço, P1: telas de dados compactas

Antes = `origin/staging` (cb495a5). Depois = branch do PR. Mesmas rotas, seed `dev@local.test` mais 12
projetos fictícios só no banco local (para o Gantt ter linhas). Viewport 1440×800; o Cronograma e o
Quadro também em 1320×750, que é a janela do notebook 13" do Matheus.

O que muda:

- **Cronograma:** os controles (Todos/Meus, Status, Cliente, Responsável, Hoje, Meses/Semanas) saem
  do card com título e sobem para a barra de filtros, na mesma linha de "Filtros". A legenda vira o
  botão (i). O Gantt ocupa o resto da tela.
- **Telas de dados** (Projetos, Tarefas, Leads, Propostas, Clientes, Equipe): padding de 16/24 px no
  lugar de 40 px, e o conteúdo ocupa a altura da tela.
- **Indicadores de Projetos:** recolhidos, mostram um resumo na mesma linha
  ("14 ativos · 0 em atraso · …") em vez de sumir.
- **Propostas e Mapa:** sem altura fixa por conta (`100svh - 360px`, `100dvh - 320px`).

| Tela                                                    | Antes                                               | Depois                                                |
| ------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| Cronograma 1320×750                                     | ![antes](antes-cronograma-1320.jpg)                 | ![depois](depois-cronograma-1320.jpg)                 |
| Cronograma 1440×800                                     | ![antes](antes-cronograma.jpg)                      | ![depois](depois-cronograma.jpg)                      |
| Projetos › Quadro 1320×750                              | ![antes](antes-projetos-1320.jpg)                   | ![depois](depois-projetos-1320.jpg)                   |
| Projetos › Quadro                                       | ![antes](antes-projetos.jpg)                        | ![depois](depois-projetos.jpg)                        |
| Projetos › Indicadores recolhidos                       | ![antes](antes-projetos-indicadores-recolhidos.jpg) | ![depois](depois-projetos-indicadores-recolhidos.jpg) |
| Tarefas › Quadro                                        | ![antes](antes-tarefas-quadro.jpg)                  | ![depois](depois-tarefas-quadro.jpg)                  |
| Leads                                                   | ![antes](antes-leads.jpg)                           | ![depois](depois-leads.jpg)                           |
| Propostas                                               | ![antes](antes-propostas.jpg)                       | ![depois](depois-propostas.jpg)                       |
| Clientes                                                | ![antes](antes-clientes.jpg)                        | ![depois](depois-clientes.jpg)                        |
| Mapa (seed sem coordenadas: só o padding muda no print) | ![antes](antes-mapa.jpg)                            | ![depois](depois-mapa.jpg)                            |

Medido em 1320×750: o Gantt passou de **5 linhas** (antes do P0) para **~10 linhas** visíveis.
