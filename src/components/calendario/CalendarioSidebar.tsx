import { type ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { type CamadaId, type CamadasVisiveis, CAMADA_REGISTRY } from "./eventos";
import { MiniMes } from "./MiniMes";

interface CalendarioSidebarProps {
  selecionado: Date;
  diasComEvento: Set<string>;
  onSelectDate: (d: Date) => void;
  /** Camadas oferecidas nesta tela (ordem = ordem de exibição). */
  camadas: CamadaId[];
  visiveis: CamadasVisiveis;
  onToggleCamada: (id: CamadaId, valor: boolean) => void;
  /** Filtros extras da tela (ex.: projeto, responsável), renderizados abaixo. */
  children?: ReactNode;
}

function CamadaToggle({ id, checked, onChange }: { id: CamadaId; checked: boolean; onChange: (v: boolean) => void }) {
  const camada = CAMADA_REGISTRY[id];
  return (
    <label htmlFor={`cal-${id}`} className="flex items-center gap-2 py-1 cursor-pointer group">
      <Checkbox
        id={`cal-${id}`}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className={cn(camada.toggleClass)}
      />
      <span className="text-sm text-ink group-hover:text-ink/70">{camada.label}</span>
    </label>
  );
}

export function CalendarioSidebar({
  selecionado,
  diasComEvento,
  onSelectDate,
  camadas,
  visiveis,
  onToggleCamada,
  children,
}: CalendarioSidebarProps) {
  return (
    <aside className="hidden md:block w-64 shrink-0 border-r bg-white overflow-y-auto p-4 space-y-6">
      <MiniMes selecionado={selecionado} diasComEvento={diasComEvento} onSelectDate={onSelectDate} />

      <div>
        <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
          Meus calendários
        </h3>
        {camadas.map((id) => (
          <CamadaToggle key={id} id={id} checked={visiveis[id] !== false} onChange={(v) => onToggleCamada(id, v)} />
        ))}
      </div>

      {children && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Filtros</h3>
          {children}
        </div>
      )}
    </aside>
  );
}
