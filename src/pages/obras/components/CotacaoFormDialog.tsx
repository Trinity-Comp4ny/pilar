import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useObraFrentes } from "@/hooks/useObraFrentes";
import { useSaveCotacao, type CotacaoRow } from "@/hooks/useObraCotacoes";

const SEM_FRENTE = "__none__";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  cotacao?: CotacaoRow | null;
}

/** Cria ou edita a necessidade a cotar (item único). Só a descrição é obrigatória. */
export function CotacaoFormDialog({ open, onOpenChange, obraId, cotacao }: Props) {
  const isEdit = !!cotacao;
  const { data: frentes = [] } = useObraFrentes(obraId);
  const save = useSaveCotacao(obraId);

  const [descricao, setDescricao] = useState(cotacao?.descricao ?? "");
  const [quantidade, setQuantidade] = useState(cotacao?.quantidade != null ? String(cotacao.quantidade) : "");
  const [unidade, setUnidade] = useState(cotacao?.unidade ?? "");
  const [frenteId, setFrenteId] = useState(cotacao?.obra_frente_id ?? SEM_FRENTE);
  const [prazo, setPrazo] = useState(cotacao?.prazo_necessidade ?? "");
  const [observacoes, setObservacoes] = useState(cotacao?.observacoes ?? "");

  const submit = async () => {
    if (!descricao.trim()) {
      toast.error("Descreva o que vai cotar");
      return;
    }
    try {
      await save.mutateAsync({
        id: cotacao?.id,
        descricao: descricao.trim(),
        quantidade: quantidade ? Number(quantidade) : null,
        unidade: unidade.trim() || null,
        obra_frente_id: frenteId === SEM_FRENTE ? null : frenteId,
        prazo_necessidade: prazo || null,
        observacoes: observacoes.trim() || null,
      });
      toast.success(isEdit ? "Cotação atualizada" : "Cotação criada");
      onOpenChange(false);
    } catch (e) {
      toast.error("Não foi possível salvar", { description: e instanceof Error ? e.message : "Tente novamente" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cotação" : "Nova cotação"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cot-desc">O que cotar</Label>
            <Input
              id="cot-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Tábuas de cedrinho, material elétrico, locação de MUNCK"
            />
            <p className="text-xs text-muted-foreground">
              Depois é só analisar o PDF do orçamento: a IA identifica sozinha se é comparação entre lojas ou a lista de
              um fornecedor.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cot-qtd">Quantidade</Label>
              <Input
                id="cot-qtd"
                type="number"
                step="0.001"
                min="0"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cot-un">Unidade</Label>
              <Input
                id="cot-un"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                placeholder="Ex.: sacos, m³, vb"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select value={frenteId} onValueChange={setFrenteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_FRENTE}>Sem etapa</SelectItem>
                  {frentes.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cot-prazo">Precisa até</Label>
              <DatePicker id="cot-prazo" value={prazo} onChange={setPrazo} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cot-obs">Observações</Label>
            <Textarea
              id="cot-obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Detalhes do que precisa ser cotado"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="brand" onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
