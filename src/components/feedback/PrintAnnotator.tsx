import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Pencil, Square, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ajustarTamanho,
  espessuraTraco,
  exportarPrint,
  retanguloEntre,
  type Marca,
  type Ponto,
} from "@/lib/feedbackPrint";

type Ferramenta = "caneta" | "retangulo";

export type PrintAnnotatorHandle = {
  /** Print com as marcas, no tamanho final que sobe pro bucket. */
  exportar: () => Promise<{ blob: Blob; extensao: "png" | "jpg" }>;
};

export type PrintAnnotatorProps = {
  imagem: HTMLImageElement;
  onRemover: () => void;
};

/** Cor da marca vem do token (--chart-danger); canvas não resolve var() sozinho. */
function corDaMarca(): string {
  const valor = getComputedStyle(document.documentElement).getPropertyValue("--chart-danger").trim();
  return valor ? `hsl(${valor})` : "hsl(0 84% 60%)";
}

function desenharMarca(ctx: CanvasRenderingContext2D, marca: Marca) {
  if (marca.tipo === "retangulo") {
    const r = retanguloEntre(marca.de, marca.ate);
    ctx.strokeRect(r.x, r.y, r.largura, r.altura);
    return;
  }
  const [primeiro, ...resto] = marca.pontos;
  if (!primeiro) return;
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  // Um clique sem arrastar vira um ponto visível.
  if (resto.length === 0) ctx.lineTo(primeiro.x + 0.1, primeiro.y + 0.1);
  for (const p of resto) ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

/**
 * Editor do print do feedback (SPEC 112): caneta livre e retângulo por cima da
 * imagem, com desfazer. As marcas ficam em coordenadas da imagem, então o
 * export sai no tamanho real, não no tamanho exibido no modal.
 */
export const PrintAnnotator = forwardRef<PrintAnnotatorHandle, PrintAnnotatorProps>(function PrintAnnotator(
  { imagem, onRemover },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ferramenta, setFerramenta] = useState<Ferramenta>("caneta");
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const rascunho = useRef<Marca | null>(null);
  const { largura, altura } = ajustarTamanho(imagem.naturalWidth, imagem.naturalHeight);

  const redesenhar = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, largura, altura);
    ctx.drawImage(imagem, 0, 0, largura, altura);
    ctx.strokeStyle = corDaMarca();
    ctx.lineWidth = espessuraTraco(largura);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const m of marcas) desenharMarca(ctx, m);
    if (rascunho.current) desenharMarca(ctx, rascunho.current);
  }, [imagem, largura, altura, marcas]);

  useEffect(redesenhar, [redesenhar]);

  useImperativeHandle(ref, () => ({
    exportar: () => {
      const canvas = canvasRef.current;
      if (!canvas) return Promise.reject(new Error("Print indisponível."));
      return exportarPrint(canvas);
    },
  }));

  const pontoNoCanvas = (e: React.PointerEvent<HTMLCanvasElement>): Ponto => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * largura) / rect.width,
      y: ((e.clientY - rect.top) * altura) / rect.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pontoNoCanvas(e);
    rascunho.current = ferramenta === "caneta" ? { tipo: "caneta", pontos: [p] } : { tipo: "retangulo", de: p, ate: p };
    redesenhar();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const atual = rascunho.current;
    if (!atual) return;
    const p = pontoNoCanvas(e);
    if (atual.tipo === "caneta") atual.pontos.push(p);
    else atual.ate = p;
    redesenhar();
  };

  const handlePointerUp = () => {
    const pronto = rascunho.current;
    rascunho.current = null;
    if (!pronto) return;
    setMarcas((prev) => [...prev, pronto]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Marcar o print">
        <Button
          type="button"
          size="sm"
          variant={ferramenta === "caneta" ? "secondary" : "ghost"}
          aria-pressed={ferramenta === "caneta"}
          onClick={() => setFerramenta("caneta")}
        >
          <Pencil size={14} strokeWidth={1.5} />
          Caneta
        </Button>
        <Button
          type="button"
          size="sm"
          variant={ferramenta === "retangulo" ? "secondary" : "ghost"}
          aria-pressed={ferramenta === "retangulo"}
          onClick={() => setFerramenta("retangulo")}
        >
          <Square size={14} strokeWidth={1.5} />
          Retângulo
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={marcas.length === 0}
          onClick={() => setMarcas((prev) => prev.slice(0, -1))}
        >
          <Undo2 size={14} strokeWidth={1.5} />
          Desfazer
        </Button>
        <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={onRemover}>
          <Trash2 size={14} strokeWidth={1.5} />
          Remover print
        </Button>
      </div>
      <div className="flex justify-center rounded-lg border border-black/10 bg-black/5 p-1">
        <canvas
          ref={canvasRef}
          width={largura}
          height={altura}
          aria-label="Print anexado. Arraste para marcar o ponto do problema."
          className="h-auto max-h-[50vh] w-auto max-w-full cursor-crosshair touch-none rounded"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
    </div>
  );
});
