import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { formatDate } from "@/lib/dateUtils";
import { diasDePausa, empurrarData, mensagemDaPausa } from "@/pages/projetos/lib/pausa";
import { useProjetoPausas } from "../hooks/useProjetoPausas";

interface RetomarProjetoDialogProps {
  projetoId: string | undefined;
  dataPrevisao?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Coluna de destino quando a retomada vem de um arraste no Kanban. */
  etapaDestinoId?: string;
}

function LinhaPrazo({ nome, de, para }: { nome: string; de: string | null; para: string | null }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 py-1.5 text-sm">
      <span className="truncate">{nome}</span>
      <span className="text-muted-foreground">{formatDate(de)}</span>
      <span aria-hidden="true" className="text-muted-foreground">
        →
      </span>
      <span className="font-medium">{formatDate(para)}</span>
    </div>
  );
}

/** Retomar mostra o antes e o depois de cada prazo antes de confirmar (spec 141). */
export function RetomarProjetoDialog({
  projetoId,
  dataPrevisao,
  open,
  onOpenChange,
  etapaDestinoId,
}: RetomarProjetoDialogProps) {
  const { aberta, afetadas, retomar } = useProjetoPausas(open ? projetoId : undefined);
  const dias = aberta ? diasDePausa(aberta.pausado_em) : 0;
  const unidade = dias === 1 ? "dia" : "dias";

  const descricao = !aberta
    ? "Carregando a pausa do projeto."
    : dias === 0
      ? "Pausado hoje. Os prazos não mudam."
      : `Pausado há ${dias} ${unidade} (${new Date(aberta.pausado_em).toLocaleDateString("pt-BR")} a hoje). Os prazos avançam ${dias} ${unidade}.`;

  const confirmar = () =>
    retomar.mutate(etapaDestinoId, {
      onSuccess: () => {
        toast.success(dias === 0 ? "Projeto retomado." : `Projeto retomado. Os prazos avançaram ${dias} ${unidade}.`);
        onOpenChange(false);
      },
      onError: (e) =>
        toast.error(mensagemDaPausa(e, "Não foi possível retomar o projeto. Nada foi alterado. Tente de novo.")),
    });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Retomar projeto"
      description={descricao}
      size="md"
      onSubmit={confirmar}
      submitLabel="Retomar projeto"
      isPending={retomar.isPending}
      submitDisabled={!aberta}
    >
      <div className="space-y-3">
        {dias > 0 && (
          <div className="divide-y divide-border rounded-md border border-border px-3">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 py-1.5 text-xs text-muted-foreground">
              <span>Disciplina</span>
              <span>Prazo atual</span>
              <span aria-hidden="true" />
              <span>Novo prazo</span>
            </div>
            {(afetadas.data ?? []).map((d) => (
              <LinhaPrazo key={d.id} nome={d.nome} de={d.data_fim} para={empurrarData(d.data_fim, dias)} />
            ))}
            {dataPrevisao && (
              <LinhaPrazo nome="Previsão do projeto" de={dataPrevisao} para={empurrarData(dataPrevisao, dias)} />
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">As disciplinas voltam ao status que tinham antes da pausa.</p>
      </div>
    </FormDialog>
  );
}
