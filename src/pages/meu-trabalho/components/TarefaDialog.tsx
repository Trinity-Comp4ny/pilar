import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { LabelsEditor } from "@/components/LabelsEditor";
import { LinksEditor, type LinkItem } from "@/components/LinksEditor";
import { AtividadeComposer } from "@/pages/projetos/components/AtividadeComposer";
import { Calendar, CheckSquare, Clock, Flag, FolderOpen, MessageSquare, Tag, User } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRIORIDADE_DOT_CLASS,
  PRIORIDADE_LABEL,
  PRIORIDADE_ORDER,
  type Prioridade,
  type StatusBucket,
} from "../status";
import type { Comentario, PessoaOpcao, TarefaInput, TarefaItem } from "../hooks";

const SEM = "__none__";

/** Linha de propriedade no padrão ClickUp: ícone + rótulo cinza + controle. */
function Prop({
  icon: Icon,
  label,
  className,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="flex w-32 flex-shrink-0 items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preenchida = edição; ausente = criação. */
  tarefa?: TarefaItem | null;
  pessoas: PessoaOpcao[];
  projetos: PessoaOpcao[];
  /** Responsável default numa nova tarefa (a pessoa do usuário). */
  defaultResponsavelId: string | null;
  /** Só admin escolhe o responsável; os demais criam já atribuído a si. */
  podeEscolherResponsavel?: boolean;
  /** Nome de quem assina os comentários novos (a pessoa do usuário). */
  autorNome: string;
  onSave: (input: TarefaInput) => Promise<void>;
  saving: boolean;
  /** Sem permissão de edição: mostra os detalhes, sem salvar. */
  readOnly?: boolean;
};

/**
 * Corpo do form. Inicializa o estado pelas props (sem efeito de sincronização):
 * o pai remonta este componente por `key` a cada abertura, dando estado limpo.
 * Mesmo layout do detalhe de disciplina (spec 013/014): propriedades à esquerda,
 * atividades à direita, painéis redimensionáveis.
 */
function TarefaFormBody({
  tarefa,
  pessoas,
  projetos,
  defaultResponsavelId,
  podeEscolherResponsavel = true,
  autorNome,
  onOpenChange,
  onSave,
  saving,
  readOnly = false,
}: Omit<Props, "open">) {
  const [titulo, setTitulo] = useState(tarefa?.titulo ?? "");
  const [descricao, setDescricao] = useState(tarefa?.descricao ?? "");
  // O status coarse acompanha a coluna (etapa) no board; aqui só é preservado.
  const [status] = useState<StatusBucket>(tarefa?.status ?? "a_fazer");
  const [prioridade, setPrioridade] = useState<Prioridade>(tarefa?.prioridade ?? "media");
  const [responsavelId, setResponsavelId] = useState<string | null>(
    tarefa ? tarefa.responsavel_id : defaultResponsavelId
  );
  const [projetoId, setProjetoId] = useState<string | null>(tarefa?.projeto_id ?? null);
  const [prazo, setPrazo] = useState(tarefa?.prazo ?? "");
  const [horas, setHoras] = useState(tarefa?.horas_estimadas != null ? String(tarefa.horas_estimadas) : "");
  const [horasReais, setHorasReais] = useState(tarefa?.horas_reais != null ? String(tarefa.horas_reais) : "");
  const [labels, setLabels] = useState<string[]>(tarefa?.labels ?? []);
  const [links, setLinks] = useState<LinkItem[]>(tarefa?.links ?? []);
  const [comentarios, setComentarios] = useState<Comentario[]>(tarefa?.comentarios ?? []);

  const podeSalvar = !readOnly && titulo.trim().length > 0 && !saving;

  const adicionarComentario = (texto: string) => {
    const t = texto.trim();
    if (!t) return;
    setComentarios((prev) => [
      ...prev,
      { id: crypto.randomUUID(), texto: t, autor: autorNome, data: new Date().toISOString() },
    ]);
  };

  const salvar = async () => {
    if (!podeSalvar) return;
    const horasNum = horas.trim() ? Number(horas) : null;
    const horasReaisNum = horasReais.trim() ? Number(horasReais) : null;
    await onSave({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      status,
      prioridade,
      responsavel_id: responsavelId,
      projeto_id: projetoId,
      prazo: prazo || null,
      horas_estimadas: horasNum != null && !Number.isNaN(horasNum) ? horasNum : null,
      horas_reais: horasReaisNum != null && !Number.isNaN(horasReaisNum) ? horasReaisNum : null,
      labels,
      links,
      comentarios,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Cabeçalho: chip + título editável */}
      <div className="flex-shrink-0 border-b px-8 pt-6 pb-4">
        <DialogTitle className="sr-only">
          {readOnly ? "Detalhes da tarefa" : tarefa ? "Editar tarefa" : "Nova tarefa"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Propriedades e descrição à esquerda; atividades à direita.
        </DialogDescription>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <CheckSquare className="h-3 w-3" /> Tarefa
          </span>
        </div>
        <Input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Nome da tarefa"
          autoFocus={!readOnly}
          disabled={readOnly}
          className="h-auto border-0 bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
        />
      </div>

      {/* Corpo: principal (redimensionável) + atividades */}
      <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize={68} minSize={45}>
          <div className="h-full space-y-7 overflow-y-auto px-8 py-6">
            {/* Propriedades em grade 2 colunas */}
            <div className="grid max-w-3xl grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
              <Prop icon={Flag} label="Prioridade">
                <Select value={prioridade} onValueChange={(v) => setPrioridade(v as Prioridade)} disabled={readOnly}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORIDADE_ORDER.map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 rounded-full", PRIORIDADE_DOT_CLASS[p])} />
                          {PRIORIDADE_LABEL[p]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Prop>

              <Prop icon={User} label="Responsável">
                <Select
                  value={responsavelId ?? SEM}
                  onValueChange={(v) => setResponsavelId(v === SEM ? null : v)}
                  disabled={readOnly || !podeEscolherResponsavel}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM}>Sem responsável</SelectItem>
                    {pessoas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Prop>

              <Prop icon={Calendar} label="Prazo">
                <DatePicker value={prazo || undefined} onChange={setPrazo} placeholder="Sem prazo" />
              </Prop>

              <Prop icon={Clock} label="Horas est.">
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  inputMode="decimal"
                  value={horas}
                  onChange={(e) => setHoras(e.target.value)}
                  className="h-9"
                  placeholder="opcional"
                  disabled={readOnly}
                />
              </Prop>

              <Prop icon={Clock} label="Horas reais">
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  inputMode="decimal"
                  value={horasReais}
                  onChange={(e) => setHorasReais(e.target.value)}
                  className="h-9"
                  placeholder="gastas até agora"
                  disabled={readOnly}
                />
              </Prop>

              <Prop icon={FolderOpen} label="Projeto">
                <Select
                  value={projetoId ?? SEM}
                  onValueChange={(v) => setProjetoId(v === SEM ? null : v)}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Sem projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM}>Sem projeto</SelectItem>
                    {projetos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Prop>

              <Prop icon={Tag} label="Etiquetas" className="md:col-span-2">
                <LabelsEditor value={labels} onChange={setLabels} readOnly={readOnly} />
              </Prop>
            </div>

            <div className="space-y-2 border-t pt-6">
              <Label className="text-sm font-semibold">Descrição</Label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={5}
                placeholder="Detalhes, contexto, o que precisa ser feito..."
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2 border-t pt-6">
              <Label className="text-sm font-semibold">Links (Drive, planilha, referência...)</Label>
              <div className="max-w-2xl">
                <LinksEditor value={links} onChange={setLinks} readOnly={readOnly} />
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Atividades */}
        <ResizablePanel defaultSize={32} minSize={22}>
          <div className="flex h-full min-h-0 flex-col bg-muted/10">
            <div className="flex-shrink-0 border-b px-5 py-4">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare size={16} /> Atividades
              </Label>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {comentarios.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">Nenhum comentário ainda</p>
              ) : (
                comentarios.map((c) => (
                  <div key={c.id} className="rounded-lg border bg-background p-3 text-sm shadow-sm">
                    <p className="whitespace-pre-wrap text-foreground">{c.texto}</p>
                    <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                      <span>{c.autor}</span>
                      <span>{new Date(c.data).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            {!readOnly && (
              <div className="flex-shrink-0 border-t bg-background/60 p-4">
                <AtividadeComposer pessoas={pessoas} onSubmit={(texto) => adicionarComentario(texto)} />
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Rodapé */}
      <DialogFooter className="flex-shrink-0 border-t px-8 py-3">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          {readOnly ? "Fechar" : "Cancelar"}
        </Button>
        {!readOnly && (
          <Button variant="brand" onClick={salvar} disabled={!podeSalvar}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}

export function TarefaDialog({ open, onOpenChange, tarefa, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-none flex-col gap-0 overflow-hidden p-0">
        {open && <TarefaFormBody key={tarefa?.id ?? "nova"} tarefa={tarefa} onOpenChange={onOpenChange} {...rest} />}
      </DialogContent>
    </Dialog>
  );
}
