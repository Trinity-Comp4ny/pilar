import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Coins, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { msgErro } from "./erros";
import type { Acao } from "./useChat";

type Props = {
  index: number;
  acao: Acao;
  onExecutar: (runId: string, operacao: string, payload: Record<string, unknown>) => Promise<void>;
  onCancelar: (runId: string) => Promise<void>;
};

type Candidato = { id: string; label: string; valor?: number; email?: string };

const META: Record<string, { titulo: string; verbo: string; targetKey: string; vazio: string; alvoLabel: string }> = {
  converter_lead: {
    titulo: "Converter lead em cliente",
    verbo: "Converter",
    targetKey: "lead_id",
    alvoLabel: "Lead",
    vazio: "Nenhum lead em aberto para converter.",
  },
  converter_proposta: {
    titulo: "Converter proposta em projeto",
    verbo: "Converter",
    targetKey: "proposta_id",
    alvoLabel: "Proposta",
    vazio: "Nenhuma proposta em aberto para converter.",
  },
  marcar_recebido: {
    titulo: "Marcar receita como recebida",
    verbo: "Marcar recebida",
    targetKey: "receita_id",
    alvoLabel: "Receita",
    vazio: "Nenhuma receita pendente.",
  },
  marcar_pago: {
    titulo: "Marcar despesa como paga",
    verbo: "Marcar paga",
    targetKey: "despesa_id",
    alvoLabel: "Despesa",
    vazio: "Nenhuma despesa pendente.",
  },
  quitar_parcela: {
    titulo: "Quitar parcelas antecipado",
    verbo: "Quitar",
    targetKey: "grupo_id",
    alvoLabel: "Parcelamento",
    vazio: "Nenhum parcelamento em aberto.",
  },
  pagar_fatura: {
    titulo: "Pagar fatura de cartão",
    verbo: "Pagar",
    targetKey: "fatura_id",
    alvoLabel: "Fatura",
    vazio: "Nenhuma fatura em aberto.",
  },
  convidar_portal: {
    titulo: "Convidar cliente ao portal",
    verbo: "Convidar",
    targetKey: "cliente_id",
    alvoLabel: "Cliente",
    vazio: "Nenhum cliente cadastrado ainda.",
  },
};

async function fetchCandidatos(op: string): Promise<Candidato[]> {
  if (op === "converter_lead") {
    const { data } = await supabase
      .from("leads")
      .select("id, nome")
      .is("cliente_id", null)
      .is("deleted_at", null)
      .order("nome");
    return (data ?? []).map((l: { id: string; nome: string }) => ({ id: l.id, label: l.nome }));
  }
  if (op === "converter_proposta") {
    const { data } = await supabase
      .from("propostas")
      .select("id, titulo")
      .is("projeto_id", null)
      .is("deleted_at", null)
      .order("titulo");
    return (data ?? []).map((p: { id: string; titulo: string }) => ({ id: p.id, label: p.titulo }));
  }
  if (op === "marcar_recebido") {
    const { data } = await supabase
      .from("receitas")
      .select("id, descricao, valor")
      .eq("status", "Pendente")
      .is("deleted_at", null)
      .order("data_vencimento");
    return (data ?? []).map((r: { id: string; descricao: string; valor: number }) => ({
      id: r.id,
      label: r.descricao,
      valor: Number(r.valor),
    }));
  }
  if (op === "marcar_pago") {
    const { data } = await supabase
      .from("despesas")
      .select("id, descricao, valor")
      .eq("status", "Pendente")
      .eq("is_fatura_payment", false)
      .is("deleted_at", null)
      .order("data_vencimento");
    return (data ?? []).map((d: { id: string; descricao: string; valor: number }) => ({
      id: d.id,
      label: d.descricao,
      valor: Number(d.valor),
    }));
  }
  if (op === "quitar_parcela") {
    const { data } = await supabase
      .from("grupos_parcela")
      .select("id, descricao, tipo_lancamento")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    return (data ?? []).map((g: { id: string; descricao: string | null; tipo_lancamento: string }) => ({
      id: g.id,
      label: `${g.descricao ?? "Parcelamento"} (${g.tipo_lancamento})`,
    }));
  }
  if (op === "pagar_fatura") {
    const { data } = await supabase
      .from("faturas")
      .select("id, mes_referencia, ano_referencia, valor_total, status")
      .neq("status", "Paga")
      .order("ano_referencia", { ascending: false });
    return (data ?? []).map(
      (f: { id: string; mes_referencia: number; ano_referencia: number; valor_total: number }) => ({
        id: f.id,
        label: `Fatura ${f.mes_referencia}/${f.ano_referencia}`,
        valor: Number(f.valor_total),
      })
    );
  }
  if (op === "convidar_portal") {
    const { data } = await supabase.from("clientes").select("id, nome, email").is("deleted_at", null).order("nome");
    return (data ?? []).map((c: { id: string; nome: string; email: string | null }) => ({
      id: c.id,
      label: c.nome,
      email: c.email ?? undefined,
    }));
  }
  return [];
}

export function AcaoCard({ index, acao, onExecutar, onCancelar }: Props) {
  const money = useMoneyMask();
  const meta = META[acao.operacao];
  const [alvo, setAlvo] = useState("");
  const [contaId, setContaId] = useState("");
  const [email, setEmail] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [salvando, setSalvando] = useState(false);

  const candidatos = useQuery({
    queryKey: ["acao-candidatos", acao.operacao],
    enabled: acao.status === "pendente",
    queryFn: () => fetchCandidatos(acao.operacao),
  });
  const contas = useQuery({
    queryKey: ["acao-contas"],
    enabled: acao.status === "pendente" && acao.operacao === "pagar_fatura",
    queryFn: async () => {
      const { data } = await supabase.from("contas").select("id, nome").is("deleted_at", null).order("nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const precisaConta = acao.operacao === "pagar_fatura";
  const precisaEmail = acao.operacao === "convidar_portal";
  const permiteQtd = acao.operacao === "quitar_parcela";
  const semCandidatos = !candidatos.isLoading && (candidatos.data?.length ?? 0) === 0;
  const idBase = `acao-${index}`;

  const alvoEmail = useMemo(() => candidatos.data?.find((c) => c.id === alvo)?.email, [candidatos.data, alvo]);

  const executar = async () => {
    if (!alvo) return toast.error("Selecione o alvo");
    if (precisaConta && !contaId) return toast.error("Selecione a conta de pagamento");
    const emailFinal = email || alvoEmail || "";
    if (precisaEmail && !emailFinal) return toast.error("Informe o e-mail do cliente");
    const payload: Record<string, unknown> = { [meta.targetKey]: alvo };
    if (precisaConta) payload.conta_id = contaId;
    if (precisaEmail) payload.email = emailFinal;
    if (permiteQtd && quantidade) payload.quantidade = Number(quantidade);
    setSalvando(true);
    try {
      await onExecutar(acao.runId, acao.operacao, payload);
      toast.success("Ação concluída");
    } catch (e) {
      toast.error("Não foi possível concluir", { description: msgErro(e) });
    } finally {
      setSalvando(false);
    }
  };

  const cancelar = async () => {
    setSalvando(true);
    try {
      await onCancelar(acao.runId);
    } finally {
      setSalvando(false);
    }
  };

  if (!meta) return null;

  if (acao.status === "feito") {
    return (
      <div className="w-full max-w-md rounded-2xl border border-positive/30 bg-positive/5 p-4 text-sm font-medium text-foreground">
        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-positive/15 align-middle text-positive-strong">
          <Check className="h-3.5 w-3.5" />
        </span>
        {meta.titulo}: concluído
      </div>
    );
  }
  if (acao.status === "cancelado") {
    return (
      <div className="w-full max-w-md rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        Ação cancelada.
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-elegant">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-ink">
          <Zap className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium leading-none text-foreground">{meta.titulo}</p>
          <p className="mt-1 text-xs text-muted-foreground">Escolha o alvo e confirme</p>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {!candidatos.isLoading && semCandidatos ? (
          <p className="py-2 text-sm text-muted-foreground">{meta.vazio}</p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor={`${idBase}-alvo`} className="text-xs text-muted-foreground">
              {meta.alvoLabel}
            </Label>
            <Select
              value={alvo}
              onValueChange={(v) => {
                setAlvo(v);
                setEmail(candidatos.data?.find((c) => c.id === v)?.email ?? "");
              }}
            >
              <SelectTrigger id={`${idBase}-alvo`} className="h-9">
                <SelectValue placeholder={candidatos.isLoading ? "Carregando…" : "Selecione…"} />
              </SelectTrigger>
              <SelectContent>
                {(candidatos.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                    {c.valor != null ? ` · ${money(c.valor)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {precisaConta && !semCandidatos && (
          <div className="space-y-1.5">
            <Label htmlFor={`${idBase}-conta`} className="text-xs text-muted-foreground">
              Conta de pagamento
            </Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger id={`${idBase}-conta`} className="h-9">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {(contas.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {precisaEmail && !semCandidatos && (
          <div className="space-y-1.5">
            <Label htmlFor={`${idBase}-email`} className="text-xs text-muted-foreground">
              E-mail do convite
            </Label>
            <Input
              id={`${idBase}-email`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@cliente.com"
              disabled={salvando}
              className="h-9"
            />
          </div>
        )}
        {permiteQtd && !semCandidatos && (
          <div className="space-y-1.5">
            <Label htmlFor={`${idBase}-qtd`} className="text-xs text-muted-foreground">
              Quantidade de parcelas (vazio = todas em aberto)
            </Label>
            <Input
              id={`${idBase}-qtd`}
              type="number"
              min={1}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              disabled={salvando}
              className="h-9"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Coins className="h-3.5 w-3.5" /> Executar consome tokens de IA
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={cancelar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={executar}
            disabled={salvando || !alvo || semCandidatos}
            variant="brand"
            className="gap-1.5"
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {meta.verbo}
          </Button>
        </div>
      </div>
    </div>
  );
}
