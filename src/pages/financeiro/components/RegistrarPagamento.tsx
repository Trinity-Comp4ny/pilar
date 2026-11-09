import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safeError";
import type { Lancamento } from "../hooks/useLancamentosUnified";
import { useContasOpcoes } from "../hooks/useContasOpcoes";
import { isPaidStatus } from "./lancamentosRows";

type Alvo = { l: Lancamento; novoStatus: string } | Lancamento[];

const semContaNemCartao = (l: Lancamento) =>
  l.tipo !== "transferencia" && !isPaidStatus(l) && !l.conta_id && !l.cartao_id;

/**
 * Registrar pagamento/recebimento: um diálogo só para a linha, o lote, o swipe do
 * celular e o painel de detalhe. Pede a data REAL (não precisa ser hoje: cartão
 * debitado semanas antes de alguém marcar) e, para quem não tem conta nem cartão, a
 * conta de onde saiu/entrou o dinheiro. Sem ela o saldo da conta não bate com o banco
 * (diagnóstico 2026-11-07, B7).
 */
export function useRegistrarPagamento({ onDone }: { onDone: () => void }) {
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [aoConcluirLote, setAoConcluirLote] = useState<(() => void) | null>(null);
  const [data, setData] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [conta, setConta] = useState("");

  const linhas = alvo === null ? [] : Array.isArray(alvo) ? alvo : [alvo.l];
  const semConta = linhas.filter(semContaNemCartao);
  const precisaConta = semConta.length > 0;
  const contas = useContasOpcoes(precisaConta);

  const abrir = (novo: Alvo, aoConcluir?: () => void) => {
    setData(format(new Date(), "yyyy-MM-dd"));
    setConta("");
    setAoConcluirLote(() => aoConcluir ?? null);
    setAlvo(novo);
  };

  const gravarLote = async (rows: Lancamento[]): Promise<boolean> => {
    const abertos = rows.filter((l) => !isPaidStatus(l) && l.tipo !== "transferencia");
    // Quem já tem conta (ou cartão) mantém a sua; quem não tem recebe a escolhida.
    const grupos: Array<{ tabela: "receitas" | "despesas"; ids: string[]; payload: Record<string, unknown> }> = [];
    for (const tipo of ["receita", "despesa"] as const) {
      const tabela = tipo === "receita" ? "receitas" : "despesas";
      const base =
        tipo === "receita" ? { status: "Recebido", data_recebimento: data } : { status: "Pago", data_pagamento: data };
      const doTipo = abertos.filter((l) => l.tipo === tipo);
      const comConta = doTipo.filter((l) => !semContaNemCartao(l)).map((l) => l.id);
      const semContaIds = doTipo.filter(semContaNemCartao).map((l) => l.id);
      if (comConta.length) grupos.push({ tabela, ids: comConta, payload: base });
      if (semContaIds.length) grupos.push({ tabela, ids: semContaIds, payload: { ...base, conta_id: conta } });
    }
    if (!grupos.length) {
      toast.info("Nada a marcar — já efetivados");
      return true;
    }
    const results = await Promise.all(
      grupos.map(
        (g) =>
          supabase
            .from(g.tabela)
            .update(g.payload as never)
            .in("id", g.ids) as unknown as PromiseLike<{ error: unknown }>
      )
    );
    if (results.some((r) => r.error)) {
      toast.error("Falha em alguns registros");
      return false;
    }
    toast.success(`${abertos.length} marcado(s) como pago/recebido`);
    return true;
  };

  const gravarUm = async ({ l, novoStatus }: { l: Lancamento; novoStatus: string }): Promise<boolean> => {
    const table = l.tipo === "receita" ? "receitas" : "despesas";
    const dataField = l.tipo === "receita" ? "data_recebimento" : "data_pagamento";
    const normalized = l.tipo === "receita" && novoStatus === "Recebida" ? "Recebido" : novoStatus;
    const payload: Record<string, unknown> = { status: normalized, [dataField]: data };
    if (semContaNemCartao(l)) payload.conta_id = conta;
    const { error } = await supabase
      .from(table)
      .update(payload as never)
      .eq("id", l.id);
    if (error) {
      toast.error("Não foi possível atualizar o status", {
        description: getSafeErrorMessage(error, "Tente de novo em instantes."),
      });
      return false;
    }
    toast.success("Status atualizado");
    return true;
  };

  const confirmar = async () => {
    if (!alvo) return;
    if (precisaConta && !conta) {
      toast.error("Escolha a conta", {
        description: "Informe de qual conta saiu ou em qual entrou o dinheiro, para o saldo bater com o banco.",
      });
      return;
    }
    const ok = Array.isArray(alvo) ? await gravarLote(alvo) : await gravarUm(alvo);
    if (!ok) return;
    if (Array.isArray(alvo)) aoConcluirLote?.();
    setAlvo(null);
    onDone();
  };

  const dialog = (
    <FormDialog
      open={alvo !== null}
      onOpenChange={(v) => !v && setAlvo(null)}
      title={
        Array.isArray(alvo)
          ? `Marcar ${alvo.length} lançamento(s) como pago/recebido`
          : "Confirmar recebimento/pagamento"
      }
      description="Confirme a data em que o pagamento realmente caiu — não precisa ser hoje. Você pode reverter o status depois."
      size="sm"
      onSubmit={confirmar}
      submitLabel="Confirmar"
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Data</Label>
          <DatePicker value={data} onChange={setData} />
        </div>
        {precisaConta && (
          <div className="space-y-2">
            <Label htmlFor="conta-pagamento">Conta *</Label>
            <Select value={conta} onValueChange={setConta}>
              <SelectTrigger id="conta-pagamento" aria-label="Conta">
                <SelectValue placeholder="De qual conta saiu / em qual entrou" />
              </SelectTrigger>
              <SelectContent>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {Array.isArray(alvo) && semConta.length < linhas.length && (
              <p className="text-xs text-muted-foreground">
                Vale só para os {semConta.length} sem conta; os demais mantêm a conta que já têm.
              </p>
            )}
          </div>
        )}
      </div>
    </FormDialog>
  );

  return { abrir, dialog };
}
