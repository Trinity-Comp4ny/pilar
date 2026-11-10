import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NovidadeLista } from "@/components/novidades/NovidadeLista";
import { useMarcarNovidadesVistas, useNovidades } from "@/hooks/useNovidades";

/**
 * Modal "O que mudou" (SPEC 152). Abre sozinho uma vez quando há release nova com mudança de
 * caminho (`fluxo`) que vale para a pessoa. Fechar conta como visto, em qualquer dispositivo.
 * Melhoria e correção não abrem modal: ficam no ponto do menu e na página Novidades.
 */
export function OQueMudou() {
  const { pendentes } = useNovidades();
  const marcar = useMarcarNovidadesVistas();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [fechado, setFechado] = useState(false);

  const releases = pendentes.comFluxo;
  const aberto = releases.length > 0 && !fechado && pathname !== "/novidades";
  if (!aberto) return null;

  const fluxo = releases.flatMap((r) => r.itens.filter((i) => i.impacto === "fluxo"));
  const outras = releases.reduce((n, r) => n + r.itens.length, 0) - fluxo.length;

  const fechar = () => {
    setFechado(true);
    marcar.mutate();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>O que mudou no Pilar</DialogTitle>
          <DialogDescription>Algumas tarefas mudaram de lugar ou de jeito. Vale um minuto.</DialogDescription>
        </DialogHeader>
        <NovidadeLista itens={fluxo} />
        <DialogFooter className="gap-2 sm:gap-0">
          {outras > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                fechar();
                navigate("/novidades");
              }}
            >
              {outras === 1 ? "Ver mais 1 novidade" : `Ver mais ${outras} novidades`}
            </Button>
          )}
          <Button variant="brand" onClick={fechar}>
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
