import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { FormDialog } from "@/components/FormDialog";
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
const SEM_CLIENTE = "__none__";

const schema = z.object({
  nome: z.string().min(1, "Dê um nome à obra"),
  status: z.enum(["planejada", "em_andamento", "paralisada", "concluida"]),
  modelo_cobranca: z.enum(["administracao", "preco_fechado"]),
  taxa_administracao_pct: z.string(),
  projeto_id: z.string(),
  responsavel_id: z.string(),
  cliente_id: z.string(),
  visivel_portal: z.boolean(),
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
  cliente_id: SEM_CLIENTE,
  visivel_portal: false,
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
  const { data: clientes = [] } = useClientesLite();
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
        cliente_id: obra.cliente_id ?? SEM_CLIENTE,
        visivel_portal: obra.visivel_portal ?? false,
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
      cliente_id: data.cliente_id === SEM_CLIENTE ? null : data.cliente_id,
      visivel_portal: data.visivel_portal,
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
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar obra" : "Nova obra"}
      description="Registre a obra e a localização. O CEP alimenta a previsão do tempo na aba Clima."
      size="md"
      onSubmit={onSubmit}
      isPending={saving}
      submitLabel={isEdit ? "Salvar" : "Criar obra"}
    >
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

      {/* Portal do cliente: quem vê e se está publicada */}
      <div className="space-y-1.5">
        <Label htmlFor="cliente">Cliente</Label>
        <Select value={watch("cliente_id")} onValueChange={(v) => setValue("cliente_id", v)}>
          <SelectTrigger id="cliente">
            <SelectValue placeholder="Sem cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_CLIENTE}>Sem cliente</SelectItem>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="visivel_portal">Visível no portal do cliente</Label>
          <p className="text-xs text-muted-foreground">
            O dono acompanha o andamento e a prestação de contas. Só vale para obra em administração com cliente
            vinculado.
          </p>
        </div>
        <Switch
          id="visivel_portal"
          checked={watch("visivel_portal")}
          onCheckedChange={(v) => setValue("visivel_portal", v)}
        />
      </div>

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
    </FormDialog>
  );
}

// Lista leve de obras só para filtrar projetos já ocupados no modo criação.
function useObrasParaFiltro(isEdit: boolean) {
  const q = useObras();
  return { data: isEdit ? [] : (q.data ?? []) };
}

// Lista leve de clientes para vincular a obra ao portal do cliente.
function useClientesLite() {
  return useQuery({
    queryKey: ["clientes-lite"],
    queryFn: async (): Promise<{ id: string; nome: string }[]> => {
      const { data, error } = await supabase.from("clientes").select("id, nome").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
}
