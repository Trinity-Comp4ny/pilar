import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { compartilhar, temCompartilharNativo, type DadosCompartilhar } from "@/lib/compartilhar";

interface CompartilharButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  /** Devolve o que compartilhar na hora do toque (link já gerado, texto montado). */
  dados: () => DadosCompartilhar | null;
  rotulo?: string;
}

/**
 * Abre a folha de compartilhamento do celular (WhatsApp, E-mail, Mensagens). No computador, onde
 * já existe o botão de copiar, não aparece: este botão é o atalho do celular.
 */
export function CompartilharButton({
  dados,
  rotulo = "Compartilhar",
  variant = "outline",
  ...props
}: CompartilharButtonProps) {
  if (!temCompartilharNativo()) return null;

  const aoClicar = async () => {
    const conteudo = dados();
    if (!conteudo) return;
    const r = await compartilhar(conteudo);
    if (r === "copiado") toast.success("Copiado");
    if (r === "falhou") toast.error("Não foi possível compartilhar");
  };

  return (
    <Button type="button" variant={variant} onClick={aoClicar} {...props}>
      <Share2 className="h-3.5 w-3.5" />
      {rotulo}
    </Button>
  );
}
