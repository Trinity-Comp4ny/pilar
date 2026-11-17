import { SelectItem } from "@/components/ui/select";
import { ESTADOS_BR } from "../lib/estadosBr";

export function EstadoSelectItems() {
  return ESTADOS_BR.map((uf) => (
    <SelectItem key={uf} value={uf}>
      {uf}
    </SelectItem>
  ));
}
