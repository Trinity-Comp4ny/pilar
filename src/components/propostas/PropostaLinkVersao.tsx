import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatDateTime } from "@/lib/format";

export function PropostaLinkVersao({
  versao,
  podePublicar,
}: {
  versao: Tables<"proposta_versoes">;
  podePublicar: boolean;
}) {
  const queryClient = useQueryClient();
  const link = (token: string) => new URL(`/proposta-compartilhada#${token}`, window.location.origin).href;
  const publicar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("publicar_link_proposta", { p_versao_id: versao.id });
      if (error || !data) throw error ?? new Error("Link indisponível");
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["proposta-versoes"] }),
        queryClient.invalidateQueries({ queryKey: ["propostas"] }),
      ]);
      toast.success("Link publicado");
    },
    onError: () =>
      toast.error("Não foi possível publicar. Confira se o PDF é da versão atual e está dentro da validade."),
  });

  const url = versao.link_token ? link(versao.link_token) : null;
  const copiar = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Selecione o endereço para copiar manualmente.");
    }
  };

  return (
    <div className="space-y-2">
      {url ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label={`Link da versão ${versao.numero}`}
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
              className="min-w-40 flex-1 rounded-md border bg-background px-2 py-1 text-xs"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => void copiar()}>
              Copiar link
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {versao.primeira_abertura_em
              ? `Primeira abertura: ${formatDateTime(versao.primeira_abertura_em)} · Última: ${formatDateTime(versao.ultima_abertura_em)}`
              : "Nenhuma abertura registrada"}
          </p>
          {versao.aceita_em && (
            <p className="text-xs font-medium">Versão aceita em {formatDateTime(versao.aceita_em)}</p>
          )}
        </>
      ) : (
        podePublicar && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={publicar.isPending}
            onClick={() => publicar.mutate()}
          >
            Publicar link
          </Button>
        )
      )}
    </div>
  );
}
