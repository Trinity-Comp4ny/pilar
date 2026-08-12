import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { ArrowUpRight, Check, Coins, Loader2, RotateCcw, Users } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currencyUtils";
import { msgErro } from "./erros";
import type { Draft, DraftCampos, FolhaLinhaPayload } from "./useChat";

type Props = {
  draft: Draft;
  onConfirmar: (runId: string, entidade: "folha", campos: DraftCampos) => Promise<string | undefined>;
  onCancelar: (runId: string) => Promise<void>;
  onDesfazerFolha: (runId: string, mes: number, ano: number) => Promise<void>;
};

const MESES = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type Linha = {
  pessoa_id: string;
  nome: string;
  salario_fixo: number;
  total_area_projetada: number;
  valor_m2: number;
  adicional_variavel: number;
};

export function FolhaCard({ draft, onConfirmar, onCancelar, onDesfazerFolha }: Props) {
  const mes = Number(draft.campos.mes);
  const ano = Number(draft.campos.ano);
  const [rows, setRows] = useState<Linha[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);

  // Preview calculado (mesma RPC da plataforma) + checagem de folha já fechada.
  const preview = useQuery({
    queryKey: ["folha-preview-agente", mes, ano],
    queryFn: async () => {
      const [{ data: prev }, { count }] = await Promise.all([
        supabase.rpc("get_folha_preview", { p_mes: mes, p_ano: ano }),
        supabase.from("folha_pagamento").select("id", { count: "exact", head: true }).eq("mes", mes).eq("ano", ano),
      ]);
      return { linhas: prev ?? [], jaFechada: (count ?? 0) > 0 };
    },
    enabled: draft.status === "pendente",
  });

  useEffect(() => {
    if (!preview.data) return;
    setRows(
      preview.data.linhas.map((l) => ({
        pessoa_id: l.pessoa_id,
        nome: l.nome,
        salario_fixo: Number(l.salario_fixo) || 0,
        total_area_projetada: Number(l.total_area) || 0,
        valor_m2: Number(l.valor_m2) || 0,
        adicional_variavel: Number(l.total_variavel) || 0,
      }))
    );
  }, [preview.data]);

  const setCampo = (i: number, key: "salario_fixo" | "adicional_variavel", value: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value === "" ? 0 : Number(value) } : r)));
  };

  const totalGeral = useMemo(() => rows.reduce((s, r) => s + r.salario_fixo + r.adicional_variavel, 0), [rows]);

  const fechar = async () => {
    if (rows.length === 0) {
      toast.error("Sem pessoas para a folha deste mês");
      return;
    }
    const linhas: FolhaLinhaPayload[] = rows.map((r) => ({
      pessoa_id: r.pessoa_id,
      salario_fixo: r.salario_fixo,
      total_area_projetada: r.total_area_projetada,
      valor_m2: r.valor_m2,
      adicional_variavel: r.adicional_variavel,
      total_receber: r.salario_fixo + r.adicional_variavel,
    }));
    setSalvando(true);
    try {
      await onConfirmar(draft.runId, "folha", { mes, ano, linhas });
      toast.success("Folha fechada");
    } catch (e) {
      toast.error("Não foi possível fechar a folha", { description: msgErro(e) });
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
    setDesfazendo(true);
    try {
      await onDesfazerFolha(draft.runId, mes, ano);
      toast.success("Fechamento desfeito");
    } catch {
      toast.error("Não foi possível desfazer");
    } finally {
      setDesfazendo(false);
    }
  };

  const competencia = `${MESES[mes] ?? mes}/${ano}`;

  if (draft.status === "criado") {
    return (
      <div className="w-full max-w-2xl rounded-2xl border border-positive/30 bg-positive/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-positive/15 text-positive-strong">
            <Check className="h-3.5 w-3.5" />
          </span>
          Folha de {competencia} fechada · {rows.length} pessoa{rows.length === 1 ? "" : "s"}
        </div>
        <div className="mt-3 flex items-center gap-2 pl-8">
          <NavLink
            to="/gestao/financeiro?tab=folha"
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            Ver folha
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
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        Fechamento de folha descartado.
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-elegant">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-ink">
          <Users className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium leading-none text-foreground">Fechar folha · {competencia}</p>
          <p className="mt-1 text-xs text-muted-foreground">Revise e edite os valores antes de fechar</p>
        </div>
      </div>

      <div className="px-4 py-4">
        {preview.isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> Calculando preview…
          </div>
        ) : preview.data?.jaFechada ? (
          <p className="py-4 text-sm text-muted-foreground">A folha de {competencia} já foi fechada.</p>
        ) : rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Nenhuma pessoa com folha para {competencia}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Pessoa</th>
                  <th className="pb-2 px-2 font-medium">Salário fixo</th>
                  <th className="pb-2 px-2 font-medium">Variável</th>
                  <th className="pb-2 pl-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.pessoa_id} className="border-b border-border/60">
                    <td className="py-2 pr-2 text-foreground">{r.nome}</td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={r.salario_fixo}
                        onChange={(e) => setCampo(i, "salario_fixo", e.target.value)}
                        disabled={salvando}
                        className="h-8 w-28"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={r.adicional_variavel}
                        onChange={(e) => setCampo(i, "adicional_variavel", e.target.value)}
                        disabled={salvando}
                        className="h-8 w-28"
                      />
                    </td>
                    <td className="py-2 pl-2 text-right font-medium text-foreground">
                      {formatCurrency(r.salario_fixo + r.adicional_variavel)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-2 text-right text-xs text-muted-foreground">
                    Total da folha
                  </td>
                  <td className="pt-2 pl-2 text-right text-sm font-semibold text-foreground">
                    {formatCurrency(totalGeral)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Coins className="h-3.5 w-3.5" />
          Fechar debita {draft.custoCreditos} crédito{draft.custoCreditos === 1 ? "" : "s"} de IA
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={cancelar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={fechar}
            disabled={salvando || preview.isLoading || preview.data?.jaFechada || rows.length === 0}
            variant="brand"
            className="gap-1.5"
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Fechar folha
          </Button>
        </div>
      </div>
    </div>
  );
}
