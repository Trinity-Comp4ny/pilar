import { useState } from "react";
import { CheckCircle2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageLoader } from "@/components/motion/PageLoader";
import { usePermissions } from "@/hooks/usePermissions";
import { CHAVE_STATUS_DRIVE, useStatusDrive } from "@/hooks/useGoogleDrive";
import { conectarGoogleDrive, desconectarDrive } from "@/lib/googleDrive";
import { getSafeErrorMessage } from "@/lib/safeError";
import { formatDateTime } from "@/lib/format";

// Integrações da empresa (SPEC 162). Hoje: Google Drive, para os arquivos dos projetos.
export function IntegracoesPanel() {
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const { data: status, isLoading, isError } = useStatusDrive();
  const [conectando, setConectando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [desconectando, setDesconectando] = useState(false);

  const conectar = async () => {
    setConectando(true);
    try {
      await conectarGoogleDrive();
    } catch (e) {
      setConectando(false);
      toast.error("Não foi possível conectar", { description: getSafeErrorMessage(e, "Tente de novo.") });
    }
  };

  const desconectar = async () => {
    setDesconectando(true);
    try {
      await desconectarDrive();
      toast.success("Google Drive desconectado", { description: "Os arquivos continuam no Drive." });
      queryClient.invalidateQueries({ queryKey: CHAVE_STATUS_DRIVE });
      setConfirmar(false);
    } catch (e) {
      toast.error("Não foi possível desconectar", { description: getSafeErrorMessage(e, "Tente de novo.") });
    } finally {
      setDesconectando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <FolderOpen className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-ink">Google Drive</p>
              <p className="text-sm text-muted-foreground">
                Cada projeto ganha uma pasta no Drive do escritório, com uma subpasta por disciplina. A equipe vê, envia
                e baixa os arquivos na aba Arquivos do projeto. Os arquivos ficam no Drive, não na Pilar.
              </p>
            </div>
          </div>

          {isLoading ? (
            <PageLoader size="inline" />
          ) : isError ? (
            <p className="text-sm text-danger-strong">Não foi possível ver o status da conexão.</p>
          ) : status?.conectado ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg border border-positive/20 bg-positive/10 px-3 py-2.5 text-sm text-positive-strong">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Conectado a <strong>{status.email}</strong>
                  {status.conectadoEm ? ` desde ${formatDateTime(status.conectadoEm)}` : ""}.
                </p>
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setConfirmar(true)}>
                  Desconectar
                </Button>
              )}
            </div>
          ) : isAdmin ? (
            <Button variant="brand" onClick={conectar} loading={conectando}>
              Conectar Google Drive
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Peça ao admin do escritório para conectar o Google Drive.</p>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        onConfirm={desconectar}
        loading={desconectando}
        variant="destructive"
        title="Desconectar o Google Drive?"
        description="A aba Arquivos dos projetos para de mostrar as pastas. Nada é apagado: os arquivos continuam no Drive da conta conectada."
        confirmText="Desconectar"
      />
    </div>
  );
}
