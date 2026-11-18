import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { Lead } from "@/hooks/useLeads";
export function useLeadAtividadeLink(leads: Lead[], select: (lead: Lead) => void, open: (value: boolean) => void) {
  const [params, setParams] = useSearchParams();
  const id = params.get("lead");
  useEffect(() => {
    const lead = leads.find((l) => l.id === id);
    if (lead) {
      select(lead);
      open(true);
    }
  }, [id, leads, select, open]);
  return {
    comentarioDestacado: params.get("comentario"),
    onOpenChangeDetalhe: (value: boolean) => {
      open(value);
      if (!value && id)
        setParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("lead");
            next.delete("comentario");
            return next;
          },
          { replace: true }
        );
    },
  };
}
