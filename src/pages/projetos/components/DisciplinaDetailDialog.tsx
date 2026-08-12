import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Calendar, CircleDot, Clock, Flag, Layers, MessageSquare, Plus, Tag, Trash2, User } from "lucide-react";
import { PROJECT_PRIORITY, PRIORITY_OPTIONS, PROJECT_PRIORITY_CONFIG } from "@/constants";
import { type DisciplinaComentario, type DisciplinaResponsavel, disciplinaStatusOptions } from "@/types/projetos";
import { DatePicker } from "@/components/ui/date-picker";
import { LabelsEditor } from "@/components/LabelsEditor";
import { LinksEditor, type LinkItem } from "@/components/LinksEditor";
import { AtividadeComposer } from "./AtividadeComposer";

interface DisciplinaDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disciplina: DisciplinaResponsavel | null;
  disciplinas: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
  onUpdateField: (field: keyof DisciplinaResponsavel, value: string) => void;
  onUpdateResponsavel: (val: string, nome: string) => void;
  /** Opcionais: só a disciplina persistida (detalhe do projeto) edita estes. */
  onUpdateLabels?: (next: string[]) => void;
  onUpdateLinks?: (next: LinkItem[]) => void;
  onUpdateComentarios?: (next: DisciplinaComentario[]) => void;
  onUpdateDescricao?: (next: string) => void;
  onUpdateHorasEstimadas?: (n: number) => void;
  onUpdateHorasRealizadas?: (n: number) => void;
  autorNome?: string;
  /** Fallback pré-save (chat/criação): observação em texto simples. */
  newObservation?: string;
  onNewObservationChange?: (val: string) => void;
  onAddObservation?: () => void;
  /** Datas do projeto: limitam as datas da disciplina ao "guarda-chuva" do projeto. */
  projetoDataInicio?: string;
  projetoDataPrevisao?: string;
  /** Excluir a disciplina persistida. Ausente = sem botão de excluir. */
  onDelete?: () => void;
}

function priorityDot(p: string): string {
  return p === PROJECT_PRIORITY.ALTA ? "bg-red-500" : p === PROJECT_PRIORITY.MEDIA ? "bg-amber-400" : "bg-blue-400";
}

function isoSlice(d?: string | null): string | undefined {
  return d ? d.slice(0, 10) : undefined;
}

/** Maior data (limite inferior mais restritivo) entre as informadas. */
function laterOf(...ds: (string | null | undefined)[]): string | undefined {
  const v = ds.map(isoSlice).filter(Boolean) as string[];
  return v.length ? [...v].sort()[v.length - 1] : undefined;
}

/** Menor data (limite superior mais restritivo) entre as informadas. */
function earlierOf(...ds: (string | null | undefined)[]): string | undefined {
  const v = ds.map(isoSlice).filter(Boolean) as string[];
  return v.length ? [...v].sort()[0] : undefined;
}

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
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <span className="flex w-32 flex-shrink-0 items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export function DisciplinaDetailDialog(props: DisciplinaDetailDialogProps) {
  const { open, onOpenChange, disciplina } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none w-[96vw] h-[92vh] p-0 gap-0 overflow-hidden flex flex-col">
        {disciplina && <DisciplinaDetailBody key={disciplina.id ?? "nova"} {...props} disciplina={disciplina} />}
      </DialogContent>
    </Dialog>
  );
}

/** Corpo remontado por `key` a cada disciplina — estado local nasce limpo. */
function DisciplinaDetailBody({
  disciplina,
  disciplinas,
  pessoas,
  onUpdateField,
  onUpdateResponsavel,
  onUpdateLabels,
  onUpdateLinks,
  onUpdateComentarios,
  onUpdateDescricao,
  onUpdateHorasEstimadas,
  onUpdateHorasRealizadas,
  autorNome = "Usuário",
  newObservation,
  onNewObservationChange,
  onAddObservation,
  projetoDataInicio,
  projetoDataPrevisao,
  onDelete,
}: DisciplinaDetailDialogProps & { disciplina: DisciplinaResponsavel }) {
  const [descricao, setDescricao] = useState(disciplina.descricao ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [horasEst, setHorasEst] = useState(
    disciplina.horas_estimadas != null ? String(disciplina.horas_estimadas) : ""
  );
  const [horasReal, setHorasReal] = useState(
    disciplina.horas_realizadas != null ? String(disciplina.horas_realizadas) : ""
  );
  const persistida = !!disciplina.id;
  const comentarios = disciplina.comentarios ?? [];
  const temAtividades = persistida && !!onUpdateComentarios;

  const salvarNumero = (raw: string, inicial: string, save?: (n: number) => void) => {
    if (!save || raw.trim() === inicial.trim()) return;
    const n = raw.trim() ? Number(raw) : 0;
    save(Number.isNaN(n) ? 0 : n);
  };

  const salvarDescricao = () => {
    if (!onUpdateDescricao || descricao === (disciplina.descricao ?? "")) return;
    onUpdateDescricao(descricao);
  };

  const adicionarComentario = (texto: string, mencionados: string[]) => {
    if (!onUpdateComentarios) return;
    onUpdateComentarios([
      ...comentarios,
      {
        id: crypto.randomUUID(),
        texto,
        autor: autorNome,
        data: new Date().toISOString(),
        mencionados: mencionados.length ? mencionados : undefined,
      },
    ]);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Cabeçalho */}
      <div className="flex-shrink-0 border-b px-8 pt-6 pb-4">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Layers className="h-3 w-3" /> {disciplina.codigo || "Disciplina"}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">{disciplina.disciplina || "Disciplina"}</DialogTitle>
          </DialogHeader>
          {onDelete && persistida && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0 gap-1.5 text-muted-foreground hover:text-red-600"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          )}
        </div>
      </div>

      {/* Corpo: principal (redimensionável) + atividades */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={68} minSize={45}>
          <div className="h-full space-y-7 overflow-y-auto px-8 py-6">
            {/* Propriedades em grade 2 colunas */}
            <div className="grid max-w-3xl grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
              <Prop icon={CircleDot} label="Status">
                <Select value={disciplina.status} onValueChange={(val) => onUpdateField("status", val)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {disciplinaStatusOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Prop>

              <Prop icon={User} label="Responsável">
                <Select
                  value={disciplina.responsavel_id}
                  onValueChange={(val) => {
                    const pessoa = pessoas.find((p) => p.id === val);
                    onUpdateResponsavel(val, pessoa?.nome || "");
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pessoas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Prop>

              <Prop icon={Flag} label="Prioridade">
                <Select
                  value={disciplina.prioridade || PROJECT_PRIORITY.MEDIA}
                  onValueChange={(val) => onUpdateField("prioridade", val)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${priorityDot(p)}`} />
                          {PROJECT_PRIORITY_CONFIG[p].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Prop>

              <Prop icon={Layers} label="Disciplina">
                <Select value={disciplina.disciplina} onValueChange={(val) => onUpdateField("disciplina", val)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {disciplinas.map((d) => (
                      <SelectItem key={d.id} value={d.nome}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Prop>

              {onUpdateHorasEstimadas && (
                <Prop icon={Clock} label="Horas est.">
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    inputMode="decimal"
                    value={horasEst}
                    onChange={(e) => setHorasEst(e.target.value)}
                    onBlur={() =>
                      salvarNumero(
                        horasEst,
                        disciplina.horas_estimadas != null ? String(disciplina.horas_estimadas) : "",
                        onUpdateHorasEstimadas
                      )
                    }
                    className="h-9"
                    placeholder="0"
                  />
                </Prop>
              )}

              {onUpdateHorasRealizadas && (
                <Prop icon={Clock} label="Horas reais">
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    inputMode="decimal"
                    value={horasReal}
                    onChange={(e) => setHorasReal(e.target.value)}
                    onBlur={() =>
                      salvarNumero(
                        horasReal,
                        disciplina.horas_realizadas != null ? String(disciplina.horas_realizadas) : "",
                        onUpdateHorasRealizadas
                      )
                    }
                    className="h-9"
                    placeholder="0"
                  />
                </Prop>
              )}

              <Prop icon={Calendar} label="Datas" className="md:col-span-2">
                <div className="grid grid-cols-3 gap-2 max-w-md">
                  <DatePicker
                    value={(disciplina.data_inicio || "").slice(0, 10) || undefined}
                    onChange={(v) => onUpdateField("data_inicio", v)}
                    placeholder="Início"
                    minDate={isoSlice(projetoDataInicio)}
                    maxDate={earlierOf(disciplina.data_previsao, disciplina.data_final, projetoDataPrevisao)}
                  />
                  <DatePicker
                    value={(disciplina.data_previsao || "").slice(0, 10) || undefined}
                    onChange={(v) => onUpdateField("data_previsao", v)}
                    placeholder="Previsão"
                    minDate={laterOf(disciplina.data_inicio, projetoDataInicio)}
                    maxDate={isoSlice(projetoDataPrevisao)}
                  />
                  <DatePicker
                    value={(disciplina.data_final || "").slice(0, 10) || undefined}
                    onChange={(v) => onUpdateField("data_final", v)}
                    placeholder="Final"
                    minDate={laterOf(disciplina.data_inicio, projetoDataInicio)}
                  />
                </div>
              </Prop>

              {onUpdateLabels && (
                <Prop icon={Tag} label="Etiquetas" className="md:col-span-2">
                  <LabelsEditor value={disciplina.labels ?? []} onChange={onUpdateLabels} />
                </Prop>
              )}
            </div>

            {onUpdateDescricao && (
              <div className="space-y-2 border-t pt-6">
                <Label className="text-sm font-semibold">Descrição</Label>
                <Textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  onBlur={salvarDescricao}
                  rows={5}
                  placeholder="Detalhes, escopo, o que precisa ser entregue..."
                />
              </div>
            )}

            {onUpdateLinks && (
              <div className="space-y-2 border-t pt-6">
                <Label className="text-sm font-semibold">Links</Label>
                <div className="max-w-2xl">
                  <LinksEditor value={disciplina.links ?? []} onChange={onUpdateLinks} />
                </div>
              </div>
            )}
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

            {temAtividades ? (
              <>
                <div className="flex-1 min-h-0 space-y-2 overflow-y-auto px-5 py-4">
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
                <div className="flex-shrink-0 border-t bg-background/60 p-4">
                  <AtividadeComposer pessoas={pessoas} onSubmit={adicionarComentario} />
                </div>
              </>
            ) : onAddObservation ? (
              <div className="p-5">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nova observação..."
                    value={newObservation ?? ""}
                    onChange={(e) => onNewObservationChange?.(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onAddObservation();
                      }
                    }}
                  />
                  <Button type="button" size="icon" onClick={onAddObservation} aria-label="Adicionar observação">
                    <Plus size={16} />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="p-5 text-xs text-muted-foreground">Salve a disciplina para comentar.</p>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir disciplina</AlertDialogTitle>
            <AlertDialogDescription>
              A disciplina "{disciplina.disciplina}" e seus dados serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                setConfirmDelete(false);
                onDelete?.();
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
