// Campo de horas em horas + minutos (mesmo formato do dropdown de horas da linha,
// CelulasLista/HorasCell), para uso inline no modal. Guarda/entrega decimal.
import { useState } from "react";
import { Input } from "@/components/ui/input";

function decParaHM(dec: number | null): { h: string; m: string } {
  if (dec == null) return { h: "", m: "" };
  const total = Math.round(dec * 60);
  return { h: String(Math.floor(total / 60)), m: String(total % 60) };
}

function hmParaDec(h: string, m: string): number | null {
  const horas = Number(h) || 0;
  const min = Number(m) || 0;
  const total = horas * 60 + min;
  return total > 0 ? Math.round((total / 60) * 1000) / 1000 : null;
}

type Props = {
  value: number | null;
  onChange: (dec: number | null) => void;
  disabled?: boolean;
};

export function HorasMinutosField({ value, onChange, disabled }: Props) {
  const inicial = decParaHM(value);
  const [h, setH] = useState(inicial.h);
  const [m, setM] = useState(inicial.m);

  const commit = (nh: string, nm: string) => onChange(hmParaDec(nh, nm));

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min="0"
        inputMode="numeric"
        value={h}
        disabled={disabled}
        onChange={(e) => {
          setH(e.target.value);
          commit(e.target.value, m);
        }}
        className="h-9 w-16"
        placeholder="0"
        aria-label="Horas"
      />
      <span className="text-sm text-muted-foreground">h</span>
      <Input
        type="number"
        min="0"
        max="59"
        inputMode="numeric"
        value={m}
        disabled={disabled}
        onChange={(e) => {
          setM(e.target.value);
          commit(h, e.target.value);
        }}
        className="h-9 w-16"
        placeholder="0"
        aria-label="Minutos"
      />
      <span className="text-sm text-muted-foreground">min</span>
    </div>
  );
}
