import { AddColumnInline } from "@/components/kanban/AddColumnInline";
import { KANBAN_ADD_COLUMN_CLASSES } from "@/components/kanban/kanbanLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { statusLabel } from "@/lib/status";
import type { LeadBucket } from "@/pages/leads/hooks/useLeadEtapas";
import { CORES_ETAPA_LEAD, LEAD_BUCKETS } from "@/pages/leads/lib/etapas";

type Props = {
  busy: boolean;
  onCreate: (nome: string, cor: string, bucket: LeadBucket) => Promise<boolean>;
};

/** "Nova coluna" no fim do quadro: nome, cor e "Conta como" (o status que a coluna representa). */
export function NovaEtapaInline({ busy, onCreate }: Props) {
  return (
    <AddColumnInline<LeadBucket>
      colors={CORES_ETAPA_LEAD}
      initialColor={CORES_ETAPA_LEAD[1]}
      extraInitial="Em contato"
      busy={busy}
      onCreate={onCreate}
      triggerClassName={KANBAN_ADD_COLUMN_CLASSES.trigger}
      panelClassName={KANBAN_ADD_COLUMN_CLASSES.panel}
      placeholder="Visita técnica, Reunião..."
      renderExtra={(bucket, setBucket) => (
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground">Conta como</span>
          <Select value={bucket} onValueChange={(v) => setBucket(v as LeadBucket)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_BUCKETS.map((b) => (
                <SelectItem key={b} value={b} className="text-xs">
                  {statusLabel("lead", b)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    />
  );
}
