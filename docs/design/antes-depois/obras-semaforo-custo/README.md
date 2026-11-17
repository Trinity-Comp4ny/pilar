# Obras: semáforo de custo nos cards da lista

Antes = `origin/staging` (b71fad96). Depois = branch `feat/obras-semaforo-custo`.
Quadro de obras renderizado pelo componente real (`ObrasQuadro`), 1440px, dados fictícios.
Mobile 390px: o card é o mesmo (só ganha uma linha), sem mudança de layout.

| Tela | Imagem |
| --- | --- |
| Lista de obras: barra de custo (gasto ÷ orçado) sob a de avanço, verde/amarela/vermelha | `obras-lista-semaforo.jpg` |

Regra da cor: gasto até 5 pontos acima do avanço = verde; acima de 5 = amarela; acima de 15 pontos
ou orçado estourado = vermelha. Obra sem orçado não mostra a linha.
