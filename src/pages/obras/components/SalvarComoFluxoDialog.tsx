import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSalvarFluxoObra } from "@/pages/obras/hooks/useFluxosObra";
import type { ObraFrenteRow } from "@/pages/obras/hooks/useObraFrentes";
import type { ObraTarefa } from "@/pages/obras/hooks/useObraTarefas";
import { vincularObraAoFluxo } from "@/pages/obras/hooks/useSincronizarFluxoObra";
import { estruturaDeObra } from "@/pages/obras/lib/fluxoObra";

/** Guarda o cronograma desta obra como fluxo: durações das datas, prestadores e tarefas, para as próximas obras. */
export function SalvarComoFluxoDialog({
  open,
  onOpenChange,
  nos,
  tarefas,
  nomeSugerido,
  obraId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nos: ReadonlyArray<ObraFrenteRow>;
  tarefas: ReadonlyArray<ObraTarefa>;
  nomeSugerido: string;
  /** A obra de onde o fluxo saiu passa a segui-lo. */
  obraId: string;
}) {
  const salvar = useSalvarFluxoObra();
  const [nome, setNome] = useState(`Fluxo ${nomeSugerido}`);

  const confirmar = async () => {
    const estrutura = estruturaDeObra(nos, tarefas);
    if (!nome.trim()) return;
    if (estrutura.every((f) => f.etapas.every((e) => e.servicos.length === 0))) {
      toast.error("O cronograma ainda não tem serviços", {
        description: "Monte fase, etapa e serviço antes de salvar.",
      });
      return;
    }
    try {
      const fluxoId = await salvar.mutateAsync({ nome, estrutura });
      await vincularObraAoFluxo(obraId, fluxoId).catch(() => undefined);
      toast.success("Fluxo salvo", { description: "Ele já aparece para aplicar em outras obras." });
      onOpenChange(false);
    } catch (e) {
      toast.error("Não foi possível salvar", { description: e instanceof Error ? e.message : "Tente de novo." });
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Salvar como fluxo"
      description="O cronograma desta obra vira um modelo: a duração de cada serviço sai das datas, e o prestador e as tarefas vão junto."
      size="sm"
      submitLabel="Salvar fluxo"
      onSubmit={() => void confirmar()}
      isPending={salvar.isPending}
      submitDisabled={!nome.trim()}
    >
      <div className="space-y-1.5">
        <Label htmlFor="fluxo-nome">Nome do fluxo</Label>
        <Input id="fluxo-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} autoFocus />
      </div>
    </FormDialog>
  );
}
