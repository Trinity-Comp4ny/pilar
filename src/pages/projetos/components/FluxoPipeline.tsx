import { useMemo, useState } from "react";
import type { DisciplinaResponsavel } from "@/types/projetos";
import { formatDate, formatDateShort } from "@/lib/format";
import { formatDateLocal } from "@/lib/businessDays";
import { diasUteisEntre, projetarFluxo, type NoFluxo, type StatusNoFluxo } from "@/pages/projetos/lib/fluxoGrafo";
import type { ChecklistCounts } from "@/pages/projetos/hooks/useProjetoDisciplinaChecklist";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { FluxoPipelineGraph, type FluxoNodeStatus, type FluxoPipelineStage } from "./FluxoPipelineGraph";

/** Mesma régua de `isDiscAtrasada`, mas contra o `hoje` recebido (testável). */
function getDiscStatusFluxo(disc: DisciplinaResponsavel, hoje: string): StatusNoFluxo {
  if (disc.status === "Concluído" || disc.data_final) return "concluido";
  if (disc.status === "Pausada") return "pausado";
  if (disc.data_previsao && disc.data_previsao < hoje) return "atrasado";
  if (disc.status === "Em Andamento") return "em_andamento";
  return "nao_iniciado";
}

/** O grafo só desenha 4 estados; pausada aparece como aguardando (prazo congelado). */
function statusVisual(status: StatusNoFluxo): FluxoNodeStatus {
  return status === "pausado" ? "nao_iniciado" : status;
}

interface FluxoPipelineProps {
  disciplinas: DisciplinaResponsavel[];
  onOpenDisciplina?: (disc: DisciplinaResponsavel) => void;
  /** Chave = projeto_disciplina.id. Ausente = disciplina sem checklist (sem badge). */
  checklistCounts?: Record<string, ChecklistCounts>;
  /** Previsão gravada no projeto: base do desvio "+N dias úteis" no resumo. */
  projetoDataPrevisao?: string | null;
  /** Injetável nos testes. Padrão: hoje no fuso local. */
  hoje?: string;
}

/** Key do nó no grafo: disc.id quando persistida, senão um índice estável dentro da etapa. */
function nodeKeyFor(disc: DisciplinaResponsavel, etapa: number | null, index: number): string {
  return disc.id ?? `${etapa}-${index}`;
}

function rotuloData(
  disc: DisciplinaResponsavel,
  status: StatusNoFluxo,
  atraso: number
): { label?: string; tone?: "danger" | "success" } {
  if (status === "concluido") {
    return disc.data_final ? { label: `concluída ${formatDateShort(disc.data_final)}`, tone: "success" } : {};
  }
  if (status === "atrasado" && atraso > 0) return { label: `${atraso}d de atraso`, tone: "danger" };
  if (disc.data_previsao) return { label: `prev. ${formatDateShort(disc.data_previsao)}` };
  return {};
}

export function FluxoPipeline({
  disciplinas,
  onOpenDisciplina,
  checklistCounts,
  projetoDataPrevisao,
  hoje = formatDateLocal(new Date()),
}: FluxoPipelineProps) {
  const etapas = useMemo(() => groupByEtapa(disciplinas).filter((e) => e.etapa != null), [disciplinas]);
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const modelo = useMemo(() => {
    const discPorKey = new Map<string, DisciplinaResponsavel>();
    const statusPorKey = new Map<string, StatusNoFluxo>();
    const etapaDaKey = new Map<string, number>();
    const nos: NoFluxo[] = [];

    etapas.forEach((etapa, idx) => {
      etapa.disciplinas.forEach((disc, i) => {
        const key = nodeKeyFor(disc, etapa.etapa, i);
        const status = getDiscStatusFluxo(disc, hoje);
        discPorKey.set(key, disc);
        statusPorKey.set(key, status);
        etapaDaKey.set(key, idx);
        nos.push({
          key,
          coluna: etapa.etapa!,
          status,
          dataInicio: disc.data_inicio || undefined,
          dataPrevisao: disc.data_previsao || undefined,
          dataFinal: disc.data_final || undefined,
        });
      });
    });

    const projecao = projetarFluxo(nos, hoje);

    const stages: FluxoPipelineStage[] = etapas.map((etapa) => {
      const nodes = etapa.disciplinas.map((disc, i) => {
        const key = nodeKeyFor(disc, etapa.etapa, i);
        const status = statusPorKey.get(key)!;
        const counts = disc.id ? checklistCounts?.[disc.id] : undefined;
        const data = rotuloData(disc, status, projecao.porNo[key]?.atrasoDiasUteis ?? 0);
        return {
          key,
          titulo: disc.disciplina,
          status: statusVisual(status),
          responsavelNome: disc.responsavel_nome || undefined,
          metaLabel: data.label,
          metaTone: data.tone,
          checklistLabel: counts && counts.total > 0 ? `${counts.concluidos}/${counts.total}` : undefined,
        };
      });
      const concluidas = nodes.filter((n) => n.status === "concluido").length;
      return { key: String(etapa.etapa), titulo: etapa.nome, resumo: `${concluidas}/${nodes.length}`, nodes };
    });

    // Conectores do caminho crítico: o conector i liga a etapa i à i+1.
    const conectoresCriticos: number[] = [];
    for (let i = 0; i < projecao.caminhoCritico.length - 1; i++) {
      const de = etapaDaKey.get(projecao.caminhoCritico[i]);
      const para = etapaDaKey.get(projecao.caminhoCritico[i + 1]);
      if (de != null && para === de + 1) conectoresCriticos.push(de);
    }

    return { discPorKey, statusPorKey, etapaDaKey, projecao, stages, conectoresCriticos };
  }, [etapas, checklistCounts, hoje]);

  if (etapas.length === 0) return null;

  const { discPorKey, statusPorKey, etapaDaKey, projecao, stages, conectoresCriticos } = modelo;
  const total = statusPorKey.size;
  const status = Array.from(statusPorKey.values());
  const concluidas = status.filter((s) => s === "concluido").length;
  const emAndamento = status.filter((s) => s === "em_andamento" || s === "atrasado").length;
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;
  const inicio = Array.from(discPorKey.values())
    .map((d) => d.data_inicio)
    .filter((d): d is string => !!d)
    .sort()[0];

  const conclusao = projecao.conclusaoEstimada;
  const desvio =
    conclusao && projetoDataPrevisao && conclusao > projetoDataPrevisao
      ? diasUteisEntre(projetoDataPrevisao, conclusao)
      : 0;
  const criticaAberta = projecao.caminhoCritico.find((k) => statusPorKey.get(k) !== "concluido");

  // Selecionada: realça da coluna dela até o fim (o que ela trava). Sem seleção: caminho crítico.
  const etapaSelecionada = selecionada != null ? etapaDaKey.get(selecionada) : undefined;
  const conectoresRealcados =
    etapaSelecionada != null
      ? Array.from({ length: Math.max(stages.length - 1 - etapaSelecionada, 0) }, (_, i) => etapaSelecionada + i)
      : conectoresCriticos;

  return (
    <div className="bg-white border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Fluxo de Disciplinas</span>
        <span className="text-xs text-muted-foreground">
          {concluidas}/{total} disciplinas concluídas ({progresso}%)
        </span>
      </div>

      <dl className="grid grid-cols-2 lg:grid-cols-5 gap-3" aria-label="Resumo do fluxo">
        <ResumoItem rotulo="Progresso">
          <span className="text-base font-semibold">
            {concluidas} de {total}
          </span>
          <span
            className="mt-1.5 block h-1.5 rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-label="Disciplinas concluídas"
            aria-valuenow={progresso}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className="block h-full rounded-full bg-status-done" style={{ width: `${progresso}%` }} />
          </span>
        </ResumoItem>
        <ResumoItem rotulo="Início">
          <span className="text-base font-semibold">{inicio ? formatDate(inicio) : "-"}</span>
        </ResumoItem>
        <ResumoItem rotulo="Previsão de conclusão">
          <span className="text-base font-semibold">{conclusao ? formatDate(conclusao) : "-"}</span>
          {conclusao && projetoDataPrevisao && (
            <span
              className={cn("block text-xs", desvio > 0 ? "text-danger-strong font-medium" : "text-muted-foreground")}
            >
              {desvio > 0
                ? `+${desvio} ${desvio === 1 ? "dia útil" : "dias úteis"} sobre ${formatDate(projetoDataPrevisao)}`
                : `No prazo do projeto (${formatDate(projetoDataPrevisao)})`}
            </span>
          )}
          {projecao.semData > 0 && (
            <span className="block text-xs text-muted-foreground">
              {projecao.semData} {projecao.semData === 1 ? "disciplina sem data" : "disciplinas sem data"} fora da conta
            </span>
          )}
        </ResumoItem>
        <ResumoItem rotulo="Caminho crítico passa por">
          <span className="text-sm font-semibold truncate block">
            {criticaAberta ? discPorKey.get(criticaAberta)?.disciplina : "-"}
          </span>
          <span className="block text-xs text-muted-foreground">Atraso aqui empurra a entrega</span>
        </ResumoItem>
        <ResumoItem rotulo="Em andamento agora">
          <span className="text-base font-semibold">
            {emAndamento} {emAndamento === 1 ? "disciplina" : "disciplinas"}
          </span>
        </ResumoItem>
      </dl>

      <FluxoPipelineGraph
        stages={stages}
        selectedNodeKey={selecionada}
        highlightedConnectors={conectoresRealcados}
        onNodeClick={(key) => setSelecionada((atual) => (atual === key ? null : key))}
      />

      {selecionada != null && discPorKey.has(selecionada) && (
        <DetalheDisciplina
          disc={discPorKey.get(selecionada)!}
          status={statusPorKey.get(selecionada)!}
          projecao={projecao.porNo[selecionada]}
          dependeDe={etapaSelecionada! > 0 ? stages[etapaSelecionada! - 1].nodes.map((n) => n.titulo) : []}
          libera={etapaSelecionada! < stages.length - 1 ? stages[etapaSelecionada! + 1].nodes.map((n) => n.titulo) : []}
          onAbrir={onOpenDisciplina}
        />
      )}
    </div>
  );
}

function ResumoItem({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border px-3 py-2.5 min-w-0">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

interface DetalheDisciplinaProps {
  disc: DisciplinaResponsavel;
  status: StatusNoFluxo;
  projecao?: ReturnType<typeof projetarFluxo>["porNo"][string];
  dependeDe: string[];
  libera: string[];
  onAbrir?: (disc: DisciplinaResponsavel) => void;
}

function DetalheDisciplina({ disc, status, projecao, dependeDe, libera, onAbrir }: DetalheDisciplinaProps) {
  const fimEstimadoDiferente =
    status !== "concluido" && projecao?.fimEstimado && projecao.fimEstimado !== disc.data_previsao;

  return (
    <section aria-label={`Detalhe de ${disc.disciplina}`} className="rounded-md border p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-sm font-semibold">{disc.disciplina}</span>
          <StatusBadge domain="disciplina_fluxo" status={status} />
          {projecao?.critico && status !== "concluido" && (
            <span className="text-xs text-info-strong font-medium">No caminho crítico</span>
          )}
          {disc.responsavel_nome && <span className="text-xs text-muted-foreground">{disc.responsavel_nome}</span>}
        </div>
        {onAbrir && (
          <Button variant="brand" size="sm" onClick={() => onAbrir(disc)}>
            Abrir disciplina
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3 text-sm">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Datas</p>
          <p>
            <span className="text-muted-foreground">Início:</span> {formatDate(disc.data_inicio)}
          </p>
          <p>
            <span className="text-muted-foreground">Previsão:</span> {formatDate(disc.data_previsao)}
          </p>
          {status === "concluido" ? (
            <p>
              <span className="text-muted-foreground">Concluída em:</span> {formatDate(disc.data_final)}
            </p>
          ) : (
            fimEstimadoDiferente && (
              <p className="text-danger-strong font-medium">
                <span className="text-muted-foreground font-normal">Fim estimado:</span>{" "}
                {formatDate(projecao!.fimEstimado)}
                {projecao!.atrasoDiasUteis > 0 && ` (+${projecao!.atrasoDiasUteis} d.u.)`}
              </p>
            )
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Depende de</p>
          <p>{dependeDe.length > 0 ? dependeDe.join(", ") : "Nada: é o início do fluxo"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Libera</p>
          <p>{libera.length > 0 ? libera.join(", ") : "Nada: é a entrega final"}</p>
        </div>
      </div>
    </section>
  );
}

export function groupByEtapa(disciplinas: DisciplinaResponsavel[]) {
  const groups: { etapa: number | null; nome: string; disciplinas: DisciplinaResponsavel[] }[] = [];
  const etapaMap = new Map<number, DisciplinaResponsavel[]>();
  const semEtapa: DisciplinaResponsavel[] = [];

  for (const d of disciplinas) {
    if (d.etapa != null) {
      if (!etapaMap.has(d.etapa)) etapaMap.set(d.etapa, []);
      etapaMap.get(d.etapa)!.push(d);
    } else {
      semEtapa.push(d);
    }
  }

  for (const [etapa, discs] of Array.from(etapaMap.entries()).sort(([a], [b]) => a - b)) {
    // Rótulo neutro (posição), não "Etapa N": "etapa" já nomeia o sub-passo
    // dentro do checklist de uma disciplina (spec 071), evita colisão de nome.
    groups.push({ etapa, nome: String(etapa), disciplinas: discs });
  }

  if (semEtapa.length > 0) {
    groups.push({ etapa: null, nome: "Avulsas", disciplinas: semEtapa });
  }

  return groups;
}
