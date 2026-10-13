import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { toDataSourceResult } from "@/types/dataSource";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/FormDialog";
import { PilarPage } from "@/components/PilarPage";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";
import { mensagemDaFunction } from "@/lib/edgeError";
import { usePageTitle } from "@/hooks/usePageTitle";

interface PedidoRow {
  id: string;
  titularNome: string;
  titularEmail: string;
  empresaNome: string;
  motivo: string | null;
  status: string;
  requestedAt: string;
  prazoEm: string;
  notes: string | null;
  unicoAdmin: boolean;
}

const ABERTO = new Set(["pending", "failed"]);
const DIA_MS = 24 * 60 * 60 * 1000;

/** Dias até o prazo legal (LGPD art. 19); negativo é atraso. */
function diasAtePrazo(prazoEm: string): number {
  return Math.ceil((new Date(prazoEm).getTime() - Date.now()) / DIA_MS);
}

// Fila de pedidos de exclusão (SPEC 116), seção do portal ultra admin (SPEC 117).
// Aprovar chama a edge excluir-dados-titular, que apaga o dado pessoal e anonimiza a
// conta; recusar avisa o titular com o motivo.
export default function PedidosLgpd() {
  usePageTitle("Pedidos LGPD · Ultra admin");
  const queryClient = useQueryClient();
  const [aprovarAlvo, setAprovarAlvo] = useState<PedidoRow | null>(null);
  const [recusarAlvo, setRecusarAlvo] = useState<PedidoRow | null>(null);
  const [motivoRecusa, setMotivoRecusa] = useState("");

  const query = useQuery({
    queryKey: ["ultra-admin-pedidos-lgpd"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ultra_admin_listar_pedidos_exclusao");
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo<PedidoRow[]>(
    () =>
      (query.data ?? []).map((p) => ({
        id: p.id,
        titularNome: p.titular_nome ?? "",
        titularEmail: p.titular_email ?? "",
        empresaNome: p.empresa_nome ?? "",
        motivo: p.motivo,
        status: p.status,
        requestedAt: p.requested_at,
        prazoEm: p.prazo_em,
        notes: p.notes,
        unicoAdmin: p.unico_admin,
      })),
    [query.data]
  );

  const decidir = useMutation({
    mutationFn: async (body: { request_id: string; acao: "aprovar" | "recusar"; motivo?: string }) => {
      const { error } = await supabase.functions.invoke("excluir-dados-titular", { body });
      if (error) throw new Error(await mensagemDaFunction(error, "Não foi possível concluir. Tente de novo."));
    },
    onSuccess: (_, body) => {
      toast.success(
        body.acao === "aprovar" ? "Dados excluídos e titular avisado" : "Pedido recusado e titular avisado"
      );
      setAprovarAlvo(null);
      setRecusarAlvo(null);
      setMotivoRecusa("");
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["ultra-admin-pedidos-lgpd"] }),
  });

  const columns: ColumnDef<PedidoRow>[] = [
    {
      key: "titularNome",
      header: "Titular",
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-ink">{r.titularNome}</p>
          <p className="truncate text-xs text-ink-muted">{r.titularEmail}</p>
        </div>
      ),
    },
    { key: "empresaNome", header: "Empresa", getSortValue: (r) => r.empresaNome, cell: (r) => r.empresaNome },
    {
      key: "requestedAt",
      header: "Pedido em",
      getSortValue: (r) => r.requestedAt,
      cell: (r) => <span className="text-ink-muted">{formatDateTime(r.requestedAt)}</span>,
    },
    {
      key: "prazoEm",
      header: "Prazo",
      cell: (r) => {
        if (!ABERTO.has(r.status)) return <span className="text-ink-muted">-</span>;
        const dias = diasAtePrazo(r.prazoEm);
        if (dias < 0) return <span className="font-medium text-danger-strong">{`Atrasado ${-dias} d`}</span>;
        return <span className={dias <= 3 ? "font-medium text-warning-strong" : "text-ink"}>{`${dias} d`}</span>;
      },
    },
    {
      key: "status",
      header: "Situação",
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge domain="pedido_lgpd" status={r.status} />
          {r.notes && (
            <span title={r.notes} className="text-xs text-ink-muted">
              ver nota
            </span>
          )}
        </div>
      ),
    },
    {
      key: "acoes",
      header: "",
      align: "end",
      cell: (r) =>
        ABERTO.has(r.status) ? (
          <div className="flex items-center justify-end gap-2">
            {r.unicoAdmin && (
              <span title="Único admin ativo da empresa: precisa passar o papel antes da exclusão">
                <AlertTriangle className="h-3.5 w-3.5 text-warning-mid" />
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => setRecusarAlvo(r)}>
              Recusar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={r.unicoAdmin}
              title={r.unicoAdmin ? "Único admin ativo da empresa: recuse explicando o motivo" : undefined}
              onClick={() => setAprovarAlvo(r)}
            >
              Excluir dados
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <PilarPage title="Pedidos LGPD">
      <div>
        <p className="text-sm text-ink-muted">
          Prazo legal de 15 dias a partir do pedido. Excluir apaga o dado pessoal e encerra o acesso; registros da
          empresa e prova de aceite ficam.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={toDataSourceResult<PedidoRow>({ data: rows, isLoading: query.isLoading, error: query.error })}
        rowKey={(r) => r.id}
        emptyMessage="Nenhum pedido de exclusão até agora."
        errorTitle="Não foi possível carregar os pedidos"
      />

      <FormDialog
        open={!!aprovarAlvo}
        onOpenChange={(o) => !o && setAprovarAlvo(null)}
        title={`Excluir dados de ${aprovarAlvo?.titularNome ?? ""}`}
        description="Apaga nome, e-mail, telefone, foto, conversas com a IA, notificações e preferências, e bloqueia o login. Não dá para desfazer."
        size="sm"
        submitLabel="Excluir dados"
        submitVariant="destructive"
        isPending={decidir.isPending}
        onSubmit={() => aprovarAlvo && decidir.mutate({ request_id: aprovarAlvo.id, acao: "aprovar" })}
      >
        <div className="space-y-2 text-sm text-ink-muted">
          {aprovarAlvo?.motivo && <p>{`Motivo do titular: ${aprovarAlvo.motivo}`}</p>}
          <p>O titular recebe a confirmação no e-mail atual antes da troca.</p>
        </div>
      </FormDialog>

      <FormDialog
        open={!!recusarAlvo}
        onOpenChange={(o) => {
          if (o) return;
          setRecusarAlvo(null);
          setMotivoRecusa("");
        }}
        title={`Recusar pedido de ${recusarAlvo?.titularNome ?? ""}`}
        description="O titular recebe o motivo por e-mail e pode pedir de novo depois de resolver."
        size="sm"
        submitLabel="Recusar e avisar"
        isPending={decidir.isPending}
        submitDisabled={!motivoRecusa.trim()}
        onSubmit={() =>
          recusarAlvo && decidir.mutate({ request_id: recusarAlvo.id, acao: "recusar", motivo: motivoRecusa.trim() })
        }
      >
        <div className="space-y-2">
          <Label htmlFor="recusa-motivo">Motivo</Label>
          <Textarea
            id="recusa-motivo"
            value={motivoRecusa}
            onChange={(e) => setMotivoRecusa(e.target.value)}
            placeholder="Ex.: é o único admin da empresa; passe o papel a outra pessoa e peça de novo"
            rows={3}
            autoFocus
          />
        </div>
      </FormDialog>
    </PilarPage>
  );
}
