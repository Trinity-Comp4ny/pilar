import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Corpo de um artigo da central de ajuda (SPEC 154). Link interno (`/leads`) navega sem recarregar;
 * HTML cru nunca é interpretado (react-markdown escapa por padrão).
 */
export function ArtigoMarkdown({ children }: { children: string }) {
  return (
    <div className="max-w-2xl text-sm leading-relaxed text-ink [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: texto }) =>
            href?.startsWith("/") && !href.startsWith("//") ? (
              <Link to={href}>{texto}</Link>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {texto}
              </a>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
