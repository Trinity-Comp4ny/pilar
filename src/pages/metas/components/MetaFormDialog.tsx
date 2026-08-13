import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchPessoasLookup } from "@/lib/supabaseQueries";
import { formatValorToInput, parseCurrencyString } from "@/lib/currencyUtils";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { NumberInput } from "@/components/forms/NumberInput";

export type MetaTipo = "financeira" | "pessoal";

export interface MetaRow {
  id: string;
  nome: string;
  alvo: number;
  atual: number;
  prazo: string | null;
  categoria: string | null;
  tipo: string;
  pessoa_id?: string | null;
  descricao?: string | null;
  unidade?: string | null;
  auto_sync?: boolean | null;
  sync_fonte?: string | null;
}

interface MetaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: MetaTipo;
  /** Preenchido = modo edição; ausente = criar. */
  meta?: MetaRow | null;
}

const CATEGORIAS_FINANCEIRA = [
  { value: "receita", label: "Receita" },
  { value: "lucro", label: "Lucro" },
  { value: "economia", label: "Economia" },
  { value: "investimento", label: "Investimento" },
];

const CATEGORIAS_PESSOAL = [
  { value: "entregas", label: "Entregas" },
  { value: "qualidade", label: "Qualidade" },
  { value: "produtividade", label: "Produtividade" },
  { value: "desenvolvimento", label: "Desenvolvimento" },
];

const UNIDADES = [
  { value: "currency", label: "Valor (R$)" },
  { value: "percentage", label: "Percentual (%)" },
  { value: "quantity", label: "Quantidade" },
];

const SYNC_FONTES = [
  { value: "receita_total", label: "Receita total (ano)" },
  { value: "receita_mes", label: "Receita do mês" },
  { value: "projetos_concluidos", label: "Projetos concluídos (ano)" },
  { value: "projetos_ativos", label: "Projetos ativos" },
  { value: "margem_media", label: "Margem média (%)" },
  { value: "leads_convertidos", label: "Leads convertidos (ano)" },
  { value: "horas_faturadas", label: "Horas faturadas (ano)" },
];

interface FormState {
  nome: string;
  descricao: string;
  pessoa_id: string;
  categoria: string;
  unidade: string;
  alvo: string;
  atual: string;
  prazo: string;
  auto_sync: boolean;
  sync_fonte: string;
}

function emptyForm(tipo: MetaTipo): FormState {
  return {
    nome: "",
    descricao: "",
    pessoa_id: "",
    categoria: tipo === "financeira" ? "receita" : "entregas",
    unidade: "currency",
    alvo: "",
    atual: "",
    prazo: "",
    auto_sync: false,
    sync_fonte: "",
  };
}

// Valor numérico do banco → string exibida no campo, respeitando a unidade.
function valorToInput(unidade: string, valor: number): string {
  if (unidade === "currency") return formatValorToInput(valor);
  return String(valor);
}

function parseValor(unidade: string, raw: string): number {
  if (unidade === "currency") return parseCurrencyString(raw);
  return Number(String(raw).replace(",", ".")) || 0;
}

function fromMeta(tipo: MetaTipo, meta: MetaRow): FormState {
  const unidade = tipo === "financeira" ? "currency" : meta.unidade || "quantity";
  return {
    nome: meta.nome,
    descricao: meta.descricao ?? "",
    pessoa_id: meta.pessoa_id ?? "",
    categoria: meta.categoria ?? (tipo === "financeira" ? "receita" : "entregas"),
    unidade,
    alvo: valorToInput(unidade, meta.alvo),
    atual: valorToInput(unidade, meta.atual),
    prazo: meta.prazo ?? "",
    auto_sync: meta.auto_sync ?? false,
    sync_fonte: meta.sync_fonte ?? "",
  };
}

export function MetaFormDialog({ open, onOpenChange, tipo, meta }: MetaFormDialogProps) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const isEdit = !!meta;
  const [form, setForm] = useState<FormState>(() => emptyForm(tipo));

  useEffect(() => {
    if (!open) return;
    setForm(meta ? fromMeta(tipo, meta) : emptyForm(tipo));
  }, [open, meta, tipo]);

  const { data: pessoas } = useQuery({
    queryKey: ["pessoas-list"],
    queryFn: fetchPessoasLookup,
    enabled: tipo === "pessoal",
  });

  const set = (field: keyof FormState, value: string | boolean): void => setForm((f) => ({ ...f, [field]: value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const unidade = tipo === "financeira" ? "currency" : form.unidade;
      const payload: Record<string, unknown> = {
        nome: form.nome,
        alvo: parseValor(unidade, form.alvo),
        atual: parseValor(unidade, form.atual),
        prazo: form.prazo || null,
        categoria: form.categoria,
        unidade,
        tipo,
      };
      if (tipo === "pessoal") {
        payload.pessoa_id = form.pessoa_id || null;
        payload.descricao = form.descricao || null;
      }
      if (tipo === "financeira") {
        payload.auto_sync = form.auto_sync;
        payload.sync_fonte = form.auto_sync ? form.sync_fonte || null : null;
      }

      if (isEdit && meta) {
        const { error } = await supabase
          .from("metas")
          .update(payload as never)
          .eq("id", meta.id);
        if (error) throw error;
      } else {
        // RLS de metas exige empresa_id = get_user_empresa_id() e a tabela não
        // tem trigger que preencha, então setamos aqui (padrão de useTarefaMutations).
        if (!profile?.empresa_id) throw new Error("Sem empresa no perfil.");
        payload.empresa_id = profile.empresa_id;
        const { error } = await supabase.from("metas").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      queryClient.invalidateQueries({ queryKey: ["metas-all"] });
      onOpenChange(false);
      toast.success(isEdit ? "Meta atualizada" : "Meta criada", {
        description: `Meta ${tipo === "financeira" ? "financeira" : "pessoal"} ${isEdit ? "atualizada" : "criada"} com sucesso.`,
      });
    },
    onError: (error) => {
      toast.error(isEdit ? "Erro ao atualizar meta" : "Erro ao criar meta", {
        description: error instanceof Error ? error.message : undefined,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const categorias = tipo === "financeira" ? CATEGORIAS_FINANCEIRA : CATEGORIAS_PESSOAL;
  const unidade = tipo === "financeira" ? "currency" : form.unidade;

  const tituloTipo = tipo === "financeira" ? "Financeira" : "Pessoal";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Editar meta ${tituloTipo.toLowerCase()}` : `Nova meta ${tituloTipo.toLowerCase()}`}
          </DialogTitle>
          <DialogDescription>
            {tipo === "financeira"
              ? "Estabeleça um objetivo de receita, lucro, economia ou investimento."
              : "Defina uma meta para um colaborador."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {tipo === "pessoal" && (
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={form.pessoa_id || undefined} onValueChange={(v) => set("pessoa_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {(pessoas ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Nome da meta</Label>
            <Input
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder={tipo === "financeira" ? "Ex: Faturamento 2026" : "Ex: Entregas no prazo"}
              required
            />
          </div>

          {tipo === "pessoal" && (
            <>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={form.descricao}
                  onChange={(e) => set("descricao", e.target.value)}
                  placeholder="Descreva o objetivo"
                />
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={form.unidade} onValueChange={(v) => set("unidade", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{unidade === "currency" ? "Valor alvo" : "Alvo"}</Label>
              <ValorInput unidade={unidade} value={form.alvo} onChange={(v) => set("alvo", v)} />
            </div>
            <div className="space-y-2">
              <Label>{unidade === "currency" ? "Valor atual" : "Atual"}</Label>
              <ValorInput unidade={unidade} value={form.atual} onChange={(v) => set("atual", v)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prazo</Label>
              <DatePicker value={form.prazo} onChange={(v) => set("prazo", v)} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => set("categoria", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {tipo === "financeira" && (
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="auto_sync"
                  checked={form.auto_sync}
                  onCheckedChange={(checked) => set("auto_sync", checked === true)}
                />
                <Label htmlFor="auto_sync" className="text-sm cursor-pointer font-normal">
                  Sincronizar automaticamente
                </Label>
              </div>
              {form.auto_sync && (
                <div className="space-y-1">
                  <Label className="text-xs">Fonte de dados</Label>
                  <Select value={form.sync_fonte || undefined} onValueChange={(v) => set("sync_fonte", v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {SYNC_FONTES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    O valor atual é atualizado ao clicar em "Atualizar" no painel.
                  </p>
                </div>
              )}
            </div>
          )}

          <Button type="submit" variant="brand" className="w-full rounded-full" loading={mutation.isPending}>
            {isEdit ? "Atualizar meta" : "Salvar meta"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ValorInputProps {
  unidade: string;
  value: string;
  onChange: (value: string) => void;
}

// Campo de valor: moeda (R$) para "currency", inteiro para "quantity",
// decimal para o resto (ex.: percentual). Usa os primitivos canônicos.
function ValorInput({ unidade, value, onChange }: ValorInputProps) {
  if (unidade === "currency") {
    return <MoneyInput value={value} onChange={onChange} required />;
  }
  return <NumberInput value={value} onChange={onChange} allowDecimal={unidade !== "quantity"} required />;
}
