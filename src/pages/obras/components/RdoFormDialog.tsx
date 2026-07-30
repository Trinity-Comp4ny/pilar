import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLIMA_OPCOES, CONDICAO_OPCOES } from "@/lib/obras";
import { useCreateRdo, useUpdateRdo, type RdoRow } from "@/hooks/useObraRdo";

const NAO_INFORMADO = "__none__";

const schema = z.object({
  data: z.string().min(1, "Escolha a data"),
  clima: z.string(),
  condicao_trabalho: z.string(),
  efetivo: z.string(),
  atividades: z.string(),
  ocorrencias: z.string(),
  pendencias: z.string(),
});
type FormData = z.infer<typeof schema>;

const hoje = () => new Date().toISOString().slice(0, 10);

const vazio = (): FormData => ({
  data: hoje(),
  clima: NAO_INFORMADO,
  condicao_trabalho: NAO_INFORMADO,
  efetivo: "",
  atividades: "",
  ocorrencias: "",
  pendencias: "",
});

const doRdo = (r: RdoRow): FormData => ({
  data: r.data,
  clima: r.clima ?? NAO_INFORMADO,
  condicao_trabalho: r.condicao_trabalho ?? NAO_INFORMADO,
  efetivo: r.efetivo != null ? String(r.efetivo) : "",
  atividades: r.atividades ?? "",
  ocorrencias: r.ocorrencias ?? "",
  pendencias: r.pendencias ?? "",
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  /** RDOs já existentes da obra, para aplicar a regra de 1 por dia. */
  rdos: RdoRow[];
  /** Quando presente, abre editando este registro. */
  rdoInicial?: RdoRow | null;
}

export function RdoFormDialog({ open, onOpenChange, obraId, rdos, rdoInicial }: Props) {
  const criar = useCreateRdo();
  const atualizar = useUpdateRdo();
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: vazio() });
  const { register, handleSubmit, reset, watch, setValue, formState } = form;
  const dataSel = watch("data");

  useEffect(() => {
    if (!open) return;
    if (rdoInicial) {
      setEditandoId(rdoInicial.id);
      reset(doRdo(rdoInicial));
    } else {
      setEditandoId(null);
      reset(vazio());
    }
  }, [open, rdoInicial, reset]);

  // Regra de 1 por dia: se a data escolhida já tem RDO, passa a editar aquele.
  useEffect(() => {
    if (!open || !dataSel) return;
    const existente = rdos.find((r) => r.data === dataSel);
    if (existente && existente.id !== editandoId) {
      setEditandoId(existente.id);
      reset(doRdo(existente));
      toast.info("Já existe um registro nesse dia", { description: "Abrimos ele para você editar." });
    } else if (!existente && editandoId && !rdoInicial) {
      setEditandoId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSel]);

  const onSubmit = handleSubmit(async (d) => {
    const payload = {
      obra_id: obraId,
      data: d.data,
      clima: d.clima === NAO_INFORMADO ? null : d.clima,
      condicao_trabalho: d.condicao_trabalho === NAO_INFORMADO ? null : d.condicao_trabalho,
      efetivo: d.efetivo.trim() === "" ? null : Number(d.efetivo),
      atividades: d.atividades.trim() || null,
      ocorrencias: d.ocorrencias.trim() || null,
      pendencias: d.pendencias.trim() || null,
    };
    try {
      if (editandoId) {
        await atualizar.mutateAsync({ id: editandoId, ...payload });
        toast.success("Registro atualizado");
      } else {
        await criar.mutateAsync(payload);
        toast.success("Dia registrado");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error("Não foi possível salvar", {
        description: e instanceof Error ? e.message : "Tente novamente",
      });
    }
  });

  const saving = criar.isPending || atualizar.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editandoId ? "Editar dia" : "Registrar dia"}</DialogTitle>
          <DialogDescription>Diário de obra (RDO). Um registro por dia.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="data">Data *</Label>
              <Input id="data" type="date" max={hoje()} {...register("data")} />
              {formState.errors.data && <p className="text-xs text-danger-strong">{formState.errors.data.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="efetivo">Efetivo (pessoas)</Label>
              <Input id="efetivo" type="number" min={0} {...register("efetivo")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="clima">Clima</Label>
              <Select value={watch("clima")} onValueChange={(v) => setValue("clima", v)}>
                <SelectTrigger id="clima">
                  <SelectValue placeholder="Não informado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NAO_INFORMADO}>Não informado</SelectItem>
                  {CLIMA_OPCOES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="condicao">Condição de trabalho</Label>
              <Select value={watch("condicao_trabalho")} onValueChange={(v) => setValue("condicao_trabalho", v)}>
                <SelectTrigger id="condicao">
                  <SelectValue placeholder="Não informado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NAO_INFORMADO}>Não informado</SelectItem>
                  {CONDICAO_OPCOES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="atividades">Atividades do dia</Label>
            <Textarea id="atividades" rows={2} {...register("atividades")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ocorrencias">Ocorrências</Label>
            <Textarea id="ocorrencias" rows={2} {...register("ocorrencias")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pendencias">Pendências</Label>
            <Textarea id="pendencias" rows={2} {...register("pendencias")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
