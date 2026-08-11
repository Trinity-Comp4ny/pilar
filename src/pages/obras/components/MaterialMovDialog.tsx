import { useEffect } from "react";
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
import { TIPO_MOVIMENTO_OPCOES } from "@/lib/obras";
import type { ObraFrenteRow } from "@/hooks/useObraFrentes";
import {
  useSaveMaterial,
  useSaveMovimento,
  type MaterialComMovimentos,
  type MovimentoRow,
} from "@/hooks/useObraEstoque";

const NOVO = "__novo__";
const SEM_FRENTE = "__none__";
const hoje = () => new Date().toISOString().slice(0, 10);
const parseNum = (v: string): number => Number(v.replace(",", ".").trim());

const schema = z
  .object({
    material: z.string().min(1, "Escolha o material"),
    nome: z.string(),
    unidade: z.string(),
    tipo: z.enum(["entrada", "baixa"]),
    quantidade: z.string(),
    data: z.string().min(1, "Escolha a data"),
    obra_frente_id: z.string(),
    valor_unitario: z.string(),
    observacoes: z.string(),
  })
  .superRefine((d, ctx) => {
    const q = parseNum(d.quantidade);
    if (!Number.isFinite(q) || q <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["quantidade"], message: "Informe uma quantidade maior que zero" });
    }
    if (d.material === NOVO) {
      if (!d.nome.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nome"], message: "Nome do material" });
      if (!d.unidade.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["unidade"], message: "Unidade" });
    }
  });
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  materiais: MaterialComMovimentos[];
  frentes: ObraFrenteRow[];
  /** Quando presente, edita este movimento (o material fica fixo). */
  movInicial?: MovimentoRow | null;
  /** Pré-seleciona um material (ao registrar a partir de um card). */
  materialIdInicial?: string | null;
}

export function MaterialMovDialog({ open, onOpenChange, obraId, materiais, frentes, movInicial, materialIdInicial }: Props) {
  const saveMaterial = useSaveMaterial(obraId);
  const saveMov = useSaveMovimento(obraId);
  const editando = !!movInicial;

  const form = useForm<FormData>({ resolver: zodResolver(schema) });
  const { register, handleSubmit, reset, watch, setValue, formState } = form;
  const material = watch("material");
  const tipo = watch("tipo");

  useEffect(() => {
    if (!open) return;
    reset({
      material: movInicial?.obra_material_id ?? materialIdInicial ?? "",
      nome: "",
      unidade: "",
      tipo: (movInicial?.tipo as "entrada" | "baixa") ?? "entrada",
      quantidade: movInicial ? String(movInicial.quantidade) : "",
      data: movInicial?.data ?? hoje(),
      obra_frente_id: movInicial?.obra_frente_id ?? SEM_FRENTE,
      valor_unitario: movInicial?.valor_unitario != null ? String(movInicial.valor_unitario) : "",
      observacoes: movInicial?.observacoes ?? "",
    });
  }, [open, movInicial, materialIdInicial, reset]);

  const materialFixoNome = editando ? materiais.find((m) => m.id === movInicial?.obra_material_id)?.nome : null;

  const onSubmit = handleSubmit(async (d) => {
    try {
      let materialId = d.material;
      if (!editando && d.material === NOVO) {
        materialId = await saveMaterial.mutateAsync({ nome: d.nome.trim(), unidade: d.unidade.trim() });
        // Fixa o material recém-criado no form: se o movimento abaixo falhar, um novo
        // envio reusa este id em vez de criar um segundo material com o mesmo nome.
        setValue("material", materialId);
      }
      await saveMov.mutateAsync({
        id: movInicial?.id ?? undefined,
        obra_material_id: materialId,
        tipo: d.tipo,
        quantidade: parseNum(d.quantidade),
        data: d.data,
        obra_frente_id: d.obra_frente_id === SEM_FRENTE ? null : d.obra_frente_id,
        valor_unitario: d.tipo === "entrada" && d.valor_unitario.trim() ? parseNum(d.valor_unitario) : null,
        observacoes: d.observacoes.trim() || null,
      });
      toast.success(editando ? "Movimento atualizado" : d.tipo === "entrada" ? "Entrada registrada" : "Baixa registrada");
      onOpenChange(false);
    } catch (e) {
      toast.error("Não foi possível salvar", { description: e instanceof Error ? e.message : "Tente novamente" });
    }
  });

  const saving = saveMaterial.isPending || saveMov.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar movimento" : "Registrar movimento"}</DialogTitle>
          <DialogDescription>
            Entrada é o material comprado que chegou. Baixa é o que foi aplicado na obra.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Material */}
          <div className="space-y-1.5">
            <Label htmlFor="material">Material *</Label>
            {editando ? (
              <Input value={materialFixoNome ?? "Material"} disabled />
            ) : (
              <Select value={material} onValueChange={(v) => setValue("material", v)}>
                <SelectTrigger id="material">
                  <SelectValue placeholder="Escolha ou cadastre" />
                </SelectTrigger>
                <SelectContent>
                  {materiais.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome} ({m.unidade})
                    </SelectItem>
                  ))}
                  <SelectItem value={NOVO}>+ Novo material</SelectItem>
                </SelectContent>
              </Select>
            )}
            {formState.errors.material && (
              <p className="text-xs text-danger-strong">{formState.errors.material.message}</p>
            )}
          </div>

          {!editando && material === NOVO && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome *</Label>
                <Input id="nome" placeholder="Cimento CP-II" {...register("nome")} />
                {formState.errors.nome && <p className="text-xs text-danger-strong">{formState.errors.nome.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unidade">Unidade *</Label>
                <Input id="unidade" placeholder="sc, kg, m², un" {...register("unidade")} />
                {formState.errors.unidade && (
                  <p className="text-xs text-danger-strong">{formState.errors.unidade.message}</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => setValue("tipo", v as "entrada" | "baixa")}>
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_MOVIMENTO_OPCOES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quantidade">Quantidade *</Label>
              <Input id="quantidade" inputMode="decimal" placeholder="0" {...register("quantidade")} />
              {formState.errors.quantidade && (
                <p className="text-xs text-danger-strong">{formState.errors.quantidade.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="data">Data *</Label>
              <Input id="data" type="date" max={hoje()} {...register("data")} />
              {formState.errors.data && <p className="text-xs text-danger-strong">{formState.errors.data.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frente">Frente (etapa)</Label>
              <Select value={watch("obra_frente_id")} onValueChange={(v) => setValue("obra_frente_id", v)}>
                <SelectTrigger id="frente">
                  <SelectValue placeholder="Sem etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_FRENTE}>Sem etapa</SelectItem>
                  {frentes.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {tipo === "entrada" && (
            <div className="space-y-1.5">
              <Label htmlFor="valor_unitario">Valor unitário (R$, opcional)</Label>
              <Input id="valor_unitario" inputMode="decimal" placeholder="0,00" {...register("valor_unitario")} />
              <p className="text-xs text-muted-foreground">Usado para valorizar o saldo parado no canteiro.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" rows={2} {...register("observacoes")} />
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
