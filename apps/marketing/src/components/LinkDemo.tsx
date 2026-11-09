import { trackCta } from "../analytics";
import { DEMO_URL } from "../lib/contato";

/**
 * Caminho secundário para quem quer ver o Pilar antes de assinar (decisão de
 * 2026-11-08): os botões principais levam aos planos; a demonstração fica numa
 * linha discreta embaixo, em nova aba (Google Agenda) e sem dar `window.opener`.
 */
export function LinkDemo({
  local,
  texto = "Prefere ver antes de assinar?",
  rotulo = "Agende uma demonstração",
  className,
}: {
  local: string;
  texto?: string | null;
  rotulo?: string;
  className?: string;
}) {
  return (
    <p className={`text-[12.5px] text-ink-muted ${className ?? ""}`}>
      {texto ? `${texto} ` : null}
      <a
        href={DEMO_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackCta("agende_demo", local)}
        className="text-ink underline underline-offset-2 hover:text-ink/70"
      >
        {rotulo}
      </a>
    </p>
  );
}
