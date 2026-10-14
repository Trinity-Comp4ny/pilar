/**
 * Print do feedback (SPEC 112): captura da tela, carga de imagem e export do
 * canvas anotado. As partes puras (tamanho, retângulo, contexto) ficam
 * separadas do DOM pra teste.
 */

/** Lado maior do print salvo. Tela 4K reduzida pra caber no limite do bucket sem perder leitura. */
const PRINT_MAX_LADO = 2400;
/** Espelho do file_size_limit do bucket feedback-prints (5 MB). */
const PRINT_MAX_BYTES = 5 * 1024 * 1024;

export type Ponto = { x: number; y: number };

export type Marca = { tipo: "caneta"; pontos: Ponto[] } | { tipo: "retangulo"; de: Ponto; ate: Ponto };

/** Reduz (nunca amplia) mantendo a proporção, com o lado maior em `max`. */
export function ajustarTamanho(largura: number, altura: number, max = PRINT_MAX_LADO) {
  const maior = Math.max(largura, altura);
  if (maior <= max) return { largura, altura };
  const escala = max / maior;
  return { largura: Math.round(largura * escala), altura: Math.round(altura * escala) };
}

/** Retângulo normalizado a partir de dois cantos quaisquer (arrastar pra qualquer lado). */
export function retanguloEntre(de: Ponto, ate: Ponto) {
  return {
    x: Math.min(de.x, ate.x),
    y: Math.min(de.y, ate.y),
    largura: Math.abs(ate.x - de.x),
    altura: Math.abs(ate.y - de.y),
  };
}

/** Espessura do traço proporcional ao print, pra marca não sumir numa tela grande. */
export function espessuraTraco(larguraImagem: number) {
  return Math.max(3, Math.round(larguraImagem / 320));
}

export type ContextoFeedback = {
  rota: string;
  janela: string;
  navegador: string;
  release: string;
};

/** Contexto técnico mínimo que ajuda a reproduzir. Sem query string: pode carregar id ou filtro sensível. */
export function montarContexto(
  loc: Pick<Location, "pathname">,
  win: Pick<Window, "innerWidth" | "innerHeight">,
  userAgent: string,
  release: string
): ContextoFeedback {
  return {
    rota: loc.pathname,
    janela: `${win.innerWidth}x${win.innerHeight}`,
    navegador: userAgent.slice(0, 300),
    release: release.slice(0, 80),
  };
}

/** Screen Capture API não existe no iOS nem em navegador antigo: sem ela, só upload e colar. */
export function podeCapturarTela(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";
}

/**
 * Pede ao navegador um frame da tela. `preferCurrentTab` faz o Chrome oferecer
 * a própria aba primeiro; nos outros, o usuário escolhe no seletor nativo.
 * Rejeita se o usuário cancelar o seletor.
 */
export async function capturarTela(): Promise<Blob> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: "browser" },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: "include",
  } as DisplayMediaStreamOptions);

  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    // O primeiro frame às vezes ainda mostra o seletor/aviso de compartilhamento saindo.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    return await canvasParaBlob(canvas, "image/png");
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

export function carregarImagem(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não deu pra abrir essa imagem. Tente um PNG ou JPG."));
    };
    img.src = url;
  });
}

function canvasParaBlob(canvas: HTMLCanvasElement, tipo: string, qualidade?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não deu pra gerar a imagem do print."))),
      tipo,
      qualidade
    );
  });
}

/** PNG mantém texto nítido; se passar do limite do bucket, cai pra JPEG. */
export async function exportarPrint(canvas: HTMLCanvasElement): Promise<{ blob: Blob; extensao: "png" | "jpg" }> {
  const png = await canvasParaBlob(canvas, "image/png");
  if (png.size <= PRINT_MAX_BYTES) return { blob: png, extensao: "png" };
  const jpg = await canvasParaBlob(canvas, "image/jpeg", 0.85);
  if (jpg.size <= PRINT_MAX_BYTES) return { blob: jpg, extensao: "jpg" };
  throw new Error("O print ficou grande demais (acima de 5 MB). Recorte a imagem e tente de novo.");
}
