import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLACA_LABEL, PLACA_STATUS, placaStatusDe, type PlacaStatus } from "@/lib/placa";

interface Props {
  id?: string;
  value: string | null | undefined;
  onChange: (status: PlacaStatus) => void;
  disabled?: boolean;
}

/** Seletor da situação da placa (não instalada, instalada, retirada). */
export function PlacaSelect({ id, value, onChange, disabled }: Props) {
  return (
    <Select value={placaStatusDe(value)} onValueChange={(v) => onChange(placaStatusDe(v))} disabled={disabled}>
      <SelectTrigger id={id} aria-label="Placa">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PLACA_STATUS.map((s) => (
          <SelectItem key={s} value={s}>
            {PLACA_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
