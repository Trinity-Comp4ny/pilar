# Auditoria de espaço: P6 (terceira varredura, desktop e celular)

Antes = `origin/staging` (222c28c). Depois = branch do PR. Seed `dev@local.test`. Viewport 1320×750
(notebook 13") e 390×844 (celular, "-cel").

Varredura de 52 telas e abas no desktop e no celular. Além do espaço, ela procurou elemento fora da
tela, sobreposto, cortado, alvo de toque pequeno e linha com um controle só. O que muda:

- **Financeiro › Visão geral:** no desktop, o "Este mês" vai para o fim da linha das abas, sem uma
  linha de 52 px só para ele. No celular, os 5 indicadores ficam em duas colunas (antes
  ocupavam a tela inteira, um por linha).
- **Indicadores em duas ou três colunas no celular:** Obras (3), Folha, Ultra e Custos de IA (2).
- **Detalhe da obra:** a linha de dados (status, responsável, endereço, datas) só aparece na aba
  Visão. Nas outras abas ela repetia 40 px (3 linhas no celular) acima do conteúdo.
- **Obra › Tarefas:** visão, filtros, busca e "Nova tarefa" sobem para a barra da página, como em
  Gestão › Tarefas.
- **Obra › Acessos:** sem o botão "Criar acesso" duplicado (topo e estado vazio) quando não há
  acessos. Igual à aba Cotações.
- **Detalhe do fornecedor:** os 6 indicadores recolhem com resumo ("3 obras · R$ X comprado ·
  nota 4,5") e ficam em duas colunas no celular. No celular eles empurravam o conteúdo da aba para
  fora da tela.
- **Botão de estado vazio:** verde da marca em todo o app. Era preto em metade das telas (Clima,
  Diário, Cotações, Estoque, Acessos) e verde na outra.
- **Início no celular:** o "Atualizado há…" vira só o ícone. Antes aparecia "At" cortado ao lado
  dele.

| Tela                        | Antes                                      | Depois                                       |
| --------------------------- | ------------------------------------------ | -------------------------------------------- |
| Financeiro › Visão geral    | ![antes](antes-financeiro-visao.jpg)       | ![depois](depois-financeiro-visao.jpg)       |
| Financeiro › Visão, celular | ![antes](antes-financeiro-visao-cel.jpg)   | ![depois](depois-financeiro-visao-cel.jpg)   |
| Obras, celular              | ![antes](antes-obras-cel.jpg)              | ![depois](depois-obras-cel.jpg)              |
| Obra › Diário               | ![antes](antes-obra-diario.jpg)            | ![depois](depois-obra-diario.jpg)            |
| Obra › Diário, celular      | ![antes](antes-obra-diario-cel.jpg)        | ![depois](depois-obra-diario-cel.jpg)        |
| Obra › Tarefas              | ![antes](antes-obra-tarefas.jpg)           | ![depois](depois-obra-tarefas.jpg)           |
| Obra › Tarefas, celular     | ![antes](antes-obra-tarefas-cel.jpg)       | ![depois](depois-obra-tarefas-cel.jpg)       |
| Obra › Acessos              | ![antes](antes-obra-acessos.jpg)           | ![depois](depois-obra-acessos.jpg)           |
| Fornecedor                  | ![antes](antes-fornecedor-detalhe.jpg)     | ![depois](depois-fornecedor-detalhe.jpg)     |
| Fornecedor, celular         | ![antes](antes-fornecedor-detalhe-cel.jpg) | ![depois](depois-fornecedor-detalhe-cel.jpg) |
| Clima (botão do vazio)      | ![antes](antes-clima.jpg)                  | ![depois](depois-clima.jpg)                  |
| Início, celular             | ![antes](antes-inicio-cel.jpg)             | ![depois](depois-inicio-cel.jpg)             |
