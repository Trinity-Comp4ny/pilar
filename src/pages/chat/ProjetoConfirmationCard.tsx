import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Calendar, Check, ChevronDown, Coins, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatCurrencyInput, parseCurrencyString } from "@/lib/currencyUtils";
import { supabase } from "@/integrations/supabase/client";
import { useClientes } from "@/hooks/useClientes";
import { useAuth } from "@/contexts/AuthContext";
import { useTemplates } from "@/hooks/useTemplates";
import { useFluxosDisciplinas } from "@/hooks/useFluxosDisciplinas";
import { useBulkSaveDisciplinas } from "@/hooks/useProjetoDisciplinas";
import { DisciplinasSection } from "@/pages/projetos/components/DisciplinasSection";
import { DisciplinaDetailDialog } from "@/pages/projetos/components/DisciplinaDetailDialog";
import { useDisciplinasEditor } from "./useDisciplinasEditor";
import type { Draft, ProjetoCampos } from "./useChat";

type Props = {
  index: number;
  draft: Draft;
  onConfirmar: (
    runId: string,
    entidade: "projeto",
    campos: ProjetoCampos,
    onAfterCreate?: (entityId: string) => Promise<void>
  ) => Promise<string | undefined>;
  onCancelar: (runId: string) => Promise<void>;
  onDesfazer: (runId: string, entidade: "projeto", entityId: string) => Promise<void>;
};

const PRIORIDADES = ["Alta", "Media", "Baixa"];

export function ProjetoConfirmationCard({ index, draft, onConfirmar, onCancelar, onDesfazer }: Props) {
  const { clientes } = useClientes();
  const { user, profile } = useAuth();
  const { data: catalogoDisciplinas = [] } = useQuery({
    queryKey: ["disciplinas-catalogo-agente"],
    queryFn: async () => {
      const { data } = await supabase.from("disciplinas").select("id, nome").order("nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
  });
  const { data: pessoas = [] } = useQuery({
    queryKey: ["pessoas-agente"],
    queryFn: async () => {
      const { data } = await supabase.from("pessoas").select("id, nome").is("deleted_at", null).order("nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
  });
  const { data: templatesData = [] } = useTemplates();
  const fluxosData = useFluxosDisciplinas();
  const bulkSaveDisciplinas = useBulkSaveDisciplinas();
  const currentUser = useMemo(
    () =>
      profile
        ? {
            name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Usuário",
            email: user?.email ?? "",
          }
        : null,
    [profile, user]
  );
  const disc = useDisciplinasEditor({
    pessoas,
    templatesData,
    fluxosData: fluxosData.data ?? [],
    currentUser,
  });

  const campos = draft.campos as ProjetoCampos;
  const [form, setForm] = useState<ProjetoCampos>({ prioridade: "Media", ...campos });
  const [valorDisplay, setValorDisplay] = useState(
    campos.valor_contrato != null ? formatCurrency(campos.valor_contrato) : ""
  );
  const [salvando, setSalvando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);
  const [mostrarDisc, setMostrarDisc] = useState(false);

  // Pré-seleciona o cliente pela dica textual (cliente_nome) quando a lista carrega.
  useEffect(() => {
    if (form.cliente_id || !campos.cliente_nome || !clientes.length) return;
    const alvo = campos.cliente_nome.toLowerCase();
    const match = clientes.find(
      (c) => c.nome?.toLowerCase().includes(alvo) || alvo.includes((c.nome ?? "").toLowerCase())
    );
    if (match) setForm((prev) => ({ ...prev, cliente_id: match.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes]);

  const set = (key: keyof ProjetoCampos, value: string | number | undefined) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const criar = async () => {
    if (!form.nome?.trim()) {
      toast.error("Informe o nome do projeto");
      return;
    }
    setSalvando(true);
    try {
      // Após criar o projeto (RPC), grava as disciplinas relacionais pelo mesmo caminho da
      // plataforma. Se falhar, desfaz o projeto (soft-delete) para não deixar registro órfão.
      await onConfirmar(draft.runId, "projeto", form, async (projetoId) => {
        const disciplinas = disc.buildDiscsForBulk();
        if (disciplinas.length === 0) return;
        try {
          await bulkSaveDisciplinas.mutateAsync({ projetoId, disciplinas });
        } catch (e) {
          await supabase.from("projetos").update({ deleted_at: new Date().toISOString() }).eq("id", projetoId);
          throw e;
        }
      });
      toast.success("Projeto criado");
    } catch {
      toast.error("Não foi possível criar o projeto", { description: "Verifique suas permissões e tente de novo." });
    } finally {
      setSalvando(false);
    }
  };

  const cancelar = async () => {
    setSalvando(true);
    try {
      await onCancelar(draft.runId);
    } finally {
      setSalvando(false);
    }
  };

  const desfazer = async () => {
    if (!draft.entityId) return;
    setDesfazendo(true);
    try {
      await onDesfazer(draft.runId, "projeto", draft.entityId);
      toast.success("Projeto desfeito");
    } catch {
      toast.error("Não foi possível desfazer");
    } finally {
      setDesfazendo(false);
    }
  };

  // ── Estado: criado ──
  if (draft.status === "criado") {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-positive/30 bg-positive/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-positive/15 text-positive-strong">
            <Check className="h-3.5 w-3.5" />
          </span>
          Projeto criado
        </div>
        <p className="mt-1 pl-8 text-sm text-muted-foreground">{form.nome}</p>
        <div className="mt-3 flex items-center gap-2 pl-8">
          <NavLink
            to="/projetos"
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            Ver em Projetos
            <ArrowUpRight className="h-3.5 w-3.5" />
          </NavLink>
          <Button
            variant="ghost"
            size="sm"
            onClick={desfazer}
            disabled={desfazendo}
            className="h-auto gap-1 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {desfazendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Desfazer
          </Button>
        </div>
      </div>
    );
  }

  // ── Estado: cancelado ──
  if (draft.status === "cancelado") {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        Rascunho de projeto descartado.
      </div>
    );
  }

  // ── Estado: pendente (editável, paridade com os passos 1-2 do wizard) ──
  const p = `proj-${index}`;
  return (
    <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-elegant">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-ink">
          <Calendar className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium leading-none text-foreground">Novo projeto</p>
          <p className="mt-1 text-xs text-muted-foreground">Revise e edite antes de criar</p>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${p}-codigo`} className="text-xs text-muted-foreground">
              Código
            </Label>
            <Input
              id={`${p}-codigo`}
              value={form.codigo_projeto ?? ""}
              placeholder="gerado automaticamente"
              onChange={(e) => set("codigo_projeto", e.target.value)}
              disabled={salvando}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${p}-cliente`} className="text-xs text-muted-foreground">
              Cliente
            </Label>
            <Select value={form.cliente_id ?? ""} onValueChange={(v) => set("cliente_id", v)}>
              <SelectTrigger id={`${p}-cliente`} className="h-9">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${p}-nome`} className="text-xs text-muted-foreground">
              Nome <span className="text-negative-strong">*</span>
            </Label>
            <Input
              id={`${p}-nome`}
              value={form.nome ?? ""}
              placeholder="Nome do projeto"
              onChange={(e) => set("nome", e.target.value)}
              disabled={salvando}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${p}-prioridade`} className="text-xs text-muted-foreground">
              Prioridade
            </Label>
            <Select value={form.prioridade ?? "Media"} onValueChange={(v) => set("prioridade", v)}>
              <SelectTrigger id={`${p}-prioridade`} className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORIDADES.map((pr) => (
                  <SelectItem key={pr} value={pr}>
                    {pr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`${p}-local`} className="text-xs text-muted-foreground">
              Localização
            </Label>
            <Input
              id={`${p}-local`}
              value={form.localizacao ?? ""}
              placeholder="Cidade / endereço da obra"
              onChange={(e) => set("localizacao", e.target.value)}
              disabled={salvando}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${p}-valor`} className="text-xs text-muted-foreground">
              Valor do contrato
            </Label>
            <Input
              id={`${p}-valor`}
              value={valorDisplay}
              inputMode="numeric"
              placeholder="R$ 0,00"
              onChange={(e) => {
                const masked = e.target.value ? formatCurrencyInput(e.target.value) : "";
                setValorDisplay(masked);
                set("valor_contrato", masked ? parseCurrencyString(masked) : undefined);
              }}
              disabled={salvando}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${p}-parcelas`} className="text-xs text-muted-foreground">
              Parcelas
            </Label>
            <Input
              id={`${p}-parcelas`}
              type="number"
              min={1}
              value={form.parcelas ?? ""}
              placeholder="1"
              onChange={(e) => set("parcelas", e.target.value)}
              disabled={salvando}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${p}-area`} className="text-xs text-muted-foreground">
              Área (m²)
            </Label>
            <Input
              id={`${p}-area`}
              type="number"
              min={0}
              step="0.01"
              value={form.area_m2 ?? ""}
              placeholder="0"
              onChange={(e) => set("area_m2", e.target.value === "" ? undefined : Number(e.target.value))}
              disabled={salvando}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${p}-inicio`} className="text-xs text-muted-foreground">
              Início
            </Label>
            <DatePicker id={`${p}-inicio`} value={form.data_inicio ?? ""} onChange={(v) => set("data_inicio", v)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${p}-previsao`} className="text-xs text-muted-foreground">
              Previsão
            </Label>
            <DatePicker
              id={`${p}-previsao`}
              value={form.data_previsao ?? ""}
              onChange={(v) => set("data_previsao", v)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${p}-final`} className="text-xs text-muted-foreground">
              Final
            </Label>
            <DatePicker id={`${p}-final`} value={form.data_final ?? ""} onChange={(v) => set("data_final", v)} />
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          <Label htmlFor={`${p}-obs`} className="text-xs text-muted-foreground">
            Observação
          </Label>
          <Textarea
            id={`${p}-obs`}
            value={form.observacao ?? ""}
            rows={2}
            placeholder="Observações sobre o projeto…"
            onChange={(e) => set("observacao", e.target.value)}
            disabled={salvando}
          />
        </div>

        {/* Disciplinas (paridade com o passo 3 do wizard) — recolhível para reduzir carga cognitiva */}
        <div className="mt-4 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setMostrarDisc((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            <span>
              Disciplinas{disc.projetosDisciplinas.length > 0 ? ` (${disc.projetosDisciplinas.length})` : " (opcional)"}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${mostrarDisc ? "rotate-180" : ""}`} />
          </button>

          {mostrarDisc && (
            <div className="mt-3">
              {templatesData.length > 0 && disc.projetosDisciplinas.length === 0 && (
                <div className="mb-3 space-y-1.5 rounded-lg border border-dashed border-border bg-muted/40 p-3">
                  <Label className="text-xs text-muted-foreground">Criar a partir de template</Label>
                  <Select onValueChange={disc.applyTemplate}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione um template (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {templatesData.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nome} ({t.tipo_servico})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <DisciplinasSection
                disciplinas={catalogoDisciplinas}
                pessoas={pessoas}
                fluxosData={fluxosData.data ?? []}
                onApplyFluxo={disc.applyFluxo}
                projetosDisciplinas={disc.projetosDisciplinas}
                tempDisciplina={disc.tempDisciplina}
                onTempDisciplinaChange={disc.setTempDisciplina}
                onAddDisciplina={disc.addProjetoDisciplina}
                onRemoveDisciplina={disc.removeProjetoDisciplina}
                onOpenDetail={disc.handleOpenDisciplinaDetail}
                addingRespToFormDisc={disc.addingRespToFormDisc}
                onSetAddingResp={disc.setAddingRespToFormDisc}
                newFormResp={disc.newFormResp}
                onNewFormRespChange={disc.setNewFormResp}
                onAddResponsavel={disc.addResponsavelToDisc}
                onRemoveResponsavel={disc.removeResponsavelFromDisc}
                onUpdateRespDatas={disc.updateRespDatasInForm}
                projetoDataInicio={form.data_inicio || undefined}
                projetoDataPrevisao={form.data_previsao || undefined}
                projetoDataFinal={form.data_final || undefined}
              />
            </div>
          )}
        </div>
      </div>

      <DisciplinaDetailDialog
        open={disc.isDisciplinaDetailOpen}
        onOpenChange={disc.setIsDisciplinaDetailOpen}
        disciplina={disc.selectedDisciplina}
        disciplinas={catalogoDisciplinas}
        pessoas={pessoas}
        onUpdateField={disc.updateDisciplinaField}
        onUpdateResponsavel={disc.updateDisciplinaResponsavel}
        newObservation={disc.newObservation}
        onNewObservationChange={disc.setNewObservation}
        onAddObservation={disc.handleAddObservation}
      />

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Coins className="h-3.5 w-3.5" />
          Criar debita {draft.custoCreditos} crédito{draft.custoCreditos === 1 ? "" : "s"} de IA
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={cancelar} disabled={salvando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={criar} disabled={salvando} variant="brand" className="gap-1.5">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Criar projeto
          </Button>
        </div>
      </div>
    </div>
  );
}
