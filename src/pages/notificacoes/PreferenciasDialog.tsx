import { useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  CATEGORIAS,
  rotuloCategoria,
  iconeCategoria,
  emailPadraoCategoria,
  type CategoriaNotificacao,
} from "@/lib/notificacoes";
import {
  useNotificacaoPreferencias,
  useSetPreferenciaInApp,
  useSetPreferenciaEmail,
} from "@/hooks/useNotificacaoPreferencias";

interface PreferenciasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Preferências de notificação por categoria (spec 029, Fase 4). Mora aqui na
 * página de notificações; quando o modal de configurações estabilizar, pode
 * virar um painel dele. Coluna E-mail (SPEC 096): alerta urgente sai na hora,
 * o resto num resumo semanal; sem escolha, vale o padrão da categoria.
 */
export function PreferenciasDialog({ open, onOpenChange }: PreferenciasDialogProps) {
  const { data: prefs = [] } = useNotificacaoPreferencias();
  const setInApp = useSetPreferenciaInApp();
  const setEmail = useSetPreferenciaEmail();

  // Ausência de linha = in_app ligada; e-mail NULL/ausente = padrão da categoria.
  const porCategoria = useMemo(() => {
    const m = new Map<string, { inApp: boolean; email: boolean | null }>();
    for (const p of prefs) m.set(p.categoria, { inApp: p.in_app, email: p.email });
    return m;
  }, [prefs]);

  const estaLigada = (c: CategoriaNotificacao) => porCategoria.get(c)?.inApp ?? true;
  const emailLigado = (c: CategoriaNotificacao) => porCategoria.get(c)?.email ?? emailPadraoCategoria(c);
  const pendente = setInApp.isPending || setEmail.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Preferências de notificação</DialogTitle>
          <DialogDescription>
            Escolha o que aparece no sino e o que chega por e-mail. Vale só para você.
          </DialogDescription>
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
                    disabled={pendente}
                    onCheckedChange={(v) => setInApp.mutate({ categoria: c, inApp: v })}
                  />
                </div>
                <div className="flex justify-center">
                  <Switch
                    id={`pref-email-${c}`}
                    checked={emailLigado(c)}
                    disabled={pendente}
                    aria-label={`E-mail: ${rotuloCategoria(c)}`}
                    onCheckedChange={(v) => setEmail.mutate({ categoria: c, email: v })}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Por e-mail, alerta urgente sai em minutos se você não viu no app. O resto vai num resumo toda segunda-feira.
        </p>
      </DialogContent>
    </Dialog>
  );
}
