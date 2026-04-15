import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical } from "lucide-react";
import {
  type TemplateFase,
  type TemplateDisciplina,
  type TemplateChecklistItem,
  type TemplateInsert,
  type TemplateProjeto,
  TIPOS_SERVICO,
} from "@/hooks/useTemplates";

interface TemplateFormProps {
  template?: TemplateProjeto;
  onSubmit: (data: TemplateInsert) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const DISCIPLINAS_PADRAO = [
  "Arquitetônico",
  "Estrutural",
  "Estrutura Metálica",
  "Alvenaria Estrutural",
  "Elétrico",
  "Hidráulico",
  "Hidrossanitário",
  "Automação",
  "Climatização/Exaustão",
  "Gases Medicinais",
  "Sistema Fotovoltaico",
  "PPCI",
  "AVCB",
  "SPDA",
];

export function TemplateForm({ template, onSubmit, onCancel, isLoading }: TemplateFormProps) {
  const [nome, setNome] = useState(template?.nome || "");
  const [tipoServico, setTipoServico] = useState(template?.tipo_servico || "");
  const [descricao, setDescricao] = useState(template?.descricao || "");
  const [fases, setFases] = useState<TemplateFase[]>(template?.fases || []);
  const [checklist, setChecklist] = useState<TemplateChecklistItem[]>(template?.checklist || []);
  const [newCheckItem, setNewCheckItem] = useState("");

  const addFase = () => {
    setFases([...fases, { nome: "", disciplinas: [], duracao_dias: 30 }]);
  };

  const removeFase = (index: number) => {
    setFases(fases.filter((_, i) => i !== index));
  };

  const updateFase = (index: number, field: keyof TemplateFase, value: string | number | TemplateDisciplina[]) => {
    const updated = [...fases];
    updated[index] = { ...updated[index], [field]: value };
    setFases(updated);
  };

  const addDisciplinaToFase = (faseIndex: number, disciplina: string) => {
    if (!disciplina) return;
    const updated = [...fases];
    const exists = updated[faseIndex].disciplinas.some((d) => d.disciplina === disciplina);
    if (exists) return;
    updated[faseIndex].disciplinas.push({ disciplina, horas_estimadas: 0, riscos: [] });
    setFases(updated);
  };

  const removeDisciplinaFromFase = (faseIndex: number, discIndex: number) => {
    const updated = [...fases];
    updated[faseIndex].disciplinas.splice(discIndex, 1);
    setFases(updated);
  };

  const updateDisciplinaHoras = (faseIndex: number, discIndex: number, horas: number) => {
    const updated = [...fases];
    updated[faseIndex].disciplinas[discIndex].horas_estimadas = horas;
    setFases(updated);
  };

  const addChecklistItem = () => {
    if (!newCheckItem.trim()) return;
    setChecklist([...checklist, { item: newCheckItem.trim(), obrigatorio: false }]);
    setNewCheckItem("");
  };

  const removeChecklistItem = (index: number) => {
    setChecklist(checklist.filter((_, i) => i !== index));
  };

  const toggleChecklistObrigatorio = (index: number) => {
    const updated = [...checklist];
    updated[index].obrigatorio = !updated[index].obrigatorio;
    setChecklist(updated);
  };

  const handleSubmit = () => {
    if (!nome.trim() || !tipoServico) return;
    onSubmit({
      nome: nome.trim(),
      tipo_servico: tipoServico,
      descricao: descricao.trim() || undefined,
      fases,
      checklist,
    });
  };

  return (
    <div className="space-y-6">
      {/* Dados básicos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome do Template *</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Residencial Alto Padrão" />
        </div>
        <div className="space-y-2">
          <Label>Tipo de Serviço *</Label>
          <Select value={tipoServico} onValueChange={setTipoServico}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_SERVICO.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {tipo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descrição do template..."
          rows={2}
        />
      </div>

      {/* Fases */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Fases</Label>
          <Button variant="outline" size="sm" onClick={addFase}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Fase
          </Button>
        </div>

        {fases.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma fase adicionada. Clique em "+ Fase" para começar.
          </p>
        )}

        {fases.map((fase, fi) => (
          <Card key={fi}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  value={fase.nome}
                  onChange={(e) => updateFase(fi, "nome", e.target.value)}
                  placeholder="Nome da fase"
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={fase.duracao_dias}
                  onChange={(e) => updateFase(fi, "duracao_dias", parseInt(e.target.value) || 0)}
                  className="w-20"
                  min={1}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">dias</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeFase(fi)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Disciplinas da fase */}
              <div className="pl-6 space-y-2">
                <div className="flex items-center gap-2">
                  <Select onValueChange={(val) => addDisciplinaToFase(fi, val)}>
                    <SelectTrigger className="h-8 text-xs w-[200px]">
                      <SelectValue placeholder="+ Disciplina" />
                    </SelectTrigger>
                    <SelectContent>
                      {DISCIPLINAS_PADRAO.filter((d) => !fase.disciplinas.some((fd) => fd.disciplina === d)).map(
                        (d) => (
                          <SelectItem key={d} value={d} className="text-xs">
                            {d}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {fase.disciplinas.map((disc, di) => (
                  <div key={di} className="flex items-center gap-2 text-xs">
                    <Badge variant="secondary" className="text-xs">
                      {disc.disciplina}
                    </Badge>
                    <Input
                      type="number"
                      value={disc.horas_estimadas || ""}
                      onChange={(e) => updateDisciplinaHoras(fi, di, parseFloat(e.target.value) || 0)}
                      className="h-7 w-20 text-xs"
                      placeholder="Horas"
                      min={0}
                    />
                    <span className="text-muted-foreground">h</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeDisciplinaFromFase(fi, di)}
                    >
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Checklist */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Checklist de Documentação</Label>
        <div className="flex items-center gap-2">
          <Input
            value={newCheckItem}
            onChange={(e) => setNewCheckItem(e.target.value)}
            placeholder="Novo item do checklist"
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
          />
          <Button variant="outline" size="sm" onClick={addChecklistItem}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {checklist.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <Badge
              variant={item.obrigatorio ? "default" : "secondary"}
              className="cursor-pointer text-xs"
              onClick={() => toggleChecklistObrigatorio(i)}
            >
              {item.obrigatorio ? "Obrigatório" : "Opcional"}
            </Badge>
            <span className="flex-1">{item.item}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeChecklistItem(i)}>
              <Trash2 className="h-3 w-3 text-red-400" />
            </Button>
          </div>
        ))}
      </div>

      {/* Ações */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={isLoading || !nome.trim() || !tipoServico}>
          {template ? "Salvar Alterações" : "Criar Template"}
        </Button>
      </div>
    </div>
  );
}
