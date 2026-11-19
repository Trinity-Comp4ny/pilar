import type { MutableRefObject } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Endereco {
  loc_logradouro: string;
  loc_numero: string;
  loc_cep: string;
  loc_cidade: string;
  loc_estado: string;
}

interface Params {
  form: Endereco;
  /** Endereço já composto em uma linha. */
  localizacaoComposta: string;
  /** Projeto cujas coordenadas serão gravadas (nulo se o salvamento não devolveu id). */
  alvoId: string | null;
  abortRef: MutableRefObject<AbortController | null>;
  onSaved: () => void;
  queryClient: QueryClient;
}

const AVISO_FALHA = {
  description: "Não foi possível obter coordenadas do endereço. O projeto não aparecerá no mapa.",
};

/**
 * Geocodifica o endereço do projeto depois de salvar e grava latitude/longitude.
 * Marca esta geocodificação como a mais recente: se o usuário salvar de novo antes
 * desta terminar, a anterior não sobrescreve as coordenadas.
 */
export function geocodificarProjeto({ form, localizacaoComposta, alvoId, abortRef, onSaved, queryClient }: Params) {
  abortRef.current?.abort();
  const abortController = new AbortController();
  abortRef.current = abortController;
  const { signal } = abortController;

  const street = [form.loc_logradouro, form.loc_numero].filter(Boolean).join(" ");
  const cepDigits = form.loc_cep.replace(/\D/g, "");
  const postalcode = cepDigits.length === 8 ? `${cepDigits.slice(0, 5)}-${cepDigits.slice(5)}` : "";

  const saveCoords = (lat: number, lng: number) => {
    if (signal.aborted || !alvoId) return;
    const query = supabase.from("projetos").update({ latitude: lat, longitude: lng }).eq("id", alvoId);
    query.then(() => {
      onSaved();
      queryClient.invalidateQueries({ queryKey: ["projetos-mapa"] });
    });
  };

  // Geocodifica via edge function (User-Agent + fair-use do Nominatim no
  // servidor). A edge já faz o fallback cidade+estado internamente.
  supabase.functions
    .invoke("geocode-address", {
      body: {
        street: street || undefined,
        city: form.loc_cidade || undefined,
        state: form.loc_estado || undefined,
        postalcode: postalcode || undefined,
        address: localizacaoComposta,
      },
    })
    .then(({ data, error }) => {
      if (signal.aborted) return;
      if (error) {
        toast.warning("Geocodificação falhou", AVISO_FALHA);
        return;
      }
      const lat = typeof data?.lat === "number" ? data.lat : NaN;
      const lng = typeof data?.lng === "number" ? data.lng : NaN;
      if (data?.found && !isNaN(lat) && !isNaN(lng)) {
        saveCoords(lat, lng);
        return;
      }
      if (data?.indisponivel) {
        toast.warning("Mapa indisponível agora", {
          description:
            "O serviço de mapas não respondeu. Salve o projeto de novo mais tarde para ele aparecer no mapa.",
        });
        return;
      }
      toast.warning("Endereço não localizado", {
        description: "Não foi possível encontrar as coordenadas do endereço. O projeto não aparecerá no mapa.",
      });
    })
    .catch(() => {
      if (signal.aborted) return;
      toast.warning("Geocodificação falhou", AVISO_FALHA);
    });
}
