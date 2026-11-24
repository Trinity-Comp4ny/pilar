import { trackCta } from "../analytics";
import { DEMO_PATH } from "../lib/contato";
import { SplitButton } from "./ui/SplitButton";

/**
 * O par de botões da landing, o mesmo na hero, nas páginas de módulo e recurso e
 * no fecho: "Ver planos" (primário) e "Agendar demonstração" (contorno). O acesso
 * ao app ("Entrar") fica só no header e no rodapé: quem já é cliente sabe onde
 * procurar, e o espaço de destaque vai para quem ainda está decidindo
 * (DECISOES.md, 2026-11-24).
 */
export function BotoesCta({ local, className }: { local: string; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-2.5 sm:gap-3 ${className ?? ""}`}>
      <SplitButton to="/planos" onClick={() => trackCta("ver_planos", local)}>
        Ver planos
      </SplitButton>
      <SplitButton to={DEMO_PATH} onClick={() => trackCta("agende_demo", local)} fantasma>
        Agendar demonstração
      </SplitButton>
    </div>
  );
}
