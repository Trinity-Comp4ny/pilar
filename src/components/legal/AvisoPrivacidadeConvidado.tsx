import { cn } from "@/lib/utils";

/**
 * Aviso de privacidade para quem entra no Pilar a convite de um escritório e nunca
 * aceitou os Termos: cliente no portal, fornecedor no link de cotação, profissional
 * no Pilar Campo. O controlador desses dados é o escritório (LGPD art. 9º, III);
 * o Pilar é operador. Ver /privacidade, seção 1.
 */
export function AvisoPrivacidadeConvidado({
  escritorio,
  className,
}: {
  escritorio?: string | null;
  className?: string;
}) {
  const quem = escritorio?.trim() ? escritorio.trim() : null;
  return (
    <p className={cn("text-center text-xs text-muted-foreground", className)}>
      Seus dados são tratados {quem ? `por ${quem}` : "pelo escritório que convidou você"}, que usa o Pilar. Saiba como
      na{" "}
      <a
        href="/privacidade"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground"
      >
        Política de Privacidade
      </a>
      .
    </p>
  );
}
