import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Bloco } from "../../lib/markdown";

/** Desenha os blocos de `lib/markdown.ts` com a tipografia da landing. */

/** Negrito e link. Link interno vira <Link> (navegação da SPA); externo abre em outra aba. */
function inline(texto: string): ReactNode[] {
  const nos: ReactNode[] = [];
  const padrao = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = padrao.exec(texto))) {
    if (m.index > ultimo) nos.push(texto.slice(ultimo, m.index));
    if (m[1]) {
      nos.push(
        <strong key={k++} className="font-medium text-ink">
          {m[1]}
        </strong>
      );
    } else if (m[3].startsWith("/")) {
      nos.push(
        <Link
          key={k++}
          to={m[3]}
          className="text-ink underline decoration-ink/25 underline-offset-[3px] hover:decoration-ink"
        >
          {m[2]}
        </Link>
      );
    } else {
      nos.push(
        <a
          key={k++}
          href={m[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink underline decoration-ink/25 underline-offset-[3px] hover:decoration-ink"
        >
          {m[2]}
        </a>
      );
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) nos.push(texto.slice(ultimo));
  return nos;
}

export function Markdown({ blocos }: { blocos: Bloco[] }) {
  return (
    <>
      {blocos.map((b, i) => {
        switch (b.tipo) {
          case "h2":
            return (
              <h2
                key={i}
                id={b.id}
                className="mb-4 mt-12 scroll-mt-28 text-[26px] font-medium leading-[1.15] tracking-[-0.025em] text-ink max-[850px]:text-[22px]"
              >
                {b.texto}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} id={b.id} className="mb-2 mt-8 scroll-mt-28 text-[18px] font-medium leading-snug text-ink">
                {b.texto}
              </h3>
            );
          case "p":
            return (
              <p key={i} className="mb-5 text-[16px] leading-[1.75] text-ink-soft">
                {inline(b.texto)}
              </p>
            );
          case "destaque":
            return (
              <blockquote
                key={i}
                className="my-7 rounded-[18px] border-l-[3px] border-modulo-gestao-strong bg-card-brand-soft px-6 py-5 text-[15.5px] leading-relaxed text-ink"
              >
                {inline(b.texto)}
              </blockquote>
            );
          case "ul":
          case "ol": {
            const Lista = b.tipo === "ul" ? "ul" : "ol";
            return (
              <Lista
                key={i}
                className={`mb-6 flex flex-col gap-2 pl-5 text-[16px] leading-[1.7] text-ink-soft ${
                  b.tipo === "ul" ? "list-disc" : "list-decimal"
                } marker:text-ink-muted`}
              >
                {b.itens.map((item, j) => (
                  <li key={j} className="pl-1">
                    {inline(item)}
                  </li>
                ))}
              </Lista>
            );
          }
          case "tabela":
            return (
              <div key={i} className="my-7 overflow-x-auto rounded-[18px] border border-paper-border/80">
                <table className="w-full min-w-[520px] border-collapse text-left text-[14px]">
                  <thead className="bg-paper-alt text-[11px] uppercase tracking-widest text-ink-muted">
                    <tr>
                      {b.cabecalho.map((c, j) => (
                        <th key={j} scope="col" className="px-4 py-3 font-medium">
                          {inline(c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.linhas.map((linha, j) => (
                      <tr key={j} className={j % 2 === 1 ? "bg-paper-alt/40" : ""}>
                        {linha.map((c, k) => (
                          <td key={k} className="px-4 py-3 align-top leading-snug text-ink-soft">
                            {inline(c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </>
  );
}
