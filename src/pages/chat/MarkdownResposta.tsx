import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown das respostas do agente (spec 075): negrito, listas, código inline e links
 * internos para os registros citados (SPEC 147).
 * HTML cru nunca é interpretado (react-markdown escapa por padrão), então o
 * conteúdo do modelo não vira vetor de injeção na tela.
 */
export function MarkdownResposta({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Link para registro da Pilar (ex.: /projetos/abc) navega sem recarregar o app.
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
