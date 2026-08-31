import { Link, useLocation } from "react-router-dom";
import { APP_URL } from "../config";
import { usePageMeta } from "../lib/seo";

/**
 * Sem isso, qualquer rota fora das listadas em App.tsx caía num <main> vazio
 * (header e footer renderizam, o conteúdo não): o Routes não tinha match e o
 * rewrite do Vercel devolve 200 pro index.html de qualquer jeito.
 */
export function NotFound() {
  const location = useLocation();

  usePageMeta({
    titulo: "Página não encontrada | Pilar",
    descricao: "Não encontramos o endereço que você tentou acessar.",
    caminho: location.pathname,
  });

  return (
    <section className="pt-24 pb-24 md:pt-32 md:pb-32">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-xl mx-auto text-center">
          <p className="text-[13px] uppercase tracking-[0.14em] text-ink-muted font-medium mb-4">404</p>
          <h1 className="text-[clamp(28px,4vw,40px)] font-medium tracking-[-0.03em] text-ink leading-[1.1] mb-4">
            Página não encontrada
          </h1>
          <p className="text-base text-ink-soft font-light leading-relaxed mb-10">
            Não encontramos o endereço que você tentou acessar.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/"
              className="px-6 py-3 rounded-full bg-brand text-ink text-[14px] font-medium hover:opacity-90 transition-opacity"
            >
              Ir para a página inicial
            </Link>
            <a
              href={`${APP_URL}/login`}
              className="text-[13.5px] text-ink/60 hover:text-ink transition-colors underline decoration-ink/25 underline-offset-4"
            >
              Ir para o login do Pilar
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
