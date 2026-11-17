import { toast } from "sonner";
import { SincronizarFluxoDialog, type LinhaSincronizacao } from "@/components/fluxo/SincronizarFluxoDialog";
import {
  useAplicarSincronizacoesProjetos,
  useSincronizacoesDoFluxoProjetos,
} from "@/pages/projetos/hooks/useSincronizarFluxoProjetos";
import type { FluxoDisciplinaTemplate } from "@/types/fluxoDisciplinas";

function frase(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Depois de salvar uma mudança no fluxo: oferece levar a mudança para os projetos que já seguem esse fluxo. */
export function SincronizarProjetosDialog({
  fluxo,
  onOpenChange,
}: {
  fluxo: { id: string; nome: string; disciplinas: FluxoDisciplinaTemplate[] } | null;
  onOpenChange: (v: boolean) => void;
}) {
  const { data = [], isLoading } = useSincronizacoesDoFluxoProjetos(
    fluxo?.id ?? null,
    fluxo?.disciplinas ?? [],
    !!fluxo
  );
  const aplicar = useAplicarSincronizacoesProjetos();

  const linhas: LinhaSincronizacao[] = data.map(({ projeto, plano, mudamDeColuna, temAlgo }) => {
    const partes = [
      plano.novas.length > 0 ? frase(plano.novas.length, "disciplina nova", "disciplinas novas") : null,
      mudamDeColuna > 0 ? `${frase(mudamDeColuna, "muda", "mudam")} de coluna` : null,
    ].filter(Boolean);
    return { id: projeto.id, nome: projeto.nome, temAlgo, resumo: temAlgo ? partes.join(" · ") : "Já está em dia" };
  });

  const confirmar = async (ids: string[]) => {
    const r = await aplicar.mutateAsync(data.filter((d) => ids.includes(d.projeto.id)));
    if (r.falhas.length > 0) {
      toast.warning("Parte dos projetos não atualizou", {
        description: `${r.ok} atualizado(s). Falhou em: ${r.falhas.join(", ")}. Tente de novo.`,
      });
      return;
    }
    toast.success(frase(r.ok, "projeto atualizado", "projetos atualizados"));
    onOpenChange(false);
  };

  return (
    <SincronizarFluxoDialog
      open={!!fluxo}
      onOpenChange={onOpenChange}
      tipo="projetos"
      nomeFluxo={fluxo?.nome ?? ""}
      carregando={isLoading}
      linhas={linhas}
      pending={aplicar.isPending}
      onConfirmar={(ids) => void confirmar(ids)}
    />
  );
}
