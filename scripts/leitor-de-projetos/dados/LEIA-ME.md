# Pasta de dados da bancada

Os scripts de `../ferramentas/` esperam esta estrutura. As pastas `raw*`, `dxf`, `render*` e os IFC NÃO estão no Git (dado de cliente e arquivo de terceiros). Para reproduzir:

1. Obtenha os arquivos dos casos (ver `docs/architecture/leitor-de-projetos/casos.md`) e salve com o nome neutro na pasta indicada.
2. Baixe o Duplex da buildingSMART para `raw3/aberto/duplex/`.
3. Rode a partir de `ferramentas/` (os caminhos são relativos): `./venv/bin/python -I bancada4.py caso_a caso_b_p2 ...`.

O que está versionado aqui são só saídas derivadas pequenas: `spike/` (placares, logs, JSON de OCR, saídas dos modelos de visão, gabaritos), `modelos/` (modelo do Duplex lido do IFC e compatibilizações) e `placar.jsonl` (uma linha por rodada). Imagens derivadas de projetos de cliente ficam de fora de propósito.
