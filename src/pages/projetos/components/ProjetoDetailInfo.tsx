import { useState } from "react";
import { KPICard } from "@/components/KPICard";
import { Progress } from "@/components/ui/progress";
import { DatePicker } from "@/components/ui/date-picker";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { NumberInput } from "@/components/forms/NumberInput";
import { User, DollarSign, Calendar, Ruler } from "lucide-react";
import { formatValorToInput, parseCurrencyString } from "@/lib/currencyUtils";
import type { Projeto } from "@/types/projetos";
import { formatDate } from "@/types/projetos";
import { useMoneyMask } from "@/hooks/useMoneyMask";

interface ProjetoDetailInfoProps {
  projeto: Projeto;
  progress: number;
  margemBrutaPct: number | null;
  canEdit?: boolean;
  onUpdatePrazo?: (data_previsao: string) => void;
  onUpdateContrato?: (valor_contrato: number) => void;
  onUpdateArea?: (area_m2: number) => void;
}

export function ProjetoDetailInfo({
  projeto,
  progress,
  margemBrutaPct,
  canEdit = false,
  onUpdatePrazo,
  onUpdateContrato,
  onUpdateArea,
}: ProjetoDetailInfoProps) {
  const formatCurrency = useMoneyMask();
  const [valorInput, setValorInput] = useState(() => formatValorToInput(projeto.valor_contrato));
  const [areaInput, setAreaInput] = useState(() => String(projeto.area_m2 || ""));
  // Resincroniza os rascunhos quando o valor real muda por fora (save/refetch),
  // sem useEffect: ajustar estado durante o render é o padrão pra "resetar ao
  // mudar a prop" (evita o cascading render de fazer isso em efeito).
  const [syncedValor, setSyncedValor] = useState(projeto.valor_contrato);
  if (projeto.valor_contrato !== syncedValor) {
    setSyncedValor(projeto.valor_contrato);
    setValorInput(formatValorToInput(projeto.valor_contrato));
  }
  const [syncedArea, setSyncedArea] = useState(projeto.area_m2);
  if (projeto.area_m2 !== syncedArea) {
    setSyncedArea(projeto.area_m2);
    setAreaInput(String(projeto.area_m2 || ""));
  }

  const commitValor = () => {
    const parsed = parseCurrencyString(valorInput);
    if (parsed !== projeto.valor_contrato) onUpdateContrato?.(parsed);
  };

  const commitArea = () => {
    const parsed = parseFloat(areaInput.replace(",", ".")) || 0;
    if (parsed !== (projeto.area_m2 || 0)) onUpdateArea?.(parsed);
  };

  const margemTone =
    margemBrutaPct === null
      ? "neutral"
      : margemBrutaPct >= 20
        ? "positive"
        : margemBrutaPct >= 0
          ? "neutral"
          : "danger";

  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <KPICard label="Cliente" icon={User} value={projeto.cliente_nome || "—"} />

        <KPICard
          label="Contrato"
          icon={DollarSign}
          value={formatCurrency(projeto.valor_contrato)}
          valueSlot={
            canEdit && onUpdateContrato ? (
              <MoneyInput
                value={valorInput}
                onChange={setValorInput}
                onBlur={commitValor}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="h-6 text-sm font-medium border-0 bg-transparent hover:bg-muted px-1"
              />
            ) : undefined
          }
        />

        <KPICard
          label="Área"
          icon={Ruler}
          value={`${projeto.area_m2 || 0} m²`}
          valueSlot={
            canEdit && onUpdateArea ? (
              <NumberInput
                allowDecimal
                suffix="m²"
                value={areaInput}
                onChange={setAreaInput}
                onBlur={commitArea}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="h-6 w-20 text-sm font-medium border-0 bg-transparent hover:bg-muted px-1"
              />
            ) : undefined
          }
        />

        <KPICard
          label="Prazo"
          icon={Calendar}
          value={formatDate(projeto.data_previsao)}
          valueSlot={
            canEdit && onUpdatePrazo ? (
              <DatePicker
                value={projeto.data_previsao || undefined}
                onChange={onUpdatePrazo}
                minDate={projeto.data_inicio || undefined}
                placeholder="—"
                className="h-6 text-sm font-medium border-0 bg-transparent hover:bg-muted px-1 justify-start"
              />
            ) : undefined
          }
        />

        <KPICard
          label="Margem Bruta"
          value={margemBrutaPct !== null ? `${margemBrutaPct.toFixed(1)}%` : "—"}
          valueTone={margemTone}
        />
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Progresso das disciplinas</span>
          <span className="text-xs font-medium">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" indicatorClassName="bg-brand" />
      </div>
    </>
  );
}
