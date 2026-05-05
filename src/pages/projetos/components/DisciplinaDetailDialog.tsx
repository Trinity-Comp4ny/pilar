import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, MessageSquare } from "lucide-react";
import { PROJECT_PRIORITY, PRIORITY_OPTIONS, PROJECT_PRIORITY_CONFIG } from "@/constants";
import { type DisciplinaResponsavel, disciplinaStatusOptions } from "@/types/projetos";
import { DatePicker } from "@/components/ui/date-picker";

interface DisciplinaDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disciplina: DisciplinaResponsavel | null;
  disciplinas: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
  onUpdateField: (field: keyof DisciplinaResponsavel, value: string) => void;
  onUpdateResponsavel: (val: string, nome: string) => void;
  newObservation: string;
  onNewObservationChange: (val: string) => void;
  onAddObservation: () => void;
}

export function DisciplinaDetailDialog({
  open,
  onOpenChange,
  disciplina,
  disciplinas,
  pessoas,
  onUpdateField,
  onUpdateResponsavel,
  newObservation,
  onNewObservationChange,
  onAddObservation,
}: DisciplinaDetailDialogProps) {
  if (!disciplina) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalhes da Disciplina</DialogTitle>
          <DialogDescription>
            {disciplina.disciplina} - {disciplina.responsavel_nome}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Disciplina</Label>
              <Select value={disciplina.disciplina} onValueChange={(val) => onUpdateField("disciplina", val)}>
                <SelectTrigger>
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
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select
                value={disciplina.responsavel_id}
                onValueChange={(val) => {
                  const pessoa = pessoas.find((p) => p.id === val);
                  onUpdateResponsavel(val, pessoa?.nome || "");
                }}
              >
                <SelectTrigger>
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
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={disciplina.status} onValueChange={(val) => onUpdateField("status", val)}>
                <SelectTrigger>
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
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select
                value={disciplina.prioridade || PROJECT_PRIORITY.MEDIA}
                onValueChange={(val) => onUpdateField("prioridade", val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            p === PROJECT_PRIORITY.ALTA
                              ? "bg-red-500"
                              : p === PROJECT_PRIORITY.MEDIA
                                ? "bg-amber-400"
                                : "bg-blue-400"
                          }`}
                        />
                        {PROJECT_PRIORITY_CONFIG[p].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Início</Label>
              <DatePicker
                value={(disciplina.data_inicio || "").slice(0, 10) || undefined}
                onChange={(v) => onUpdateField("data_inicio", v)}
                placeholder="dd/mm/aaaa"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Previsão</Label>
              <DatePicker
                value={(disciplina.data_previsao || "").slice(0, 10) || undefined}
                onChange={(v) => onUpdateField("data_previsao", v)}
                placeholder="dd/mm/aaaa"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Final</Label>
              <DatePicker
                value={(disciplina.data_final || "").slice(0, 10) || undefined}
                onChange={(v) => onUpdateField("data_final", v)}
                placeholder="dd/mm/aaaa"
              />
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <Label className="flex items-center gap-2">
              <MessageSquare size={16} /> Observações
            </Label>

            <div className="bg-gray-50 rounded-lg p-3 h-48 overflow-y-auto space-y-3">
              {disciplina.observacoes?.length === 0 ? (
                <p className="text-xs text-center text-gray-400 py-4">Nenhuma observação registrada</p>
              ) : (
                disciplina.observacoes?.map((obs, i) => (
                  <div key={i} className="bg-white p-2 rounded border shadow-sm text-sm">
                    <p className="text-gray-800">{obs.texto}</p>
                    <div className="flex justify-between items-center mt-1 text-[10px] text-gray-400">
                      <span>{obs.usuario}</span>
                      <span>{new Date(obs.data).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Nova observação..."
                value={newObservation}
                onChange={(e) => onNewObservationChange(e.target.value)}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
