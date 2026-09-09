import { useState } from "react";
import { toast } from "sonner";
import { HardHat, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { useCampoAcessos, type CampoAcesso } from "@/hooks/useCampoAcessos";
import { CriarAcessoCampoDialog } from "./CriarAcessoCampoDialog";

function statusLabel(acesso: CampoAcesso): string {
  if (!acesso.ativo) return "Revogado";
  if (acesso.convite_pendente) return "Convite pendente";
  return "Ativo";
}

export function ObraAcessosTab({ obraId, canEdit }: { obraId: string; canEdit: boolean }) {
  const { acessos, isLoading, revogar } = useCampoAcessos(obraId);
  const [criarOpen, setCriarOpen] = useState(false);
  const [confirmRevogar, setConfirmRevogar] = useState<CampoAcesso | null>(null);

  const handleRevogar = async () => {
    if (!confirmRevogar) return;
    try {
      await revogar.mutateAsync(confirmRevogar.id);
      toast.success("Acesso revogado");
      setConfirmRevogar(null);
    } catch (err) {
      toast.error("Não foi possível revogar", { description: errorMessage(err) });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canEdit && (
          <Button variant="brand" size="sm" onClick={() => setCriarOpen(true)}>
            <HardHat className="mr-1.5 h-4 w-4" />
            Criar acesso
          </Button>
        )}
      </div>

      {acessos.length === 0 ? (
        <EmptyState
          icon={HardHat}
          title="Ninguém tem acesso de campo ainda"
          description="Crie um acesso para o pessoal da obra registrar o dia pelo celular."
          action={canEdit ? { label: "Criar acesso", onClick: () => setCriarOpen(true) } : undefined}
        />
      ) : (
        <div className="space-y-2">
          {acessos.map((acesso) => (
            <div
              key={acesso.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-muted/20 p-3"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-medium text-ink">{acesso.nome}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {acesso.login_gerado ? "Sem e-mail (login inventado)" : acesso.email}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right text-xs text-muted-foreground">
                  <p>{statusLabel(acesso)}</p>
                  {acesso.ultimo_acesso && <p>Último acesso {formatDateTime(acesso.ultimo_acesso)}</p>}
                </div>
                {canEdit && acesso.ativo && (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmRevogar(acesso)}>
                    <ShieldOff className="mr-1.5 h-4 w-4" />
                    Revogar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CriarAcessoCampoDialog open={criarOpen} onOpenChange={setCriarOpen} obraId={obraId} />

      <ConfirmDialog
        open={!!confirmRevogar}
        onOpenChange={(v) => !v && setConfirmRevogar(null)}
        onConfirm={handleRevogar}
        title="Revogar acesso de campo?"
        itemName={confirmRevogar?.nome ?? ""}
        description="A pessoa não consegue mais entrar no Pilar Campo. Dá pra criar um acesso novo depois."
        variant="destructive"
        confirmText="Revogar"
        loading={revogar.isPending}
      />
    </div>
  );
}
