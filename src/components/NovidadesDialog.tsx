import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { NOVIDADES, ROTULO_TIPO, VARIANTE_TIPO } from "@/lib/novidades";

type NovidadesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Marca a versão como vista. Chamada ao abrir. */
  onVisto?: () => void;
};

/**
 * Central de novidades (spec 038). Lista os releases voltados ao usuário, do mais
 * recente ao mais antigo, cada item com um selo do tipo (Novo/Melhoria/Correção).
 * Ao abrir, marca a versão atual como vista.
 */
export function NovidadesDialog({ open, onOpenChange, onVisto }: NovidadesDialogProps) {
  useEffect(() => {
    if (open) onVisto?.();
  }, [open, onVisto]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(100vw-2rem,560px)] p-0">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand" strokeWidth={1.75} />
            Novidades
          </DialogTitle>
          <DialogDescription>O que chegou de novo, melhorou e foi corrigido no Pilar.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-8 px-6 py-5">
            {NOVIDADES.map((release) => (
              <section key={release.versao} className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold tracking-tight text-ink">{release.titulo}</h3>
                  <span className="shrink-0 text-xs text-muted-foreground">{release.data}</span>
                </div>
                <ul className="space-y-2.5">
                  {release.itens.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Badge variant={VARIANTE_TIPO[item.tipo]} className="mt-0.5 shrink-0">
                        {ROTULO_TIPO[item.tipo]}
                      </Badge>
                      <span className="text-sm leading-relaxed text-foreground">{item.texto}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default NovidadesDialog;
