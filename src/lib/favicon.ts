/**
 * Favicon com badge de notificação (estilo GitHub). Desenha o favicon base num
 * canvas e, quando há não lidas, sobrepõe uma bolinha vermelha com anel branco
 * no canto. Atualiza o <link rel="icon"> com o PNG resultante.
 *
 * Reusa /favicon.svg como fonte única da arte — o badge é só uma camada por cima.
 */
const SIZE = 64; // 2x o favicon de 32 para nitidez em telas retina
const BASE_HREF = "/favicon.svg";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

let ultimoEstado: boolean | null = null;

export async function setFaviconBadge(hasBadge: boolean): Promise<void> {
  if (typeof document === "undefined") return;
  if (ultimoEstado === hasBadge) return; // evita redesenhar à toa
  ultimoEstado = hasBadge;

  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;

  try {
    const img = await loadImage(BASE_HREF);
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(img, 0, 0, SIZE, SIZE);

    if (hasBadge) {
      const r = SIZE * 0.19; // raio da bolinha
      const gap = SIZE * 0.05; // folga transparente ao redor (o "buraco")
      const cx = SIZE - r - gap;
      const cy = r + gap;
      // Fura o círculo: recorta um disco transparente onde o badge vai (estilo GitHub).
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(cx, cy, r + gap, 0, Math.PI * 2);
      ctx.fill();
      // Bolinha vermelha dentro do buraco.
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "#EF4444";
      ctx.fill();
    }

    link.type = "image/png";
    link.href = canvas.toDataURL("image/png");
  } catch {
    // Se o canvas/imagem falhar, mantém o favicon atual (sem quebrar a UI).
    ultimoEstado = null;
  }
}
