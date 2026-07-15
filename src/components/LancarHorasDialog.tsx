import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useLancarHoras } from "@/hooks/useTimesheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface LancarHorasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoIdInicial?: string;
}

interface ProjetoOption {
  id: string;
  nome: string;
  codigo_projeto: string | null;
}

const NENHUMA_FASE = "__nenhuma__";

interface FaseOption {
  id: string;
  disciplina: string;
}

export function LancarHorasDialog({ open, onOpenChange, projetoIdInicial }: LancarHorasDialogProps) {
  const hoje = format(new Date(), "yyyy-MM-dd");

  const [projetoId, setProjetoId] = useState(projetoIdInicial ?? "");
  const [projetoOpen, setProjetoOpen] = useState(false);
  const [faseId, setFaseId] = useState("");
  const [data, setData] = useState(hoje);
  const [horas, setHoras] = useState("");
  const [descricao, setDescricao] = useState("");

  const { mutateAsync: lancarHoras, isPending } = useLancarHoras();

  const { data: projetos = [] } = useQuery<ProjetoOption[]>({
    queryKey: ["projetos-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, nome, codigo_projeto")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ProjetoOption[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const projetoLabel = (p: ProjetoOption) => (p.codigo_projeto ? `${p.codigo_projeto} — ${p.nome}` : p.nome);
  const projetoSelecionado = projetos.find((p) => p.id === projetoId);

  const { data: fases = [] } = useQuery<FaseOption[]>({
    queryKey: ["orcamento-fases-select", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_orcamento_fases")
        .select("id, disciplina")
        .eq("projeto_id", projetoId)
        .is("deleted_at", null)
        .order("disciplina");
      if (error) throw error;
      return (data ?? []) as FaseOption[];
    },
    enabled: !!projetoId,
    staleTime: 1000 * 60 * 5,
  });

  function resetForm() {
    setProjetoId(projetoIdInicial ?? "");
    setFaseId("");
    setData(hoje);
    setHoras("");
    setDescricao("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const horasNum = parseFloat(horas);
    if (!projetoId || !data || !descricao.trim() || isNaN(horasNum)) return;

    await lancarHoras({
      projeto_id: projetoId,
      fase_id: faseId || null,
      descricao: descricao.trim(),
      horas: horasNum,
      data,
    });

    resetForm();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar horas</DialogTitle>
          <DialogDescription>
            Registre as horas trabalhadas em um projeto. Os campos com * são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="projeto">Projeto *</Label>
            <Popover open={projetoOpen} onOpenChange={setProjetoOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="projeto"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={projetoOpen}
                  className={cn("w-full justify-between font-normal", !projetoSelecionado && "text-muted-foreground")}
                >
                  <span className="truncate">
                    {projetoSelecionado ? projetoLabel(projetoSelecionado) : "Selecione o projeto"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por código ou nome..." />
                  <CommandList>
                    <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
                    <CommandGroup>
                      {projetos.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={projetoLabel(p)}
                          onSelect={() => {
                            setProjetoId(p.id);
                            setFaseId("");
                            setProjetoOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", projetoId === p.id ? "opacity-100" : "opacity-0")} />
                          <span className="truncate">{projetoLabel(p)}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {projetoId && (
            <div className="space-y-1.5">
              <Label htmlFor="fase">Fase / Disciplina</Label>
              <Select
                value={faseId || NENHUMA_FASE}
                onValueChange={(v) => setFaseId(v === NENHUMA_FASE ? "" : v)}
              >
                <SelectTrigger id="fase">
                  <SelectValue placeholder="Selecione a fase (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUMA_FASE}>Nenhuma fase</SelectItem>
                  {fases.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.disciplina}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <DatePicker value={data} onChange={setData} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="horas">Horas *</Label>
              <Input
                id="horas"
                type="number"
                min={0.5}
                max={24}
                step={0.5}
                placeholder="Ex: 2.5"
                value={horas}
                onChange={(e) => setHoras(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição *</Label>
            <Textarea
              id="descricao"
              placeholder="Descreva o que foi feito..."
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
              minLength={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending || !projetoId || !horas || !descricao.trim()}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lançar horas
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
