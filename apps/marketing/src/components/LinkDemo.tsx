import { Link } from "react-router-dom";
import { trackCta } from "../analytics";
import { DEMO_PATH } from "../lib/contato";

/**
 * Linha discreta de demonstração, para os lugares onde o par de botões
 * (`BotoesCta`) não cabe: cartões de plano, artigos e ferramentas. Leva à página
 * `/demonstracao`, que tem a agenda embutida (decisão de 2026-11-24).
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
      <Link
        to={DEMO_PATH}
        onClick={() => trackCta("agende_demo", local)}
        className="text-ink underline underline-offset-2 hover:text-ink/70"
      >
        {rotulo}
      </Link>
    </p>
  );
}
