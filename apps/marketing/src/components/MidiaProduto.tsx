type Captura = { arquivo: string; descricao: string };
type Print = Captura & { formato?: "jpg"; largura?: number; altura?: number };
export type Midia = { print?: Print; video?: Captura };

export function MidiaProduto({ midia }: { midia: Midia }) {
  const poster = midia.print && `/screens/${midia.print.arquivo}.${midia.print.formato ?? "png"}`;
  return (
    <div className="min-w-0 space-y-5">
      {midia.print && (
        <figure>
          <a href={poster} aria-label={`Ampliar captura. ${midia.print.descricao}`}>
            <img
              src={poster}
              alt={midia.print.descricao}
              width={midia.print.largura ?? 1440}
              height={midia.print.altura ?? 900}
              loading="lazy"
              className="block max-h-[36rem] w-full rounded-xl border border-paper-border object-contain object-top"
            />
          </a>
          <figcaption className="mt-2 text-sm text-ink-muted">Captura da Pilar com dados de demonstração.</figcaption>
        </figure>
      )}
      {midia.video && (
        <figure>
          <video
            aria-label={midia.video.descricao}
            controls
            playsInline
            preload="none"
            className="aspect-[8/5] w-full rounded-xl bg-ink"
            poster={poster}
            src={`/screens/${midia.video.arquivo}.mp4`}
          >
            <a href={`/screens/${midia.video.arquivo}.mp4`}>Abrir vídeo</a>
          </video>
          <figcaption className="mt-2 text-sm text-ink-muted">{midia.video.descricao} Gravação sem áudio.</figcaption>
        </figure>
      )}
    </div>
  );
}
