import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Building2,
  Check,
  Coins,
  FileText,
  Flag,
  Landmark,
  Layers,
  LayoutGrid,
  Loader2,
  RotateCcw,
  Tag,
  Truck,
  User,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatCNPJ, formatCPF, formatDocument, formatPhone } from "@/lib/maskUtils";
import { formatCurrency, formatCurrencyInput, parseCurrencyString } from "@/lib/currencyUtils";
import { msgErro } from "./erros";
import type { Draft, DraftCampos, Entidade } from "./useChat";

type FieldType =
  | "text" | "textarea" | "number" | "currency" | "phone" | "cpf" | "cnpj" | "cpfcnpj" | "date" | "select" | "selectSource";
type SourceKey = "clientes" | "leads" | "projetos";

type Field = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  source?: SourceKey;
  hintKey?: string; // campo *_nome que a extração devolve, para pré-selecionar
  full?: boolean;
};

type EntConfig = { titulo: string; icon: LucideIcon; verbo: string; link: string; fields: Field[] };

const CONFIG: Partial<Record<Entidade, EntConfig>> = {
  cliente: {
    titulo: "Novo cliente", icon: Building2, verbo: "Criar cliente", link: "/clientes",
    fields: [
      { key: "nome", label: "Nome", type: "text", required: true },
      { key: "sobrenome", label: "Sobrenome", type: "text" },
      { key: "cpf_cnpj", label: "CPF/CNPJ", type: "cpfcnpj" },
      { key: "email", label: "E-mail", type: "text" },
      { key: "contato", label: "Contato", type: "phone" },
      { key: "tipo_nf", label: "Tipo NF", type: "select", options: ["servico", "produto", "misto"] },
      { key: "origem", label: "Origem", type: "text" },
      { key: "endereco", label: "Endereço", type: "text", full: true },
    ],
  },
  fornecedor: {
    titulo: "Novo fornecedor", icon: Truck, verbo: "Criar fornecedor", link: "/fornecedores",
    fields: [
      { key: "nome", label: "Nome", type: "text", required: true },
      { key: "cnpj", label: "CNPJ", type: "cnpj" },
      { key: "contato", label: "Contato", type: "phone" },
      { key: "telefone", label: "Telefone", type: "phone" },
      { key: "email", label: "E-mail", type: "text" },
    ],
  },
  categoria: {
    titulo: "Nova categoria", icon: Tag, verbo: "Criar categoria", link: "/financeiro",
    fields: [
      { key: "nome", label: "Nome", type: "text", required: true },
      { key: "tipo", label: "Tipo", type: "select", options: ["Receita", "Despesa"], required: true },
    ],
  },
  conta: {
    titulo: "Nova conta bancária", icon: Landmark, verbo: "Cadastrar conta", link: "/financeiro",
    fields: [
      { key: "nome", label: "Nome", type: "text", required: true },
      { key: "banco", label: "Banco", type: "text", required: true },
      { key: "saldo_inicial", label: "Saldo inicial", type: "currency" },
      { key: "chave_pix", label: "Chave PIX", type: "text" },
    ],
  },
  centro_custo: {
    titulo: "Novo centro de custo", icon: LayoutGrid, verbo: "Criar centro de custo", link: "/financeiro",
    fields: [
      { key: "nome", label: "Nome", type: "text", required: true },
      { key: "codigo", label: "Código", type: "text" },
      { key: "descricao", label: "Descrição", type: "textarea", full: true },
    ],
  },
  pessoa: {
    titulo: "Nova pessoa", icon: User, verbo: "Cadastrar pessoa", link: "/equipe",
    fields: [
      { key: "primeiro_nome", label: "Primeiro nome", type: "text", required: true },
      { key: "sobrenome", label: "Sobrenome", type: "text", required: true },
      { key: "email", label: "E-mail", type: "text", required: true },
      { key: "cargo", label: "Cargo", type: "text" },
      { key: "cpf", label: "CPF", type: "cpf" },
      { key: "telefone", label: "Telefone", type: "phone" },
      { key: "tipo_contrato", label: "Contrato", type: "select", options: ["PJ", "CLT", "estagio", "freelancer"] },
      { key: "salario_fixo", label: "Salário fixo", type: "currency" },
      { key: "valor_m2", label: "Valor por m²", type: "currency" },
    ],
  },
  proposta: {
    titulo: "Nova proposta", icon: FileText, verbo: "Criar proposta", link: "/documentos",
    fields: [
      { key: "titulo", label: "Título", type: "text", required: true, full: true },
      { key: "cliente_id", label: "Cliente", type: "selectSource", source: "clientes", hintKey: "cliente_nome" },
      { key: "lead_id", label: "Lead", type: "selectSource", source: "leads", hintKey: "lead_nome" },
      { key: "valor_proposto", label: "Valor", type: "currency" },
      { key: "area_m2", label: "Área (m²)", type: "number" },
      { key: "localizacao", label: "Localização", type: "text" },
      { key: "prazo_estimado_dias", label: "Prazo (dias)", type: "number" },
      { key: "validade", label: "Validade", type: "date" },
      { key: "observacao", label: "Observação", type: "textarea", full: true },
    ],
  },
  marco: {
    titulo: "Novo marco de faturamento", icon: Flag, verbo: "Criar marco", link: "/financeiro",
    fields: [
      { key: "projeto_id", label: "Projeto", type: "selectSource", source: "projetos", hintKey: "projeto_nome", required: true },
      { key: "nome", label: "Nome", type: "text", required: true },
      { key: "valor", label: "Valor", type: "currency", required: true },
      { key: "disciplina", label: "Disciplina", type: "text" },
      { key: "percentual", label: "Percentual", type: "number" },
      { key: "data_prevista", label: "Data prevista", type: "date" },
    ],
  },
  disciplina: {
    titulo: "Nova disciplina", icon: Layers, verbo: "Adicionar disciplina", link: "/projetos",
    fields: [
      { key: "projeto_id", label: "Projeto", type: "selectSource", source: "projetos", hintKey: "projeto_nome", required: true },
      { key: "nome", label: "Disciplina", type: "text", required: true },
      { key: "prioridade", label: "Prioridade", type: "select", options: ["Alta", "Media", "Baixa"] },
      { key: "horas_estimadas", label: "Horas estimadas", type: "number" },
      { key: "custo_hora", label: "Custo/hora", type: "currency" },
      { key: "data_inicio", label: "Início", type: "date" },
      { key: "data_fim", label: "Fim", type: "date" },
    ],
  },
};

type Props = {
  index: number;
  draft: Draft;
  entidade: Entidade;
  onConfirmar: (runId: string, entidade: Entidade, campos: DraftCampos) => Promise<string | undefined>;
  onCancelar: (runId: string) => Promise<void>;
  onDesfazer: (runId: string, entidade: Entidade, entityId: string) => Promise<void>;
};

type FormState = Record<string, string | number | undefined>;

export function SimpleEntityCard({ index, draft, entidade, onConfirmar, onCancelar, onDesfazer }: Props) {
  const cfg = CONFIG[entidade];
  const campos = draft.campos as Record<string, unknown>;
  const [form, setForm] = useState<FormState>(() => ({ ...(campos as FormState) }));
  const [display, setDisplay] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);

  const sources = useMemo(
    () => new Set((cfg?.fields ?? []).filter((f) => f.type === "selectSource").map((f) => f.source!)),
    [cfg]
  );

  const listas = useQuery({
    queryKey: ["simple-entity-sources", [...sources].sort().join(",")],
    enabled: sources.size > 0 && draft.status === "pendente",
    queryFn: async () => {
      const out: Record<string, { id: string; nome: string }[]> = {};
      if (sources.has("clientes")) {
        const { data } = await supabase.from("clientes").select("id, nome").is("deleted_at", null).order("nome");
        out.clientes = (data ?? []) as { id: string; nome: string }[];
      }
      if (sources.has("leads")) {
        const { data } = await supabase.from("leads").select("id, nome").is("deleted_at", null).order("nome");
        out.leads = (data ?? []) as { id: string; nome: string }[];
      }
      if (sources.has("projetos")) {
        const { data } = await supabase
          .from("projetos")
          .select("id, nome, codigo_projeto")
          .is("deleted_at", null)
          .order("nome");
        out.projetos = ((data ?? []) as { id: string; nome: string; codigo_projeto: string | null }[]).map((p) => ({
          id: p.id,
          nome: p.codigo_projeto ? `${p.codigo_projeto} — ${p.nome}` : p.nome,
        }));
      }
      return out;
    },
  });

  // Inicializa displays de moeda e resolve dicas *_nome -> *_id quando as listas chegam.
  useEffect(() => {
    const d: Record<string, string> = {};
    for (const f of cfg?.fields ?? []) {
      if (f.type === "currency" && campos[f.key] != null) d[f.key] = formatCurrency(Number(campos[f.key]));
    }
    setDisplay(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!listas.data) return;
    setForm((prev) => {
      const next = { ...prev };
      for (const f of cfg?.fields ?? []) {
        if (f.type === "selectSource" && !next[f.key] && f.hintKey && f.source) {
          const hint = String(campos[f.hintKey] ?? "").toLowerCase();
          if (hint) {
            const m = (listas.data![f.source] ?? []).find(
              (x) => x.nome.toLowerCase().includes(hint) || hint.includes(x.nome.toLowerCase())
            );
            if (m) next[f.key] = m.id;
          }
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listas.data]);

  if (!cfg) return null;
  const Icon = cfg.icon;

  const criar = async () => {
    for (const f of cfg.fields) {
      if (f.required && !String(form[f.key] ?? "").trim()) {
        toast.error(`Preencha: ${f.label}`);
        return;
      }
    }
    setSalvando(true);
    try {
      await onConfirmar(draft.runId, entidade, form as DraftCampos);
      toast.success(`${cfg.titulo} criado`);
    } catch (e) {
      toast.error("Não foi possível criar", { description: msgErro(e) });
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
      await onDesfazer(draft.runId, entidade, draft.entityId);
      toast.success("Desfeito");
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
          {cfg.titulo} criado
        </div>
        <div className="mt-3 flex items-center gap-2 pl-8">
          <NavLink
            to={cfg.link}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            Ver
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

  if (draft.status === "cancelado") {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        Rascunho descartado.
      </div>
    );
  }

  const setMasked = (f: Field, raw: string) => {
    if (f.type === "phone") return setForm((p) => ({ ...p, [f.key]: formatPhone(raw) }));
    if (f.type === "cpf") return setForm((p) => ({ ...p, [f.key]: formatCPF(raw) }));
    if (f.type === "cnpj") return setForm((p) => ({ ...p, [f.key]: formatCNPJ(raw) }));
    if (f.type === "cpfcnpj") return setForm((p) => ({ ...p, [f.key]: formatDocument(raw) }));
    if (f.type === "number") return setForm((p) => ({ ...p, [f.key]: raw === "" ? undefined : Number(raw) }));
    if (f.type === "currency") {
      const masked = raw ? formatCurrencyInput(raw) : "";
      setDisplay((p) => ({ ...p, [f.key]: masked }));
      return setForm((p) => ({ ...p, [f.key]: masked ? parseCurrencyString(masked) : undefined }));
    }
    return setForm((p) => ({ ...p, [f.key]: raw }));
  };

  const fieldId = (k: string) => `${entidade}-${index}-${k}`;

  return (
    <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-elegant">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-ink">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium leading-none text-foreground">{cfg.titulo}</p>
          <p className="mt-1 text-xs text-muted-foreground">Revise e edite antes de criar</p>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
        {cfg.fields.map((f) => {
          const val = form[f.key];
          const label = (
            <Label htmlFor={fieldId(f.key)} className="text-xs text-muted-foreground">
              {f.label} {f.required && <span className="text-negative-strong">*</span>}
            </Label>
          );
          const wrap = (node: React.ReactNode) => (
            <div key={f.key} className={`space-y-1.5 ${f.full ? "sm:col-span-2" : ""}`}>
              {label}
              {node}
            </div>
          );

          if (f.type === "textarea")
            return wrap(
              <Textarea
                id={fieldId(f.key)}
                value={String(val ?? "")}
                rows={2}
                onChange={(e) => setMasked(f, e.target.value)}
                disabled={salvando}
              />
            );
          if (f.type === "date")
            return wrap(
              <DatePicker id={fieldId(f.key)} value={String(val ?? "")} onChange={(v) => setForm((p) => ({ ...p, [f.key]: v }))} />
            );
          if (f.type === "select")
            return wrap(
              <Select value={String(val ?? "")} onValueChange={(v) => setForm((p) => ({ ...p, [f.key]: v }))}>
                <SelectTrigger id={fieldId(f.key)} className="h-9">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {(f.options ?? []).map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          if (f.type === "selectSource")
            return wrap(
              <Select value={String(val ?? "")} onValueChange={(v) => setForm((p) => ({ ...p, [f.key]: v }))}>
                <SelectTrigger id={fieldId(f.key)} className="h-9">
                  <SelectValue placeholder={listas.isLoading ? "Carregando…" : "Selecione…"} />
                </SelectTrigger>
                <SelectContent>
                  {(listas.data?.[f.source!] ?? []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );

          const displayVal = f.type === "currency" ? display[f.key] ?? "" : String(val ?? "");
          return wrap(
            <Input
              id={fieldId(f.key)}
              type={f.type === "number" ? "number" : "text"}
              inputMode={f.type === "currency" || f.type === "cpf" || f.type === "cnpj" || f.type === "cpfcnpj" || f.type === "phone" ? "numeric" : undefined}
              value={displayVal}
              onChange={(e) => setMasked(f, e.target.value)}
              disabled={salvando}
              className="h-9"
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Coins className="h-3.5 w-3.5" />
          Criar debita {draft.custoCreditos} crédito{draft.custoCreditos === 1 ? "" : "s"} de IA
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={cancelar} disabled={salvando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={criar} disabled={salvando} className="gap-1.5 bg-brand text-ink hover:bg-brand/90">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {cfg.verbo}
          </Button>
        </div>
      </div>
    </div>
  );
}
