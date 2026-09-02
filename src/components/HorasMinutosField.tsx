// Campo de horas único, estilo ClickUp: digita a hora em decimal (1 = 1h,
// 0.5 = 30min) e uma dica ao lado mostra a leitura ("1h", "30min"...) — sem
// unidade fixa colada no campo, o valor já fala por si.
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatHoras } from "@/lib/format";

function paraTexto(dec: number | null): string {
  return dec == null ? "" : String(dec);
}

function paraDecimal(raw: string): number | null {
  const normalizado = raw.trim().replace(",", ".");
  if (!normalizado) return null;
  const dec = Number(normalizado);
  return Number.isFinite(dec) && dec >= 0 ? dec : null;
}

type Props = {
  value: number | null;
  onChange: (dec: number | null) => void;
  disabled?: boolean;
};

export function HorasMinutosField({ value, onChange, disabled }: Props) {
  const [texto, setTexto] = useState(paraTexto(value));
  const preview = formatHoras(paraDecimal(texto));

  const commit = (raw: string) => {
    setTexto(raw);
    const normalizado = raw.trim().replace(",", ".");
    if (!normalizado) {
      onChange(null);
      return;
    }
    const dec = Number(normalizado);
    if (Number.isFinite(dec) && dec >= 0) onChange(Math.round(dec * 1000) / 1000);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min="0"
        step="0.25"
        inputMode="decimal"
        value={texto}
        disabled={disabled}
        onChange={(e) => commit(e.target.value)}
        className="h-9 w-20"
        placeholder="0"
        aria-label="Horas"
      />
      {preview && <span className="text-xs text-muted-foreground">{preview}</span>}
    </div>
  );
}
