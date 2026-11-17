import { toast } from "sonner";
import { SincronizarFluxoDialog, type LinhaSincronizacao } from "@/components/fluxo/SincronizarFluxoDialog";
import {
  useAplicarSincronizacoesObra,
  useSincronizacoesDoFluxoObra,
} from "@/pages/obras/hooks/useSincronizarFluxoObra";
import type { EstruturaFluxo } from "@/pages/obras/lib/fluxoObra";
import { resumoDaSincronizacao } from "@/pages/obras/lib/sincronizarFluxoObra";

function frase(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Depois de salvar uma mudança no fluxo: oferece levar o que falta para as obras que já seguem esse fluxo. */
export function SincronizarObrasDialog({
  fluxo,
  onOpenChange,
}: {
  fluxo: { id: string; nome: string; estrutura: EstruturaFluxo } | null;
  onOpenChange: (v: boolean) => void;
}) {
  const { data = [], isLoading } = useSincronizacoesDoFluxoObra(fluxo?.id ?? null, fluxo?.estrutura ?? [], !!fluxo);
  const aplicar = useAplicarSincronizacoesObra();

  const linhas: LinhaSincronizacao[] = data.map(({ obra, plano, temAlgo }) => {
    const r = resumoDaSincronizacao(plano);
    const partes = [
      r.fases + r.etapas + r.servicos > 0 ? frase(r.fases + r.etapas + r.servicos, "item novo", "itens novos") : null,
      r.tarefas > 0 ? frase(r.tarefas, "tarefa nova", "tarefas novas") : null,
      r.prestadores > 0 ? frase(r.prestadores, "prestador padrão", "prestadores padrão") : null,
    ].filter(Boolean);
    return { id: obra.id, nome: obra.nome, temAlgo, resumo: temAlgo ? partes.join(" · ") : "Já está em dia" };
  });

  const confirmar = async (ids: string[]) => {
    const r = await aplicar.mutateAsync(data.filter((d) => ids.includes(d.obra.id)));
    if (r.falhas.length > 0) {
      toast.warning("Parte das obras não atualizou", {
        description: `${r.ok} atualizada(s). Falhou em: ${r.falhas.join(", ")}. Tente de novo.`,
      });
      return;
    }
    toast.success(frase(r.ok, "obra atualizada", "obras atualizadas"));
    onOpenChange(false);
  };

  return (
    <SincronizarFluxoDialog
      open={!!fluxo}
      onOpenChange={onOpenChange}
      tipo="obras"
      nomeFluxo={fluxo?.nome ?? ""}
      carregando={isLoading}
      linhas={linhas}
      pending={aplicar.isPending}
      onConfirmar={(ids) => void confirmar(ids)}
    />
  );
}
