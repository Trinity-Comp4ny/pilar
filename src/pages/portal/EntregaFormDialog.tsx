import { useState } from "react";
import { FormDialog } from "@/components/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/safeError";
import { useProjetoDisciplinas } from "@/hooks/useProjetoDisciplinas";
import { useAuth } from "@/contexts/AuthContext";

// Mesmo formato exigido pelo CHECK constraint de portal_entregas.drive_url no banco.
const DRIVE_URL_PATTERN = /^https:\/\/(drive|docs)\.google\.com\/.+/;

// Mesmos valores do CHECK constraint portal_entregas_tipo_check no banco.
const TIPO_OPTIONS = [
  { value: "documento", label: "Documento" },
  { value: "aprovacao", label: "Aprovação" },
  { value: "informacao", label: "Informação" },
];

interface EntregaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoId: string;
  onCreated: () => void;
}

export function EntregaFormDialog({ open, onOpenChange, projetoId, onCreated }: EntregaFormDialogProps) {
  const { profile } = useAuth();
  const disciplinas = useProjetoDisciplinas(projetoId);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [disciplinaId, setDisciplinaId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const urlValida = !driveUrl.trim() || DRIVE_URL_PATTERN.test(driveUrl.trim());

  const limpar = () => {
    setTitulo("");
    setTipo("");
    setDescricao("");
    setDriveUrl("");
    setDisciplinaId("");
  };

  const handleSubmit = async () => {
    if (!titulo.trim() || !urlValida || !profile?.empresa_id) return;
    setSaving(true);
    const { error } = await supabase.from("portal_entregas").insert({
      empresa_id: profile.empresa_id,
      projeto_id: projetoId,
      titulo: titulo.trim(),
      tipo: tipo.trim() || null,
      descricao: descricao.trim() || null,
      drive_url: driveUrl.trim() || null,
      projeto_disciplina_id: disciplinaId || null,
      status: "pendente",
    } as never);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível criar a entrega", {
        description: getSafeErrorMessage(error, "Tente de novo em instantes."),
      });
      return;
    }
    toast.success("Entrega criada");
    limpar();
    onOpenChange(false);
    onCreated();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nova entrega"
      description="O cliente vai ver isso no portal dele e poder aprovar ou pedir revisão."
      size="md"
      onSubmit={handleSubmit}
      submitLabel="Criar entrega"
      isPending={saving}
      submitDisabled={!titulo.trim() || !urlValida}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="entrega-titulo">Título</Label>
          <Input
            id="entrega-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Anteprojeto revisado"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {TIPO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Etapa</Label>
            <Select value={disciplinaId} onValueChange={setDisciplinaId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem etapa vinculada" />
              </SelectTrigger>
              <SelectContent>
                {(disciplinas.data ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id!}>
                    {d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="entrega-descricao">Descrição</Label>
          <Textarea
            id="entrega-descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhes do que está sendo entregue..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="entrega-drive-url">Link do Google Drive</Label>
          <Input
            id="entrega-drive-url"
            value={driveUrl}
            onChange={(e) => setDriveUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
          />
          {!urlValida && (
            <p className="text-xs text-danger-mid">Precisa ser um link do drive.google.com ou docs.google.com</p>
          )}
        </div>
      </div>
    </FormDialog>
  );
}
