import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Calendar,
  CircleDot,
  Clock,
  Flag,
  History,
  Layers,
  ListChecks,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";
import { PROJECT_PRIORITY, PRIORITY_OPTIONS, PROJECT_PRIORITY_CONFIG } from "@/constants";
import { type DisciplinaComentario, type DisciplinaResponsavel, disciplinaStatusOptions } from "@/types/projetos";
import { DatePicker } from "@/components/ui/date-picker";
import { LabelsEditor } from "@/components/LabelsEditor";
import { LinksEditor, type LinkItem } from "@/components/LinksEditor";
import { SeletorResponsaveis } from "@/components/SeletorResponsaveis";
import { HorasMinutosField } from "@/components/HorasMinutosField";
import { AtividadeComposer } from "./AtividadeComposer";
import { useDisciplinaChecklist } from "@/hooks/useProjetoDisciplinaChecklist";
import { useDisciplinaPausas, totalDiasParados } from "@/hooks/useDisciplinaPausas";
import { useDisciplinaRevisoes, revisaoAberta } from "@/hooks/useDisciplinaRevisoes";
import { FormDialog } from "@/components/FormDialog";
import { formatDate, formatDateTime } from "@/lib/format";
import { notificarMencao } from "@/lib/notificarMencao";

interface DisciplinaDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disciplina: DisciplinaResponsavel | null;
  disciplinas: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
  onUpdateField: (field: keyof DisciplinaResponsavel, value: string) => void;
  onUpdateResponsaveis: (ids: string[]) => void;
  /** Opcionais: só a disciplina persistida (detalhe do projeto) edita estes. */
  onUpdateLabels?: (next: string[]) => void;
  onUpdateLinks?: (next: LinkItem[]) => void;
  onUpdateComentarios?: (next: DisciplinaComentario[]) => void | Promise<void>;
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
  onUpdateResponsaveis,
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
  const persistida = !!disciplina.id;
  const comentarios = disciplina.comentarios ?? [];
  const temAtividades = persistida && !!onUpdateComentarios;
  const checklist = useDisciplinaChecklist(persistida ? disciplina.id : undefined);
  const checklistItens = checklist.data ?? [];
  const checklistConcluidos = checklistItens.filter((i) => i.concluido).length;
  const checklistIncompleto = checklistItens.length > 0 && checklistConcluidos < checklistItens.length;
  const [novoItemChecklist, setNovoItemChecklist] = useState("");

  const pausas = useDisciplinaPausas(persistida ? disciplina.id : undefined);
  const historicoPausas = pausas.data ?? [];
  const diasParados = totalDiasParados(historicoPausas);
  // `disciplina.status` é um snapshot que o componente pai não resincroniza sozinho após a
  // mutation (fica preso em "Em Andamento" até o dialog reabrir); o histórico de pausas já
  // vem fresco da própria query, então é a fonte confiável pra saber se está pausada agora.
  const estaPausada = historicoPausas.some((p) => !p.retomado_em);
  const [pausarOpen, setPausarOpen] = useState(false);
  const [motivoPausa, setMotivoPausa] = useState("");

  const abrirPausar = () => {
    setMotivoPausa("");
    setPausarOpen(true);
  };

  const confirmarPausar = () => {
    if (!motivoPausa.trim()) return;
    pausas.pausar.mutate(motivoPausa.trim(), {
      onSuccess: () => {
        setPausarOpen(false);
        // A mutation não passa por onUpdateField, então o pai (dono do `disciplina.status`
        // exibido) não se resincroniza sozinho: atualiza aqui pro Select/texto não ficar preso.
        onUpdateField("status", "Pausada");
      },
    });
  };

  const confirmarRetomar = () => {
    pausas.retomar.mutate(undefined, { onSuccess: () => onUpdateField("status", "Em Andamento") });
  };

  const revisoes = useDisciplinaRevisoes(persistida ? disciplina.id : undefined);
  const historicoRevisoes = revisoes.data ?? [];
  const revisaoEmAberto = revisaoAberta(historicoRevisoes);
  const [revisarOpen, setRevisarOpen] = useState(false);
  const [motivoRevisao, setMotivoRevisao] = useState("");
  const [dataRevisao, setDataRevisao] = useState<string | undefined>(undefined);

  const abrirRevisar = () => {
    setMotivoRevisao("");
    setDataRevisao(undefined);
    setRevisarOpen(true);
  };

  const confirmarRevisar = () => {
    if (!motivoRevisao.trim()) return;
    revisoes.registrar.mutate(
      { motivo: motivoRevisao.trim(), solicitadaEm: dataRevisao },
      { onSuccess: () => setRevisarOpen(false) }
    );
  };

  const confirmarConcluirRevisao = () => {
    if (!revisaoEmAberto) return;
    revisoes.concluir.mutate(revisaoEmAberto.id);
  };

  const salvarDescricao = () => {
    if (!onUpdateDescricao || descricao === (disciplina.descricao ?? "")) return;
    onUpdateDescricao(descricao);
  };

  const adicionarComentario = async (texto: string, mencionados: string[]) => {
    if (!onUpdateComentarios) return;
    await onUpdateComentarios([
      ...comentarios,
      {
        id: crypto.randomUUID(),
        texto,
        autor: autorNome,
        data: new Date().toISOString(),
        mencionados: mencionados.length ? mencionados : undefined,
      },
    ]);
    if (disciplina.id) await notificarMencao("disciplina", disciplina.id, mencionados, texto);
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
              className="flex-shrink-0 gap-1.5 text-muted-foreground hover:text-danger-mid"
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
              <Prop icon={CircleDot} label="Status" className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <Select
                    value={estaPausada ? "Pausada" : disciplina.status}
                    onValueChange={(val) => onUpdateField("status", val)}
                    disabled={estaPausada}
                  >
                    <SelectTrigger className="h-9 w-56 min-w-0 flex-shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {disciplinaStatusOptions.map((opt) => (
                        <SelectItem
                          key={opt}
                          value={opt}
                          disabled={(opt === "Concluído" && checklistIncompleto) || opt === "Pausada"}
                          title={
                            opt === "Concluído" && checklistIncompleto
                              ? "Conclua todos os itens do checklist antes"
                              : opt === "Pausada"
                                ? "Use o botão Pausar, ao lado, pra registrar o motivo"
                                : undefined
                          }
                        >
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {persistida &&
                    (estaPausada ? (
                      <Button
                        type="button"
                        variant="brand"
                        size="sm"
                        className="h-9 flex-shrink-0 gap-1.5"
                        onClick={confirmarRetomar}
                        disabled={pausas.retomar.isPending}
                      >
                        <Play className="h-3.5 w-3.5" /> Retomar
                      </Button>
                    ) : (
                      disciplina.status === "Em Andamento" && (
                        <Button
                          type="button"
                          variant="brand"
                          size="sm"
                          className="h-9 flex-shrink-0 gap-1.5"
                          onClick={abrirPausar}
                        >
                          <Pause className="h-3.5 w-3.5" /> Pausar
                        </Button>
                      )
                    ))}
                  {persistida &&
                    disciplina.status !== "Não Iniciado" &&
                    (revisaoEmAberto ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 flex-shrink-0 gap-1.5"
                        onClick={confirmarConcluirRevisao}
                        disabled={revisoes.concluir.isPending}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Concluir revisão
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 flex-shrink-0 gap-1.5"
                        onClick={abrirRevisar}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Registrar revisão
                      </Button>
                    ))}
                </div>
              </Prop>

              <Prop icon={User} label="Responsáveis">
                <SeletorResponsaveis
                  value={(disciplina.responsaveis ?? []).map((r) => r.responsavel_id).filter(Boolean)}
                  pessoas={pessoas}
                  onChange={onUpdateResponsaveis}
                />
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
                          <span className={`h-2 w-2 rounded-full ${PROJECT_PRIORITY_CONFIG[p].dotColor}`} />
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

              {(onUpdateHorasEstimadas || onUpdateHorasRealizadas) && (
                <Prop icon={Clock} label="Horas" className="md:col-span-2">
                  <div className="flex flex-wrap items-center gap-6">
                    {onUpdateHorasEstimadas && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Estimadas</span>
                        <HorasMinutosField
                          value={disciplina.horas_estimadas ?? null}
                          onChange={(n) => onUpdateHorasEstimadas(n ?? 0)}
                        />
                      </div>
                    )}
                    {onUpdateHorasRealizadas && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Reais</span>
                        <HorasMinutosField
                          value={disciplina.horas_realizadas ?? null}
                          onChange={(n) => onUpdateHorasRealizadas(n ?? 0)}
                        />
                      </div>
                    )}
                  </div>
                </Prop>
              )}

              <Prop icon={Calendar} label="Datas" className="md:col-span-2">
                <div className="grid grid-cols-3 gap-3 max-w-xl">
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

            {persistida && historicoPausas.length > 0 && (
              <div className="space-y-2 border-t pt-6">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold">
                    <History className="h-4 w-4" /> Histórico de pausas
                  </Label>
                  <span className="text-xs font-medium text-muted-foreground">
                    {diasParados.toFixed(1)} dia(s) parado no total
                  </span>
                </div>
                <ul className="space-y-2">
                  {historicoPausas.map((p) => (
                    <li key={p.id} className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      <p className="text-ink">{p.motivo}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Pausado {p.pausado_por_nome ? `por ${p.pausado_por_nome} ` : ""}em{" "}
                        {formatDateTime(p.pausado_em)}
                        {p.retomado_em ? (
                          <>
                            {" "}
                            · retomado {p.retomado_por_nome ? `por ${p.retomado_por_nome} ` : ""}em{" "}
                            {formatDateTime(p.retomado_em)}
                          </>
                        ) : (
                          " · em aberto"
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {persistida && historicoRevisoes.length > 0 && (
              <div className="space-y-2 border-t pt-6">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold">
                    <RotateCcw className="h-4 w-4" /> Histórico de revisões
                  </Label>
                  <span className="text-xs font-medium text-muted-foreground">
                    {historicoRevisoes.length} {historicoRevisoes.length === 1 ? "revisão" : "revisões"}
                  </span>
                </div>
                <ul className="space-y-2">
                  {historicoRevisoes.map((r) => (
                    <li key={r.id} className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      <p className="text-ink">{r.motivo}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Registrada {r.registrada_por_nome ? `por ${r.registrada_por_nome} ` : ""}em{" "}
                        {formatDate(r.solicitada_em)}
                        {r.concluida_em ? (
                          <>
                            {" "}
                            · concluída {r.concluida_por_nome ? `por ${r.concluida_por_nome} ` : ""}em{" "}
                            {formatDate(r.concluida_em)}
                          </>
                        ) : (
                          " · em aberto"
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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

            {persistida && (
              <div className="space-y-2 border-t pt-6">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <ListChecks className="h-4 w-4" /> Checklist
                  {checklistItens.length > 0 && (
                    <span className="font-normal text-xs text-muted-foreground">
                      {checklistConcluidos}/{checklistItens.length}
                    </span>
                  )}
                </Label>
                <div className="max-w-2xl space-y-1">
                  {checklistItens.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/40">
                      <Checkbox
                        checked={item.concluido}
                        onCheckedChange={(checked) =>
                          checklist.toggleItem.mutate({ id: item.id, concluido: checked === true })
                        }
                      />
                      <span className={item.concluido ? "text-sm text-muted-foreground line-through" : "text-sm"}>
                        {item.texto}
                      </span>
                      <button
                        type="button"
                        className="ml-auto text-muted-foreground hover:text-danger-mid"
                        onClick={() => checklist.removeItem.mutate(item.id)}
                        aria-label={`Remover item ${item.texto}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <Input
                      value={novoItemChecklist}
                      onChange={(e) => setNovoItemChecklist(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" || !novoItemChecklist.trim()) return;
                        e.preventDefault();
                        checklist.addItem.mutate(novoItemChecklist.trim());
                        setNovoItemChecklist("");
                      }}
                      placeholder="Adicionar item…"
                      className="h-9 text-sm"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      disabled={!novoItemChecklist.trim()}
                      onClick={() => {
                        checklist.addItem.mutate(novoItemChecklist.trim());
                        setNovoItemChecklist("");
                      }}
                      aria-label="Adicionar item ao checklist"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
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
                  <Button
                    type="button"
                    size="icon"
                    variant="brand"
                    onClick={onAddObservation}
                    aria-label="Adicionar observação"
                  >
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

      <FormDialog
        open={pausarOpen}
        onOpenChange={setPausarOpen}
        title="Pausar disciplina"
        description="Registra o motivo e a data de início da pausa. Fica no histórico até você retomar."
        size="sm"
        onSubmit={confirmarPausar}
        submitLabel="Pausar"
        isPending={pausas.pausar.isPending}
        submitDisabled={!motivoPausa.trim()}
      >
        <div className="space-y-2">
          <Label htmlFor="motivo-pausa">Motivo</Label>
          <Textarea
            id="motivo-pausa"
            value={motivoPausa}
            onChange={(e) => setMotivoPausa(e.target.value)}
            placeholder="Ex.: aguardando confirmação do cliente sobre o briefing"
            rows={3}
            autoFocus
          />
        </div>
      </FormDialog>

      <FormDialog
        open={revisarOpen}
        onOpenChange={setRevisarOpen}
        title="Registrar revisão"
        description="Documenta um retrabalho nesta disciplina. Fica no histórico até você concluir."
        size="sm"
        onSubmit={confirmarRevisar}
        submitLabel="Registrar"
        isPending={revisoes.registrar.isPending}
        submitDisabled={!motivoRevisao.trim()}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="motivo-revisao">Motivo</Label>
            <Textarea
              id="motivo-revisao"
              value={motivoRevisao}
              onChange={(e) => setMotivoRevisao(e.target.value)}
              placeholder="Ex.: cliente pediu mudar a posição do pilar P12"
              rows={3}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Data da solicitação</Label>
            <DatePicker value={dataRevisao} onChange={setDataRevisao} placeholder="Hoje" />
          </div>
        </div>
      </FormDialog>
    </div>
  );
}
