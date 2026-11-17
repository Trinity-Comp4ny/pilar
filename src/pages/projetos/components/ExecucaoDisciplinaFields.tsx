import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DisciplinaResponsavel } from "@/types/projetos";

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

export function DisciplinaExecucaoEditor({
  disciplina,
  onSave,
}: {
  disciplina: DisciplinaResponsavel;
  onSave: (tipo: "interna" | "terceirizada", prestador: string) => void | Promise<void>;
}) {
  const [execucao, setExecucao] = useState({
    tipo: disciplina.tipo_execucao ?? "interna",
    prestador: disciplina.prestador_nome ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  return (
    <div className="space-y-2">
      <ExecucaoDisciplinaFields
        tipo={execucao.tipo}
        prestador={execucao.prestador}
        onChange={(tipo, prestador) => setExecucao({ tipo, prestador })}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={salvando || (execucao.tipo === "terceirizada" && !execucao.prestador.trim())}
        onClick={async () => {
          setSalvando(true);
          try {
            await onSave(execucao.tipo, execucao.prestador.trim());
          } finally {
            setSalvando(false);
          }
        }}
      >
        Salvar execução
      </Button>
    </div>
  );
}
