import { useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CATEGORIAS, rotuloCategoria, iconeCategoria, type CategoriaNotificacao } from "@/lib/notificacoes";
import { useNotificacaoPreferencias, useSetPreferenciaInApp } from "@/hooks/useNotificacaoPreferencias";

interface PreferenciasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Preferências de notificação por categoria (spec 029, Fase 4). Mora aqui na
 * página de notificações; quando o modal de configurações estabilizar, pode
 * virar um painel dele. E-mail aparece desabilitado ("em breve") — canal é pós-v1.
 */
export function PreferenciasDialog({ open, onOpenChange }: PreferenciasDialogProps) {
  const { data: prefs = [] } = useNotificacaoPreferencias();
  const setInApp = useSetPreferenciaInApp();

  // Ausência de linha = ligada. Mapa categoria → in_app efetivo.
  const inAppPor = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const p of prefs) m.set(p.categoria, p.in_app);
    return m;
  }, [prefs]);

  const estaLigada = (c: CategoriaNotificacao) => inAppPor.get(c) ?? true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Preferências de notificação</DialogTitle>
          <DialogDescription>Escolha o que aparece no seu sino. Vale só para você.</DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-1">
          <span />
          <span className="text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            No app
          </span>
          <span className="text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            E-mail
          </span>

          {CATEGORIAS.map((c) => {
            const Icon = iconeCategoria(c);
            const ligada = estaLigada(c);
            return (
              <div key={c} className="contents">
                <Label htmlFor={`pref-${c}`} className="flex items-center gap-2 py-2 text-sm font-normal text-ink">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {rotuloCategoria(c)}
                </Label>
                <div className="flex justify-center">
                  <Switch
                    id={`pref-${c}`}
                    checked={ligada}
                    disabled={setInApp.isPending}
                    onCheckedChange={(v) => setInApp.mutate({ categoria: c, inApp: v })}
                  />
                </div>
                <div className="flex justify-center">
                  <Switch checked={false} disabled aria-label="E-mail (em breve)" />
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">Notificação por e-mail chega em breve.</p>
      </DialogContent>
    </Dialog>
  );
}
