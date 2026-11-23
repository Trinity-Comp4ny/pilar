import { analytics } from "@/lib/analytics";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatDateTime } from "@/lib/format";

export function PropostaLinkVersao({
  versao,
  podePublicar,
  podeRevogar = podePublicar,
}: {
  versao: Tables<"proposta_versoes">;
  podePublicar: boolean;
  podeRevogar?: boolean;
}) {
  const queryClient = useQueryClient();
  const link = (token: string) => new URL(`/proposta-compartilhada#${token}`, window.location.origin).href;
  const atualizarVersoes = () => queryClient.invalidateQueries({ queryKey: ["proposta-versoes"] });
  const revogar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("revogar_link_proposta", { p_versao_id: versao.id });
      if (error) throw error;
    },
    onSuccess: async () => {
      await atualizarVersoes();
      toast.success("Link revogado");
    },
    onError: () => toast.error("Não foi possível revogar o link. Atualize as versões e tente novamente."),
  });
  const publicar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("publicar_link_proposta", { p_versao_id: versao.id });
      if (error || !data) throw error ?? new Error("Link indisponível");
      return data;
    },
    onSuccess: async () => {
      await Promise.all([atualizarVersoes(), queryClient.invalidateQueries({ queryKey: ["propostas"] })]);
      analytics.track("proposta_link_publicado");
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
            {podeRevogar && !versao.aceita_em && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm" disabled={revogar.isPending}>
                    Revogar link
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revogar o link da versão {versao.numero}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O endereço compartilhado deixará de abrir a proposta. O PDF e o histórico continuam no escritório.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => revogar.mutate()}>Confirmar revogação</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
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
