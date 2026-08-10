import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";
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
import { usePermissions } from "@/hooks/usePermissions";
import { useProjetosLite, usePessoasEmpresa } from "@/pages/meu-trabalho/hooks";
import { useCreateObra, useObras, useUpdateObra, type ObraResumo } from "@/hooks/useObras";
import { STATUS_OBRA_OPCOES } from "@/lib/obras";
import { lookupCEP } from "@/lib/brasilApi";
import { geocodarCidade } from "@/lib/clima";
import { onlyDigits } from "@/lib/maskUtils";

const SEM_RESPONSAVEL = "__none__";
const SEM_PROJETO = "__none__";

const schema = z.object({
  nome: z.string().min(1, "Dê um nome à obra"),
  status: z.enum(["planejada", "em_andamento", "paralisada", "concluida"]),
  modelo_cobranca: z.enum(["administracao", "preco_fechado"]),
  taxa_administracao_pct: z.string(),
  projeto_id: z.string(),
  responsavel_id: z.string(),
  cep: z.string(),
  data_inicio_prevista: z.string(),
  data_fim_prevista: z.string(),
  observacoes: z.string(),
});
type FormData = z.infer<typeof schema>;

const VAZIO: FormData = {
  nome: "",
  status: "planejada",
  modelo_cobranca: "administracao",
  taxa_administracao_pct: "",
  projeto_id: SEM_PROJETO,
  responsavel_id: SEM_RESPONSAVEL,
  cep: "",
  data_inicio_prevista: "",
  data_fim_prevista: "",
  observacoes: "",
};

type Local = { cidade: string; localizacao: string; latitude: number | null; longitude: number | null };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obra?: ObraResumo | null;
  onSaved?: () => void;
}

export function ObraFormDialog({ open, onOpenChange, obra, onSaved }: Props) {
  const isEdit = !!obra;
  const { can } = usePermissions();
  const mostrarProjeto = can("projetos", "view");

  const { data: projetos = [] } = useProjetosLite();
  const { data: pessoas = [] } = usePessoasEmpresa();
  const { data: obrasExistentes = [] } = useObrasParaFiltro(isEdit);
  const criar = useCreateObra();
  const atualizar = useUpdateObra();

  const [local, setLocal] = useState<Local | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const ultimoCep = useRef("");

  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: VAZIO });
  const { register, handleSubmit, reset, watch, setValue, formState } = form;

  // Projetos que já têm obra ligada não aparecem (evita dois vínculos no mesmo).
  const projetosDisponiveis = useMemo(() => {
    const ocupados = new Set(obrasExistentes.map((o) => o.projeto_id).filter(Boolean));
    // mantém o projeto atual da obra em edição na lista
    return projetos.filter((p) => !ocupados.has(p.id) || p.id === obra?.projeto_id);
  }, [projetos, obrasExistentes, obra?.projeto_id]);

  useEffect(() => {
    if (!open) return;
    ultimoCep.current = "";
    if (obra) {
      reset({
        nome: obra.nome,
        status: obra.status as FormData["status"],
        modelo_cobranca: (obra.modelo_cobranca as FormData["modelo_cobranca"]) ?? "administracao",
        taxa_administracao_pct: obra.taxa_administracao_pct ? String(obra.taxa_administracao_pct) : "",
        projeto_id: obra.projeto_id ?? SEM_PROJETO,
        responsavel_id: obra.responsavel_id ?? SEM_RESPONSAVEL,
        cep: obra.cep ?? "",
        data_inicio_prevista: obra.data_inicio_prevista ?? "",
        data_fim_prevista: obra.data_fim_prevista ?? "",
        observacoes: obra.observacoes ?? "",
      });
      setLocal(
        obra.localizacao || obra.latitude != null
          ? {
              cidade: obra.cidade ?? "",
              localizacao: obra.localizacao ?? "",
              latitude: obra.latitude,
              longitude: obra.longitude,
            }
          : null
      );
    } else {
      reset(VAZIO);
      setLocal(null);
    }
  }, [open, obra, reset]);

  // CEP → endereço (BrasilAPI) → coordenadas (Open-Meteo). Mesmo gesto do projeto.
  const buscarCep = async (cepRaw: string) => {
    const d = onlyDigits(cepRaw);
    if (d.length !== 8 || d === ultimoCep.current) return;
    ultimoCep.current = d;
    setBuscandoCep(true);
    try {
      const end = await lookupCEP(d);
      if (!end) {
        toast.error("CEP não encontrado");
        return;
      }
      const partes = [end.street, end.neighborhood, end.city, end.state].filter(Boolean);
      const localizacao = partes.join(", ");
      let latitude: number | null = null;
      let longitude: number | null = null;
      try {
        const geo = await geocodarCidade(`${end.city} ${end.state}`);
        if (geo[0]) {
          latitude = geo[0].latitude;
          longitude = geo[0].longitude;
        }
      } catch {
        // geocode falhou: mantém endereço, sem coordenadas (clima fica indisponível)
      }
      setLocal({ cidade: end.city, localizacao, latitude, longitude });
    } catch {
      toast.error("Erro ao buscar CEP");
    } finally {
      setBuscandoCep(false);
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    const payload = {
      nome: data.nome.trim(),
      status: data.status,
      modelo_cobranca: data.modelo_cobranca,
      taxa_administracao_pct: data.modelo_cobranca === "administracao" ? Number(data.taxa_administracao_pct) || 0 : 0,
      projeto_id: mostrarProjeto && data.projeto_id !== SEM_PROJETO ? data.projeto_id : null,
      responsavel_id: data.responsavel_id === SEM_RESPONSAVEL ? null : data.responsavel_id,
      cep: onlyDigits(data.cep) || null,
      cidade: local?.cidade || null,
      localizacao: local?.localizacao || null,
      latitude: local?.latitude ?? null,
      longitude: local?.longitude ?? null,
      data_inicio_prevista: data.data_inicio_prevista || null,
      data_fim_prevista: data.data_fim_prevista || null,
      observacoes: data.observacoes.trim() || null,
    };
    try {
      if (isEdit && obra) {
        await atualizar.mutateAsync({ id: obra.id, ...payload });
        toast.success("Obra atualizada");
      } else {
        await criar.mutateAsync(payload);
        toast.success("Obra criada");
      }
      onOpenChange(false);
      onSaved?.();
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
          <DialogTitle>{isEdit ? "Editar obra" : "Nova obra"}</DialogTitle>
          <DialogDescription>
            Registre a obra e a localização. O CEP alimenta a previsão do tempo na aba Clima.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome da obra *</Label>
            <Input id="nome" {...register("nome")} placeholder="Ex.: Residência Alphaville" />
            {formState.errors.nome && <p className="text-xs text-danger-strong">{formState.errors.nome.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as FormData["status"])}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OBRA_OPCOES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="responsavel">Responsável</Label>
              <Select value={watch("responsavel_id")} onValueChange={(v) => setValue("responsavel_id", v)}>
                <SelectTrigger id="responsavel">
                  <SelectValue placeholder="Ninguém" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_RESPONSAVEL}>Ninguém</SelectItem>
                  {pessoas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="modelo_cobranca">Cobrança</Label>
              <Select
                value={watch("modelo_cobranca")}
                onValueChange={(v) => setValue("modelo_cobranca", v as FormData["modelo_cobranca"])}
              >
                <SelectTrigger id="modelo_cobranca">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administracao">Administração</SelectItem>
                  <SelectItem value="preco_fechado">Preço fechado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {watch("modelo_cobranca") === "administracao" && (
              <div className="space-y-1.5">
                <Label htmlFor="taxa">Taxa de administração (%)</Label>
                <Input
                  id="taxa"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="Ex.: 10"
                  {...register("taxa_administracao_pct")}
                />
              </div>
            )}
          </div>
          {watch("modelo_cobranca") === "administracao" && (
            <p className="-mt-2 text-xs text-muted-foreground">
              A taxa vira receita do escritório automaticamente a cada despesa lançada na conta da obra.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cep">CEP da obra</Label>
            <div className="relative">
              <Input
                id="cep"
                inputMode="numeric"
                placeholder="00000-000"
                {...register("cep", {
                  onChange: (e) => buscarCep(e.target.value),
                })}
              />
              {buscandoCep && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            {local?.localizacao && (
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {local.localizacao}
                {local.latitude == null && " (sem coordenadas — clima indisponível)"}
              </p>
            )}
          </div>

          {mostrarProjeto && (
            <div className="space-y-1.5">
              <Label htmlFor="projeto">Projeto (opcional)</Label>
              <Select value={watch("projeto_id")} onValueChange={(v) => setValue("projeto_id", v)}>
                <SelectTrigger id="projeto">
                  <SelectValue placeholder="Sem projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_PROJETO}>Sem projeto</SelectItem>
                  {projetosDisponiveis.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Vincule para conectar a execução ao faturamento e à margem do projeto.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inicio">Início previsto</Label>
              <Input id="inicio" type="date" {...register("data_inicio_prevista")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fim">Fim previsto</Label>
              <Input id="fim" type="date" {...register("data_fim_prevista")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações</Label>
            <Textarea id="obs" rows={2} {...register("observacoes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar" : "Criar obra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Lista leve de obras só para filtrar projetos já ocupados no modo criação.
function useObrasParaFiltro(isEdit: boolean) {
  const q = useObras();
  return { data: isEdit ? [] : (q.data ?? []) };
}
