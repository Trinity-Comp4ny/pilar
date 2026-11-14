import { EllipsisVertical, Share, SquarePlus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Passo {
  texto: React.ReactNode;
  icone?: LucideIcon;
}

const PASSOS: Record<"ios" | "android", { titulo: string; descricao: string; passos: Passo[] }> = {
  ios: {
    titulo: "Instalar no iPhone",
    descricao: "O iPhone não instala pelo site: são três toques no navegador.",
    passos: [
      {
        icone: Share,
        texto: (
          <>
            Toque em <strong className="font-semibold text-ink">Compartilhar</strong>, na barra do navegador. No Safari,
            se não aparecer, toque antes em <strong className="font-semibold text-ink">···</strong>.
          </>
        ),
      },
      {
        icone: SquarePlus,
        texto: (
          <>
            Role a lista e toque em <strong className="font-semibold text-ink">Adicionar à Tela de Início</strong>.
          </>
        ),
      },
      {
        texto: (
          <>
            Toque em <strong className="font-semibold text-ink">Adicionar</strong>. O Pilar aparece na tela inicial e
            abre em tela cheia, como um app.
          </>
        ),
      },
    ],
  },
  android: {
    titulo: "Instalar no Android",
    descricao: "Pelo menu do navegador, em três toques.",
    passos: [
      {
        icone: EllipsisVertical,
        texto: (
          <>
            Toque no <strong className="font-semibold text-ink">menu</strong> do navegador, no canto de cima da tela.
          </>
        ),
      },
      {
        icone: SquarePlus,
        texto: (
          <>
            Toque em <strong className="font-semibold text-ink">Instalar app</strong> ou{" "}
            <strong className="font-semibold text-ink">Adicionar à tela inicial</strong>.
          </>
        ),
      },
      {
        texto: <>Confirme. O Pilar aparece na tela inicial e abre em tela cheia, como um app.</>,
      },
    ],
  },
};

interface InstrucoesInstalarProps {
  plataforma: "ios" | "android";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Passos para pôr o Pilar na tela inicial quando o navegador não instala sozinho. */
export function InstrucoesInstalar({ plataforma, open, onOpenChange }: InstrucoesInstalarProps) {
  const conteudo = PASSOS[plataforma];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{conteudo.titulo}</DialogTitle>
          <DialogDescription>{conteudo.descricao}</DialogDescription>
        </DialogHeader>

        <ol className="space-y-3">
          {conteudo.passos.map((passo, i) => {
            const Icone = passo.icone;
            return (
              <li key={i} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-ink"
                >
                  {i + 1}
                </span>
                <p className="flex-1 pt-0.5 text-sm text-ink-soft">{passo.texto}</p>
                {Icone && (
                  <span
                    aria-hidden="true"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-muted text-ink"
                  >
                    <Icone size={16} />
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
