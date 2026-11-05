# Leitor de projetos: ferramentas

Scripts Python do leitor de projetos (PDF vetorial, PDF raster, escaneado e IFC): bancada de testes, OCR em blocos, cascata de leitura e verificações. Experimento de pesquisa, fora do app.

Documentação completa: [`docs/architecture/leitor-de-projetos/README.md`](../../docs/architecture/leitor-de-projetos/README.md) (estado, regras medidas, custo, pendências e como retomar).

```
cd scripts/leitor-de-projetos
python3 -m venv ferramentas/venv && ferramentas/venv/bin/pip install -r requirements.txt
brew install tesseract                      # e baixar tessdata_fast (por, eng) para ferramentas/tessdata/
cd ferramentas && ./venv/bin/python -I bancada4.py caso_a
```

Requisitos: Python 3.14, Tesseract 5.5. Os dados de idioma e os arquivos de projeto não ficam no Git.
