import { useEffect, useMemo, useState } from "react";
import { FormDialog } from "@/components/FormDialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchPessoasLookup } from "@/lib/supabaseQueries";
import { formatValorToInput, parseCurrencyString } from "@/lib/currencyUtils";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { NumberInput } from "@/components/forms/NumberInput";
import { METAS_PROGRESSO_KEY } from "@/hooks/useMetas";
import {
  AREAS,
  GRUPOS_INDICADOR,
  INDICADORES,
  INDICADOR_POR_CHAVE,
  RECORRENCIAS,
  UNIDADES,
  atalhosDePeriodo,
  sugerirNomeMeta,
  type MetaIndicador,
  type MetaRecorrencia,
  type MetaRow,
  type MetaUnidade,
} from "@/lib/metas";

interface MetaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preenchido = modo edição; ausente = criar. */
  meta?: MetaRow | null;
}

// Radix Select não aceita value "": estes valores representam "nenhum".
const EMPRESA = "empresa";
const MANUAL = "manual";
const SEM_AREA = "sem_area";

interface FormState {
  pessoa_id: string;
  indicador: MetaIndicador | typeof MANUAL;
  /** Só vale para meta manual: o indicador define a unidade das demais. */
  unidade: MetaUnidade;
  unidade_rotulo: string;
  alvo: string;
  atual: string;
  recorrencia: MetaRecorrencia;
  periodo_inicio: string;
  prazo: string;
  nome: string;
  /** Falso enquanto o nome é o sugerido; vira verdadeiro quando a pessoa escreve o dela. */
  nomeEditado: boolean;
  categoria: string;
  descricao: string;
}

function emptyForm(): FormState {
  return {
    pessoa_id: "",
    indicador: MANUAL,
    unidade: "quantity",
    unidade_rotulo: "",
    alvo: "",
    atual: "",
    recorrencia: "nenhuma",
    periodo_inicio: "",
    prazo: "",
    nome: "",
    nomeEditado: false,
    categoria: "",
    descricao: "",
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

function fromMeta(meta: MetaRow): FormState {
  const def = meta.indicador ? INDICADOR_POR_CHAVE[meta.indicador] : undefined;
  const unidade = (def?.unidade ?? meta.unidade ?? "quantity") as MetaUnidade;
  return {
    pessoa_id: meta.pessoa_id ?? "",
    indicador: def ? def.key : MANUAL,
    unidade,
    unidade_rotulo: meta.unidade_rotulo ?? "",
    alvo: valorToInput(unidade, meta.alvo),
    atual: valorToInput(unidade, meta.atual),
    recorrencia: (meta.recorrencia as MetaRecorrencia) ?? "nenhuma",
    periodo_inicio: meta.periodo_inicio ?? "",
    prazo: meta.prazo ?? "",
    nome: meta.nome,
    nomeEditado: true,
    categoria: meta.categoria ?? "",
    descricao: meta.descricao ?? "",
  };
}

const unidadeDe = (f: FormState): MetaUnidade =>
  f.indicador === MANUAL ? f.unidade : INDICADOR_POR_CHAVE[f.indicador].unidade;

export function MetaFormDialog({ open, onOpenChange, meta }: MetaFormDialogProps) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const isEdit = !!meta;
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (!open) return;
    setForm(meta ? fromMeta(meta) : emptyForm());
  }, [open, meta]);

  const { data: pessoas } = useQuery({
    queryKey: ["pessoas-list"],
    queryFn: fetchPessoasLookup,
    enabled: open,
  });

  const def = form.indicador === MANUAL ? undefined : INDICADOR_POR_CHAVE[form.indicador];
  const unidade = unidadeDe(form);
  const alvoNum = parseValor(unidade, form.alvo);
  const pessoaNome = pessoas?.find((p) => p.id === form.pessoa_id)?.nome ?? null;
  const comPeriodo = !def?.pontual;
  const datasEspecificas = form.recorrencia === "nenhuma";

  const nomeSugerido = useMemo(
    () =>
      sugerirNomeMeta({
        indicador: def?.key ?? null,
        alvo: alvoNum,
        recorrencia: form.recorrencia,
        inicio: form.periodo_inicio || null,
        fim: form.prazo || null,
        pessoaNome,
      }),
    [def?.key, alvoNum, form.recorrencia, form.periodo_inicio, form.prazo, pessoaNome]
  );
  const nome = form.nomeEditado ? form.nome : nomeSugerido;

  const set = <K extends keyof FormState>(field: K, value: FormState[K]): void =>
    setForm((f) => ({ ...f, [field]: value }));

  const setPessoa = (v: string): void =>
    setForm((f) => {
      const pessoa_id = v === EMPRESA ? "" : v;
      const atual = f.indicador === MANUAL ? undefined : INDICADOR_POR_CHAVE[f.indicador];
      // Indicador que não vale por pessoa volta para o acompanhamento manual.
      if (pessoa_id && atual && !atual.aceitaPessoa) {
        return { ...f, pessoa_id, indicador: MANUAL, recorrencia: "nenhuma", alvo: "", atual: "" };
      }
      return { ...f, pessoa_id };
    });

  const setIndicador = (v: string): void =>
    setForm((f) => {
      if (v === MANUAL) return { ...f, indicador: MANUAL, recorrencia: "nenhuma", alvo: "", atual: "" };
      const novo = INDICADOR_POR_CHAVE[v];
      const mudouUnidade = unidadeDe(f) !== novo.unidade;
      const next: FormState = { ...f, indicador: novo.key, alvo: mudouUnidade ? "" : f.alvo };
      if (novo.pontual) return { ...next, recorrencia: "nenhuma", periodo_inicio: "", prazo: "" };
      // Sem período escolhido ainda: começa no ano corrente, já válido.
      if (next.recorrencia === "nenhuma" && !next.periodo_inicio && !next.prazo) {
        const ano = atalhosDePeriodo(new Date()).find((a) => a.label === "Este ano");
        return { ...next, periodo_inicio: ano?.inicio ?? "", prazo: ano?.fim ?? "" };
      }
      return next;
    });

  const setRecorrencia = (v: MetaRecorrencia): void =>
    setForm((f) => ({
      ...f,
      recorrencia: v,
      periodo_inicio: v === "nenhuma" ? f.periodo_inicio : "",
      prazo: v === "nenhuma" ? f.prazo : "",
    }));

  const datasFora = !!form.periodo_inicio && !!form.prazo && form.periodo_inicio > form.prazo;
  const periodoIncompleto = !!def && comPeriodo && datasEspecificas && (!form.periodo_inicio || !form.prazo);
  const submitDisabled = !nome.trim() || !(alvoNum > 0) || datasFora || periodoIncompleto;

  const mutation = useMutation({
    mutationFn: async () => {
      const auto = !!def;
      const guardaDatas = comPeriodo && datasEspecificas;
      const payload: Record<string, unknown> = {
        nome: nome.trim(),
        descricao: form.descricao.trim() || null,
        alvo: alvoNum,
        // Meta com indicador tem o atual calculado no banco; o gravado fica de reserva.
        atual: auto ? (meta?.atual ?? 0) : parseValor(unidade, form.atual),
        unidade,
        unidade_rotulo: !auto && unidade === "quantity" ? form.unidade_rotulo.trim() || null : null,
        indicador: def?.key ?? null,
        pessoa_id: form.pessoa_id || null,
        recorrencia: auto && comPeriodo ? form.recorrencia : "nenhuma",
        periodo_inicio: guardaDatas ? form.periodo_inicio || null : null,
        prazo: guardaDatas ? form.prazo || null : null,
        categoria: form.categoria || null,
        auto_sync: auto,
        sync_fonte: null,
      };

      if (isEdit && meta) {
        const { error } = await supabase
          .from("metas")
          .update(payload as never)
          .eq("id", meta.id);
        if (error) throw error;
        return;
      }
      // RLS de metas exige empresa_id = get_user_empresa_id() e a tabela não
      // tem trigger que preencha, então setamos aqui (padrão de useTarefaMutations).
      if (!profile?.empresa_id) throw new Error("Sem empresa no perfil.");
      payload.empresa_id = profile.empresa_id;
      const { error } = await supabase.from("metas").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      queryClient.invalidateQueries({ queryKey: ["metas-all"] });
      queryClient.invalidateQueries({ queryKey: METAS_PROGRESSO_KEY });
      queryClient.invalidateQueries({ queryKey: ["metas-historico"] });
      onOpenChange(false);
      toast.success(isEdit ? "Meta atualizada" : "Meta criada");
    },
    onError: (error) => {
      toast.error(isEdit ? "Não foi possível atualizar a meta" : "Não foi possível criar a meta", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    },
  });

  const atalhos = useMemo(() => atalhosDePeriodo(new Date()), []);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar meta" : "Nova meta"}
      description="Escolha o que medir, para quem e em que período."
      size="md"
      onSubmit={() => mutation.mutate()}
      isPending={mutation.isPending}
      submitDisabled={submitDisabled}
      submitLabel={isEdit ? "Atualizar meta" : "Salvar meta"}
    >
      <div className="space-y-2">
        <Label>Para quem</Label>
        <Select value={form.pessoa_id || EMPRESA} onValueChange={setPessoa}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPRESA}>Empresa toda</SelectItem>
            {(pessoas ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>O que medir</Label>
        <Select value={form.indicador} onValueChange={setIndicador}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={MANUAL}>Acompanhar manualmente</SelectItem>
            {GRUPOS_INDICADOR.map((grupo) => (
              <SelectGroup key={grupo}>
                <SelectLabel>{grupo}</SelectLabel>
                {INDICADORES.filter((i) => i.grupo === grupo).map((i) => {
                  const bloqueado = !!form.pessoa_id && !i.aceitaPessoa;
                  return (
                    <SelectItem key={i.key} value={i.key} disabled={bloqueado}>
                      {i.label}
                      {bloqueado ? " (só da empresa toda)" : ""}
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {def
            ? "O valor atual é calculado sozinho a partir dos dados do Pilar."
            : "Você atualiza o valor atual na mão."}
        </p>
      </div>

      {!def && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Unidade</Label>
            <Select
              value={form.unidade}
              onValueChange={(v) => setForm((f) => ({ ...f, unidade: v as MetaUnidade, alvo: "", atual: "" }))}
            >
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
          {form.unidade === "quantity" && (
            <div className="space-y-2">
              <Label>Nome da unidade (opcional)</Label>
              <Input
                value={form.unidade_rotulo}
                onChange={(e) => set("unidade_rotulo", e.target.value)}
                placeholder="Ex.: relatórios"
                maxLength={40}
              />
            </div>
          )}
        </div>
      )}

      <div className={def ? "space-y-2" : "grid grid-cols-2 gap-4"}>
        <div className="space-y-2">
          <Label>{unidade === "currency" ? "Valor alvo" : "Alvo"}</Label>
          <ValorInput unidade={unidade} value={form.alvo} onChange={(v) => set("alvo", v)} />
        </div>
        {!def && (
          <div className="space-y-2">
            <Label>{unidade === "currency" ? "Valor atual" : "Atual"}</Label>
            <ValorInput unidade={unidade} value={form.atual} onChange={(v) => set("atual", v)} />
          </div>
        )}
      </div>

      {def && comPeriodo && (
        <div className="space-y-2">
          <Label>Período</Label>
          <Select value={form.recorrencia} onValueChange={(v) => setRecorrencia(v as MetaRecorrencia)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECORRENCIAS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!datasEspecificas && (
            <p className="text-xs text-muted-foreground">
              O alvo vale para cada período. O painel mostra o período atual e o histórico.
            </p>
          )}
        </div>
      )}

      {def?.pontual && (
        <p className="text-xs text-muted-foreground">Retrato de hoje: esse indicador não depende de período.</p>
      )}

      {comPeriodo && datasEspecificas && (
        <div className="space-y-2">
          {def && (
            <div className="flex flex-wrap gap-2">
              {atalhos.map((a) => (
                <Button
                  key={a.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, periodo_inicio: a.inicio, prazo: a.fim }))}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{def ? "Início" : "Início (opcional)"}</Label>
              <DatePicker value={form.periodo_inicio} onChange={(v) => set("periodo_inicio", v)} />
            </div>
            <div className="space-y-2">
              <Label>{def ? "Fim" : "Prazo (opcional)"}</Label>
              <DatePicker value={form.prazo} onChange={(v) => set("prazo", v)} />
            </div>
          </div>
          {datasFora && <p className="text-xs text-danger-strong">O início precisa ser antes do fim.</p>}
        </div>
      )}

      <div className="space-y-2">
        <Label>Nome da meta</Label>
        <Input
          value={nome}
          onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value, nomeEditado: e.target.value !== "" }))}
          placeholder="Ex.: Organizar a segurança social dos trabalhadores"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Área (opcional)</Label>
          <Select value={form.categoria || SEM_AREA} onValueChange={(v) => set("categoria", v === SEM_AREA ? "" : v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_AREA}>Sem área</SelectItem>
              {AREAS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Descrição (opcional)</Label>
          <Input
            value={form.descricao}
            onChange={(e) => set("descricao", e.target.value)}
            placeholder="Descreva o objetivo"
          />
        </div>
      </div>
    </FormDialog>
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
