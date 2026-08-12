import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowDownCircle, ArrowUpCircle, CalendarIcon, Loader2, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyInput, parseCurrencyString } from "@/lib/currencyUtils";
import type { TipoLancamento } from "../hooks/useLancamentosUnified";

interface Props {
  onCreated: () => void;
}

export function QuickAddLancamento({ onCreated }: Props) {
  const [tipo, setTipo] = useState<TipoLancamento>("receita");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setDescricao("");
    setValor("");
    setData(new Date());
  };

  const submit = async () => {
    if (saving) return; // evita inserts duplicados com Enter repetido
    if (!descricao.trim() || !valor) {
      toast.error("Preencha descrição e valor");
      return;
    }
    const valorNum = parseCurrencyString(valor);
    if (valorNum <= 0) {
      toast.error("Valor inválido");
      return;
    }
    setSaving(true);
    try {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário sem empresa vinculada");
      const dataStr = format(data, "yyyy-MM-dd");
      const table = tipo === "receita" ? "receitas" : "despesas";
      const payload =
        tipo === "receita"
          ? {
              data_vencimento: dataStr,
              data_recebimento: null,
              descricao: descricao.trim(),
              valor: valorNum,
              status: "Pendente",
              empresa_id: empresaId,
            }
          : {
              data_vencimento: dataStr,
              data_pagamento: null,
              descricao: descricao.trim(),
              valor: valorNum,
              status: "Pendente",
              empresa_id: empresaId,
            };
      const { error } = await supabase.from(table).insert(payload as never);
      if (error) throw error;
      toast.success(`${tipo === "receita" ? "Receita" : "Despesa"} adicionada`);
      reset();
      onCreated();
    } catch (e) {
      toast.error("Erro ao adicionar", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-black/15 bg-gray-50/40 px-3 py-2">
      <div className="inline-flex rounded-full bg-white border p-0.5">
        <button
          type="button"
          onClick={() => setTipo("receita")}
          className={cn(
            "h-7 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1 transition",
            tipo === "receita" ? "bg-positive/10 text-positive-strong" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ArrowUpCircle className="h-3.5 w-3.5" />
          Receita
        </button>
        <button
          type="button"
          onClick={() => setTipo("despesa")}
          className={cn(
            "h-7 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1 transition",
            tipo === "despesa" ? "bg-red-50 text-red-600" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ArrowDownCircle className="h-3.5 w-3.5" />
          Despesa
        </button>
      </div>

      <Input
        placeholder="Descrição rápida…"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !saving && submit()}
        className="h-8 flex-1 min-w-[180px] bg-white text-sm"
      />
      <Input
        placeholder="R$ 0,00"
        value={valor}
        onChange={(e) => setValor(formatCurrencyInput(e.target.value))}
        onKeyDown={(e) => e.key === "Enter" && !saving && submit()}
        className="h-8 w-[110px] bg-white text-sm tabular-nums"
      />
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1 bg-white text-xs">
            <CalendarIcon className="h-3 w-3" />
            {format(data, "dd/MM")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={data} onSelect={(d) => d && setData(d)} autoFocus />
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        size="sm"
        onClick={submit}
        disabled={saving}
        variant="brand"
        className="h-8 gap-1 rounded-full"
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
        Adicionar
      </Button>
      <span className="text-[10px] text-muted-foreground">
        Status pendente. Use a aba específica para vínculos completos.
      </span>
    </div>
  );
}
