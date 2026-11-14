import { Fragment } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { teclaModificadora } from "@/lib/teclado";
import { gruposDeAtalhos } from "@/lib/atalhosTeclado";

function Tecla({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-surface-muted px-1.5 font-mono text-xs text-ink">
      {children}
    </kbd>
  );
}

interface AtalhosTecladoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AtalhosTecladoDialog({ open, onOpenChange }: AtalhosTecladoDialogProps) {
  const grupos = gruposDeAtalhos(teclaModificadora());
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
          <DialogDescription>Funcionam quando o cursor não está num campo de texto.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {grupos.map((grupo) => (
            <section key={grupo.titulo} aria-label={grupo.titulo}>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{grupo.titulo}</h3>
              <ul className="divide-y divide-border-subtle">
                {grupo.atalhos.map((atalho) => (
                  <li
                    key={atalho.descricao}
                    className="flex items-center justify-between gap-4 py-2 text-sm text-ink-soft"
                  >
                    <span>{atalho.descricao}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {atalho.teclas.map((tecla, i) => (
                        <Fragment key={tecla}>
                          {i > 0 ? (
                            <span className="text-xs text-muted-foreground">{atalho.ou ? "ou" : "+"}</span>
                          ) : null}
                          <Tecla>{tecla}</Tecla>
                        </Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
