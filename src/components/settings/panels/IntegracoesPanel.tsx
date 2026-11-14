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
import {
  CHAVE_AGENDAS_DA_CONTA,
  CHAVE_EVENTOS_AGENDA,
  CHAVE_STATUS_AGENDA,
  useAgendasDaConta,
  useStatusAgenda,
} from "@/hooks/useGoogleAgenda";
import {
  type AgendaDaConta,
  OPCOES_AVISO,
  conectarGoogleAgenda,
  definirAgendaVisivel,
  definirAvisoPadrao,
  desconectarAgenda,
  sincronizarAgenda,
} from "@/lib/googleAgenda";
import { Checkbox } from "@/components/ui/checkbox";
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
  const conectadoOk = !!status?.conectado && !status.reconectar;
  const { data: agendas = [] } = useAgendasDaConta(conectadoOk);
  const [mudandoAgenda, setMudandoAgenda] = useState<string | null>(null);

  // Ligar traz as reuniões na hora (sincroniza); desligar já tira as reuniões no banco.
  const alternarAgenda = async (agenda: AgendaDaConta, visivel: boolean) => {
    setMudandoAgenda(agenda.id);
    try {
      await definirAgendaVisivel(agenda.id, visivel);
      if (visivel) await sincronizarAgenda();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CHAVE_AGENDAS_DA_CONTA }),
        queryClient.invalidateQueries({ queryKey: CHAVE_EVENTOS_AGENDA }),
      ]);
    } catch (e) {
      toast.error("Não foi possível mudar a agenda", { description: getSafeErrorMessage(e, "Tente de novo.") });
    } finally {
      setMudandoAgenda(null);
    }
  };

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
      queryClient.invalidateQueries({ queryKey: CHAVE_AGENDAS_DA_CONTA });
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
            {agendas.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-ink">Agendas que aparecem na Pilar</p>
                <ul className="space-y-1" aria-label="Agendas do Google">
                  {agendas.map((a) => (
                    <li key={a.id}>
                      <label htmlFor={`agenda-${a.id}`} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                        <Checkbox
                          id={`agenda-${a.id}`}
                          checked={a.visivel}
                          disabled={mudandoAgenda !== null}
                          onCheckedChange={(v) => void alternarAgenda(a, v === true)}
                        />
                        {/* Cor que a agenda tem no Google: dado do usuário, não token de tema. */}
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5 shrink-0 rounded-full border border-border"
                          style={a.cor ? { backgroundColor: a.cor } : undefined}
                        />
                        <span className="truncate text-ink">{a.nome}</span>
                        {a.principal && <span className="text-xs text-muted-foreground">principal</span>}
                        {!a.pode_editar && <span className="text-xs text-muted-foreground">só leitura</span>}
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Pessoal, trabalho, compartilhadas: todas as agendas da sua conta. Desligar tira as reuniões dela da
                  Pilar e para os avisos.
                </p>
              </div>
            )}
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
