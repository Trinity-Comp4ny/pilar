import { Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { BusyMark } from "@/components/motion/BusyMark";
import type { EstadoResumo, ResumoSemanal, Tom } from "@/pages/inicio/hooks/useResumoSemanal";
import { saudacao } from "./saudacao";
import { ROTULO_TEMA, TEMAS, VISUAL_TEMA, type TemaInicio, type VisualTema } from "./temas";

/**
 * Cabeçalho do Início (SPEC 121): uma saudação, uma frase com o que importa na semana e até
 * três destaques curtos. Nada além disso: sem data, sem lista de ações, sem rodapé.
 *
 * É apresentação pura: os dados do resumo e as preferências chegam por props, então a peça
 * se testa sem rede. A cor vem do tema (`temas.ts`).
 */

export type ResumoView = {
  estado: EstadoResumo;
  resumo: ResumoSemanal | null;
  erro: string | null;
  onTentarDeNovo: () => void;
};

type Props = {
  nome: string | null;
  tema: TemaInicio;
  mostrarResumo: boolean;
  editando: boolean;
  /** Botões do modo Personalizar (Restaurar, Cancelar, Salvar). Só aparecem ao editar. */
  acoes: React.ReactNode;
  resumo: ResumoView;
  onTema: (tema: TemaInicio) => void;
  onMostrarResumo: (mostrar: boolean) => void;
  /** Só para teste: fixa a hora da saudação. */
  agora?: Date;
};

/** O tom vai no ponto colorido e também em texto para leitor de tela. */
const PONTO_TOM: Record<Tom, { classe: string; rotulo: string }> = {
  positivo: { classe: "bg-chart-success", rotulo: "Positivo" },
  atencao: { classe: "bg-chart-warning", rotulo: "Atenção" },
  neutro: { classe: "bg-chart-neutral", rotulo: "Informação" },
};

/** Curvas de fundo: dão forma ao bloco sem competir com o texto. */
function Formas({ visual }: { visual: VisualTema }) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 800 200"
      preserveAspectRatio="none"
    >
      <circle cx="740" cy="20" r="110" className={visual.circulo} />
      <path d="M0,150 C140,100 250,200 410,145 C570,90 670,170 800,105 L800,200 L0,200 Z" className={visual.onda} />
    </svg>
  );
}

function ModoEdicao({
  tema,
  mostrarResumo,
  visual,
  acoes,
  onTema,
  onMostrarResumo,
}: Pick<Props, "tema" | "mostrarResumo" | "acoes" | "onTema" | "onMostrarResumo"> & { visual: VisualTema }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border px-4 py-2.5",
        visual.chip
      )}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div role="radiogroup" aria-label="Cor do cabeçalho" className="flex items-center gap-2">
          <span className="mr-1 text-xs font-medium">Cor</span>
          {TEMAS.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tema === t}
              aria-label={ROTULO_TEMA[t]}
              title={ROTULO_TEMA[t]}
              onClick={() => onTema(t)}
              className={cn(
                "h-6 w-6 rounded-full border-2 transition-shadow focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                VISUAL_TEMA[t].amostra,
                tema === t ? "ring-2 ring-ring ring-offset-2" : "opacity-80 hover:opacity-100"
              )}
            />
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs font-medium">
          <Switch checked={mostrarResumo} onCheckedChange={onMostrarResumo} aria-label="Mostrar resumo da semana" />
          Resumo da semana
        </label>
      </div>
      {/* text-ink: os botões são claros em qualquer tema e herdariam o texto branco do grafite. */}
      <div className="flex flex-wrap items-center gap-2 text-ink">{acoes}</div>
    </div>
  );
}

function BlocoResumo({ view, visual }: { view: ResumoView; visual: VisualTema }) {
  const { estado, resumo } = view;

  if (estado === "carregando") {
    return (
      <div aria-busy="true">
        <Skeleton className="h-6 w-3/4 max-w-xl rounded-full bg-black/10" />
      </div>
    );
  }

  if (estado === "gerando") {
    return (
      <p role="status" className="flex items-center gap-2.5 text-sm">
        <BusyMark className="h-4 w-4" />
        Preparando o resumo da semana
      </p>
    );
  }

  if (estado === "erro" || !resumo) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <p>{view.erro ?? "Não foi possível carregar o resumo da semana."}</p>
        <Button variant="outline" size="sm" className="rounded-full text-ink" onClick={view.onTentarDeNovo}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  const { conteudo } = resumo;

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-3xl text-lg font-medium leading-snug tracking-tight md:text-xl">{conteudo.manchete}</p>

      {conteudo.destaques.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {conteudo.destaques.map((d, i) => (
            <li
              key={`${i}-${d.texto}`}
              className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-xs", visual.chip)}
            >
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PONTO_TOM[d.tom].classe)} aria-hidden="true" />
              <span className="sr-only">{PONTO_TOM[d.tom].rotulo}: </span>
              {d.texto}
            </li>
          ))}
        </ul>
      )}

      {resumo.origem === "automatico" && resumo.motivo && (
        <p className={cn("text-xs", visual.suave)}>{resumo.motivo}</p>
      )}
    </div>
  );
}

export function HeroInicio({
  nome,
  tema,
  mostrarResumo,
  editando,
  acoes,
  resumo,
  onTema,
  onMostrarResumo,
  agora,
}: Props) {
  const visual = VISUAL_TEMA[tema];
  const hoje = agora ?? new Date();
  const origem = resumo.resumo?.origem;

  return (
    <section
      aria-label="Resumo da semana"
      className={cn("relative overflow-hidden rounded-3xl border px-5 py-4 shadow-card md:px-6 md:py-5", visual.raiz)}
    >
      <Formas visual={visual} />

      <div className="relative flex flex-col gap-3">
        <h2 className={cn("flex items-center gap-2 text-sm font-medium", visual.suave)}>
          {saudacao(hoje)}
          {nome ? `, ${nome}` : ""}
          {mostrarResumo && origem && (
            <span
              className="inline-flex"
              title={origem === "ia" ? "Resumo da semana escrito por IA" : "Resumo automático da semana"}
            >
              {origem === "ia" ? <Sparkles size={13} aria-hidden="true" /> : <Info size={13} aria-hidden="true" />}
              <span className="sr-only">{origem === "ia" ? "Resumo escrito por IA" : "Resumo automático"}</span>
            </span>
          )}
        </h2>

        {editando && (
          <ModoEdicao
            tema={tema}
            mostrarResumo={mostrarResumo}
            visual={visual}
            acoes={acoes}
            onTema={onTema}
            onMostrarResumo={onMostrarResumo}
          />
        )}

        {mostrarResumo && <BlocoResumo view={resumo} visual={visual} />}
      </div>
    </section>
  );
}
