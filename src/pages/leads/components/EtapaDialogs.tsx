import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EditColumnDialog, type ColunaEditavel } from "@/components/kanban/EditColumnDialog";
import type { LeadEtapa } from "@/pages/leads/hooks/useLeadEtapas";
import { CORES_ETAPA_LEAD } from "@/pages/leads/lib/etapas";

type Props = {
  editando: ColunaEditavel | null;
  onFecharEdicao: () => void;
  onSalvar: (coluna: ColunaEditavel) => Promise<boolean>;
  salvando: boolean;
  aExcluir: LeadEtapa | null;
  onFecharExclusao: () => void;
  onExcluir: () => void;
  excluindo: boolean;
};

/** Diálogos de editar (nome + cor) e de confirmar a exclusão de uma coluna do funil. */
export function EtapaDialogs({
  editando,
  onFecharEdicao,
  onSalvar,
  salvando,
  aExcluir,
  onFecharExclusao,
  onExcluir,
  excluindo,
}: Props) {
  return (
    <>
      <EditColumnDialog
        coluna={editando}
        onClose={onFecharEdicao}
        colors={CORES_ETAPA_LEAD}
        onSave={onSalvar}
        isPending={salvando}
        placeholder="Visita técnica, Reunião..."
      />
      <ConfirmDialog
        open={!!aExcluir}
        onOpenChange={(open) => !open && onFecharExclusao()}
        onConfirm={onExcluir}
        title="Excluir coluna"
        description="A coluna está vazia. Não dá para desfazer."
        itemName={aExcluir?.nome}
        confirmText="Excluir coluna"
        loading={excluindo}
      />
    </>
  );
}
