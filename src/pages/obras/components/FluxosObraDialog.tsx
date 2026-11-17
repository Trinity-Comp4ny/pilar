import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useExcluirFluxoObra,
  useFluxosObra,
  useSalvarFluxoObra,
  type FluxoObra,
} from "@/pages/obras/hooks/useFluxosObra";
import { SincronizarObrasDialog } from "./SincronizarObrasDialog";
import { useFornecedoresLite } from "@/pages/obras/hooks/useFornecedoresLite";
import {
  achatarEstrutura,
  agruparLinhas,
  DURACAO_PADRAO_DIAS,
  duracaoTotalDias,
  planoDoFluxo,
  type EstruturaFluxo,
  type LinhaFluxo,
} from "@/pages/obras/lib/fluxoObra";

const SEM_PRESTADOR = "__nenhum__";
const linhaVazia = (base?: LinhaFluxo): LinhaFluxo => ({
  fase: base?.fase ?? "",
  etapa: base?.etapa ?? "",
  servico: "",
  duracao_dias: DURACAO_PADRAO_DIAS,
  fornecedor_id: null,
  paralelo: false,
  tarefas: "",
});

function contarServicos(f: FluxoObra) {
  return f.estrutura.reduce((a, fase) => a + fase.etapas.reduce((b, e) => b + e.servicos.length, 0), 0);
}

/** Editor do fluxo: uma linha por serviço, com o caminho (fase e etapa), duração, prestador e tarefas. */
function EditorFluxoObra({
  fluxo,
  onFechar,
  onAtualizado,
}: {
  /** null = fluxo novo. */
  fluxo: FluxoObra | null;
  onFechar: () => void;
  /** Chamado ao salvar a mudança de um fluxo que já existia: é aí que se oferece atualizar as obras. */
  onAtualizado: (f: { id: string; nome: string; estrutura: EstruturaFluxo }) => void;
}) {
  const salvar = useSalvarFluxoObra();
  const { data: fornecedores = [] } = useFornecedoresLite();
  const [nome, setNome] = useState(fluxo?.nome ?? "");
  const [descricao, setDescricao] = useState(fluxo?.descricao ?? "");
  const [linhas, setLinhas] = useState<LinhaFluxo[]>(() =>
    fluxo ? achatarEstrutura(fluxo.estrutura) : [linhaVazia()]
  );

  const editar = (i: number, campos: Partial<LinhaFluxo>) =>
    setLinhas((atual) => atual.map((l, j) => (j === i ? { ...l, ...campos } : l)));
  const estrutura = agruparLinhas(linhas);
  const plano = planoDoFluxo(estrutura, "2026-01-01");

  const confirmar = async () => {
    if (!nome.trim() || plano.erro) return;
    try {
      await salvar.mutateAsync({ id: fluxo?.id, nome, descricao, estrutura });
      toast.success(fluxo ? "Fluxo atualizado" : "Fluxo criado");
      onFechar();
      if (fluxo) onAtualizado({ id: fluxo.id, nome: nome.trim(), estrutura });
    } catch (e) {
      toast.error("Não foi possível salvar", { description: e instanceof Error ? e.message : "Tente de novo." });
    }
  };

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onFechar()}
      title={fluxo ? "Editar fluxo de obra" : "Novo fluxo de obra"}
      description="Cada linha é um serviço, com a fase e a etapa dele. Serviços seguidos da mesma fase e etapa ficam juntos."
      size="lg"
      submitLabel="Salvar fluxo"
      onSubmit={() => void confirmar()}
      isPending={salvar.isPending}
      submitDisabled={!nome.trim() || !!plano.erro}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fo-nome">Nome</Label>
            <Input id="fo-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Residencial" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fo-desc">Descrição (opcional)</Label>
            <Input id="fo-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
        </div>

        <ul className="space-y-3">
          {linhas.map((l, i) => (
            <li key={i} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  value={l.fase}
                  onChange={(e) => editar(i, { fase: e.target.value })}
                  placeholder="Fase (ex.: Estrutura)"
                  aria-label={`Fase da linha ${i + 1}`}
                />
                <Input
                  value={l.etapa}
                  onChange={(e) => editar(i, { etapa: e.target.value })}
                  placeholder="Etapa (ex.: Fundação)"
                  aria-label={`Etapa da linha ${i + 1}`}
                />
                <Input
                  value={l.servico}
                  onChange={(e) => editar(i, { servico: e.target.value })}
                  placeholder="Serviço (ex.: Sapatas)"
                  aria-label={`Serviço da linha ${i + 1}`}
                />
              </div>
              <div className="grid items-center gap-2 sm:grid-cols-[96px_1fr_auto_auto]">
                <Input
                  type="number"
                  min={1}
                  value={l.duracao_dias}
                  onChange={(e) => editar(i, { duracao_dias: Number(e.target.value) })}
                  aria-label={`Duração em dias da linha ${i + 1}`}
                  title="Duração em dias"
                />
                <Select
                  value={l.fornecedor_id ?? SEM_PRESTADOR}
                  onValueChange={(v) => editar(i, { fornecedor_id: v === SEM_PRESTADOR ? null : v })}
                >
                  <SelectTrigger aria-label={`Prestador da linha ${i + 1}`}>
                    <SelectValue placeholder="Prestador padrão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_PRESTADOR}>Sem prestador</SelectItem>
                    {fornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={l.paralelo} onCheckedChange={(v) => editar(i, { paralelo: v })} />
                  Junto do anterior
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setLinhas((atual) => (atual.length > 1 ? atual.filter((_, j) => j !== i) : atual))}
                  aria-label={`Remover a linha ${i + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Input
                value={l.tarefas}
                onChange={(e) => editar(i, { tarefas: e.target.value })}
                placeholder="Tarefas, separadas por ponto e vírgula (opcional)"
                aria-label={`Tarefas da linha ${i + 1}`}
              />
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLinhas((atual) => [...atual, linhaVazia(atual[atual.length - 1])])}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Adicionar serviço
          </Button>
          <p className="text-xs text-muted-foreground">
            {plano.erro ? "Preencha fase, etapa e serviço." : `${duracaoTotalDias(plano)} dias no total.`}
          </p>
        </div>
      </div>
    </FormDialog>
  );
}

/** Lista dos fluxos de obra da empresa, com criar, editar e excluir. */
export function FluxosObraDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: fluxos = [], isLoading } = useFluxosObra();
  const excluir = useExcluirFluxoObra();
  const [editando, setEditando] = useState<FluxoObra | "novo" | null>(null);
  const [aExcluir, setAExcluir] = useState<FluxoObra | null>(null);
  const [sincronizar, setSincronizar] = useState<{ id: string; nome: string; estrutura: EstruturaFluxo } | null>(null);

  return (
    <>
      <Dialog open={open && editando === null} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Fluxos de obra</DialogTitle>
            <DialogDescription>
              Modelos de cronograma com duração e prestador padrão. Aplique ao criar uma obra ou no cronograma dela.
            </DialogDescription>
          </DialogHeader>
          {isLoading ? null : fluxos.length === 0 ? (
            <p className="rounded-xl bg-muted/60 px-3 py-4 text-sm text-muted-foreground">
              Nenhum fluxo ainda. Crie um aqui ou, numa obra pronta, use "Salvar como fluxo" no cronograma.
            </p>
          ) : (
            <ul className="divide-y divide-black/5">
              {fluxos.map((f) => (
                <li key={f.id} className="flex items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{f.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {contarServicos(f)} serviços · {duracaoTotalDias(planoDoFluxo(f.estrutura, "2026-01-01"))} dias
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditando(f)}
                    aria-label={`Editar ${f.nome}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setAExcluir(f)}
                    aria-label={`Excluir ${f.nome}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="brand" onClick={() => setEditando("novo")}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Novo fluxo
          </Button>
        </DialogContent>
      </Dialog>

      {editando !== null && (
        <EditorFluxoObra
          fluxo={editando === "novo" ? null : editando}
          onFechar={() => setEditando(null)}
          onAtualizado={setSincronizar}
        />
      )}

      <SincronizarObrasDialog fluxo={sincronizar} onOpenChange={(v) => !v && setSincronizar(null)} />

      <ConfirmDialog
        open={!!aExcluir}
        onOpenChange={(v) => !v && setAExcluir(null)}
        onConfirm={async () => {
          if (!aExcluir) return;
          try {
            await excluir.mutateAsync(aExcluir.id);
            setAExcluir(null);
          } catch {
            toast.error("Não foi possível excluir", { description: "Tente de novo." });
          }
        }}
        title="Excluir fluxo?"
        itemName={aExcluir?.nome}
        description="As obras que já usaram esse fluxo não mudam."
        variant="destructive"
        confirmText="Excluir"
        loading={excluir.isPending}
      />
    </>
  );
}
