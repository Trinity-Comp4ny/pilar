const OPCOES = [
  { value: "projeto", label: "Projeto" },
  { value: "obra", label: "Obra / serviço" },
] as const;

interface TipoPropostaFieldProps {
  value: "projeto" | "obra";
  onChange: (tipo: "projeto" | "obra") => void;
}

/** Projeto (disciplinas, horas) ou obra/serviço (itens de escopo, sem horas). */
export function TipoPropostaField({ value, onChange }: TipoPropostaFieldProps) {
  return (
    <fieldset className="flex flex-wrap items-center gap-4">
      <legend className="sr-only">Tipo da proposta</legend>
      <span className="text-sm font-medium">Tipo:</span>
      {OPCOES.map((op) => (
        <label key={op.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="radio"
            name="proposta-tipo"
            className="accent-primary"
            checked={value === op.value}
            onChange={() => onChange(op.value)}
          />
          {op.label}
        </label>
      ))}
    </fieldset>
  );
}
