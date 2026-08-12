import { useMemo, useState } from "react";
import { Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { useFornecedoresLite, usePropostasNaoVinculadas, useVincularFornecedor } from "@/hooks/useFornecedorDetalhe";
import { sugerirFornecedor } from "@/lib/fornecedorInsights";

interface ReconciliarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Fila de reconciliação (spec 026): propostas de cotação digitadas como texto
 * livre (sem vínculo com o cadastro) que dá pra associar a um fornecedor. Sugere
 * o cadastro por semelhança de nome; ao vincular, a proposta passa a contar no
 * histórico do fornecedor.
 */
export function ReconciliarDialog({ open, onOpenChange }: ReconciliarDialogProps) {
  const { data: nomes = [], isLoading } = usePropostasNaoVinculadas();
  const { data: fornecedores = [] } = useFornecedoresLite();
  const vincular = useVincularFornecedor();

  // Só guardamos as escolhas explícitas do usuário; a sugestão automática é
  // derivada no render (evita set-state em effect e mantém uma fonte de verdade).
  const [override, setOverride] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  const sugestoes = useMemo(() => {
    const mapa: Record<string, string> = {};
    for (const n of nomes) {
      const s = sugerirFornecedor(n.nome, fornecedores);
      if (s) mapa[n.nome] = s.id;
    }
    return mapa;
  }, [nomes, fornecedores]);

  const valorDe = (nome: string) => override[nome] ?? sugestoes[nome] ?? "";

  const handleVincular = async (nome: string) => {
    const fornecedorId = valorDe(nome);
    if (!fornecedorId) {
      toast.error("Escolha um fornecedor para vincular");
      return;
    }
    setSalvando(nome);
    try {
      await vincular.mutateAsync({ nome, fornecedorId });
      toast.success("Cotações vinculadas ao fornecedor");
    } catch {
      toast.error("Não foi possível vincular. Tente de novo.");
    } finally {
      setSalvando(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reconciliar cotações</DialogTitle>
          <DialogDescription>
            Cotações de campo digitadas com o nome solto do fornecedor. Associe cada uma ao cadastro para o histórico do
            fornecedor ficar completo.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : nomes.length === 0 ? (
          <EmptyState
            icon={Link2}
            title="Tudo reconciliado"
            description="Nenhuma cotação com fornecedor em texto livre pendente."
          />
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {nomes.map((n) => (
              <div key={n.nome} className="rounded-lg border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium">{n.nome}</p>
                  <span className="text-xs text-muted-foreground">
                    {n.propostas} cotaç{n.propostas === 1 ? "ão" : "ões"}
                  </span>
                </div>
                {n.exemploObra && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    ex.: {n.exemploDescricao ? `${n.exemploDescricao} · ` : ""}
                    {n.exemploObra}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Select
                    value={valorDe(n.nome)}
                    onValueChange={(v) => setOverride((prev) => ({ ...prev, [n.nome]: v }))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Escolher fornecedor do cadastro" />
                    </SelectTrigger>
                    <SelectContent>
                      {fornecedores.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                          {sugestoes[n.nome] === f.id ? " (sugerido)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => handleVincular(n.nome)} disabled={salvando === n.nome}>
                    {salvando === n.nome ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vincular"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
