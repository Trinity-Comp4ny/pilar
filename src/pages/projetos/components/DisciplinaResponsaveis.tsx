import { SeletorResponsaveis } from "@/components/SeletorResponsaveis";
export function DisciplinaResponsaveis({
  value,
  pessoas,
  terceirizada,
  onChange,
  disabledPeople = false,
}: {
  value: string[];
  pessoas: { id: string; nome: string }[];
  terceirizada: boolean;
  onChange: (ids: string[], terceirizada: boolean) => void;
  disabledPeople?: boolean;
}) {
  return (
    <SeletorResponsaveis
      value={value}
      pessoas={pessoas}
      pessoasDesabilitadas={disabledPeople}
      onChange={(ids) => onChange(ids, false)}
      opcaoExtra={{
        label: "Serviço terceirizado",
        selecionada: terceirizada,
        onSelect: () => onChange([], !terceirizada),
      }}
    />
  );
}
