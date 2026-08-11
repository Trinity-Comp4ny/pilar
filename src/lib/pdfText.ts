/**
 * Extração de texto de PDF no navegador (spec 017).
 *
 * Roda inteiramente no client: lê o PDF com pdf.js e devolve só o texto, que é o
 * que segue para a IA estruturar. A imagem/binário do documento nunca sai daqui.
 * O pdf.js é carregado sob demanda (import dinâmico) para não pesar o bundle
 * inicial do financeiro.
 */

export async function extrairTextoPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Worker empacotado pelo Vite; sem isso o pdf.js tenta buscar de uma URL externa.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const partes: string[] = [];

  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const linha = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (linha) partes.push(linha);
    }
  } finally {
    await doc.destroy();
  }

  return partes.join("\n");
}
