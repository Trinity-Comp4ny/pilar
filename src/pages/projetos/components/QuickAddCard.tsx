import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface QuickAddCardProps {
  /** Coluna onde o projeto será criado; o status deriva do bucket da etapa. */
  etapaId: string;
  clientes: { id: string; nome: string }[];
  onCreated: () => void;
}

export function QuickAddCard({ etapaId, clientes, onCreated }: QuickAddCardProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [clienteId, setClienteId] = useState("");
  const codigoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => codigoRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const reset = () => {
    setCodigo("");
    setNome("");
    setClienteId("");
    setOpen(false);
  };

  const submit = async () => {
    if (!codigo.trim() || !nome.trim() || !clienteId) {
      toast.error("Preencha código, nome e cliente");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("create_projeto_completo", {
        p_codigo: codigo.trim(),
        p_nome: nome.trim(),
        p_cliente_id: clienteId,
        p_valor_contrato: 0,
        p_observacao: "",
        p_localizacao: "",
        p_disciplinas: [] as unknown as never,
      });
      if (error) throw error;
      // O RPC cria em "Planejamento"; movemos para a coluna clicada (o trigger
      // deriva o status pelo bucket da etapa).
      const { data } = await supabase
        .from("projetos")
        .select("id, etapa_id")
        .eq("codigo_projeto", codigo.trim())
        .single();
      if (data?.id && data.etapa_id !== etapaId) {
        await supabase.from("projetos").update({ etapa_id: etapaId }).eq("id", data.id);
      }
      toast.success("Projeto criado");
      reset();
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao criar projeto";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg border border-dashed transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar projeto
      </button>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-2.5 space-y-2 shadow-sm">
      <Input
        ref={codigoRef}
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        placeholder="Código (PRJ-...)"
        className="h-8 text-xs"
        disabled={saving}
        onKeyDown={(e) => {
          if (e.key === "Escape") reset();
        }}
      />
      <Input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome do projeto"
        className="h-8 text-xs"
        disabled={saving}
      />
      <Select value={clienteId} onValueChange={setClienteId} disabled={saving}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Cliente" />
        </SelectTrigger>
        <SelectContent>
          {clientes.map((c) => (
            <SelectItem key={c.id} value={c.id} className="text-xs">
              {c.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="brand"
          className="h-7 text-xs flex-1"
          onClick={submit}
          disabled={saving || !codigo.trim() || !nome.trim() || !clienteId}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Criar"}
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={reset} disabled={saving} aria-label="Cancelar">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
