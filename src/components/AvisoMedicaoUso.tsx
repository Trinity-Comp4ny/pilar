import { Link } from "react-router-dom";

/**
 * Aviso (não é caixa) abaixo do aceite dos Termos e da Política, no cadastro e no primeiro acesso.
 * A medição de uso se apoia em legítimo interesse: um aceite só, e a pessoa pode desligar em
 * Configurações → Privacidade.
 */
export function AvisoMedicaoUso() {
  return (
    <p className="text-xs leading-relaxed text-ink-soft">
      Medimos como a Pilar é usada (telas e cliques, nunca nomes, valores ou documentos) para melhorar o produto. Você
      pode desligar quando quiser em Configurações → Privacidade.{" "}
      <Link
        to="/privacidade"
        target="_blank"
        rel="noopener noreferrer"
        className="text-ink underline underline-offset-2"
      >
        Saiba mais
      </Link>
    </p>
  );
}
