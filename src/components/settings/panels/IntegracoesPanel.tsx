import { useState } from "react";
import { AlertTriangle, CheckCircle2, FolderOpen, Video } from "lucide-react";
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
import { CHAVE_EVENTOS_AGENDA, CHAVE_STATUS_AGENDA, useStatusAgenda } from "@/hooks/useGoogleAgenda";
import { OPCOES_AVISO, conectarGoogleAgenda, definirAvisoPadrao, desconectarAgenda } from "@/lib/googleAgenda";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Integrações: Google Drive do escritório (SPEC 163) e Google Agenda de cada pessoa (SPEC 164).
export function IntegracoesPanel() {
  return (
    <div className="space-y-4">
      <AgendaCard />
      <DriveCard />
    </div>
  );
}

/** Google Agenda: pessoal. Cada um conecta a própria conta; ninguém vê a agenda do outro. */
function AgendaCard() {
  const queryClient = useQueryClient();
  const { data: status, isLoading, isError } = useStatusAgenda();
  const [conectando, setConectando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [salvandoAviso, setSalvandoAviso] = useState(false);

  const mudarAviso = async (valor: string) => {
    setSalvandoAviso(true);
    try {
      await definirAvisoPadrao(valor === "-1" ? null : Number(valor));
      await queryClient.invalidateQueries({ queryKey: CHAVE_STATUS_AGENDA });
      toast.success("Aviso das reuniões atualizado");
    } catch (e) {
      toast.error("Não foi possível salvar o aviso", { description: getSafeErrorMessage(e, "Tente de novo.") });
    } finally {
      setSalvandoAviso(false);
    }
  };

  const conectar = async () => {
    setConectando(true);
    try {
      await conectarGoogleAgenda();
    } catch (e) {
      setConectando(false);
      toast.error("Não foi possível conectar", { description: getSafeErrorMessage(e, "Tente de novo.") });
    }
  };

  const desconectar = async () => {
    setDesconectando(true);
    try {
      await desconectarAgenda();
      toast.success("Google Agenda desconectado", { description: "Nada foi alterado na sua agenda." });
      queryClient.invalidateQueries({ queryKey: CHAVE_STATUS_AGENDA });
      queryClient.invalidateQueries({ queryKey: CHAVE_EVENTOS_AGENDA });
      setConfirmar(false);
    } catch (e) {
      toast.error("Não foi possível desconectar", { description: getSafeErrorMessage(e, "Tente de novo.") });
    } finally {
      setDesconectando(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start gap-3">
          <Video className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-ink">Google Agenda</p>
            <p className="text-sm text-muted-foreground">
              Suas reuniões aparecem na Agenda de Tarefas, junto dos prazos. Você cria, edita e exclui reuniões ali
              mesmo, com sala do Meet e convite aos convidados, e a Pilar avisa antes de cada uma. A conexão é sua: a
              equipe não vê a sua agenda.
            </p>
          </div>
        </div>

        {isLoading ? (
          <PageLoader size="inline" />
        ) : isError ? (
          <p className="text-sm text-danger-strong">Não foi possível ver o status da conexão.</p>
        ) : status?.conectado && status.reconectar ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-warning-mid-border bg-warning-soft px-3 py-2.5 text-sm text-warning-strong">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                O Google recusou o acesso a <strong>{status.email}</strong>. Conecte de novo para voltar a receber os
                avisos.
              </p>
            </div>
            <Button variant="brand" onClick={conectar} loading={conectando}>
              Reconectar Google Agenda
            </Button>
          </div>
        ) : status?.conectado ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-positive/20 bg-positive/10 px-3 py-2.5 text-sm text-positive-strong">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Conectado a <strong>{status.email}</strong>
                {status.sincronizadoEm ? `. Atualizado em ${formatDateTime(status.sincronizadoEm)}` : ""}.
              </p>
            </div>
            <div className="max-w-xs space-y-1.5">
              <Label>Avisar antes das reuniões</Label>
              <Select
                value={status.lembreteMinutos === null ? "-1" : String(status.lembreteMinutos)}
                onValueChange={mudarAviso}
                disabled={salvandoAviso}
              >
                <SelectTrigger className="h-9" aria-label="Avisar antes das reuniões">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPCOES_AVISO.map((o) => (
                    <SelectItem key={o.valor} value={String(o.valor)}>
                      {o.rotulo}
                    </SelectItem>
                  ))}
                  <SelectItem value="-1">Não avisar</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Vale para as reuniões sem aviso próprio. O aviso de cada reunião muda na própria reunião.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setConfirmar(true)}>
              Desconectar
            </Button>
          </div>
        ) : (
          <Button variant="brand" onClick={conectar} loading={conectando}>
            Conectar Google Agenda
          </Button>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        onConfirm={desconectar}
        loading={desconectando}
        variant="destructive"
        title="Desconectar o Google Agenda?"
        description="As reuniões saem da Agenda da Pilar e os avisos param. Nada muda na sua agenda do Google."
        confirmText="Desconectar"
      />
    </Card>
  );
}

function DriveCard() {
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
    <>
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
    </>
  );
}
