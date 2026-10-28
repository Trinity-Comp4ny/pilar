import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ViewSwitcher, type ViewOption } from "@/components/ViewSwitcher";

/** "Meus projetos" ligado ou não, guardado na URL (`?meus=1`) para o link e o F5 manterem a visão. */
export function useFiltroMeusProjetos(): [boolean, (ligado: boolean) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const setMeus = useCallback(
    (ligado: boolean) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (ligado) next.set("meus", "1");
          else next.delete("meus");
          return next;
        },
        { replace: true }
      ),
    [setSearchParams]
  );
  return [searchParams.get("meus") === "1", setMeus];
}

const OPCOES: ViewOption<"todos" | "meus">[] = [
  { value: "todos", label: "Todos os projetos" },
  { value: "meus", label: "Meus projetos" },
];

interface CronogramaMeusToggleProps {
  value: boolean;
  onChange: (meus: boolean) => void;
}

/** Segmento "Todos os projetos | Meus projetos" do cronograma (SPEC 143). O estado vive na URL (`?meus=1`). */
export function CronogramaMeusToggle({ value, onChange }: CronogramaMeusToggleProps) {
  return (
    <ViewSwitcher
      options={OPCOES}
      value={value ? "meus" : "todos"}
      onChange={(v) => onChange(v === "meus")}
      ariaLabel="Quais projetos mostrar"
    />
  );
}
