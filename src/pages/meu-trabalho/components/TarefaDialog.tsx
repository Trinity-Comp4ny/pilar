import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DatePicker } from "@/components/ui/date-picker";
import { LabelsEditor } from "@/components/LabelsEditor";
import { LinksEditor, type LinkItem } from "@/components/LinksEditor";
import { AtividadeComposer } from "@/pages/projetos/components/AtividadeComposer";
import { AvatarStack } from "@/components/AvatarStack";
import { HorasMinutosField } from "./HorasMinutosField";
import {
  Calendar,
  Check,
  CheckSquare,
  Circle,
  Clock,
  Flag,
  FolderOpen,
  MessageSquare,
  Tag,
  User,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRIORIDADE_DOT_CLASS,
  PRIORIDADE_LABEL,
  PRIORIDADE_ORDER,
  corDaEtapa,
  type Prioridade,
  type StatusBucket,
} from "../status";
import type { Etapa } from "../useEtapas";
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

/** Seleção de vários responsáveis: pilha de avatares no gatilho, toggle na lista. */
function SeletorResponsaveis({
  value,
  pessoas,
  disabled,
  onChange,
}: {
  value: string[];
  pessoas: PessoaOpcao[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selecionadas = pessoas.filter((p) => value.includes(p.id));

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border bg-background px-3 text-sm",
          disabled ? "cursor-not-allowed opacity-60" : "hover:bg-muted/40"
        )}
      >
        {selecionadas.length > 0 ? (
          <>
            <AvatarStack pessoas={selecionadas} size="xs" />
            <span className="min-w-0 flex-1 truncate text-left">
              {selecionadas.length === 1 ? selecionadas[0].nome : `${selecionadas.length} responsáveis`}
            </span>
          </>
        ) : (
          <span className="flex flex-1 items-center gap-1.5 text-left text-muted-foreground">
            <UserPlus className="h-4 w-4" /> Sem responsável
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Buscar pessoa..." className="h-9" />
          <CommandList>
            <CommandEmpty>Ninguém encontrado.</CommandEmpty>
            <CommandGroup>
              {pessoas.map((p) => {
                const marcado = value.includes(p.id);
                return (
                  <CommandItem
                    key={p.id}
                    value={p.nome}
                    onSelect={() => toggle(p.id)}
                    className={cn("gap-2", marcado && "font-medium")}
                  >
                    <AvatarStack pessoas={[p]} size="xs" />
                    <span className="flex-1 truncate">{p.nome}</span>
                    {marcado && <Check className="h-4 w-4 text-brand" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preenchida = edição; ausente = criação. */
  tarefa?: TarefaItem | null;
  pessoas: PessoaOpcao[];
  projetos: PessoaOpcao[];
  /** Colunas (etapas) do quadro, para o campo de status. */
  etapas: Etapa[];
  /** Etapa inicial numa nova tarefa (coluna onde ela nasce). */
  defaultEtapaId?: string | null;
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
  etapas,
  defaultEtapaId,
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
  // Status = coluna (etapa) do quadro. Editável aqui e por drag no board; ambos
  // gravam etapa_id + o bucket derivado da coluna. Cai na etapa passada, na do
  // item em edição, ou na primeira "A fazer".
  const etapasOrdenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const etapaFallback = etapasOrdenadas.find((e) => e.bucket === "a_fazer")?.id ?? etapasOrdenadas[0]?.id ?? null;
  const [etapaId, setEtapaId] = useState<string | null>(tarefa?.etapa_id ?? defaultEtapaId ?? etapaFallback);
  const statusDaEtapa = (id: string | null): StatusBucket =>
    etapasOrdenadas.find((e) => e.id === id)?.bucket ?? tarefa?.status ?? "a_fazer";
  const [prioridade, setPrioridade] = useState<Prioridade>(tarefa?.prioridade ?? "media");
  const [responsaveis, setResponsaveis] = useState<string[]>(
    tarefa ? tarefa.responsaveis.map((r) => r.id) : defaultResponsavelId ? [defaultResponsavelId] : []
  );
  const [projetoId, setProjetoId] = useState<string | null>(tarefa?.projeto_id ?? null);
  const [prazo, setPrazo] = useState(tarefa?.prazo ?? "");
  const [horas, setHoras] = useState<number | null>(tarefa?.horas_estimadas ?? null);
  const [horasReais, setHorasReais] = useState<number | null>(tarefa?.horas_reais ?? null);
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
    await onSave({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      status: statusDaEtapa(etapaId),
      etapa_id: etapaId,
      prioridade,
      responsaveis,
      projeto_id: projetoId,
      prazo: prazo || null,
      horas_estimadas: horas,
      horas_reais: horasReais,
      labels,
      links,
      comentarios,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Cabeçalho: chip + título editável */}
      <div className="flex-shrink-0 border-b px-10 pt-8 pb-5">
        <DialogTitle className="sr-only">
          {readOnly ? "Detalhes da tarefa" : tarefa ? "Editar tarefa" : "Nova tarefa"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Propriedades e descrição à esquerda; atividades à direita.
        </DialogDescription>
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <CheckSquare className="h-3 w-3" /> Tarefa
          </span>
          {tarefa?.numero != null && (
            <span className="font-mono text-xs text-muted-foreground/70">#{tarefa.numero}</span>
          )}
        </div>
        <Input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Nome da tarefa"
          autoFocus={!readOnly}
          disabled={readOnly}
          className="h-auto border-0 bg-transparent px-1 text-2xl font-semibold shadow-none focus-visible:ring-0"
        />
      </div>

      {/* Corpo: principal (redimensionável) + atividades */}
      <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize={68} minSize={45}>
          <div className="h-full space-y-7 overflow-y-auto px-8 py-6">
            {/* Propriedades em grade 2 colunas */}
            <div className="grid max-w-3xl grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
              <Prop icon={Circle} label="Status">
                <Select
                  value={etapaId ?? undefined}
                  onValueChange={(v) => setEtapaId(v)}
                  disabled={readOnly || etapasOrdenadas.length === 0}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Sem coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {etapasOrdenadas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        <span className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: corDaEtapa(e.cor, e.bucket) }}
                          />
                          {e.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Prop>

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

              <Prop icon={User} label="Responsáveis">
                <SeletorResponsaveis
                  value={responsaveis}
                  pessoas={pessoas}
                  disabled={readOnly || !podeEscolherResponsavel}
                  onChange={setResponsaveis}
                />
              </Prop>

              <Prop icon={Calendar} label="Prazo">
                <DatePicker value={prazo || undefined} onChange={setPrazo} placeholder="Sem prazo" />
              </Prop>

              <Prop icon={FolderOpen} label="Projeto" className="md:col-span-2">
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

              <Prop icon={Clock} label="Horas est.">
                <HorasMinutosField value={horas} onChange={setHoras} disabled={readOnly} />
              </Prop>

              <Prop icon={Clock} label="Horas reais">
                <HorasMinutosField value={horasReais} onChange={setHorasReais} disabled={readOnly} />
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
        {open && (
          <TarefaFormBody
            key={tarefa?.id ?? `nova-${rest.defaultEtapaId ?? "padrao"}`}
            tarefa={tarefa}
            onOpenChange={onOpenChange}
            {...rest}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
