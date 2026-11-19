import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_OPTIONS, PROJECT_PRIORITY_CONFIG } from "@/constants";
import { cn } from "@/lib/utils";
import { getPriorityDotColor } from "../lib/priorityColors";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

/** Seletor de prioridade do projeto, com a bolinha de cor de cada nível. */
export function PrioridadeSelect({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label>Prioridade</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_OPTIONS.map((p) => (
            <SelectItem key={p} value={p}>
              <span className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", getPriorityDotColor(p))} />
                {PROJECT_PRIORITY_CONFIG[p].label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
