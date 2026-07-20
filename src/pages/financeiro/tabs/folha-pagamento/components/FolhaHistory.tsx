import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { HistoryItem } from "../types";
import { getMonthLabel } from "../types";

interface FolhaHistoryProps {
  history: HistoryItem[];
  selectedMonth: number;
  selectedYear: number;
  onOpenDetail: (item: HistoryItem) => void;
}

export function FolhaHistory({ history, selectedMonth, selectedYear, onOpenDetail }: FolhaHistoryProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <History className="h-5 w-5" />
        Histórico de Folhas
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {history.length === 0 ? (
          <p className="text-muted-foreground text-sm col-span-3">Nenhum histórico encontrado.</p>
        ) : (
          history.map((h) => (
            <Card
              key={`${h.mes}-${h.ano}`}
              className={`cursor-pointer transition-all hover:border-brand/50 hover:shadow-md ${
                selectedMonth === h.mes && selectedYear === h.ano ? "border-brand bg-brand/5" : ""
              }`}
              onClick={() => onOpenDetail(h)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-lg">
                    {getMonthLabel(h.mes)} {h.ano}
                  </div>
                  <div className="text-sm text-muted-foreground">{h.count} colaboradores</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-foreground">{formatCurrency(h.total)}</div>
                  <Badge
                    variant="secondary"
                    className={`mt-1 capitalize text-[10px] h-5 px-2
                      ${h.status === "pago" ? "bg-positive/100 text-white" : ""}
                      ${h.status === "pendente" ? "bg-yellow-400 text-black" : ""}
                      ${h.status === "cancelado" ? "bg-red-500 text-white" : ""}
                      ${h.status === "misto" ? "bg-orange-400 text-white" : ""}
                    `}
                  >
                    {h.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
