import { useReducedMotion } from "framer-motion";

type Captura = { arquivo: string; descricao: string };
type Print = Captura & { formato?: "jpg"; largura?: number; altura?: number };
export type Midia = { print?: Print; video?: Captura };

/**
 * Mídia do produto: uma coisa só, vídeo OU captura (decisão de 2026-11-24).
 *
 * O vídeo roda sozinho, mudo e em loop, sem controle de play ou pausa: lê como um
 * GIF da tela, não como um player. Quem pede menos movimento no sistema recebe a
 * captura (ou o quadro inicial do vídeo) parada no lugar.
 */
export function MidiaProduto({ midia }: { midia: Midia }) {
  const reducedMotion = useReducedMotion();
  const poster = midia.print && `/screens/${midia.print.arquivo}.${midia.print.formato ?? "png"}`;
  const mostrarVideo = Boolean(midia.video) && !(reducedMotion && poster);

  if (mostrarVideo && midia.video) {
    return (
      <figure className="min-w-0">
        <video
          aria-label={midia.video.descricao}
          autoPlay={!reducedMotion}
          muted
          loop
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          preload="metadata"
          poster={poster}
          src={`/screens/${midia.video.arquivo}.mp4`}
          className="pointer-events-none block aspect-[8/5] w-full rounded-xl border border-paper-border bg-white object-cover object-top"
        />
        <figcaption className="mt-2 text-sm text-ink-muted">A Pilar com dados de demonstração.</figcaption>
      </figure>
    );
  }

  if (!midia.print || !poster) return null;
  return (
    <figure className="min-w-0">
      <img
        src={poster}
        alt={midia.print.descricao}
        width={midia.print.largura ?? 1440}
        height={midia.print.altura ?? 900}
        loading="lazy"
        className="block max-h-[36rem] w-full rounded-xl border border-paper-border object-contain object-top"
      />
      <figcaption className="mt-2 text-sm text-ink-muted">A Pilar com dados de demonstração.</figcaption>
    </figure>
  );
}
