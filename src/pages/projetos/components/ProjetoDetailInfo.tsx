import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { NumberInput } from "@/components/forms/NumberInput";
import { formatValorToInput, parseCurrencyString } from "@/lib/currencyUtils";
import type { Projeto } from "@/types/projetos";
import { formatDate } from "@/types/projetos";
import { useMoneyMask } from "@/hooks/useMoneyMask";

interface ProjetoDetailInfoProps {
  projeto: Projeto;
  veFinanceiro?: boolean;
  canEdit?: boolean;
  onUpdatePrazo?: (data_previsao: string) => void;
  onUpdateContrato?: (valor_contrato: number) => void;
  onUpdateArea?: (area_m2: number) => void;
}

export function ProjetoDetailInfo({
  projeto,
  veFinanceiro = false,
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Detalhes do projeto</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y text-sm">
          <Detalhe label="Cliente">{projeto.cliente_nome || "—"}</Detalhe>
          <Detalhe label="Localização">{projeto.localizacao || "—"}</Detalhe>
          <Detalhe label="Área">
            {canEdit && onUpdateArea ? (
              <NumberInput
                aria-label="Área"
                allowDecimal
                suffix="m²"
                value={areaInput}
                onChange={setAreaInput}
                onBlur={commitArea}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
            ) : (
              `${projeto.area_m2 || 0} m²`
            )}
          </Detalhe>
          <Detalhe label="Início">{formatDate(projeto.data_inicio) || "—"}</Detalhe>
          <Detalhe label="Prazo contratual">
            {canEdit && onUpdatePrazo ? (
              <DatePicker
                value={projeto.data_previsao || undefined}
                onChange={onUpdatePrazo}
                minDate={projeto.data_inicio || undefined}
                placeholder="—"
              />
            ) : (
              formatDate(projeto.data_previsao) || "—"
            )}
          </Detalhe>
          {veFinanceiro && (
            <Detalhe label="Contrato">
              {canEdit && onUpdateContrato ? (
                <MoneyInput
                  aria-label="Contrato"
                  value={valorInput}
                  onChange={setValorInput}
                  onBlur={commitValor}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
              ) : (
                formatCurrency(projeto.valor_contrato)
              )}
            </Detalhe>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function Detalhe({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] items-center gap-2 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
