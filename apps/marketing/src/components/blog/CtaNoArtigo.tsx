import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { trackCta } from "../../analytics";
import type { CtaArtigo } from "../../lib/ctaArtigos";
import { LinkDemo } from "../LinkDemo";

/**
 * Convite no meio do artigo, ligado ao assunto dele (ver `lib/ctaArtigos.ts`).
 * Os eventos levam o sufixo `_meio` no `location` para o PostHog separar este
 * clique do CTA do fim do artigo.
 */
export function CtaNoArtigo({ slug, cta }: { slug: string; cta: CtaArtigo }) {
  const local = `blog_${slug}_meio`;

  return (
    <aside aria-label={cta.titulo} className="my-10 rounded-[20px] bg-card-brand-soft p-6 md:p-7">
      <p className="mb-2 text-[19px] font-medium leading-snug tracking-[-0.02em] text-ink">{cta.titulo}</p>
      <p className="mb-5 text-[14.5px] leading-relaxed text-ink-soft">{cta.texto}</p>
      <Link
        to={cta.acao.para}
        onClick={() => trackCta("cta_artigo", local)}
        className="inline-flex items-center gap-1.5 text-[14px] font-medium text-ink hover:text-ink/70"
      >
        {cta.acao.rotulo} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
      <LinkDemo local={local} texto="Prefere ver na sua operação?" className="mt-3" />
    </aside>
  );
}
