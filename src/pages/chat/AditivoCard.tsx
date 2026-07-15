import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Check, Coins, Layers, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currencyUtils";
import { msgErro } from "./erros";
import type { AditivoItem, Draft, DraftCampos, Entidade } from "./useChat";

type Props = {
  index: number;
  draft: Draft;
  onConfirmar: (index: number, runId: string, entidade: Entidade, campos: DraftCampos) => Promise<string | undefined>;
  onCancelar: (index: number, runId: string) => Promise<void>;
  onDesfazer: (index: number, runId: string, entidade: Entidade, entityId: string) => Promise<void>;
};

export function AditivoCard({ index, draft, onConfirmar, onCancelar, onDesfazer }: Props) {
  const campos = draft.campos as { projeto_id?: string; projeto_nome?: string; descricao?: string; justificativa?: string; itens?: AditivoItem[] };
  const [projetoId, setProjetoId] = useState(campos.projeto_id ?? "");
  const [descricao, setDescricao] = useState(campos.descricao ?? "");
  const [justificativa, setJustificativa] = useState(campos.justificativa ?? "");
  const [itens, setItens] = useState<AditivoItem[]>(campos.itens?.length ? campos.itens : [{ descricao: "" }]);
  const [salvando, setSalvando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);

  const projetos = useQuery({
    queryKey: ["aditivo-projetos"],
    enabled: draft.status === "pendente",
    queryFn: async () => {
      const { data } = await supabase.from("projetos").select("id, nome, codigo_projeto").is("deleted_at", null).order("nome");
      return ((data ?? []) as { id: string; nome: string; codigo_projeto: string | null }[]).map((p) => ({
        id: p.id,
        nome: p.codigo_projeto ? `${p.codigo_projeto} — ${p.nome}` : p.nome,
      }));
    },
  });

  useEffect(() => {
    if (projetoId || !projetos.data || !campos.projeto_nome) return;
    const alvo = campos.projeto_nome.toLowerCase();
    const m = projetos.data.find((p) => p.nome.toLowerCase().includes(alvo) || alvo.includes(p.nome.toLowerCase()));
    if (m) setProjetoId(m.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetos.data]);

  const custoTotal = useMemo(() => itens.reduce((s, i) => s + (Number(i.custo) || 0), 0), [itens]);
  const valorAditivo = Math.round(custoTotal * 1.3 * 100) / 100;

  const setItem = (i: number, key: keyof AditivoItem, value: string) =>
    setItens((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: key === "descricao" || key === "disciplina" ? value : value === "" ? undefined : Number(value) } : it)));

  const criar = async () => {
    if (!projetoId) return toast.error("Selecione o projeto");
    if (!descricao.trim()) return toast.error("Descreva o aditivo");
    const itensValidos = itens.filter((i) => i.descricao?.trim());
    setSalvando(true);
    try {
      await onConfirmar(index, draft.runId, "aditivo", { projeto_id: projetoId, descricao, justificativa, itens: itensValidos });
      toast.success("Aditivo criado (rascunho)");
    } catch (e) {
      toast.error("Não foi possível criar o aditivo", { description: msgErro(e) });
    } finally {
      setSalvando(false);
    }
  };

  const cancelar = async () => {
    setSalvando(true);
    try {
      await onCancelar(index, draft.runId);
    } finally {
      setSalvando(false);
    }
  };

  const desfazer = async () => {
    if (!draft.entityId) return;
    setDesfazendo(true);
    try {
      await onDesfazer(index, draft.runId, "aditivo", draft.entityId);
      toast.success("Aditivo desfeito");
    } catch {
      toast.error("Não foi possível desfazer");
    } finally {
      setDesfazendo(false);
    }
  };

  if (draft.status === "criado") {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-positive/30 bg-positive/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-positive/15 text-positive-strong">
            <Check className="h-3.5 w-3.5" />
          </span>
          Aditivo criado como rascunho ({formatCurrency(valorAditivo)})
        </div>
        <p className="mt-1 pl-8 text-xs text-muted-foreground">Aprove na tela do projeto para entrar no contrato.</p>
        <div className="mt-3 flex items-center gap-2 pl-8">
          <NavLink to="/projetos" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted">
            Ver projeto <ArrowUpRight className="h-3.5 w-3.5" />
          </NavLink>
          <Button variant="ghost" size="sm" onClick={desfazer} disabled={desfazendo} className="h-auto gap-1 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            {desfazendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Desfazer
          </Button>
        </div>
      </div>
    );
  }
  if (draft.status === "cancelado") {
    return <div className="w-full max-w-lg rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Rascunho de aditivo descartado.</div>;
  }

  return (
    <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-elegant">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-ink"><Layers className="h-4 w-4" /></span>
        <div>
          <p className="text-sm font-medium leading-none text-foreground">Novo aditivo</p>
          <p className="mt-1 text-xs text-muted-foreground">Cria como rascunho; aprovação é na tela do projeto</p>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="space-y-1.5">
          <Label htmlFor={`aditivo-${index}-projeto`} className="text-xs text-muted-foreground">
            Projeto <span className="text-negative-strong">*</span>
          </Label>
          <Select value={projetoId} onValueChange={setProjetoId}>
            <SelectTrigger id={`aditivo-${index}-projeto`} className="h-9"><SelectValue placeholder={projetos.isLoading ? "Carregando…" : "Selecione…"} /></SelectTrigger>
            <SelectContent>
              {(projetos.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`aditivo-${index}-desc`} className="text-xs text-muted-foreground">
            Descrição <span className="text-negative-strong">*</span>
          </Label>
          <Input id={`aditivo-${index}-desc`} value={descricao} onChange={(e) => setDescricao(e.target.value)} disabled={salvando} className="h-9" placeholder="Resumo do aditivo" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`aditivo-${index}-just`} className="text-xs text-muted-foreground">Justificativa</Label>
          <Textarea id={`aditivo-${index}-just`} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={2} disabled={salvando} placeholder="Por que o escopo aumentou" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Itens</Label>
          {itens.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
              <Input value={it.descricao ?? ""} onChange={(e) => setItem(i, "descricao", e.target.value)} placeholder="Descrição" aria-label={`Item ${i + 1} descrição`} disabled={salvando} className="h-9" />
              <Input value={it.disciplina ?? ""} onChange={(e) => setItem(i, "disciplina", e.target.value)} placeholder="Disciplina" aria-label={`Item ${i + 1} disciplina`} disabled={salvando} className="h-9 w-28" />
              <Input type="number" value={it.custo ?? ""} onChange={(e) => setItem(i, "custo", e.target.value)} placeholder="Custo" aria-label={`Item ${i + 1} custo`} disabled={salvando} className="h-9 w-24" />
              <button type="button" onClick={() => setItens((p) => p.filter((_, idx) => idx !== i))} disabled={salvando} aria-label={`Remover item ${i + 1}`} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-negative-strong">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setItens((p) => [...p, { descricao: "" }])} disabled={salvando} className="h-auto gap-1 px-0 text-xs text-muted-foreground hover:text-foreground">
            <Plus className="h-3.5 w-3.5" /> Adicionar item
          </Button>
        </div>

        <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Custo dos itens: {formatCurrency(custoTotal)} · valor do aditivo (margem 30%): <span className="font-medium text-foreground">{formatCurrency(valorAditivo)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Coins className="h-3.5 w-3.5" /> Criar debita {draft.custoCreditos} crédito{draft.custoCreditos === 1 ? "" : "s"} de IA
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={cancelar} disabled={salvando}>Cancelar</Button>
          <Button size="sm" onClick={criar} disabled={salvando} className="gap-1.5 bg-brand text-ink hover:bg-brand/90">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Criar aditivo
          </Button>
        </div>
      </div>
    </div>
  );
}
