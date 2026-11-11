import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { AVISOS_PLATAFORMA_KEY, useComunicadosModal } from "@/hooks/useAvisosPlataforma";

/**
 * Comunicado em modal (SPEC 157): abre uma vez, o mais recente primeiro; "Entendi" dispensa no
 * banco e ele não volta em nenhum dispositivo.
 */
export function ComunicadoModal() {
  const comunicados = useComunicadosModal();
  const queryClient = useQueryClient();
  const [fechados, setFechados] = useState<string[]>([]);
  const atual = comunicados.find((c) => !fechados.includes(c.id));
  if (!atual) return null;

  const dispensar = () => {
    setFechados((f) => [...f, atual.id]);
    void supabase
      .rpc("dispensar_comunicado", { p_comunicado_id: atual.id })
      .then(() => queryClient.invalidateQueries({ queryKey: AVISOS_PLATAFORMA_KEY }));
  };

  const link = atual.link_url;
  const rotulo = atual.link_rotulo || "Saiba mais";

  return (
    <Dialog open onOpenChange={(o) => !o && dispensar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{atual.titulo}</DialogTitle>
          <DialogDescription className="whitespace-pre-line text-ink">{atual.mensagem}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          {link && (
            <Button variant="outline" asChild onClick={dispensar}>
              {link.startsWith("/") ? (
                <Link to={link}>{rotulo}</Link>
              ) : (
                <a href={link} target="_blank" rel="noreferrer">
                  {rotulo}
                </a>
              )}
            </Button>
          )}
          <Button variant="brand" onClick={dispensar}>
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
