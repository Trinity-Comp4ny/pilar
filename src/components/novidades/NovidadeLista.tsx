import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import type { NovidadeItem } from "@/lib/novidades";

/** Itens de uma release (SPEC 152), na página Novidades e no modal "O que mudou". */
export function NovidadeLista({ itens }: { itens: NovidadeItem[] }) {
  return (
    <ul className="space-y-3">
      {itens.map((i) => (
        <li key={i.id} className="flex items-start gap-3">
          <StatusBadge domain="novidade" status={i.impacto} className="mt-0.5 shrink-0" />
          <div className="min-w-0 space-y-1">
            <p className="text-sm leading-relaxed text-ink">{i.texto}</p>
            {i.voce_pediu && <Badge variant="success">Você pediu</Badge>}
          </div>
        </li>
      ))}
    </ul>
  );
}
