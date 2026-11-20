// Filtros de prioridade, etiqueta e prazo da toolbar de Tarefas (estado, regra e controles).
import { useCallback, useMemo, useState } from "react";
import { startOfDay } from "date-fns";
import { CalendarClock } from "lucide-react";
import { FilterSelect } from "@/components/filters/FilterBar";
import { FiltroPeriodo } from "@/components/filters/FiltroPeriodo";
import { MultiSelectFilter } from "@/components/filters/MultiSelectFilter";
import type { PeriodoPreset } from "@/lib/periodo";
import { PRIORIDADE_LABEL, PRIORIDADE_ORDER } from "@/lib/tarefas/status";
import type { ItemTrabalho } from "./useItensTrabalho";

type SituacaoPrazo = "todas" | "atrasadas" | "hoje" | "sem_prazo";

const PRESETS_PRAZO: PeriodoPreset[] = [
  "proximos-7",
  "proximos-30",
  "ultimos-7",
  "mes-atual",
  "mes-anterior",
  "este-trimestre",
  "este-ano",
  "tudo",
  "custom",
];

const SITUACAO_LABEL: Record<SituacaoPrazo, string> = {
  todas: "Tudo",
  atrasadas: "Atrasadas",
  hoje: "Vencem hoje",
  sem_prazo: "Sem prazo",
};

function naSituacao(prazo: string | null, filtro: SituacaoPrazo): boolean {
  if (filtro === "todas") return true;
  if (filtro === "sem_prazo") return !prazo;
  if (!prazo) return false;
  const d = new Date(`${prazo}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (filtro === "atrasadas") return d < hoje;
  if (filtro === "hoje") return d.getTime() === hoje.getTime();
  return true;
}

/** Prazo dentro do intervalo escolhido no filtro de período (pontas inclusas, por dia). */
function dentroDoIntervalo(prazo: string | null, de: Date | undefined, ate: Date | undefined): boolean {
  if (!de && !ate) return true;
  if (!prazo) return false;
  const d = new Date(`${prazo}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  if (de && d < startOfDay(de)) return false;
  if (ate && d > startOfDay(ate)) return false;
  return true;
}

export function useFiltrosItens(itens: ItemTrabalho[]) {
  const [situacao, setSituacao] = useState<SituacaoPrazo>("todas");
  const [de, setDe] = useState<Date | undefined>();
  const [ate, setAte] = useState<Date | undefined>();
  const [prioridades, setPrioridades] = useState<string[]>([]);
  const [etiquetas, setEtiquetas] = useState<string[]>([]);

  const opcoesEtiqueta = useMemo(
    () =>
      [...new Set(itens.flatMap((i) => i.labels))]
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((l) => ({ value: l, label: l })),
    [itens]
  );

  const passa = useCallback(
    (i: ItemTrabalho) =>
      naSituacao(i.prazo, situacao) &&
      dentroDoIntervalo(i.prazo, de, ate) &&
      (prioridades.length === 0 || prioridades.includes(i.prioridade)) &&
      (etiquetas.length === 0 || i.labels.some((l) => etiquetas.includes(l))),
    [situacao, de, ate, prioridades, etiquetas]
  );

  const ativos =
    (situacao !== "todas" ? 1 : 0) +
    (de || ate ? 1 : 0) +
    (prioridades.length > 0 ? 1 : 0) +
    (etiquetas.length > 0 ? 1 : 0);

  const limpar = () => {
    setSituacao("todas");
    setDe(undefined);
    setAte(undefined);
    setPrioridades([]);
    setEtiquetas([]);
  };

  const controles = (
    <>
      <MultiSelectFilter
        label="Prioridade"
        options={PRIORIDADE_ORDER.map((p) => ({ value: p, label: PRIORIDADE_LABEL[p] }))}
        selected={prioridades}
        onChange={setPrioridades}
        placeholder="Buscar prioridade…"
      />
      {opcoesEtiqueta.length > 0 && (
        <MultiSelectFilter
          label="Etiqueta"
          options={opcoesEtiqueta}
          selected={etiquetas}
          onChange={setEtiquetas}
          placeholder="Buscar etiqueta…"
        />
      )}
      <FiltroPeriodo
        from={de}
        to={ate}
        onChange={(f, t) => {
          setDe(f);
          setAte(t);
        }}
        align="start"
        active={!!de || !!ate}
        presets={PRESETS_PRAZO}
      />
      <FilterSelect
        label="Situação"
        icon={CalendarClock}
        value={situacao}
        emptyValue="todas"
        onChange={(v) => setSituacao(v as SituacaoPrazo)}
        options={(Object.keys(SITUACAO_LABEL) as SituacaoPrazo[]).map((d) => ({ value: d, label: SITUACAO_LABEL[d] }))}
      />
    </>
  );

  return { passa, ativos, limpar, controles };
}
