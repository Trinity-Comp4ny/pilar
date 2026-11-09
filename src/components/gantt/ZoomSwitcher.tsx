import { ZoomIn, ZoomOut } from "lucide-react";
import { ViewSwitcher, type ViewOption } from "@/components/ViewSwitcher";

type Zoom = "months" | "weeks";

const OPCOES: ViewOption<Zoom>[] = [
  { value: "months", label: "Meses", icon: ZoomOut },
  { value: "weeks", label: "Semanas", icon: ZoomIn },
];

/** Escala de tempo dos cronogramas (Meses/Semanas). Um só controle para os três Gantts (SPEC 127). */
export function ZoomSwitcher({ value, onChange }: { value: Zoom; onChange: (zoom: Zoom) => void }) {
  return (
    <ViewSwitcher
      options={OPCOES}
      value={value}
      onChange={onChange}
      iconOnlyOnMobile
      ariaLabel="Escala do cronograma"
    />
  );
}
