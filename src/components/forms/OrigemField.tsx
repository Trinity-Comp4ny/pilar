import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORIGENS, ORIGENS_CONHECIDAS, ORIGEM_OUTRO } from "@/constants";

/**
 * Select padronizado de origem — mesma lista pra lead e cliente (BUG-3: a
 * padronização do lead não valia pro cliente, que era texto livre). "Outro"
 * libera um campo de texto livre; o valor gravado é sempre o texto final (uma
 * das opções conhecidas ou o texto digitado), nunca o literal "Outro".
 */
export function OrigemField({
  id,
  label = "Origem",
  value,
  onChange,
  disabled,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [choice, setChoice] = useState("");
  const [custom, setCustom] = useState("");

  useEffect(() => {
    const val = value ?? "";
    if (!val) {
      setChoice("");
      setCustom("");
    } else if ((ORIGENS_CONHECIDAS as readonly string[]).includes(val)) {
      setChoice(val);
      setCustom("");
    } else {
      setChoice(ORIGEM_OUTRO);
      setCustom(val);
    }
  }, [value]);

  const handleSelect = (v: string) => {
    setChoice(v);
    onChange(v === ORIGEM_OUTRO ? custom : v);
  };

  const handleCustom = (v: string) => {
    setCustom(v);
    onChange(v);
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Select value={choice} onValueChange={handleSelect} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {ORIGENS.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {choice === ORIGEM_OUTRO && (
        <Input
          aria-label="Origem (outro)"
          value={custom}
          onChange={(e) => handleCustom(e.target.value)}
          placeholder="Qual origem?"
          disabled={disabled}
          className="mt-1.5"
        />
      )}
    </div>
  );
}
