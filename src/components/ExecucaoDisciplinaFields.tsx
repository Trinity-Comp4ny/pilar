import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useId } from "react";

export function ExecucaoDisciplinaFields({
  tipo,
  prestador,
  onChange,
}: {
  tipo?: string;
  prestador?: string | null;
  onChange: (tipo: "interna" | "terceirizada", prestador: string) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label htmlFor={`${id}-tipo`}>Execução</Label>
        <Select
          value={tipo ?? "interna"}
          onValueChange={(v: "interna" | "terceirizada") => onChange(v, prestador ?? "")}
        >
          <SelectTrigger id={`${id}-tipo`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="interna">Equipe interna</SelectItem>
            <SelectItem value="terceirizada">Serviço terceirizado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {tipo === "terceirizada" && (
        <div className="space-y-1">
          <Label htmlFor={`${id}-prestador`}>Prestador ou empresa</Label>
          <Input
            id={`${id}-prestador`}
            value={prestador ?? ""}
            maxLength={200}
            placeholder="Quem executa este serviço?"
            onChange={(e) => onChange("terceirizada", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Não exige conta na Pilar. Um responsável interno pode acompanhar o serviço.
          </p>
        </div>
      )}
    </div>
  );
}
