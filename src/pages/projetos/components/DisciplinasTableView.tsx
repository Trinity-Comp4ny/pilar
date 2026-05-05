import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePicker } from "@/components/ui/date-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, MessageSquare, Plus, Trash2, User, X, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROJECT_PRIORITY, PROJECT_PRIORITY_CONFIG, PRIORITY_OPTIONS, type ProjectPriority } from "@/constants";
import {
  type DisciplinaResponsavel,
  type ProjetoDisciplinaDB,
  disciplinaStatusOptions,
  formatDateShort,
  isDiscAtrasada,
} from "@/types/projetos";

interface DisciplinasTableViewProps {
  canEdit: boolean;
  disciplinasLegacy: DisciplinaResponsavel[];
  dbDisciplinas: ProjetoDisciplinaDB[];
  disciplinasCatalog: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
  applyDiscStatusChange: (idx: number, newStatus: string, justificativa?: string) => Promise<void>;
  handleRemoveDisc: (idx: number) => Promise<void>;
  handleAddDisc: (newDisc: { disciplina: string; responsavel_id: string }) => Promise<void>;
  handleSaveDiscChanges: (editingDiscLocal: ProjetoDisciplinaDB) => Promise<void>;
  handleAddResponsavel: (discIdx: number, responsavelId: string) => Promise<void>;
  handleRemoveResponsavel: (discIdx: number, respIdx: number) => Promise<void>;
}

const STATUS_DOT: Record<string, string> = {
  Concluído: "bg-positive/100",
  "Em Andamento": "bg-blue-500",
  Pendente: "bg-amber-500",
  "Não Iniciado": "bg-gray-400",
};

export function DisciplinasTableView({
  canEdit,
  disciplinasLegacy,
  dbDisciplinas,
  disciplinasCatalog,
  pessoas,
  applyDiscStatusChange,
  handleRemoveDisc,
  handleAddDisc,
  handleSaveDiscChanges,
  handleAddResponsavel,
  handleRemoveResponsavel,
}: DisciplinasTableViewProps) {
  const [isAddingDisc, setIsAddingDisc] = useState(false);
  const [newDisc, setNewDisc] = useState({ disciplina: "", responsavel_id: "" });
  const [justificativaDialog, setJustificativaDialog] = useState<{ idx: number; newStatus: string } | null>(null);
  const [justificativaText, setJustificativaText] = useState("");
  const [concludingIdx, setConcludingIdx] = useState<number | null>(null);
  const [obsDraft, setObsDraft] = useState("");

  const quickUpdate = async (idx: number, patch: Partial<ProjetoDisciplinaDB>) => {
    const dbDisc = dbDisciplinas[idx];
    if (!dbDisc) return;
    await handleSaveDiscChanges({ ...dbDisc, ...patch });
  };

  const handleStatusChange = async (idx: number, newStatus: string) => {
    if (newStatus === "Concluído") {
      setConcludingIdx(idx);
      return;
    }
    const disc = disciplinasLegacy[idx];
    if (isDiscAtrasada(disc) && !disc.justificativa_atraso) {
      setJustificativaDialog({ idx, newStatus });
      setJustificativaText("");
      return;
    }
    await applyDiscStatusChange(idx, newStatus);
  };

  const onAddDisc = async () => {
    await handleAddDisc(newDisc);
    setNewDisc({ disciplina: "", responsavel_id: "" });
    setIsAddingDisc(false);
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {disciplinasLegacy.length} disciplina{disciplinasLegacy.length !== 1 ? "s" : ""}
          </p>
          {canEdit && !isAddingDisc && (
            <Button size="sm" variant="outline" onClick={() => setIsAddingDisc(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar disciplina
            </Button>
          )}
        </div>

        {disciplinasLegacy.length === 0 && !isAddingDisc ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border rounded-lg">
            <Layers className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhuma disciplina definida</p>
            {canEdit && (
              <Button size="sm" variant="outline" className="mt-4" onClick={() => setIsAddingDisc(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar disciplina
              </Button>
            )}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="h-9 text-[11px] uppercase tracking-wide">Disciplina</TableHead>
                  <TableHead className="h-9 text-[11px] uppercase tracking-wide w-[110px]">Prioridade</TableHead>
                  <TableHead className="h-9 text-[11px] uppercase tracking-wide w-[140px]">Status</TableHead>
                  <TableHead className="h-9 text-[11px] uppercase tracking-wide w-[130px]">Início</TableHead>
                  <TableHead className="h-9 text-[11px] uppercase tracking-wide w-[130px]">Previsão</TableHead>
                  <TableHead className="h-9 text-[11px] uppercase tracking-wide w-[130px]">Final</TableHead>
                  <TableHead className="h-9 text-[11px] uppercase tracking-wide w-[160px]">Responsáveis</TableHead>
                  <TableHead className="h-9 text-[11px] uppercase tracking-wide w-[60px]">Obs</TableHead>
                  {canEdit && <TableHead className="h-9 w-[40px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {disciplinasLegacy.map((disc, idx) => {
                  const dbDisc = dbDisciplinas[idx];
                  const atrasada = isDiscAtrasada(disc);
                  const dpc = disc.prioridade ? PROJECT_PRIORITY_CONFIG[disc.prioridade as ProjectPriority] : null;
                  const obsCount = dbDisc?.observacoes ? dbDisc.observacoes.split("\n").filter(Boolean).length : 0;

                  return (
                    <TableRow key={dbDisc?.id || idx} className={cn(atrasada && "bg-red-50/40")}>
                      {/* Disciplina */}
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          {canEdit ? (
                            <Select value={disc.disciplina} onValueChange={(v) => quickUpdate(idx, { nome: v })}>
                              <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted px-2 -ml-2 font-medium">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {disciplinasCatalog.map((d) => (
                                  <SelectItem key={d.id} value={d.nome} className="text-xs">
                                    {d.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm font-medium">{disc.disciplina}</span>
                          )}
                          {atrasada && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-red-100 text-red-700 flex items-center gap-1">
                              <AlertTriangle size={10} /> Atrasada
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Prioridade */}
                      <TableCell className="py-2">
                        {canEdit ? (
                          <Select
                            value={disc.prioridade || PROJECT_PRIORITY.MEDIA}
                            onValueChange={(v) => quickUpdate(idx, { prioridade: v })}
                          >
                            <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted px-2 -ml-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PRIORITY_OPTIONS.map((p) => (
                                <SelectItem key={p} value={p} className="text-xs">
                                  <span className="flex items-center gap-1.5">
                                    <span
                                      className={cn(
                                        "h-2 w-2 rounded-full",
                                        p === PROJECT_PRIORITY.ALTA
                                          ? "bg-red-500"
                                          : p === PROJECT_PRIORITY.MEDIA
                                            ? "bg-amber-400"
                                            : "bg-blue-400"
                                      )}
                                    />
                                    {PROJECT_PRIORITY_CONFIG[p].label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : dpc ? (
                          <span
                            className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", dpc.bgColor, dpc.color)}
                          >
                            {dpc.label}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-2">
                        {canEdit ? (
                          <Select
                            value={disc.status || "Não Iniciado"}
                            onValueChange={(v) => handleStatusChange(idx, v)}
                          >
                            <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted px-2 -ml-2">
                              <span className="flex items-center gap-1.5">
                                <span
                                  className={cn("h-2 w-2 rounded-full", STATUS_DOT[disc.status || "Não Iniciado"])}
                                />
                                <SelectValue />
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              {disciplinaStatusOptions.map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  <span className="flex items-center gap-1.5">
                                    <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s])} />
                                    {s}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className="text-[11px]">
                            {disc.status || "Não Iniciado"}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Início */}
                      <TableCell className="py-2">
                        {canEdit ? (
                          <DatePicker
                            value={disc.data_inicio || undefined}
                            onChange={(v) => quickUpdate(idx, { data_inicio: v || null })}
                            placeholder="—"
                            className="h-7 text-xs border-0 bg-transparent hover:bg-muted"
                          />
                        ) : (
                          <span className="text-xs">{disc.data_inicio ? formatDateShort(disc.data_inicio) : "—"}</span>
                        )}
                      </TableCell>

                      {/* Previsão */}
                      <TableCell className="py-2">
                        {canEdit ? (
                          <DatePicker
                            value={disc.data_previsao || undefined}
                            onChange={(v) => quickUpdate(idx, { data_fim: v || null })}
                            placeholder="—"
                            className="h-7 text-xs border-0 bg-transparent hover:bg-muted"
                          />
                        ) : (
                          <span className="text-xs">
                            {disc.data_previsao ? formatDateShort(disc.data_previsao) : "—"}
                          </span>
                        )}
                      </TableCell>

                      {/* Final */}
                      <TableCell className="py-2">
                        {canEdit ? (
                          <DatePicker
                            value={disc.data_final || undefined}
                            onChange={(v) => quickUpdate(idx, { data_fim_real: v || null })}
                            placeholder="—"
                            className="h-7 text-xs border-0 bg-transparent hover:bg-muted"
                          />
                        ) : (
                          <span className={cn("text-xs", disc.data_final && "text-positive font-medium")}>
                            {disc.data_final ? formatDateShort(disc.data_final) : "—"}
                          </span>
                        )}
                      </TableCell>

                      {/* Responsáveis */}
                      <TableCell className="py-2">
                        <ResponsaveisCell
                          discIdx={idx}
                          disc={disc}
                          dbDisc={dbDisc}
                          pessoas={pessoas}
                          canEdit={canEdit}
                          onAdd={handleAddResponsavel}
                          onRemove={handleRemoveResponsavel}
                        />
                      </TableCell>

                      {/* Observações */}
                      <TableCell className="py-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setObsDraft("")}
                            >
                              <MessageSquare className="h-3.5 w-3.5 mr-1" />
                              {obsCount > 0 ? obsCount : ""}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80" align="end">
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">Observações</Label>
                              <div className="rounded border max-h-60 overflow-y-auto p-2 bg-muted/30">
                                {!dbDisc?.observacoes ? (
                                  <p className="text-xs text-muted-foreground text-center py-3">Nenhuma observação</p>
                                ) : (
                                  <p className="text-xs whitespace-pre-line">{dbDisc.observacoes}</p>
                                )}
                              </div>
                              {canEdit && (
                                <div className="flex gap-1.5">
                                  <Input
                                    placeholder="Nova observação..."
                                    value={obsDraft}
                                    onChange={(e) => setObsDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && obsDraft.trim()) {
                                        e.preventDefault();
                                        const stamp = new Date().toLocaleString("pt-BR");
                                        const entry = `[${stamp}] ${obsDraft.trim()}`;
                                        const next = dbDisc?.observacoes ? `${dbDisc.observacoes}\n${entry}` : entry;
                                        quickUpdate(idx, { observacoes: next });
                                        setObsDraft("");
                                      }
                                    }}
                                    className="h-8 text-xs"
                                  />
                                  <Button
                                    size="sm"
                                    className="h-8"
                                    disabled={!obsDraft.trim()}
                                    onClick={() => {
                                      const stamp = new Date().toLocaleString("pt-BR");
                                      const entry = `[${stamp}] ${obsDraft.trim()}`;
                                      const next = dbDisc?.observacoes ? `${dbDisc.observacoes}\n${entry}` : entry;
                                      quickUpdate(idx, { observacoes: next });
                                      setObsDraft("");
                                    }}
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>

                      {/* Ações */}
                      {canEdit && (
                        <TableCell className="py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-600"
                            onClick={() => handleRemoveDisc(idx)}
                            aria-label="Excluir disciplina"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}

                {/* Linha de adicionar */}
                {isAddingDisc && canEdit && (
                  <TableRow className="bg-primary/5">
                    <TableCell className="py-2">
                      <Select
                        value={newDisc.disciplina}
                        onValueChange={(v) => setNewDisc((p) => ({ ...p, disciplina: v }))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {disciplinasCatalog.map((d) => (
                            <SelectItem key={d.id} value={d.nome} className="text-xs">
                              {d.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground" colSpan={5}>
                      Defina os outros campos após adicionar
                    </TableCell>
                    <TableCell className="py-2" colSpan={2}>
                      <Select
                        value={newDisc.responsavel_id}
                        onValueChange={(v) => setNewDisc((p) => ({ ...p, responsavel_id: v }))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          {pessoas.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">
                              {p.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          className="h-7 w-7"
                          onClick={onAddDisc}
                          disabled={!newDisc.disciplina || !newDisc.responsavel_id}
                          aria-label="Adicionar disciplina"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setIsAddingDisc(false);
                            setNewDisc({ disciplina: "", responsavel_id: "" });
                          }}
                          aria-label="Cancelar"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Confirmação de conclusão */}
      <AlertDialog
        open={concludingIdx !== null}
        onOpenChange={(o) => {
          if (!o) setConcludingIdx(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar conclusão</AlertDialogTitle>
            <AlertDialogDescription>
              A disciplina <strong>{concludingIdx !== null && disciplinasLegacy[concludingIdx]?.disciplina}</strong>{" "}
              será marcada como <strong>Concluída</strong> e a data final será definida como{" "}
              <strong>{new Date().toLocaleDateString("pt-BR")}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-positive hover:bg-positive/90"
              onClick={async () => {
                if (concludingIdx === null) return;
                const idx = concludingIdx;
                setConcludingIdx(null);
                await applyDiscStatusChange(idx, "Concluído");
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Justificativa de atraso */}
      <AlertDialog
        open={!!justificativaDialog}
        onOpenChange={(o) => {
          if (!o) {
            setJustificativaDialog(null);
            setJustificativaText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Justificativa de atraso obrigatória
            </AlertDialogTitle>
            <AlertDialogDescription>
              A disciplina{" "}
              <strong>{justificativaDialog !== null && disciplinasLegacy[justificativaDialog.idx]?.disciplina}</strong>{" "}
              está atrasada. Informe a justificativa para continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label className="text-sm mb-2 block">Justificativa</Label>
            <Textarea
              value={justificativaText}
              onChange={(e) => setJustificativaText(e.target.value)}
              placeholder="Explique o motivo do atraso..."
              className="min-h-[80px]"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!justificativaText.trim()}
              className="bg-brand hover:bg-brand/90"
              onClick={async () => {
                if (!justificativaDialog || !justificativaText.trim()) return;
                await applyDiscStatusChange(
                  justificativaDialog.idx,
                  justificativaDialog.newStatus,
                  justificativaText.trim()
                );
                setJustificativaDialog(null);
                setJustificativaText("");
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface ResponsaveisCellProps {
  discIdx: number;
  disc: DisciplinaResponsavel;
  dbDisc: ProjetoDisciplinaDB | undefined;
  pessoas: { id: string; nome: string }[];
  canEdit: boolean;
  onAdd: (discIdx: number, responsavelId: string) => Promise<void>;
  onRemove: (discIdx: number, respIdx: number) => Promise<void>;
}

function ResponsaveisCell({ discIdx, disc, dbDisc, pessoas, canEdit, onAdd, onRemove }: ResponsaveisCellProps) {
  const [selectedToAdd, setSelectedToAdd] = useState("");
  const resps = dbDisc?.responsaveis || [];

  const display =
    resps.length === 0
      ? "Sem responsável"
      : resps.length === 1
        ? resps[0].nome
        : `${resps[0].nome} +${resps.length - 1}`;

  if (!canEdit) {
    return <span className="text-xs">{display}</span>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs justify-start max-w-full">
          <User className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
          <span className="truncate">{display}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Responsáveis de {disc.disciplina}</Label>
          <div className="space-y-1">
            {resps.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum responsável</p>
            ) : (
              resps.map((r, rIdx) => (
                <div key={r.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-muted/40">
                  <span className="text-xs flex items-center gap-1.5">
                    <User className="h-3 w-3" />
                    {r.nome}
                  </span>
                  {resps.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-red-600"
                      onClick={() => onRemove(discIdx, rIdx)}
                      aria-label="Remover responsável"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="flex gap-1.5 pt-1 border-t">
            <Select value={selectedToAdd} onValueChange={setSelectedToAdd}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Adicionar..." />
              </SelectTrigger>
              <SelectContent>
                {pessoas
                  .filter((p) => !resps.some((r) => r.id === p.id))
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              size="icon"
              className="h-8 w-8"
              disabled={!selectedToAdd}
              onClick={async () => {
                await onAdd(discIdx, selectedToAdd);
                setSelectedToAdd("");
              }}
              aria-label="Adicionar responsável"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
