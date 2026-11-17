import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { useFluxosObra } from "@/pages/obras/hooks/useFluxosObra";
import { vincularObraAoFluxo } from "@/pages/obras/hooks/useSincronizarFluxoObra";
import { useImportarCronograma } from "@/pages/obras/hooks/useImportarCronograma";
import { duracaoTotalDias, planoDoFluxo } from "@/pages/obras/lib/fluxoObra";

const hoje = () => new Date().toISOString().slice(0, 10);

/** Aplica um fluxo da empresa no cronograma da obra: serviços, tarefas e prestadores, com as datas em cascata. */
export function AplicarFluxoObraDialog({
  open,
  onOpenChange,
  obraId,
  projetoId,
  fasesExistentes,
  inicioPadrao,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  projetoId: string | null;
  fasesExistentes: number;
  inicioPadrao?: string | null;
}) {
  const { data: fluxos = [] } = useFluxosObra();
  const importar = useImportarCronograma(obraId, projetoId, fasesExistentes);
  const [fluxoId, setFluxoId] = useState<string>("");
  const [inicio, setInicio] = useState(inicioPadrao ?? hoje());

  const fluxo = fluxos.find((f) => f.id === fluxoId) ?? null;
  const plano = useMemo(() => (fluxo && inicio ? planoDoFluxo(fluxo.estrutura, inicio) : null), [fluxo, inicio]);
  const fim = plano?.itens
    .map((i) => i.fim)
    .filter((v): v is string => !!v)
    .sort()
    .reverse()[0];

  const confirmar = async () => {
    if (!plano || plano.erro) return;
    try {
      const r = await importar.mutateAsync(plano);
      // A obra passa a seguir o fluxo: é o que permite atualizá-la quando o fluxo mudar.
      if (fluxo) await vincularObraAoFluxo(obraId, fluxo.id).catch(() => undefined);
      toast.success("Fluxo aplicado", { description: `${r.nos} itens e ${r.tarefas} tarefas no cronograma.` });
      onOpenChange(false);
    } catch (e) {
      toast.error("Não foi possível aplicar", { description: e instanceof Error ? e.message : "Tente de novo." });
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Aplicar fluxo no cronograma"
      description="O fluxo cria fases, etapas, serviços e tarefas, com o prestador padrão e as datas em cascata a partir do início."
      size="md"
      submitLabel="Aplicar"
      onSubmit={() => void confirmar()}
      isPending={importar.isPending}
      submitDisabled={!plano || !!plano.erro}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Fluxo</Label>
          <Select value={fluxoId} onValueChange={setFluxoId}>
            <SelectTrigger>
              <SelectValue placeholder={fluxos.length ? "Escolha um fluxo" : "Nenhum fluxo cadastrado"} />
            </SelectTrigger>
            <SelectContent>
              {fluxos.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fluxo-inicio">Início da obra</Label>
          <DatePicker id="fluxo-inicio" value={inicio} onChange={setInicio} />
        </div>
        {plano && !plano.erro && (
          <p className="rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-ink">
            {plano.itens.filter((i) => i.nivel === "servico").length} serviços e {plano.tarefas.length} tarefas, em{" "}
            {duracaoTotalDias(plano)} dias
            {fim ? `, terminando em ${formatDate(fim)}` : ""}. O que entra vem depois do que a obra já tem.
          </p>
        )}
        {plano?.erro && <p className="text-sm text-danger-strong">{plano.erro}</p>}
      </div>
    </FormDialog>
  );
}
